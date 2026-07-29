import pytest
from django.urls import reverse
from rest_framework import status

from prenotazioni.models import GiornoPienoPiscina

from .factories import GiornoPienoPiscinaFactory

pytestmark = pytest.mark.django_db


class TestPermessi:
    def test_anonimo_non_puo_elencare(self, api_client):
        response = api_client.get(reverse("giorno-pieno-piscina-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_autenticato_puo_creare_e_cancellare(self, auth_client, inventario):
        response = auth_client.post(
            reverse("giorno-pieno-piscina-list"), {"inventario": str(inventario.pk), "data": "2026-08-01"}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert GiornoPienoPiscina.objects.filter(inventario=inventario, data="2026-08-01").exists()

        response = auth_client.delete(reverse("giorno-pieno-piscina-detail", args=[response.data["id"]]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not GiornoPienoPiscina.objects.filter(inventario=inventario, data="2026-08-01").exists()

    def test_rifiuta_di_marcare_due_volte_lo_stesso_giorno(self, auth_client, inventario):
        GiornoPienoPiscinaFactory(inventario=inventario, data="2026-08-01")

        response = auth_client.post(
            reverse("giorno-pieno-piscina-list"), {"inventario": str(inventario.pk), "data": "2026-08-01"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestCalendario:
    def test_richiede_i_parametri_obbligatori(self, api_client):
        response = api_client.get(reverse("giorno-pieno-piscina-calendario"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_parametri_non_numerici(self, api_client, inventario):
        response = api_client.get(
            reverse("giorno-pieno-piscina-calendario"), {"inventario": inventario.pk, "anno": "x", "mese": "7"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_e_pubblico_e_restituisce_solo_le_date(self, api_client, inventario):
        GiornoPienoPiscinaFactory(inventario=inventario, data="2026-07-05")
        GiornoPienoPiscinaFactory(inventario=inventario, data="2026-07-12")
        GiornoPienoPiscinaFactory(inventario=inventario, data="2026-08-01")  # fuori dal mese richiesto

        response = api_client.get(
            reverse("giorno-pieno-piscina-calendario"), {"inventario": inventario.pk, "anno": "2026", "mese": "7"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert sorted(response.data) == ["2026-07-05", "2026-07-12"]
