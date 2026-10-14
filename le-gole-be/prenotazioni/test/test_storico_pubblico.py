import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.settings import api_settings

from prenotazioni.serializers import nome_abbreviato, telefono_mascherato
from prenotazioni.test.factories import (
    NoleggioRacchettaFactory,
    PrenotazioneAsportoFactory,
    PrenotazionePadelFactory,
    PrenotazionePiscinaFactory,
)
from users.test.factories import ClienteFactory

pytestmark = pytest.mark.django_db

STORICO = {
    'piscina': 'prenotazione-piscina-storico-telefono',
    'asporto': 'prenotazione-asporto-storico-telefono',
    'padel': 'prenotazione-padel-storico-telefono',
}
DETTAGLIO = {
    'piscina': 'prenotazione-piscina-dettaglio-pubblico',
    'asporto': 'prenotazione-asporto-dettaglio-pubblico',
    'padel': 'prenotazione-padel-dettaglio-pubblico',
}
# Campi che un estraneo con in mano solo un numero di telefono non deve mai vedere nell'elenco.
CAMPI_VIETATI_ELENCO = {'cliente_id', 'cliente_telefono', 'note', 'creata_da_staff', 'created_at', 'updated_at'}


@pytest.fixture
def cliente():
    return ClienteFactory(nome='Mario Rossi Bianchi', telefono='3331234567')


@pytest.fixture
def prenotazioni(cliente, configurazione_padel):
    return {
        'piscina': PrenotazionePiscinaFactory(cliente_id=cliente, note='Allergia nichel'),
        'asporto': PrenotazioneAsportoFactory(cliente_id=cliente, note='Senza glutine'),
        'padel': PrenotazionePadelFactory(cliente_id=cliente, note='Campo coperto'),
    }


def _cerca(api_client, servizio, telefono='3331234567'):
    return api_client.post(reverse(STORICO[servizio]), {'telefono': telefono}, format='json')


class TestHelper:
    @pytest.mark.parametrize('nome,atteso', [
        ('Mario Rossi', 'Mario R.'),
        ('Mario Rossi Bianchi', 'Mario B.'),
        ('Mario', 'Mario'),
        ('  ', ''),
        ('', ''),
    ])
    def test_nome_abbreviato(self, nome, atteso):
        assert nome_abbreviato(nome) == atteso

    @pytest.mark.parametrize('telefono,atteso', [
        ('3331234567', '•••••••567'),
        ('+39 333 123', '••••••••123'),
        ('12', '•••'),
    ])
    def test_telefono_mascherato(self, telefono, atteso):
        assert telefono_mascherato(telefono) == atteso


@pytest.mark.parametrize('servizio', ['piscina', 'asporto', 'padel'])
class TestElencoPubblico:
    def test_get_non_e_piu_accettata(self, api_client, servizio):
        # Il telefono non deve finire in un URL (cronologia del browser, log di accesso).
        response = api_client.get(reverse(STORICO[servizio]), {'telefono': '3331234567'})
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_non_espone_dati_personali(self, api_client, prenotazioni, servizio):
        response = _cerca(api_client, servizio)

        assert response.status_code == status.HTTP_200_OK
        riga = response.data[0]
        assert CAMPI_VIETATI_ELENCO.isdisjoint(riga.keys())
        assert riga['cliente_nome'] == 'Mario B.'
        assert '3331234567' not in str(response.data)

    def test_telefono_vuoto_rifiutato(self, api_client, servizio):
        response = api_client.post(reverse(STORICO[servizio]), {'telefono': '   '}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.parametrize('servizio', ['piscina', 'asporto', 'padel'])
class TestDettaglioPubblico:
    def test_maschera_telefono_e_abbrevia_il_nome(self, api_client, prenotazioni, servizio):
        prenotazione = prenotazioni[servizio]

        response = api_client.get(reverse(DETTAGLIO[servizio], args=[prenotazione.pk]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['cliente_telefono'] == '•••••••567'
        assert response.data['cliente_nome'] == 'Mario B.'
        assert 'creata_da_staff' not in response.data
        # Servono a "Riprenota"/"Riordina": restano nel dettaglio.
        assert response.data['cliente_id'] == prenotazione.cliente_id_id
        assert response.data['note'] == prenotazione.note


def test_dettaglio_padel_include_i_noleggi_e_gli_snapshot(api_client, prenotazioni):
    partita = prenotazioni['padel']
    NoleggioRacchettaFactory(prenotazione=partita, quantita=1)

    response = api_client.get(reverse(DETTAGLIO['padel'], args=[partita.pk]))

    assert len(response.data['noleggi']) == 1
    assert {'prezzo_partita', 'prezzo_palline'} <= response.data.keys()


class TestLimiteDedicato:
    def test_ogni_servizio_ha_il_proprio_contatore(self, api_client, monkeypatch, configurazione_padel):
        monkeypatch.setitem(api_settings.DEFAULT_THROTTLE_RATES, 'storico_telefono_minuto', '1/min')

        risposte = [_cerca(api_client, s).status_code for s in ('piscina', 'asporto', 'padel', 'piscina')]

        assert risposte == [200, 200, 200, 429]

    def test_limite_giornaliero(self, api_client, monkeypatch):
        monkeypatch.setitem(api_settings.DEFAULT_THROTTLE_RATES, 'storico_telefono_giorno', '2/day')

        risposte = [_cerca(api_client, 'asporto').status_code for _ in range(3)]

        assert risposte == [200, 200, 429]

    def test_risposta_429_indica_quando_riprovare(self, api_client, monkeypatch):
        monkeypatch.setitem(api_settings.DEFAULT_THROTTLE_RATES, 'storico_telefono_minuto', '1/min')
        _cerca(api_client, 'piscina')

        response = _cerca(api_client, 'piscina')

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert 0 < int(response['Retry-After']) <= 60

    def test_non_tocca_gli_altri_endpoint_pubblici(self, api_client, monkeypatch, prenotazioni):
        monkeypatch.setitem(api_settings.DEFAULT_THROTTLE_RATES, 'storico_telefono_minuto', '1/min')
        _cerca(api_client, 'asporto')
        assert _cerca(api_client, 'asporto').status_code == 429

        response = api_client.get(reverse(DETTAGLIO['asporto'], args=[prenotazioni['asporto'].pk]))
        assert response.status_code == status.HTTP_200_OK
