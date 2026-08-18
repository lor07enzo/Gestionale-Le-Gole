import pytest

from users.serializers import (
    ActivateAccountSerializer,
    PasswordResetConfirmSerializer,
    UtenteCreateSerializer,
    UtenteSerializer,
)

from .factories import UtenteFactory

pytestmark = pytest.mark.django_db


class TestUtenteCreateSerializer:
    def test_crea_utente_con_password_inutilizzabile(self):
        serializer = UtenteCreateSerializer(data={"username": "nuovostaff", "email": "nuovo@example.com"})
        assert serializer.is_valid(), serializer.errors

        utente = serializer.save()

        assert utente.is_staff is True
        assert utente.is_superuser is False
        assert utente.has_usable_password() is False

    def test_rifiuta_email_mancante(self):
        serializer = UtenteCreateSerializer(data={"username": "senzamail", "email": ""})
        assert not serializer.is_valid()
        assert "email" in serializer.errors

    def test_rifiuta_email_gia_usata_case_insensitive(self):
        UtenteFactory(email="Esistente@Example.com")

        serializer = UtenteCreateSerializer(data={"username": "altro", "email": "esistente@example.com"})

        assert not serializer.is_valid()
        assert "email" in serializer.errors


class TestUtenteSerializer:
    def test_rifiuta_email_gia_usata_da_altro_utente(self):
        UtenteFactory(email="occupata@example.com")
        target = UtenteFactory(email="libera@example.com")

        serializer = UtenteSerializer(instance=target, data={"email": "occupata@example.com"}, partial=True)

        assert not serializer.is_valid()
        assert "email" in serializer.errors

    def test_permette_di_salvare_la_propria_email_invariata(self):
        target = UtenteFactory(email="mario@example.com")

        serializer = UtenteSerializer(
            instance=target,
            data={"username": target.username, "email": "mario@example.com"},
            partial=True,
        )

        assert serializer.is_valid(), serializer.errors

    def test_is_superuser_e_read_only(self):
        target = UtenteFactory(is_superuser=False)

        serializer = UtenteSerializer(instance=target, data={"is_superuser": True}, partial=True)
        assert serializer.is_valid(), serializer.errors
        utente = serializer.save()

        assert utente.is_superuser is False


class TestActivateAccountSerializer:
    def test_rifiuta_password_troppo_corta(self):
        serializer = ActivateAccountSerializer(
            data={"uid": "abc", "token": "xyz", "password": "abc123"}
        )
        assert not serializer.is_valid()
        assert "password" in serializer.errors

    def test_accetta_password_robusta(self):
        serializer = ActivateAccountSerializer(
            data={"uid": "abc", "token": "xyz", "password": "UnaPasswordSicura987"}
        )
        assert serializer.is_valid(), serializer.errors


class TestPasswordResetConfirmSerializer:
    # Stessa validazione password di ActivateAccountSerializer, ma classe separata: copertura duplicata apposta.
    def test_rifiuta_password_troppo_corta(self):
        serializer = PasswordResetConfirmSerializer(
            data={"uid": "abc", "token": "xyz", "password": "abc123"}
        )
        assert not serializer.is_valid()
        assert "password" in serializer.errors

    def test_accetta_password_robusta(self):
        serializer = PasswordResetConfirmSerializer(
            data={"uid": "abc", "token": "xyz", "password": "UnaPasswordSicura987"}
        )
        assert serializer.is_valid(), serializer.errors
