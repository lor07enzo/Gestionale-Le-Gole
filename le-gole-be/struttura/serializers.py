from rest_framework import serializers
from .models import (
    ConfigurazionePadel,
    GiornoChiusoPadel,
    PiscinaInventario,
    Postazione,
    RacchettaPadel,
)

class PiscinaInventarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = PiscinaInventario
        fields = '__all__'


class PostazioneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Postazione
        exclude = ['deleted_at']

    def validate_pos_x(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("pos_x deve essere compreso tra 0 e 100.")
        return value

    def validate_pos_y(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("pos_y deve essere compreso tra 0 e 100.")
        return value

    def _validate_numero_univoco(self, data, inventario, numero):
        # DRF non genera un validator per i UniqueConstraint condizionali (vedi Postazione.Meta),
        # quindi lo replichiamo qui per un 400 leggibile invece di un IntegrityError grezzo.
        if inventario is None or numero is None:
            return
        conflitti = Postazione.objects.filter(
            inventario=inventario, numero=numero, deleted_at__isnull=True
        )
        if self.instance:
            conflitti = conflitti.exclude(pk=self.instance.pk)
        if conflitti.exists():
            raise serializers.ValidationError(
                {"numero": "Numero già in uso per questo inventario."}
            )

    def _validate_capacita_tipo(self, data, inventario):
        # Limite solo in creazione: se il totale viene abbassato dopo, le postazioni in eccesso
        # restano comunque modificabili.
        if self.instance is not None:
            return
        tipo = data.get('tipo')
        if inventario is None or tipo is None:
            return
        totale = inventario.totale_ombrelloni if tipo == 'OMBRELLONE' else inventario.totale_gazebi
        attive = Postazione.objects.filter(
            inventario=inventario, tipo=tipo, deleted_at__isnull=True
        ).count()
        if attive >= totale:
            etichetta = 'ombrelloni' if tipo == 'OMBRELLONE' else 'gazebi'
            raise serializers.ValidationError(
                {"tipo": f"Limite raggiunto: il listino prevede al massimo {totale} {etichetta}."}
            )

    def validate(self, data):
        inventario = data.get('inventario', self.instance.inventario if self.instance else None)
        numero = data.get('numero', self.instance.numero if self.instance else None)
        self._validate_numero_univoco(data, inventario, numero)
        self._validate_capacita_tipo(data, inventario)
        return data

class ConfigurazionePadelSerializer(serializers.ModelSerializer):
    # min_value espliciti: i PositiveSmallIntegerField accetterebbero 0 (una partita da zero
    # minuti o senza alcun partecipante ammesso non ha senso) e i DecimalField accetterebbero
    # importi negativi. Stesso principio di ConfigurazioneAsportoSerializer.limite_prenotazioni_orario.
    durata_partita_minuti = serializers.IntegerField(min_value=1, required=False)
    max_partecipanti = serializers.IntegerField(min_value=1, required=False)
    prezzo_partita = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0, required=False)
    prezzo_noleggio_palline = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0, required=False)
    # Sola lettura, comodo per il frontend: gli orari di inizio realmente prenotabili derivati
    # dalla configurazione corrente, così il picker non deve ricalcolare la griglia da sé.
    slot_disponibili = serializers.SerializerMethodField()

    class Meta:
        model = ConfigurazionePadel
        fields = [
            'id', 'attivo', 'orario_apertura', 'orario_chiusura',
            'durata_partita_minuti', 'prezzo_partita', 'max_partecipanti',
            'prezzo_noleggio_palline',
            'slot_disponibili', 'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']

    def get_slot_disponibili(self, obj):
        return [ora.strftime('%H:%M') for ora in obj.slot_disponibili()]

    def validate(self, data):
        # Su un PATCH parziale un campo omesso ricade sul valore già presente sull'istanza —
        # stesso pattern di ConfigurazioneAsportoSerializer.validate().
        apertura = data.get('orario_apertura', getattr(self.instance, 'orario_apertura', None))
        chiusura = data.get('orario_chiusura', getattr(self.instance, 'orario_chiusura', None))
        durata = data.get('durata_partita_minuti', getattr(self.instance, 'durata_partita_minuti', None))

        if apertura is not None and chiusura is not None:
            if apertura >= chiusura:
                raise serializers.ValidationError(
                    {"orario_chiusura": "L'orario di chiusura deve essere successivo a quello di apertura."}
                )

            # Una durata più lunga dell'intera finestra di apertura produrrebbe zero slot: il
            # servizio risulterebbe attivo ma senza alcun orario prenotabile, uno stato senza
            # sintomi evidenti finché un cliente non prova a prenotare.
            if durata is not None:
                finestra_minuti = (
                    (chiusura.hour * 60 + chiusura.minute) - (apertura.hour * 60 + apertura.minute)
                )
                if durata > finestra_minuti:
                    raise serializers.ValidationError({
                        "durata_partita_minuti": (
                            f"La durata di una partita ({durata} min) supera l'orario di apertura "
                            f"({finestra_minuti} min): nessun orario risulterebbe prenotabile."
                        )
                    })
        return data


class GiornoChiusoPadelSerializer(serializers.ModelSerializer):
    class Meta:
        model = GiornoChiusoPadel
        fields = ['id', 'data', 'created_at']
        read_only_fields = ['id', 'created_at']
        # `data` è unique=True sul modello: DRF genera da sé un UniqueValidator leggibile
        # (stesso principio di GiornoChiusoAsportoSerializer).


class RacchettaPadelSerializer(serializers.ModelSerializer):
    # min_value espliciti, stesso motivo di ConfigurazionePadelSerializer: il DecimalField
    # accetterebbe un prezzo negativo e il PositiveSmallIntegerField accetterebbe 0 pezzi
    # (una racchetta di cui non si possiede alcun esemplare non è noleggiabile — per toglierla
    # temporaneamente dal noleggio esiste `disponibile`).
    prezzo_noleggio = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0)
    quantita_disponibile = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = RacchettaPadel
        fields = '__all__'
        # `nome` è unique=True sul modello: DRF genera da sé un UniqueValidator leggibile
        # (stesso principio di Categoria.nome/Allergene.nome).
