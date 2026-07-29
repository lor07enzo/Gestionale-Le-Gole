import pytest
from django.urls import reverse
from rest_framework import status

from prenotazioni.models import OccupazionePostazione, PrenotazionePiscina

from .factories import OccupazionePostazioneFactory, PrenotazionePiscinaFactory

pytestmark = pytest.mark.django_db


class TestPermessi:
    def test_anonimo_non_puo_elencare(self, api_client):
        response = api_client.get(reverse("prenotazione-piscina-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_autenticato_puo_elencare(self, auth_client, inventario):
        PrenotazionePiscinaFactory(inventario=inventario)
        response = auth_client.get(reverse("prenotazione-piscina-list"))
        assert response.status_code == status.HTTP_200_OK


class TestFiltri:
    def test_filtra_per_stato(self, auth_client, inventario):
        PrenotazionePiscinaFactory(inventario=inventario, stato="PENDING")
        PrenotazionePiscinaFactory(inventario=inventario, stato="CONFIRMED")

        response = auth_client.get(reverse("prenotazione-piscina-list"), {"stato": "PENDING"})

        stati = [p["stato"] for p in response.data]
        assert stati == ["PENDING"]

    def test_filtra_per_cliente_id(self, auth_client, inventario, cliente):
        propria = PrenotazionePiscinaFactory(inventario=inventario, cliente_id=cliente)
        PrenotazionePiscinaFactory(inventario=inventario)

        response = auth_client.get(reverse("prenotazione-piscina-list"), {"cliente_id": str(cliente.pk)})

        ids = [p["id"] for p in response.data]
        assert ids == [str(propria.pk)]


class TestEliminazione:
    def test_elimina_anche_le_occupazioni_postazione_collegate(self, auth_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario)
        occupazione = OccupazionePostazioneFactory(prenotazione=prenotazione)

        response = auth_client.delete(reverse("prenotazione-piscina-detail", args=[prenotazione.pk]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not PrenotazionePiscina.objects.filter(pk=prenotazione.pk).exists()
        # Non solo scollegata (SET_NULL): l'occupazione va rimossa del tutto, altrimenti la
        # postazione risulterebbe ancora "occupata" sulla mappa dopo l'eliminazione.
        assert not OccupazionePostazione.objects.filter(pk=occupazione.pk).exists()
