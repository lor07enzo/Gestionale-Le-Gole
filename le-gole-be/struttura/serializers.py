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

    def validate(self, data):
        # DRF non genera un validator per i UniqueConstraint condizionali (vedi Postazione.Meta),
        # quindi lo replichiamo qui per un 400 leggibile invece di un IntegrityError grezzo.
        inventario = data.get('inventario', self.instance.inventario if self.instance else None)
        numero = data.get('numero', self.instance.numero if self.instance else None)
        if inventario is not None and numero is not None:
            conflitti = Postazione.objects.filter(
                inventario=inventario, numero=numero, deleted_at__isnull=True
            )
            if self.instance:
                conflitti = conflitti.exclude(pk=self.instance.pk)
            if conflitti.exists():
                raise serializers.ValidationError(
                    {"numero": "Numero già in uso per questo inventario."}
                )
        return data