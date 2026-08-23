import pytest
from django.urls import reverse
from rest_framework import status

from menu.models import ConfigurazioneAsporto

pytestmark = pytest.mark.django_db


class TestConfigurazioneAsportoLettura:
    def test_anonimo_puo_leggere(self, api_client):
        response = api_client.get(reverse("configurazione-asporto"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["orario_apertura"] == "11:00:00"
        assert response.data["orario_chiusura"] == "22:00:00"

    def test_la_riga_singleton_non_si_duplica_tra_richieste(self, api_client):
        api_client.get(reverse("configurazione-asporto"))
        api_client.get(reverse("configurazione-asporto"))
        assert ConfigurazioneAsporto.objects.count() == 1


class TestConfigurazioneAsportoScrittura:
    def test_anonimo_non_puo_modificare(self, api_client):
        response = api_client.patch(
            reverse("configurazione-asporto"), {"orario_apertura": "12:00"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_staff_puo_modificare_un_solo_campo(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"), {"orario_apertura": "12:30"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["orario_apertura"] == "12:30:00"
        # L'altro campo, omesso dal payload, resta invariato al default.
        assert response.data["orario_chiusura"] == "22:00:00"

    def test_staff_puo_modificare_entrambi_i_campi(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura": "09:00", "orario_chiusura": "15:00"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["orario_apertura"] == "09:00:00"
        assert response.data["orario_chiusura"] == "15:00:00"

    def test_modifica_persiste_sulla_stessa_riga_singleton(self, auth_client):
        auth_client.patch(reverse("configurazione-asporto"), {"orario_apertura": "08:00"}, format="json")
        response = auth_client.get(reverse("configurazione-asporto"))
        assert response.data["orario_apertura"] == "08:00:00"
        assert ConfigurazioneAsporto.objects.count() == 1


class TestConfigurazioneAsportoValidazione:
    def test_rifiuta_apertura_uguale_a_chiusura(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura": "12:00", "orario_chiusura": "12:00"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_chiusura" in response.data

    def test_rifiuta_apertura_dopo_chiusura(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura": "20:00", "orario_chiusura": "10:00"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_chiusura" in response.data

    def test_valida_un_solo_campo_contro_il_valore_gia_presente_sull_istanza(self, auth_client):
        # orario_chiusura di default è 22:00: un PATCH parziale che sposta solo l'apertura
        # oltre quella soglia deve comunque fallire, senza che il payload la ripeta.
        response = auth_client.patch(
            reverse("configurazione-asporto"), {"orario_apertura": "23:00"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_chiusura" in response.data
