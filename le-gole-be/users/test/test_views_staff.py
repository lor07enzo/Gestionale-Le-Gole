import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status

from .factories import SuperUserFactory, UtenteFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def use_locmem_email_backend(settings):
    # Evita di colpire davvero l'API Resend durante i test: verificabile via django.core.mail.outbox.
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"


def _uid_token(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return uid, token


class TestCreateStaff:
    def test_anonimo_non_puo_creare(self, api_client):
        response = api_client.post(
            reverse("staff-list"), {"username": "nuovo", "email": "nuovo@example.com"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_staff_non_superuser_non_puo_creare(self, staff_client):
        response = staff_client.post(
            reverse("staff-list"), {"username": "nuovo", "email": "nuovo@example.com"}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_superuser_crea_e_invia_email_di_attivazione(self, superuser_client):
        response = superuser_client.post(
            reverse("staff-list"),
            {"username": "nuovostaff", "email": "nuovostaff@example.com"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["nuovostaff@example.com"]

        from users.models import Utente

        creato = Utente.objects.get(username="nuovostaff")
        assert creato.has_usable_password() is False
        assert creato.is_staff is True
        assert creato.is_superuser is False

    def test_superuser_non_puo_creare_con_email_duplicata(self, superuser_client):
        UtenteFactory(email="occupata@example.com")

        response = superuser_client.post(
            reverse("staff-list"), {"username": "altro", "email": "occupata@example.com"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestListRetrieveStaff:
    def test_anonimo_non_puo_elencare(self, api_client):
        response = api_client.get(reverse("staff-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_staff_non_superuser_non_puo_elencare(self, staff_client):
        response = staff_client.get(reverse("staff-list"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_superuser_puo_elencare(self, superuser_client, staff_user):
        response = superuser_client.get(reverse("staff-list"))
        assert response.status_code == status.HTTP_200_OK


class TestMe:
    def test_richiede_autenticazione(self, api_client):
        response = api_client.get(reverse("staff-me"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_restituisce_utente_autenticato_anche_se_non_superuser(self, staff_client, staff_user):
        response = staff_client.get(reverse("staff-me"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["username"] == staff_user.username


class TestSetActive:
    def test_superuser_disattiva_un_altro_utente(self, superuser_client, staff_user):
        response = superuser_client.patch(
            reverse("staff-set-active", args=[staff_user.pk]), {"is_active": False}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK

        staff_user.refresh_from_db()
        assert staff_user.is_active is False

    def test_non_puo_disattivare_se_stesso(self, superuser_client, superuser):
        response = superuser_client.patch(
            reverse("staff-set-active", args=[superuser.pk]), {"is_active": False}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        superuser.refresh_from_db()
        assert superuser.is_active is True

    def test_richiede_un_booleano(self, superuser_client, staff_user):
        response = superuser_client.patch(
            reverse("staff-set-active", args=[staff_user.pk]), {"is_active": "not-a-bool"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_richiede_superuser(self, staff_client, superuser):
        response = staff_client.patch(
            reverse("staff-set-active", args=[superuser.pk]), {"is_active": False}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestDestroy:
    def test_superuser_elimina_uno_staff_normale(self, superuser_client, staff_user):
        response = superuser_client.delete(reverse("staff-detail", args=[staff_user.pk]))
        assert response.status_code == status.HTTP_204_NO_CONTENT

        from users.models import Utente

        assert not Utente.objects.filter(pk=staff_user.pk).exists()

    def test_non_puo_eliminare_un_altro_superuser(self, superuser_client):
        altro_superuser = SuperUserFactory()

        response = superuser_client.delete(reverse("staff-detail", args=[altro_superuser.pk]))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        from users.models import Utente

        assert Utente.objects.filter(pk=altro_superuser.pk).exists()

    def test_non_puo_eliminare_se_stesso(self, superuser_client, superuser):
        response = superuser_client.delete(reverse("staff-detail", args=[superuser.pk]))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        from users.models import Utente

        assert Utente.objects.filter(pk=superuser.pk).exists()

    def test_richiede_superuser(self, staff_client, staff_user):
        altro = UtenteFactory()

        response = staff_client.delete(reverse("staff-detail", args=[altro.pk]))
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestActivate:
    def test_uid_e_token_validi_impostano_la_password(self, api_client):
        utente = UtenteFactory()
        utente.set_unusable_password()
        utente.save()
        uid, token = _uid_token(utente)

        response = api_client.post(
            reverse("staff-activate"),
            {"uid": uid, "token": token, "password": "UnaPasswordSicura987"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        utente.refresh_from_db()
        assert utente.check_password("UnaPasswordSicura987") is True

    def test_uid_non_valido(self, api_client):
        response = api_client.post(
            reverse("staff-activate"),
            {"uid": "non-valido", "token": "qualsiasi", "password": "UnaPasswordSicura987"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_token_non_valido(self, api_client):
        utente = UtenteFactory()
        uid, _ = _uid_token(utente)

        response = api_client.post(
            reverse("staff-activate"),
            {"uid": uid, "token": "non-valido", "password": "UnaPasswordSicura987"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestResetPassword:
    def test_richiesta_per_email_esistente_invia_email(self, api_client):
        utente = UtenteFactory(email="attivo@example.com")

        response = api_client.post(
            reverse("staff-reset-password-request"), {"email": "attivo@example.com"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["attivo@example.com"]

    def test_richiesta_per_email_inesistente_stesso_messaggio_generico_e_nessuna_email(self, api_client):
        response = api_client.post(
            reverse("staff-reset-password-request"), {"email": "fantasma@example.com"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 0

    def test_conferma_con_token_valido_reimposta_la_password(self, api_client):
        utente = UtenteFactory()
        uid, token = _uid_token(utente)

        response = api_client.post(
            reverse("staff-reset-password-confirm"),
            {"uid": uid, "token": token, "password": "AltraPasswordSicura987"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        utente.refresh_from_db()
        assert utente.check_password("AltraPasswordSicura987") is True

    def test_conferma_con_token_non_valido(self, api_client):
        utente = UtenteFactory()
        uid, _ = _uid_token(utente)

        response = api_client.post(
            reverse("staff-reset-password-confirm"),
            {"uid": uid, "token": "non-valido", "password": "AltraPasswordSicura987"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_conferma_con_uid_non_valido(self, api_client):
        response = api_client.post(
            reverse("staff-reset-password-confirm"),
            {"uid": "non-valido", "token": "qualsiasi", "password": "AltraPasswordSicura987"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
