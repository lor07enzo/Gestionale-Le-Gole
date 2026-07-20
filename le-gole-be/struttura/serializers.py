from rest_framework import serializers
from .models import PiscinaInventario, Postazione

class PiscinaInventarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = PiscinaInventario
        fields = '__all__'


class PostazioneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Postazione
        fields = '__all__'

    def validate_pos_x(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("pos_x deve essere compreso tra 0 e 100.")
        return value

    def validate_pos_y(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("pos_y deve essere compreso tra 0 e 100.")
        return value