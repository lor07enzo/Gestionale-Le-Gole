from rest_framework import serializers
from .models import PrenotazionePiscina, PrenotazioneAsporto, OccupazionePostazione, GiornoPienoPiscina
from struttura.models import PiscinaInventario
from .utils import calcola_disponibilita

class PrenotazionePiscinaSerializer(serializers.ModelSerializer):
    # Comodo per il frontend (es. mappa postazioni): evita una join lato client con /users/clienti/
    cliente_nome = serializers.CharField(source='cliente_id.nome', read_only=True)
    cliente_telefono = serializers.CharField(source='cliente_id.telefono', read_only=True)
    # Usato dal pannello notifiche staff, che elenca prenotazioni di piscine diverse.
    inventario_nome = serializers.CharField(source='inventario.nome', read_only=True)

    class Meta:
        model = PrenotazionePiscina
        fields = '__all__'

    def validate(self, data):
        # Un PATCH parziale invia solo i campi cambiati: per quelli omessi ricadiamo sui valori
        # già presenti sull'istanza.
        instance = self.instance
        data_richiesta = data.get('data', instance.data if instance else None)
        ora_richiesta = data.get('ora', instance.ora if instance else None)
        inventario = data.get('inventario', instance.inventario if instance else None)

        # "Giorno pieno" blocca solo le nuove prenotazioni self-service pubbliche, non lo staff.
        request = self.context.get('request')
        is_richiesta_pubblica = not (request and request.user and request.user.is_authenticated)
        if is_richiesta_pubblica and GiornoPienoPiscina.objects.filter(
            inventario=inventario, data=data_richiesta
        ).exists():
            raise serializers.ValidationError({
                "data": "Il giorno selezionato è al completo: non è possibile effettuare nuove prenotazioni online per questa data."
            })

        # Verifichiamo se l'orario richiesto è fuori dal range del listino attivo
        if ora_richiesta:
            if ora_richiesta < inventario.orario_apertura or ora_richiesta > inventario.orario_chiusura:
                raise serializers.ValidationError({
                    "ora": f"La piscina è aperta dalle {inventario.orario_apertura.strftime('%H:%M')} alle {inventario.orario_chiusura.strftime('%H:%M')}."
                })

            ingressi_ridotti_richiesti = data.get(
                'ingressi_ridotti', instance.ingressi_ridotti if instance else 0
            )
            if ingressi_ridotti_richiesti and ora_richiesta < inventario.orario_inizio_ridotto:
                raise serializers.ValidationError({
                    "ingressi_ridotti": f"L'ingresso ridotto pomeridiano è disponibile dalle {inventario.orario_inizio_ridotto.strftime('%H:%M')}."
                })

            # Complementare al controllo sopra, applicato solo se la tariffa ridotta è configurata.
            ingressi_interi_richiesti = data.get('ingressi', instance.ingressi if instance else 0)
            if (
                ingressi_interi_richiesti
                and inventario.prezzo_ingresso_ridotto > 0
                and ora_richiesta >= inventario.orario_inizio_ridotto
            ):
                raise serializers.ValidationError({
                    "ingressi": f"Dalle {inventario.orario_inizio_ridotto.strftime('%H:%M')} è disponibile solo l'ingresso ridotto pomeridiano: usa gli ingressi ridotti invece di quelli interi."
                })

        # Recuperiamo la PK in caso di aggiornamento (patch/put) per escludere la prenotazione corrente dal conteggio
        instance_id = instance.id if instance else None

        residui = calcola_disponibilita(inventario, data_richiesta, exclude_id=instance_id)

        # Controllo Anti-Overbooking
        richiesta_ombrelloni = data.get('ombrellone', instance.ombrellone if instance else 0)
        if richiesta_ombrelloni > residui['ombrellone']:
            raise serializers.ValidationError({"ombrellone": f"Disponibilità ombrelloni esaurita. Residui: {residui['ombrellone']}"})

        richiesta_gazebi = data.get('gazebo', instance.gazebo if instance else 0)
        if richiesta_gazebi > residui['gazebo']:
            raise serializers.ValidationError({"gazebo": f"Disponibilità gazebi esaurita. Residui: {residui['gazebo']}"})

        richiesta_lettini = data.get('lettino', instance.lettino if instance else 0)
        if richiesta_lettini > residui['lettino']:
            raise serializers.ValidationError({"lettino": f"Disponibilità lettini esaurita. Residui: {residui['lettino']}"})

        richiesta_sdraie = data.get('sdraia', instance.sdraia if instance else 0)
        if richiesta_sdraie > residui['sdraia']:
            raise serializers.ValidationError({"sdraia": f"Disponibilità sdraie esaurita. Residui: {residui['sdraia']}"})

        return data


class PrenotazioneAsportoSerializer(serializers.ModelSerializer):
    # Comodo per il frontend (staff): evita una join lato client con /users/clienti/, stesso
    # pattern di PrenotazionePiscinaSerializer.
    cliente_nome = serializers.CharField(source='cliente_id.nome', read_only=True)
    cliente_telefono = serializers.CharField(source='cliente_id.telefono', read_only=True)
    # Property del modello: somma a runtime le menu.VoceOrdine collegate, mai persistito.
    totale = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)

    class Meta:
        model = PrenotazioneAsporto
        fields = '__all__'

    def validate(self, data):
        # Un PATCH parziale invia solo i campi cambiati: per quelli omessi ricadiamo sui valori
        # già presenti sull'istanza — stesso pattern di PrenotazionePiscinaSerializer.validate().
        instance = self.instance
        data_richiesta = data.get('data', instance.data if instance else None)
        ora_richiesta = data.get('ora', instance.ora if instance else None)

        # Import locale, non in cima al modulo: `menu.models` importa già `PrenotazioneAsporto`
        # da `prenotazioni.models` (sezione 1 di CLAUDE.md, dipendenza dichiarata "a senso unico"
        # menu -> prenotazioni). Questa validazione ha bisogno dei dati di configurazione
        # dell'asporto, che vivono in `menu` — la dipendenza diventa quindi bidirezionale solo per
        # questo punto, deliberatamente, e l'import resta locale alla funzione per non introdurre
        # anche a livello di modulo un riferimento incrociato tra le due app.
        from menu.models import ConfigurazioneAsporto, GiornoChiusoAsporto

        # "Giorno chiuso" blocca solo i nuovi ordini self-service pubblici, non lo staff — stesso
        # principio di GiornoPienoPiscina sopra: lo staff ha visibilità diretta sulla cucina e può
        # comunque registrare un ordine manuale nonostante il giorno segnato come chiuso online.
        request = self.context.get('request')
        is_richiesta_pubblica = not (request and request.user and request.user.is_authenticated)
        if is_richiesta_pubblica and data_richiesta and GiornoChiusoAsporto.objects.filter(
            data=data_richiesta
        ).exists():
            raise serializers.ValidationError({
                "data": "Il servizio asporto è chiuso in questa data: non è possibile effettuare nuovi ordini online."
            })

        # L'orario di ritiro, invece, è vincolato per chiunque (staff incluso) — riflette quando
        # la cucina prepara davvero gli ordini, non solo il canale online, stesso trattamento
        # unconditional già riservato all'orario apertura/chiusura piscina sopra.
        if ora_richiesta:
            configurazione = ConfigurazioneAsporto.get_solo()
            # orario_valido() accetta il primo turno o, se configurato, il secondo (pranzo/cena) —
            # descrizione_orari() elenca entrambi nel messaggio d'errore quando pertinente.
            if not configurazione.orario_valido(ora_richiesta):
                raise serializers.ValidationError({
                    "ora": f"Il servizio asporto è attivo {configurazione.descrizione_orari()}."
                })

        return data


class OccupazionePostazioneSerializer(serializers.ModelSerializer):
    class Meta:
        model = OccupazionePostazione
        fields = '__all__'


class GiornoPienoPiscinaSerializer(serializers.ModelSerializer):
    class Meta:
        model = GiornoPienoPiscina
        fields = '__all__'