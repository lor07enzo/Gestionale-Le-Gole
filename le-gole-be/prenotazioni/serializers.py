from rest_framework import serializers
from .models import (
    PrenotazionePiscina,
    PrenotazioneAsporto,
    PrenotazionePadel,
    NoleggioRacchetta,
    OccupazionePostazione,
    GiornoPienoPiscina,
)
# Import "verticale" a livello di modulo verso struttura, già usato da prenotazioni.models:
# nessun ciclo, a differenza della dipendenza verso `menu` in PrenotazioneAsportoSerializer
# (che resta locale alla funzione proprio perché `menu` importa da qui).
from struttura.models import ConfigurazionePadel, GiornoChiusoPadel, PiscinaInventario
from .utils import calcola_disponibilita, slot_padel_libero

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

        configurazione = ConfigurazioneAsporto.get_solo()

        # Servizio disattivato e "giorno chiuso" bloccano solo i nuovi ordini self-service
        # pubblici, non lo staff — stesso principio di GiornoPienoPiscina/ConfigurazionePadel.attivo
        # sopra/sotto: lo staff ha visibilità diretta sulla cucina e può comunque registrare un
        # ordine manuale nonostante il canale online sia spento o il giorno segnato come chiuso.
        request = self.context.get('request')
        is_richiesta_pubblica = not (request and request.user and request.user.is_authenticated)
        if is_richiesta_pubblica:
            if not configurazione.attivo:
                raise serializers.ValidationError({
                    "non_field_errors": "Il servizio asporto non è al momento disponibile per l'ordine online."
                })
            if data_richiesta and GiornoChiusoAsporto.objects.filter(data=data_richiesta).exists():
                raise serializers.ValidationError({
                    "data": "Il servizio asporto è chiuso in questa data: non è possibile effettuare nuovi ordini online."
                })

        # L'orario di ritiro, invece, è vincolato per chiunque (staff incluso) — riflette quando
        # la cucina prepara davvero gli ordini, non solo il canale online, stesso trattamento
        # unconditional già riservato all'orario apertura/chiusura piscina sopra.
        if ora_richiesta:
            # orario_valido() accetta il primo turno o, se configurato, il secondo (pranzo/cena) —
            # descrizione_orari() elenca entrambi nel messaggio d'errore quando pertinente.
            if not configurazione.orario_valido(ora_richiesta):
                raise serializers.ValidationError({
                    "ora": f"Il servizio asporto è attivo {configurazione.descrizione_orari()}."
                })

            # Limite di capacità per orario di ritiro (ConfigurazioneAsporto.limite_prenotazioni_orario,
            # 2026-08-28 — sostituisce il precedente limite sui prodotti, sezione 15 di CLAUDE.md):
            # un unico valore globale, applicato automaticamente a *qualunque* orario, che conta il
            # numero di PRENOTAZIONI (ordini distinti) già confermate/in attesa per quella data+ora,
            # non la somma delle quantità in esse. Vincolato per chiunque, staff incluso, stesso
            # principio dell'orario apertura/chiusura appena sopra — riflette quanti ordini separati
            # la cucina/lo staff può gestire nella stessa finestra, non un gate solo sul self-service.
            limite_prenotazioni = configurazione.limite_prenotazioni_orario
            if limite_prenotazioni is not None:
                qs = PrenotazioneAsporto.objects.filter(
                    data=data_richiesta, ora=ora_richiesta
                ).exclude(stato='CANCELLED')
                if instance is not None:
                    # Su un update che non cambia data/ora, l'istanza corrente va esclusa dal
                    # proprio stesso conteggio — altrimenti bloccherebbe un PATCH che non tocca
                    # affatto l'orario non appena il limite fosse già "raggiunto" da lei stessa.
                    qs = qs.exclude(pk=instance.pk)
                gia_prenotate = qs.count()
                if gia_prenotate >= limite_prenotazioni:
                    raise serializers.ValidationError({
                        "ora": (
                            f"Limite raggiunto per l'orario {ora_richiesta.strftime('%H:%M')}: "
                            f"massimo {limite_prenotazioni} prenotazioni."
                        )
                    })

        return data


class PrenotazionePadelSerializer(serializers.ModelSerializer):
    # Comodi per il frontend (staff): evitano una join lato client con /users/clienti/, stesso
    # pattern degli altri due serializer di prenotazione.
    cliente_nome = serializers.CharField(source='cliente_id.nome', read_only=True)
    cliente_telefono = serializers.CharField(source='cliente_id.telefono', read_only=True)
    # Property del modello, calcolate dagli snapshot e mai persistite.
    totale = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    orario_fine = serializers.TimeField(read_only=True)
    racchette_totali = serializers.IntegerField(read_only=True)
    # Righe di noleggio annidate in sola lettura: si creano/modificano dal proprio endpoint
    # (/noleggi-racchetta/), ma leggerle qui evita al frontend una seconda richiesta per ogni
    # prenotazione mostrata — a differenza dell'asporto, dove le VoceOrdine restano separate
    # perché un ordine può averne molte, qui sono al massimo una per marca a catalogo.
    noleggi = serializers.SerializerMethodField()

    class Meta:
        model = PrenotazionePadel
        fields = '__all__'
        # Snapshot di durata/prezzi: sempre copiati server-side dalla configurazione corrente in
        # PrenotazionePadelViewSet.perform_create(), mai accettati dal client — 'create' è
        # pubblica, un chiamante anonimo non deve poter decidere quanto paga (stesso identico
        # principio di menu.VoceOrdineSerializer.prezzo_unitario).
        read_only_fields = ['durata_minuti', 'prezzo_partita', 'prezzo_palline']

    def get_noleggi(self, obj):
        return NoleggioRacchettaSerializer(
            obj.noleggi.select_related('racchetta').all(), many=True
        ).data

    def validate(self, data):
        # Un PATCH parziale invia solo i campi cambiati: per quelli omessi ricadiamo sui valori
        # già presenti sull'istanza — stesso pattern degli altri due serializer.
        instance = self.instance
        data_richiesta = data.get('data', instance.data if instance else None)
        ora_richiesta = data.get('ora', instance.ora if instance else None)

        configurazione = ConfigurazionePadel.get_solo()
        request = self.context.get('request')
        is_richiesta_pubblica = not (request and request.user and request.user.is_authenticated)

        # Servizio disattivato e giorni di chiusura bloccano solo il canale self-service, mai lo
        # staff — stesso principio di GiornoPienoPiscina/GiornoChiusoAsporto: lo staff ha
        # visibilità diretta sul campo e può comunque registrare una partita al banco.
        if is_richiesta_pubblica:
            if not configurazione.attivo:
                raise serializers.ValidationError({
                    "non_field_errors": "Il servizio padel non è al momento disponibile per la prenotazione online."
                })
            if data_richiesta and GiornoChiusoPadel.objects.filter(data=data_richiesta).exists():
                raise serializers.ValidationError({
                    "data": "Il campo da padel è chiuso in questa data: non è possibile prenotare online."
                })

        # Da qui in poi i vincoli valgono per chiunque, staff incluso: riflettono la disponibilità
        # fisica reale del campo, non le regole del solo canale online.
        if ora_richiesta:
            # L'orario deve cadere esattamente su uno slot della griglia: un orario disallineato
            # creerebbe una partita a cavallo di due slot, di fatto occupandone due (vedi
            # ConfigurazionePadel.orario_valido).
            if not configurazione.orario_valido(ora_richiesta):
                orari = ", ".join(o.strftime('%H:%M') for o in configurazione.slot_disponibili())
                raise serializers.ValidationError({
                    "ora": (
                        f"Orario non valido: il campo è prenotabile {configurazione.descrizione_orari()} "
                        f"in partite da {configurazione.durata_partita_minuti} minuti"
                        + (f" (orari disponibili: {orari})." if orari else ".")
                    )
                })

            # Anti-overbooking: un solo campo, quindi due partite non possono sovrapporsi. Su un
            # update si usa lo snapshot di durata della prenotazione stessa, non quello corrente
            # della configurazione, e la si esclude dal proprio conteggio.
            durata = instance.durata_minuti if instance else configurazione.durata_partita_minuti
            if not slot_padel_libero(
                data_richiesta, ora_richiesta, durata,
                exclude_id=instance.id if instance else None,
            ):
                raise serializers.ValidationError({
                    "ora": f"Il campo è già prenotato alle {ora_richiesta.strftime('%H:%M')} in questa data."
                })

        partecipanti = data.get('partecipanti', instance.partecipanti if instance else None)
        if partecipanti is not None:
            if partecipanti < 1:
                raise serializers.ValidationError({"partecipanti": "Serve almeno un partecipante."})
            if partecipanti > configurazione.max_partecipanti:
                raise serializers.ValidationError({
                    "partecipanti": f"Il campo ammette al massimo {configurazione.max_partecipanti} partecipanti."
                })

            # Le racchette non sono un contatore su questo modello ma righe a sé
            # (NoleggioRacchetta, che valida a sua volta il tetto quando se ne aggiunge una):
            # qui va coperta la direzione opposta, cioè abbassare i partecipanti sotto il numero
            # di racchette già noleggiate.
            if instance is not None and instance.racchette_totali > partecipanti:
                raise serializers.ValidationError({
                    "partecipanti": (
                        f"Ci sono già {instance.racchette_totali} racchette noleggiate: "
                        f"rimuovile prima di scendere a {partecipanti} partecipanti."
                    )
                })

        return data


class NoleggioRacchettaSerializer(serializers.ModelSerializer):
    # Comodi per il frontend: evitano una join per mostrare marca e costo della riga.
    racchetta_nome = serializers.CharField(source='racchetta.nome', read_only=True)
    subtotale = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    # Il campo modello (PositiveSmallIntegerField) accetterebbe anche 0: una riga di noleggio da
    # zero racchette non ha senso, si elimina la riga.
    quantita = serializers.IntegerField(min_value=1, default=1)

    class Meta:
        model = NoleggioRacchetta
        fields = '__all__'
        # Mai fidarsi di un prezzo inviato dal client: prezzo_unitario è sempre uno snapshot
        # server-side di RacchettaPadel.prezzo_noleggio, impostato da
        # NoleggioRacchettaViewSet.perform_create() — stesso identico principio di
        # menu.VoceOrdineSerializer.prezzo_unitario.
        read_only_fields = ['prezzo_unitario']

    def validate_racchetta(self, racchetta):
        # Una racchetta tolta dal noleggio online resta registrabile dallo staff (potrebbe averla
        # comunque data a mano) — stesso principio di VoceOrdineSerializer.validate_prodotto.
        request = self.context.get('request')
        is_richiesta_pubblica = not (request and request.user and request.user.is_authenticated)
        if is_richiesta_pubblica and not racchetta.disponibile:
            raise serializers.ValidationError("Questa racchetta non è al momento disponibile per il noleggio.")
        return racchetta

    def validate(self, data):
        instance = self.instance
        prenotazione = data.get('prenotazione', instance.prenotazione if instance else None)
        racchetta = data.get('racchetta', instance.racchetta if instance else None)
        quantita = data.get('quantita', instance.quantita if instance else 1)

        # Pezzi realmente posseduti: un tetto per prenotazione, non una disponibilità da calcolare
        # per data/ora — con un solo campo esiste sempre al massimo una partita per fascia oraria,
        # quindi le racchette non sono mai contese tra prenotazioni diverse (sezione 16).
        if racchetta is not None and quantita > racchetta.quantita_disponibile:
            raise serializers.ValidationError({
                "quantita": (
                    f"Sono disponibili solo {racchetta.quantita_disponibile} racchette "
                    f"«{racchetta.nome}»."
                )
            })

        # Vincolo per chiunque, staff incluso: noleggiare più racchette dei giocatori presenti non
        # ha senso. Va contato sull'intera prenotazione, non sulla singola riga, altrimenti tre
        # righe da una racchetta ciascuna aggirerebbero il limite di due partecipanti.
        if prenotazione is not None:
            altre_righe = prenotazione.noleggi.all()
            if instance is not None:
                altre_righe = altre_righe.exclude(pk=instance.pk)
            gia_noleggiate = sum(riga.quantita for riga in altre_righe)
            if gia_noleggiate + quantita > prenotazione.partecipanti:
                raise serializers.ValidationError({
                    "quantita": (
                        f"Non puoi noleggiare più racchette dei partecipanti "
                        f"({prenotazione.partecipanti}): ne risulterebbero "
                        f"{gia_noleggiate + quantita}."
                    )
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