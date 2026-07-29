import pytest
from django.urls import reverse
from rest_framework import status

from .factories import GiornoPienoPiscinaFactory, PrenotazionePiscinaFactory

pytestmark = pytest.mark.django_db


class TestDisponibilita:
    def test_richiede_i_parametri_obbligatori(self, api_client):
        response = api_client.get(reverse("prenotazione-piscina-disponibilita"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_inventario_inesistente_restituisce_404(self, api_client):
        response = api_client.get(
            reverse("prenotazione-piscina-disponibilita"),
            {"inventario": "00000000-0000-0000-0000-000000000000", "data": "2026-08-01"},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_formato_data_non_valido(self, api_client, inventario):
        response = api_client.get(
            reverse("prenotazione-piscina-disponibilita"), {"inventario": inventario.pk, "data": "01-08-2026"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_anonimo_puo_leggere_i_residui(self, api_client, inventario):
        PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-01", ombrellone=2)

        response = api_client.get(
            reverse("prenotazione-piscina-disponibilita"), {"inventario": inventario.pk, "data": "2026-08-01"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["ombrellone"] == inventario.totale_ombrelloni - 2
        assert response.data["pieno"] is False

    def test_pieno_true_se_il_giorno_e_marcato_tutto_prenotato(self, api_client, inventario):
        GiornoPienoPiscinaFactory(inventario=inventario, data="2026-08-01")

        response = api_client.get(
            reverse("prenotazione-piscina-disponibilita"), {"inventario": inventario.pk, "data": "2026-08-01"}
        )

        assert response.data["pieno"] is True


class TestScaricaBiglietto:
    def test_pubblico_genera_il_pdf_per_una_prenotazione_pending(self, api_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, stato="PENDING")

        response = api_client.get(reverse("prenotazione-piscina-scarica-biglietto", args=[prenotazione.pk]))

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"
        assert f"ticket_{prenotazione.id}.pdf" in response["Content-Disposition"]

    def test_genera_il_pdf_anche_per_una_prenotazione_confirmed(self, api_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, stato="CONFIRMED")

        response = api_client.get(reverse("prenotazione-piscina-scarica-biglietto", args=[prenotazione.pk]))
        assert response.status_code == status.HTTP_200_OK

    def test_bloccato_per_una_prenotazione_cancellata(self, api_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, stato="CANCELLED")

        response = api_client.get(reverse("prenotazione-piscina-scarica-biglietto", args=[prenotazione.pk]))
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestConteggi:
    def test_richiede_autenticazione(self, api_client):
        response = api_client.get(reverse("prenotazione-piscina-conteggi"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_richiede_i_parametri_obbligatori(self, auth_client):
        response = auth_client.get(reverse("prenotazione-piscina-conteggi"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_parametri_non_numerici(self, auth_client, inventario):
        response = auth_client.get(
            reverse("prenotazione-piscina-conteggi"), {"inventario": inventario.pk, "anno": "duemila", "mese": "7"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_conta_le_prenotazioni_non_cancellate_per_giorno(self, auth_client, inventario):
        PrenotazionePiscinaFactory(inventario=inventario, data="2026-07-05")
        PrenotazionePiscinaFactory(inventario=inventario, data="2026-07-05")
        PrenotazionePiscinaFactory(inventario=inventario, data="2026-07-12")
        PrenotazionePiscinaFactory(inventario=inventario, data="2026-07-20", stato="CANCELLED")

        response = auth_client.get(
            reverse("prenotazione-piscina-conteggi"), {"inventario": inventario.pk, "anno": "2026", "mese": "7"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"2026-07-05": 2, "2026-07-12": 1}
