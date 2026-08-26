from django.db.models import Sum
from rest_framework import serializers
from .models import (
    Allergene,
    Categoria,
    ConfigurazioneAsporto,
    GiornoChiusoAsporto,
    Prodotto,
    VoceOrdine,
)


class ConfigurazioneAsportoSerializer(serializers.ModelSerializer):
    # min_value esplicito: PositiveSmallIntegerField accetterebbe anche 0, ma un limite a 0
    # prodotti non ha senso (per chiudere del tutto un giorno esiste già GiornoChiusoAsporto).
    # `required=False, allow_null=True` per poterlo lasciare/riportare a "nessun limite" (null) —
    # ModelSerializer li dedurrebbe comunque da `null=True, blank=True` sul modello, dichiarati
    # qui solo per accompagnarli esplicitamente al min_value.
    limite_prodotti_orario = serializers.IntegerField(min_value=1, required=False, allow_null=True)

    class Meta:
        model = ConfigurazioneAsporto
        fields = [
            'id', 'orario_apertura', 'orario_chiusura',
            'orario_apertura_2', 'orario_chiusura_2',
            'limite_prodotti_orario', 'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']

    def validate(self, data):
        # Su un PATCH parziale un campo omesso ricade sul valore già presente sull'istanza —
        # stesso pattern già usato da PrenotazionePiscinaSerializer.validate() per data/ora/inventario.
        apertura = data.get('orario_apertura', getattr(self.instance, 'orario_apertura', None))
        chiusura = data.get('orario_chiusura', getattr(self.instance, 'orario_chiusura', None))
        if apertura is not None and chiusura is not None and apertura >= chiusura:
            raise serializers.ValidationError(
                {"orario_chiusura": "L'orario di fine deve essere successivo a quello di inizio."}
            )

        # Secondo turno (pranzo/cena) — opzionale, entrambi i campi vanno impostati insieme o
        # lasciati entrambi vuoti (null), mai uno solo dei due.
        apertura_2 = data.get('orario_apertura_2', getattr(self.instance, 'orario_apertura_2', None))
        chiusura_2 = data.get('orario_chiusura_2', getattr(self.instance, 'orario_chiusura_2', None))
        if (apertura_2 is None) != (chiusura_2 is None):
            raise serializers.ValidationError({
                "orario_chiusura_2": "Imposta sia l'inizio sia la fine del secondo turno, oppure lasciali entrambi vuoti."
            })
        if apertura_2 is not None and chiusura_2 is not None:
            if apertura_2 >= chiusura_2:
                raise serializers.ValidationError({
                    "orario_chiusura_2": "L'orario di fine del secondo turno deve essere successivo a quello di inizio."
                })
            # I due turni non si sovrappongono mai: il secondo deve iniziare non prima della
            # chiusura del primo, così lato cliente lo switch tra i due avviene sempre dopo la
            # chiusura del turno in corso (mai mentre è ancora aperto).
            if chiusura is not None and apertura_2 < chiusura:
                raise serializers.ValidationError({
                    "orario_apertura_2": "Il secondo turno deve iniziare non prima della chiusura del primo."
                })
        return data


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'


class AllergeneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergene
        fields = '__all__'


class GiornoChiusoAsportoSerializer(serializers.ModelSerializer):
    class Meta:
        model = GiornoChiusoAsporto
        fields = ['id', 'data', 'created_at']
        read_only_fields = ['id', 'created_at']
        # `data` è unique=True sul modello: DRF genera da sé un UniqueValidator leggibile
        # (stesso principio già usato per Categoria.nome/Allergene.nome, sezione 1).


class ProdottoSerializer(serializers.ModelSerializer):
    # Comodo per il frontend: evita una join per mostrare il nome della categoria.
    categoria_nome = serializers.CharField(source='categoria.nome', read_only=True)

    class Meta:
        model = Prodotto
        # `allergeni` (ManyToManyField) diventa automaticamente un PrimaryKeyRelatedField(many=True)
        # scrivibile: ModelSerializer gestisce da sé il .set() delle relazioni in create()/update(),
        # nessun codice custom necessario.
        fields = '__all__'


# Categorie escluse dal limite di prodotti per orario (ConfigurazioneAsporto.limite_prodotti_orario,
# sotto): bevande e vini non impegnano la cucina come un piatto/una pizza, quindi non consumano né
# sono soggette alla capacità di preparazione — né contano nel conteggio "già prenotato" di un altro
# prodotto, né la loro stessa quantità viene mai confrontata col limite.
CATEGORIE_ESCLUSE_LIMITE_ORARIO = ('Bevande', 'Vini')


class VoceOrdineSerializer(serializers.ModelSerializer):
    # Comodo per il frontend (staff): evita una join per mostrare nome/subtotale della riga.
    prodotto_nome = serializers.CharField(source='prodotto.nome', read_only=True)
    subtotale = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    quantita = serializers.IntegerField(min_value=1, default=1)

    class Meta:
        model = VoceOrdine
        fields = '__all__'
        # Mai fidarsi di un prezzo inviato dal client: prezzo_unitario è sempre uno snapshot
        # server-side di Prodotto.prezzo al momento della creazione, impostato da
        # VoceOrdineViewSet.perform_create().
        read_only_fields = ['prezzo_unitario']

    def validate_prodotto(self, prodotto):
        # Un ordine self-service (anonimo) non può includere un prodotto nascosto dal menu
        # pubblico; lo staff può comunque aggiungerlo manualmente — stesso principio con cui
        # GiornoPienoPiscina blocca solo il self-service pubblico, mai lo staff.
        request = self.context.get('request')
        is_richiesta_pubblica = not (request and request.user and request.user.is_authenticated)
        if is_richiesta_pubblica and not prodotto.disponibile:
            raise serializers.ValidationError("Questo prodotto non è al momento disponibile.")
        return prodotto

    def _valida_limite_orario(self, prenotazione, prodotto, quantita):
        # Limite di capacità per orario di ritiro (ConfigurazioneAsporto.limite_prodotti_orario) —
        # un unico valore globale che si applica automaticamente a *qualunque* orario (non un
        # limite scelto per singola fascia), se impostato dallo staff. Vincolato per chiunque,
        # staff incluso: riflette la reale capacità di preparazione della cucina, stesso principio
        # con cui l'orario apertura/chiusura del servizio è validato senza eccezioni per nessuno
        # (sezione 1 di CLAUDE.md), a differenza di GiornoChiusoAsporto che invece bypassa solo
        # lo staff. Bevande/Vini non sono mai soggette al limite (né lo consumano, sotto): una riga
        # di questa categoria salta interamente il controllo, a prescindere dalla quantità richiesta.
        if prodotto is not None and prodotto.categoria.nome in CATEGORIE_ESCLUSE_LIMITE_ORARIO:
            return
        limite_prodotti = ConfigurazioneAsporto.get_solo().limite_prodotti_orario
        if limite_prodotti is None:
            return
        qs = VoceOrdine.objects.filter(
            prenotazione__data=prenotazione.data,
            prenotazione__ora=prenotazione.ora,
        ).exclude(prenotazione__stato='CANCELLED').exclude(
            prodotto__categoria__nome__in=CATEGORIE_ESCLUSE_LIMITE_ORARIO
        )
        if self.instance is not None:
            # In un update, la riga esistente va esclusa dal conteggio "già prenotato" —
            # altrimenti la sua stessa quantità verrebbe sommata due volte (una come
            # "esistente", una come quella appena inviata da validare).
            qs = qs.exclude(pk=self.instance.pk)
        gia_prenotati = qs.aggregate(totale=Sum('quantita'))['totale'] or 0
        residuo = limite_prodotti - gia_prenotati
        if quantita > residuo:
            raise serializers.ValidationError({
                "quantita": (
                    f"Limite raggiunto per l'orario {prenotazione.ora.strftime('%H:%M')}: "
                    f"disponibili solo {max(residuo, 0)} prodotti."
                )
            })

    def validate(self, attrs):
        quantita = attrs.get('quantita', getattr(self.instance, 'quantita', None))
        prenotazione = attrs.get('prenotazione') or (self.instance.prenotazione if self.instance else None)
        prodotto = attrs.get('prodotto') or (self.instance.prodotto if self.instance else None)
        if prenotazione is not None and quantita is not None:
            self._valida_limite_orario(prenotazione, prodotto, quantita)
        return attrs
