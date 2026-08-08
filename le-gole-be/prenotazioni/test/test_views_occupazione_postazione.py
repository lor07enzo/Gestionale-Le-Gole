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

    def test_anonimo_puo_creare(self, api_client, inventario):
        # 'create' è pubblica dal 2026-08-07: il flusso self-service assegna automaticamente le
        # postazioni scelte sulla mappa alla prenotazione appena creata (sezione 7 CLAUDE.md).
        postazione = PostazioneFactory(inventario=inventario)

        response = api_client.post(
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


class TestArrivato:
    def test_nasce_non_arrivato_di_default(self, auth_client, inventario):
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
        assert response.data["arrivato"] is False

    def test_puo_essere_segnato_arrivato_indipendentemente_dalle_altre_occupazioni(self, auth_client, inventario):
        # Stesso cliente su più postazioni (es. 2 gazebi): segnare l'arrivo su una non deve
        # toccare le altre, il check-in è per singola postazione.
        prima = OccupazionePostazioneFactory(
            postazione=PostazioneFactory(inventario=inventario), cliente_nome="Mario Rossi"
        )
        seconda = OccupazionePostazioneFactory(
            postazione=PostazioneFactory(inventario=inventario, numero=99), cliente_nome="Mario Rossi"
        )

        response = auth_client.patch(
            reverse("occupazione-postazione-detail", args=[prima.pk]), {"arrivato": True}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["arrivato"] is True
        seconda.refresh_from_db()
        assert seconda.arrivato is False

    def test_richiesta_anonima_forza_arrivato_false(self, api_client, inventario):
        # Un chiamante anonimo non deve poter registrare un check-in mai avvenuto passando
        # 'arrivato: true' nel payload — stesso principio del 'perform_create' che forza 'stato'
        # su PrenotazionePiscinaViewSet per le richieste pubbliche.
        postazione = PostazioneFactory(inventario=inventario)

        response = api_client.post(
            reverse("occupazione-postazione-list"),
            {
                "postazione": str(postazione.pk),
                "data": "2026-08-01",
                "cliente_nome": "Mario Rossi",
                "orario_arrivo_previsto": "12:00",
                "arrivato": True,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["arrivato"] is False


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
