from rest_framework import serializers
from .models import PrenotazionePiscina, OccupazionePostazione, GiornoPienoPiscina
from struttura.models import PiscinaInventario
from .utils import calcola_disponibilita

class PrenotazionePiscinaSerializer(serializers.ModelSerializer):
    # Comodo per il frontend (es. mappa postazioni): evita una join lato client con /users/clienti/
    cliente_nome = serializers.CharField(source='cliente_id.nome', read_only=True)
    cliente_telefono = serializers.CharField(source='cliente_id.telefono', read_only=True)
    # Usato dal pannello notifiche staff (azione 'recenti'), che elenca prenotazioni di piscine
    # diverse nella stessa lista: senza questo servirebbe una join lato frontend per mostrare a
    # quale piscina si riferisce ogni notifica.
    inventario_nome = serializers.CharField(source='inventario.nome', read_only=True)

    class Meta:
        model = PrenotazionePiscina
        fields = '__all__'

    def validate(self, data):
        # Un PATCH parziale (es. dal form di modifica prenotazione) invia solo i campi cambiati:
        # per i campi omessi ricadiamo sui valori già presenti sull'istanza, altrimenti
        # 'inventario'/'data' risulterebbero None e il controllo di disponibilità sotto fallirebbe.
        instance = self.instance
        data_richiesta = data.get('data', instance.data if instance else None)
        ora_richiesta = data.get('ora', instance.ora if instance else None)
        inventario = data.get('inventario', instance.inventario if instance else None)

        # "Giorno pieno" (sezione staff, GiornoPienoPiscinaViewSet) blocca solo le NUOVE
        # prenotazioni self-service pubbliche (create, utente anonimo) — non lo staff, che ha
        # visibilità diretta sulla mappa e può comunque registrare un walk-in nonostante il flag.
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

            # A differenza dell'età bambini (solo testo guida, non validata), l'orario ridotto
            # pomeridiano lega due campi della stessa prenotazione ed è verificabile davvero.
            ingressi_ridotti_richiesti = data.get(
                'ingressi_ridotti', instance.ingressi_ridotti if instance else 0
            )
            if ingressi_ridotti_richiesti and ora_richiesta < inventario.orario_inizio_ridotto:
                raise serializers.ValidationError({
                    "ingressi_ridotti": f"L'ingresso ridotto pomeridiano è disponibile dalle {inventario.orario_inizio_ridotto.strftime('%H:%M')}."
                })

            # Complementare al controllo sopra: dalla soglia in poi un ingresso intero andrebbe
            # venduto come ridotto. Si applica solo se la tariffa ridotta è configurata (prezzo >
            # 0), altrimenti la soglia è solo un default non realmente disponibile.
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


class OccupazionePostazioneSerializer(serializers.ModelSerializer):
    class Meta:
        model = OccupazionePostazione
        fields = '__all__'


class GiornoPienoPiscinaSerializer(serializers.ModelSerializer):
    class Meta:
        model = GiornoPienoPiscina
        fields = '__all__'