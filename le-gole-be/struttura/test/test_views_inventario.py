from datetime import date, timedelta

import pytest
from django.urls import reverse
from rest_framework import status

from prenotazioni.models import PrenotazionePiscina
from struttura.models import PiscinaInventario
from users.test.factories import ClienteFactory

from .factories import PiscinaInventarioFactory

pytestmark = pytest.mark.django_db


def _prenotazione(inventario, data_prenotazione):
    return PrenotazionePiscina.objects.create(
        cliente_id=ClienteFactory(),
        inventario=inventario,
        data=data_prenotazione,
        ora="12:00",
    )


class TestPermessiLettura:
    def test_anonimo_puo_leggere_la_lista(self, api_client, inventario):
        response = api_client.get(reverse("inventariopiscina-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_anonimo_non_puo_creare(self, api_client):
        response = api_client.post(reverse("inventariopiscina-list"), {"nome": "Nuovo"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_autenticato_puo_creare(self, auth_client):
        response = auth_client.post(reverse("inventariopiscina-list"), {"nome": "Nuovo Listino"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED


class TestAzioneAttivo:
    def test_restituisce_il_listino_attivo(self, api_client):
        PiscinaInventarioFactory(isActive=False)
        attivo = PiscinaInventarioFactory(isActive=True)

        response = api_client.get(reverse("inventariopiscina-attivo"))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(attivo.pk)

    def test_404_se_nessun_listino_e_attivo(self, api_client):
        PiscinaInventarioFactory(isActive=False)

        response = api_client.get(reverse("inventariopiscina-attivo"))
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestEliminazioneInventario:
    def test_bloccata_se_esiste_una_prenotazione_futura(self, auth_client, inventario):
        _prenotazione(inventario, date.today() + timedelta(days=1))

        response = auth_client.delete(reverse("inventariopiscina-detail", args=[inventario.pk]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert PiscinaInventario.objects.filter(pk=inventario.pk).exists()

    def test_bloccata_se_esiste_una_prenotazione_di_oggi(self, auth_client, inventario):
        _prenotazione(inventario, date.today())

        response = auth_client.delete(reverse("inventariopiscina-detail", args=[inventario.pk]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_elimina_ripulendo_automaticamente_le_prenotazioni_passate(self, auth_client, inventario):
        passata = _prenotazione(inventario, date.today() - timedelta(days=1))

        response = auth_client.delete(reverse("inventariopiscina-detail", args=[inventario.pk]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not PiscinaInventario.objects.filter(pk=inventario.pk).exists()
        assert not PrenotazionePiscina.objects.filter(pk=passata.pk).exists()

    def test_prenotazione_passata_cancellata_non_blocca_lo_storico_di_unaltra_futura(self, auth_client, inventario):
        # Rete di sicurezza: se esiste ANCHE solo una prenotazione futura, l'intera
        # eliminazione va bloccata, a prescindere da quante prenotazioni passate ci siano.
        _prenotazione(inventario, date.today() - timedelta(days=10))
        _prenotazione(inventario, date.today() + timedelta(days=5))

        response = auth_client.delete(reverse("inventariopiscina-detail", args=[inventario.pk]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert PrenotazionePiscina.objects.filter(inventario=inventario).count() == 2
