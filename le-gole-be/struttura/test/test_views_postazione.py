import pytest
from django.urls import reverse
from rest_framework import status

from struttura.models import Postazione

from .factories import PostazioneFactory

pytestmark = pytest.mark.django_db


class TestPermessiLettura:
    def test_anonimo_puo_leggere_la_lista(self, api_client, inventario):
        PostazioneFactory(inventario=inventario)
        response = api_client.get(reverse("postazione-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_anonimo_non_puo_creare(self, api_client, inventario):
        response = api_client.post(
            reverse("postazione-list"),
            {"inventario": str(inventario.pk), "tipo": "OMBRELLONE", "numero": 1},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestSoftDelete:
    def test_eliminazione_non_rimuove_la_riga_dal_db(self, auth_client, inventario):
        postazione = PostazioneFactory(inventario=inventario)

        response = auth_client.delete(reverse("postazione-detail", args=[postazione.pk]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        postazione.refresh_from_db()
        assert postazione.deleted_at is not None
        assert Postazione.objects.filter(pk=postazione.pk).exists()

    def test_postazione_eliminata_sparisce_dalla_lista_live(self, auth_client, api_client, inventario):
        postazione = PostazioneFactory(inventario=inventario)
        auth_client.delete(reverse("postazione-detail", args=[postazione.pk]))

        response = api_client.get(reverse("postazione-list"), {"inventario": inventario.pk})

        ids = [item["id"] for item in response.data]
        assert str(postazione.pk) not in ids

    def test_postazione_eliminata_non_e_piu_raggiungibile_in_retrieve(self, auth_client, inventario):
        postazione = PostazioneFactory(inventario=inventario)
        auth_client.delete(reverse("postazione-detail", args=[postazione.pk]))

        response = auth_client.get(reverse("postazione-detail", args=[postazione.pk]))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_il_numero_di_una_postazione_eliminata_e_riutilizzabile(self, auth_client, inventario):
        vecchia = PostazioneFactory(inventario=inventario, numero=5)
        auth_client.delete(reverse("postazione-detail", args=[vecchia.pk]))

        response = auth_client.post(
            reverse("postazione-list"),
            {"inventario": str(inventario.pk), "tipo": "OMBRELLONE", "numero": 5, "pos_x": 10, "pos_y": 10},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED


class TestFiltri:
    def test_filtra_per_tipo(self, api_client, inventario):
        PostazioneFactory(inventario=inventario, tipo="OMBRELLONE", numero=1)
        PostazioneFactory(inventario=inventario, tipo="GAZEBO", numero=2)

        response = api_client.get(reverse("postazione-list"), {"inventario": inventario.pk, "tipo": "GAZEBO"})

        assert len(response.data) == 1
        assert response.data[0]["tipo"] == "GAZEBO"
