import pytest
from django.urls import reverse
from rest_framework import status

from users.test.factories import ClienteFactory

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


class TestRecenti:
    def test_richiede_autenticazione(self, api_client):
        response = api_client.get(reverse("prenotazione-piscina-recenti"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_ordina_per_data_di_creazione_decrescente_ed_esclude_cancellate(self, auth_client, inventario):
        prima = PrenotazionePiscinaFactory(inventario=inventario, data="2026-07-01")
        seconda = PrenotazionePiscinaFactory(inventario=inventario, data="2026-06-01")
        PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-01", stato="CANCELLED")

        response = auth_client.get(reverse("prenotazione-piscina-recenti"))

        assert response.status_code == status.HTTP_200_OK
        ids = [row["id"] for row in response.data]
        # 'seconda' è stata creata dopo 'prima' (ordine di chiamata della factory), a prescindere
        # dalla 'data' di prenotazione di ciascuna (qui volutamente invertita rispetto a created_at).
        assert ids == [str(seconda.pk), str(prima.pk)]

    def test_include_il_nome_dell_inventario(self, auth_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario)

        response = auth_client.get(reverse("prenotazione-piscina-recenti"))

        assert response.data[0]["inventario_nome"] == inventario.nome
        assert response.data[0]["id"] == str(prenotazione.pk)

    def test_rispetta_il_parametro_limit(self, auth_client, inventario):
        for _ in range(3):
            PrenotazionePiscinaFactory(inventario=inventario)

        response = auth_client.get(reverse("prenotazione-piscina-recenti"), {"limit": 2})

        assert len(response.data) == 2

    def test_limit_non_numerico_ricade_sul_default(self, auth_client, inventario):
        PrenotazionePiscinaFactory(inventario=inventario)

        response = auth_client.get(reverse("prenotazione-piscina-recenti"), {"limit": "tanti"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_esclude_le_prenotazioni_create_dallo_staff(self, auth_client, inventario):
        # Un walk-in registrato dallo staff (es. "+ Nuovo cliente" dalla mappa) non deve generare
        # una notifica: solo chi prenota da sé (Area Cliente) deve comparire in questo elenco.
        self_service = PrenotazionePiscinaFactory(inventario=inventario, creata_da_staff=False)
        PrenotazionePiscinaFactory(inventario=inventario, creata_da_staff=True)

        response = auth_client.get(reverse("prenotazione-piscina-recenti"))

        ids = [row["id"] for row in response.data]
        assert ids == [str(self_service.pk)]


class TestStoricoTelefono:
    def test_richiede_il_parametro_telefono(self, api_client):
        response = api_client.get(reverse("prenotazione-piscina-storico-telefono"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_pubblico_e_match_esatto_sul_telefono(self, api_client, inventario):
        cliente = ClienteFactory(telefono="3331112222")
        altro_cliente = ClienteFactory(telefono="3339998888")
        propria = PrenotazionePiscinaFactory(inventario=inventario, cliente_id=cliente, data="2026-08-01")
        PrenotazionePiscinaFactory(inventario=inventario, cliente_id=altro_cliente, data="2026-08-02")

        response = api_client.get(
            reverse("prenotazione-piscina-storico-telefono"), {"telefono": "3331112222"}
        )

        assert response.status_code == status.HTTP_200_OK
        ids = [row["id"] for row in response.data]
        assert ids == [str(propria.pk)]

    def test_nessun_match_restituisce_lista_vuota(self, api_client):
        response = api_client.get(
            reverse("prenotazione-piscina-storico-telefono"), {"telefono": "0000000000"}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_include_anche_le_cancellate(self, api_client, inventario):
        # A differenza di 'recenti' (pannello notifiche staff), qui il cliente deve vedere anche
        # le proprie prenotazioni annullate — è il suo storico completo, non un feed di arrivi.
        cliente = ClienteFactory(telefono="3331112222")
        cancellata = PrenotazionePiscinaFactory(inventario=inventario, cliente_id=cliente, stato="CANCELLED")

        response = api_client.get(
            reverse("prenotazione-piscina-storico-telefono"), {"telefono": "3331112222"}
        )

        ids = [row["id"] for row in response.data]
        assert str(cancellata.pk) in ids

    def test_ordina_per_data_decrescente(self, api_client, inventario):
        cliente = ClienteFactory(telefono="3331112222")
        vecchia = PrenotazionePiscinaFactory(inventario=inventario, cliente_id=cliente, data="2026-01-01")
        recente = PrenotazionePiscinaFactory(inventario=inventario, cliente_id=cliente, data="2026-06-01")

        response = api_client.get(
            reverse("prenotazione-piscina-storico-telefono"), {"telefono": "3331112222"}
        )

        ids = [row["id"] for row in response.data]
        assert ids == [str(recente.pk), str(vecchia.pk)]


class TestDettaglioPubblico:
    def test_pubblico_restituisce_il_dettaglio_completo(self, api_client, inventario):
        cliente = ClienteFactory(telefono="3331112222", nome="Anna Dettaglio")
        prenotazione = PrenotazionePiscinaFactory(
            inventario=inventario, cliente_id=cliente, data="2026-08-10", ora="10:00", note="Allergia nichel"
        )

        response = api_client.get(reverse("prenotazione-piscina-dettaglio-pubblico", args=[prenotazione.pk]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(prenotazione.pk)
        assert response.data["cliente_nome"] == "Anna Dettaglio"
        assert response.data["cliente_telefono"] == "3331112222"
        assert response.data["note"] == "Allergia nichel"
        assert response.data["inventario_nome"] == inventario.nome

    def test_pubblico_anche_per_una_prenotazione_cancellata(self, api_client, inventario):
        # A differenza di scarica_biglietto, qui non c'è alcun blocco per stato: consultare i
        # dettagli di una prenotazione passata/cancellata resta lecito.
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, stato="CANCELLED")

        response = api_client.get(reverse("prenotazione-piscina-dettaglio-pubblico", args=[prenotazione.pk]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["stato"] == "CANCELLED"

    def test_id_inesistente_restituisce_404(self, api_client):
        response = api_client.get(
            reverse("prenotazione-piscina-dettaglio-pubblico", args=["00000000-0000-0000-0000-000000000000"])
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


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
