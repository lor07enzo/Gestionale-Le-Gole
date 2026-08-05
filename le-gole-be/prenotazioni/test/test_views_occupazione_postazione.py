import pytest
from django.urls import reverse
from rest_framework import status

from struttura.test.factories import PostazioneFactory

from .factories import OccupazionePostazioneFactory

pytestmark = pytest.mark.django_db


class TestPermessi:
    def test_anonimo_non_puo_elencare(self, api_client):
        response = api_client.get(reverse("occupazione-postazione-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_autenticato_puo_creare(self, auth_client, inventario):
        postazione = PostazioneFactory(inventario=inventario)

        response = auth_client.post(
            reverse("occupazione-postazione-list"),
            {
                "postazione": str(postazione.pk),
                "data": "2026-08-01",
                "cliente_nome": "Mario Rossi",
                "orario_arrivo_previsto": "12:00",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED


class TestVincoloUnicoPerGiorno:
    def test_rifiuta_due_occupazioni_per_la_stessa_postazione_nello_stesso_giorno(self, auth_client, inventario):
        postazione = PostazioneFactory(inventario=inventario)
        OccupazionePostazioneFactory(postazione=postazione, data="2026-08-01")

        response = auth_client.post(
            reverse("occupazione-postazione-list"),
            {
                "postazione": str(postazione.pk),
                "data": "2026-08-01",
                "cliente_nome": "Un altro cliente",
                "orario_arrivo_previsto": "13:00",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestOccupate:
    def test_richiede_i_parametri_obbligatori(self, api_client):
        response = api_client.get(reverse("occupazione-postazione-occupate"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_inventario_inesistente_restituisce_404(self, api_client):
        response = api_client.get(
            reverse("occupazione-postazione-occupate"),
            {"inventario": "00000000-0000-0000-0000-000000000000", "data": "2026-08-01"},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_formato_data_non_valido(self, api_client, inventario):
        response = api_client.get(
            reverse("occupazione-postazione-occupate"), {"inventario": inventario.pk, "data": "01-08-2026"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_anonimo_puo_leggere_solo_gli_id_occupati(self, api_client, inventario):
        postazione_occupata = PostazioneFactory(inventario=inventario)
        occupazione = OccupazionePostazioneFactory(
            postazione=postazione_occupata, data="2026-08-01", cliente_nome="Mario Rossi"
        )
        PostazioneFactory(inventario=inventario, numero=99)  # libera, non deve comparire

        response = api_client.get(
            reverse("occupazione-postazione-occupate"), {"inventario": inventario.pk, "data": "2026-08-01"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data == [str(postazione_occupata.pk)]
        assert "Mario Rossi" not in response.content.decode()
        assert str(occupazione.pk) not in response.content.decode()

    def test_filtra_per_data_e_inventario(self, api_client, inventario):
        from struttura.test.factories import PiscinaInventarioFactory

        postazione = PostazioneFactory(inventario=inventario)
        OccupazionePostazioneFactory(postazione=postazione, data="2026-08-01")
        OccupazionePostazioneFactory(postazione=postazione, data="2026-08-02")  # altra data
        altro_inventario = PiscinaInventarioFactory()
        OccupazionePostazioneFactory(
            postazione=PostazioneFactory(inventario=altro_inventario), data="2026-08-01"
        )  # altro inventario

        response = api_client.get(
            reverse("occupazione-postazione-occupate"), {"inventario": inventario.pk, "data": "2026-08-01"}
        )

        assert response.data == [str(postazione.pk)]


class TestFiltri:
    def test_filtra_per_data(self, auth_client, inventario):
        postazione = PostazioneFactory(inventario=inventario)
        di_oggi = OccupazionePostazioneFactory(postazione=postazione, data="2026-08-01")
        OccupazionePostazioneFactory(postazione=PostazioneFactory(inventario=inventario, numero=99), data="2026-08-02")

        response = auth_client.get(reverse("occupazione-postazione-list"), {"data": "2026-08-01"})

        ids = [o["id"] for o in response.data]
        assert ids == [str(di_oggi.pk)]

    def test_filtra_per_inventario_della_postazione(self, auth_client, inventario):
        from struttura.test.factories import PiscinaInventarioFactory

        altro_inventario = PiscinaInventarioFactory()
        propria = OccupazionePostazioneFactory(postazione=PostazioneFactory(inventario=inventario))
        OccupazionePostazioneFactory(postazione=PostazioneFactory(inventario=altro_inventario, numero=99))

        response = auth_client.get(
            reverse("occupazione-postazione-list"), {"postazione__inventario": str(inventario.pk)}
        )

        ids = [o["id"] for o in response.data]
        assert ids == [str(propria.pk)]
