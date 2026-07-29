import pytest
from django.urls import reverse
from rest_framework import status

from prenotazioni.models import PrenotazionePiscina
from struttura.test.factories import PiscinaInventarioFactory

from .factories import GiornoPienoPiscinaFactory

pytestmark = pytest.mark.django_db


def _payload(inventario, cliente, **overrides):
    payload = {
        "cliente_id": str(cliente.pk),
        "inventario": str(inventario.pk),
        "data": "2026-08-01",
        "ora": "12:00",
        "ingressi": 1,
        "ombrellone": 0,
        "gazebo": 0,
        "lettino": 0,
        "sdraia": 0,
    }
    payload.update(overrides)
    return payload


class TestCreazionePubblica:
    def test_anonimo_puo_creare_e_nasce_pending(self, api_client, inventario, cliente):
        response = api_client.post(reverse("prenotazione-piscina-list"), _payload(inventario, cliente), format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["stato"] == "PENDING"

        creata = PrenotazionePiscina.objects.get(pk=response.data["id"])
        assert creata.stato == "PENDING"


class TestControlloOrarioApertura:
    def test_rifiuta_orario_prima_dell_apertura(self, api_client, inventario, cliente):
        # L'inventario di default (fixture) apre alle 10:00 (default del modello).
        response = api_client.post(
            reverse("prenotazione-piscina-list"), _payload(inventario, cliente, ora="09:00"), format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ora" in response.data

    def test_rifiuta_orario_dopo_la_chiusura(self, api_client, inventario, cliente):
        # Chiusura di default 19:00.
        response = api_client.post(
            reverse("prenotazione-piscina-list"), _payload(inventario, cliente, ora="20:00"), format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ora" in response.data

    def test_accetta_orario_nel_range_di_apertura(self, api_client, inventario, cliente):
        response = api_client.post(
            reverse("prenotazione-piscina-list"), _payload(inventario, cliente, ora="10:00"), format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED


class TestOrarioRidottoPomeridiano:
    def test_rifiuta_ingressi_ridotti_prima_della_soglia(self, api_client, inventario, cliente):
        # Soglia di default 14:00.
        response = api_client.post(
            reverse("prenotazione-piscina-list"),
            _payload(inventario, cliente, ora="12:00", ingressi=0, ingressi_ridotti=1),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ingressi_ridotti" in response.data

    def test_accetta_ingressi_ridotti_dopo_la_soglia(self, api_client, inventario, cliente):
        response = api_client.post(
            reverse("prenotazione-piscina-list"),
            _payload(inventario, cliente, ora="15:00", ingressi=0, ingressi_ridotti=1),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_rifiuta_ingressi_interi_dopo_la_soglia_se_il_ridotto_e_configurato(self, api_client, cliente):
        inventario = PiscinaInventarioFactory(prezzo_ingresso_ridotto="5.00")

        response = api_client.post(
            reverse("prenotazione-piscina-list"),
            _payload(inventario, cliente, ora="15:00", ingressi=1),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ingressi" in response.data

    def test_accetta_ingressi_interi_dopo_la_soglia_se_il_ridotto_non_e_configurato(self, api_client, inventario, cliente):
        # prezzo_ingresso_ridotto di default è 0.00 (non configurato): la soglia sopra non
        # deve applicarsi, non essendoci un'alternativa reale a cui dirottare il cliente.
        response = api_client.post(
            reverse("prenotazione-piscina-list"),
            _payload(inventario, cliente, ora="15:00", ingressi=1),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED


class TestAntiOverbooking:
    @pytest.mark.parametrize(
        "campo,totale_attr",
        [
            ("ombrellone", "totale_ombrelloni"),
            ("gazebo", "totale_gazebi"),
            ("lettino", "totale_lettini"),
            ("sdraia", "totale_sdraie"),
        ],
    )
    def test_rifiuta_se_supera_i_residui(self, api_client, inventario, cliente, campo, totale_attr):
        totale = getattr(inventario, totale_attr)

        response = api_client.post(
            reverse("prenotazione-piscina-list"),
            _payload(inventario, cliente, **{campo: totale + 1}),
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert campo in response.data
        assert str(totale) in str(response.data[campo])

    def test_accetta_se_esattamente_al_limite(self, api_client, inventario, cliente):
        response = api_client.post(
            reverse("prenotazione-piscina-list"),
            _payload(inventario, cliente, ombrellone=inventario.totale_ombrelloni),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED


class TestGiornoPieno:
    def test_blocca_la_creazione_anonima_se_il_giorno_e_pieno(self, api_client, inventario, cliente):
        GiornoPienoPiscinaFactory(inventario=inventario, data="2026-08-01")

        response = api_client.post(reverse("prenotazione-piscina-list"), _payload(inventario, cliente), format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "data" in response.data

    def test_non_blocca_la_creazione_da_staff_autenticato(self, auth_client, inventario, cliente):
        GiornoPienoPiscinaFactory(inventario=inventario, data="2026-08-01")

        response = auth_client.post(reverse("prenotazione-piscina-list"), _payload(inventario, cliente), format="json")

        assert response.status_code == status.HTTP_201_CREATED
