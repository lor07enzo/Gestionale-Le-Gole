from decimal import Decimal

import pytest
from django.urls import reverse

from prenotazioni.test.factories import NoleggioRacchettaFactory
from struttura.models import RacchettaPadel
from struttura.test.factories import RacchettaPadelFactory

pytestmark = pytest.mark.django_db

LIST_URL = reverse('racchetta-padel-list')


class TestPermessi:
    def test_lettura_pubblica(self, api_client):
        RacchettaPadelFactory(nome='Babolat Air Viper')

        response = api_client.get(LIST_URL)

        assert response.status_code == 200
        assert response.data[0]['nome'] == 'Babolat Air Viper'

    def test_anonimo_non_puo_creare(self, api_client):
        response = api_client.post(
            LIST_URL, {'nome': 'Head Alpha', 'prezzo_noleggio': '6.00'}, format='json'
        )

        assert response.status_code == 401


class TestCrud:
    def test_staff_registra_una_marca(self, auth_client):
        response = auth_client.post(
            LIST_URL,
            {'nome': 'Head Alpha Pro', 'prezzo_noleggio': '6.50', 'quantita_disponibile': 3},
            format='json',
        )

        assert response.status_code == 201
        racchetta = RacchettaPadel.objects.get(pk=response.data['id'])
        assert racchetta.prezzo_noleggio == Decimal('6.50')
        assert racchetta.quantita_disponibile == 3
        assert racchetta.disponibile is True

    def test_nome_duplicato_rifiutato(self, auth_client):
        RacchettaPadelFactory(nome='Head Alpha')

        response = auth_client.post(
            LIST_URL, {'nome': 'Head Alpha', 'prezzo_noleggio': '6.00'}, format='json'
        )

        assert response.status_code == 400
        assert 'nome' in response.data

    def test_staff_aggiorna_il_prezzo(self, auth_client):
        racchetta = RacchettaPadelFactory(prezzo_noleggio=Decimal('5.00'))

        url = reverse('racchetta-padel-detail', args=[racchetta.id])
        response = auth_client.patch(url, {'prezzo_noleggio': '7.00'}, format='json')

        assert response.status_code == 200
        racchetta.refresh_from_db()
        assert racchetta.prezzo_noleggio == Decimal('7.00')

    def test_prezzo_negativo_rifiutato(self, auth_client):
        response = auth_client.post(
            LIST_URL, {'nome': 'Head Alpha', 'prezzo_noleggio': '-1.00'}, format='json'
        )

        assert response.status_code == 400

    def test_zero_pezzi_rifiutato(self, auth_client):
        response = auth_client.post(
            LIST_URL,
            {'nome': 'Head Alpha', 'prezzo_noleggio': '6.00', 'quantita_disponibile': 0},
            format='json',
        )

        assert response.status_code == 400
        assert 'quantita_disponibile' in response.data


class TestEliminazione:
    def test_racchetta_senza_noleggi_eliminabile(self, auth_client):
        racchetta = RacchettaPadelFactory()

        url = reverse('racchetta-padel-detail', args=[racchetta.id])

        assert auth_client.delete(url).status_code == 204

    def test_racchetta_con_noleggi_bloccata_con_400(self, auth_client, configurazione_padel):
        # PROTECT: senza il destroy() custom DRF propagherebbe un 500 grezzo.
        racchetta = RacchettaPadelFactory()
        NoleggioRacchettaFactory(racchetta=racchetta)

        url = reverse('racchetta-padel-detail', args=[racchetta.id])
        response = auth_client.delete(url)

        assert response.status_code == 400
        assert RacchettaPadel.objects.filter(pk=racchetta.id).exists()


class TestFiltri:
    def test_filtro_disponibile(self, api_client):
        RacchettaPadelFactory(disponibile=True)
        RacchettaPadelFactory(disponibile=False)

        response = api_client.get(LIST_URL, {'disponibile': 'false'})

        assert len(response.data) == 1
