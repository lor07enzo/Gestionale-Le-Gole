from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Cliente

Utente = get_user_model()

class UtenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utente
        fields = ['id', 'username', 'email', 'password']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        # Utilizziamo create_user per garantire l'hashing automatico della password
        user = Utente.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            is_staff=True,
            is_superuser=False
        )
        return user

    def update(self, instance, validated_data):
        # Se viene passata una nuova password, va hashata
        if 'password' in validated_data:
            instance.set_password(validated_data.pop('password'))
        return super().update(instance, validated_data)


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = ['id', 'nome', 'telefono', 'note']