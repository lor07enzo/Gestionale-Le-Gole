import pytest
from django.urls import reverse
from rest_framework import status

from users.test.factories import ClienteFactory

from .factories import PrenotazioneAsportoFactory

pytestmark = pytest.mark.django_db


class TestPermessi:
    def test_anonimo_non_puo_elencare(self, api_client):
        response = api_client.get(reverse("prenotazione-asporto-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_autenticato_puo_elencare(self, auth_client):
        PrenotazioneAsportoFactory()
        response = auth_client.get(reverse("prenotazione-asporto-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_anonimo_puo_creare(self, api_client, cliente):
        payload = {"cliente_id": str(cliente.pk), "data": "2026-08-20", "ora": "18:30"}
        response = api_client.post(reverse("prenotazione-asporto-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED


class TestCreazionePubblica:
    def test_nasce_sempre_confirmed_anche_se_il_payload_forza_pending(self, api_client, cliente):
        payload = {
            "cliente_id": str(cliente.pk),
            "data": "2026-08-20",
            "ora": "18:30",
            "stato": "PENDING",
        }
        response = api_client.post(reverse("prenotazione-asporto-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["stato"] == "CONFIRMED"
        assert response.data["creata_da_staff"] is False

    def test_staff_puo_scegliere_liberamente_lo_stato(self, auth_client, cliente):
        payload = {
            "cliente_id": str(cliente.pk),
            "data": "2026-08-20",
            "ora": "18:30",
            "stato": "PENDING",
        }
        response = auth_client.post(reverse("prenotazione-asporto-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["stato"] == "PENDING"
        assert response.data["creata_da_staff"] is True


class TestFiltri:
    def test_filtra_per_stato(self, auth_client):
        PrenotazioneAsportoFactory(stato="PENDING")
        PrenotazioneAsportoFactory(stato="CONFIRMED")

        response = auth_client.get(reverse("prenotazione-asporto-list"), {"stato": "PENDING"})

        stati = [p["stato"] for p in response.data]
        assert stati == ["PENDING"]

    def test_filtra_per_cliente_id(self, auth_client, cliente):
        propria = PrenotazioneAsportoFactory(cliente_id=cliente)
        PrenotazioneAsportoFactory()

        response = auth_client.get(reverse("prenotazione-asporto-list"), {"cliente_id": str(cliente.pk)})

        ids = [p["id"] for p in response.data]
        assert ids == [str(propria.pk)]


class TestCampiCalcolati:
    def test_espone_nome_e_telefono_del_cliente(self, auth_client, cliente):
        prenotazione = PrenotazioneAsportoFactory(cliente_id=cliente)

        response = auth_client.get(reverse("prenotazione-asporto-detail", args=[prenotazione.pk]))

        assert response.data["cliente_nome"] == cliente.nome
        assert response.data["cliente_telefono"] == cliente.telefono

    def test_totale_e_zero_senza_voci_ordine(self, auth_client):
        prenotazione = PrenotazioneAsportoFactory()

        response = auth_client.get(reverse("prenotazione-asporto-detail", args=[prenotazione.pk]))

        assert response.data["totale"] == "0.00"


class TestScaricaRicevuta:
    def test_pubblico_genera_il_pdf_per_un_ordine_pending(self, api_client):
        prenotazione = PrenotazioneAsportoFactory(stato="PENDING")

        response = api_client.get(reverse("prenotazione-asporto-scarica-ricevuta", args=[prenotazione.pk]))

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"
        assert f"ricevuta_{prenotazione.id}.pdf" in response["Content-Disposition"]

    def test_genera_il_pdf_anche_per_un_ordine_confirmed_senza_voci(self, api_client):
        prenotazione = PrenotazioneAsportoFactory(stato="CONFIRMED")

        response = api_client.get(reverse("prenotazione-asporto-scarica-ricevuta", args=[prenotazione.pk]))
        assert response.status_code == status.HTTP_200_OK

    def test_bloccato_per_un_ordine_cancellato(self, api_client):
        prenotazione = PrenotazioneAsportoFactory(stato="CANCELLED")

        response = api_client.get(reverse("prenotazione-asporto-scarica-ricevuta", args=[prenotazione.pk]))
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestStoricoTelefono:
    def test_richiede_il_parametro_telefono(self, api_client):
        response = api_client.get(reverse("prenotazione-asporto-storico-telefono"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_pubblico_e_match_esatto_sul_telefono(self, api_client):
        cliente = ClienteFactory(telefono="3331112222")
        altro_cliente = ClienteFactory(telefono="3339998888")
        proprio = PrenotazioneAsportoFactory(cliente_id=cliente, data="2026-08-01")
        PrenotazioneAsportoFactory(cliente_id=altro_cliente, data="2026-08-02")

        response = api_client.get(
            reverse("prenotazione-asporto-storico-telefono"), {"telefono": "3331112222"}
        )

        assert response.status_code == status.HTTP_200_OK
        ids = [row["id"] for row in response.data]
        assert ids == [str(proprio.pk)]

    def test_nessun_match_restituisce_lista_vuota(self, api_client):
        response = api_client.get(
            reverse("prenotazione-asporto-storico-telefono"), {"telefono": "0000000000"}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_include_anche_le_cancellate(self, api_client):
        cliente = ClienteFactory(telefono="3331112222")
        cancellato = PrenotazioneAsportoFactory(cliente_id=cliente, stato="CANCELLED")

        response = api_client.get(
            reverse("prenotazione-asporto-storico-telefono"), {"telefono": "3331112222"}
        )

        ids = [row["id"] for row in response.data]
        assert str(cancellato.pk) in ids

    def test_ordina_per_data_decrescente(self, api_client):
        cliente = ClienteFactory(telefono="3331112222")
        vecchio = PrenotazioneAsportoFactory(cliente_id=cliente, data="2026-01-01")
        recente = PrenotazioneAsportoFactory(cliente_id=cliente, data="2026-06-01")

        response = api_client.get(
            reverse("prenotazione-asporto-storico-telefono"), {"telefono": "3331112222"}
        )

        ids = [row["id"] for row in response.data]
        assert ids == [str(recente.pk), str(vecchio.pk)]


class TestDettaglioPubblico:
    def test_pubblico_restituisce_il_dettaglio_completo_con_voci_vuote(self, api_client):
        cliente = ClienteFactory(telefono="3331112222", nome="Anna Dettaglio")
        ordine = PrenotazioneAsportoFactory(cliente_id=cliente, ora="19:00", note="Senza cipolla")

        response = api_client.get(reverse("prenotazione-asporto-dettaglio-pubblico", args=[ordine.pk]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(ordine.pk)
        assert response.data["cliente_nome"] == "Anna Dettaglio"
        assert response.data["note"] == "Senza cipolla"
        assert response.data["voci"] == []

    def test_pubblico_anche_per_un_ordine_cancellato(self, api_client):
        ordine = PrenotazioneAsportoFactory(stato="CANCELLED")

        response = api_client.get(reverse("prenotazione-asporto-dettaglio-pubblico", args=[ordine.pk]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["stato"] == "CANCELLED"

    def test_id_inesistente_restituisce_404(self, api_client):
        response = api_client.get(
            reverse("prenotazione-asporto-dettaglio-pubblico", args=["00000000-0000-0000-0000-000000000000"])
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestRecenti:
    def test_richiede_autenticazione(self, api_client):
        response = api_client.get(reverse("prenotazione-asporto-recenti"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_esclude_cancellate_e_create_dallo_staff(self, auth_client):
        self_service = PrenotazioneAsportoFactory(creata_da_staff=False)
        PrenotazioneAsportoFactory(creata_da_staff=True)
        PrenotazioneAsportoFactory(creata_da_staff=False, stato="CANCELLED")

        response = auth_client.get(reverse("prenotazione-asporto-recenti"))

        ids = [row["id"] for row in response.data]
        assert ids == [str(self_service.pk)]

    def test_rispetta_il_parametro_limit(self, auth_client):
        for _ in range(3):
            PrenotazioneAsportoFactory()

        response = auth_client.get(reverse("prenotazione-asporto-recenti"), {"limit": 2})

        assert len(response.data) == 2

    def test_limit_non_numerico_ricade_sul_default(self, auth_client):
        PrenotazioneAsportoFactory()

        response = auth_client.get(reverse("prenotazione-asporto-recenti"), {"limit": "tanti"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
