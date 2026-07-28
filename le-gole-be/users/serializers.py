from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Cliente

Utente = get_user_model()


def _validate_email_non_duplicato(value, instance=None):
    """Confronto case-insensitive: 'Mario@Test.com' e 'mario@test.com' contano come duplicati
    (stesso criterio già usato da UtenteViewSet.reset_password_request, email__iexact)."""
    queryset = Utente.objects.filter(email__iexact=value)
    if instance is not None:
        queryset = queryset.exclude(pk=instance.pk)
    if queryset.exists():
        raise serializers.ValidationError("Esiste già un account staff con questa email.")
    return value


class UtenteSerializer(serializers.ModelSerializer):
    """Rappresentazione standard: list, retrieve, me, update anagrafica da superuser."""
    class Meta:
        model = Utente
        fields = ['id', 'username', 'email', 'is_superuser', 'is_active']
        extra_kwargs = {
            'is_superuser': {'read_only': True},
        }

    def validate_email(self, value):
        return _validate_email_non_duplicato(value, instance=self.instance)


class UtenteCreateSerializer(serializers.ModelSerializer):
    """Usato SOLO dal superuser per creare un nuovo staff. Niente password in input."""
    class Meta:
        model = Utente
        fields = ['id', 'username', 'email']

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("L'email è obbligatoria per inviare il link di attivazione.")
        return _validate_email_non_duplicato(value)

    def create(self, validated_data):
        user = Utente(
            username=validated_data['username'],
            email=validated_data['email'],
            is_staff=True,
            is_superuser=False,
            is_active=True,       # l'account esiste ma non è utilizzabile finché non c'è una password
        )
        user.set_unusable_password()
        user.save()
        return user


class ActivateAccountSerializer(serializers.Serializer):
    """Endpoint pubblico: lo staff imposta la password cliccando il link ricevuto via email."""
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = ['id', 'nome', 'telefono']

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value