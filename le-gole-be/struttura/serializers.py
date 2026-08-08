from rest_framework import serializers
from .models import PiscinaInventario, Postazione

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
        # Non si possono posizionare più postazioni fisiche di quante il listino ne preveda
        # (totale_ombrelloni/totale_gazebi) — solo in creazione: se il totale viene abbassato in
        # un secondo momento, le postazioni già esistenti in eccesso restano comunque modificabili
        # (es. per riposizionarle o eliminarle), il limite blocca solo l'aggiunta di nuove.
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