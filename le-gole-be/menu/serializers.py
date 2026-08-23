from rest_framework import serializers
from .models import Allergene, Categoria, ConfigurazioneAsporto, GiornoChiusoAsporto, Prodotto, VoceOrdine


class ConfigurazioneAsportoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfigurazioneAsporto
        fields = ['id', 'orario_apertura', 'orario_chiusura', 'updated_at']
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
