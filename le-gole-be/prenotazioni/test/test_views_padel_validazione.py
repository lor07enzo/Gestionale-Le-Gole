import pytest
from django.urls import reverse
from django.utils import timezone

from prenotazioni.test.factories import NoleggioRacchettaFactory, PrenotazionePadelFactory
from struttura.test.factories import GiornoChiusoPadelFactory

pytestmark = pytest.mark.django_db

LIST_URL = reverse('prenotazione-padel-list')


def payload(cliente, **overrides):
    base = {
        'cliente_id': str(cliente.id),
        'data': timezone.localdate().isoformat(),
        'ora': '10:00',
        'partecipanti': 4,
    }
    base.update(overrides)
    return base


class TestServizioDisattivato:
    """
    L'interruttore `attivo` chiude solo il canale online: lo staff ha visibilità diretta sul
    campo e può comunque registrare una partita — stesso principio di GiornoPienoPiscina.
    """

    def test_blocca_la_richiesta_anonima(self, api_client, cliente, configurazione_padel):
        configurazione_padel.attivo = False
        configurazione_padel.save()

        response = api_client.post(LIST_URL, payload(cliente), format='json')

        assert response.status_code == 400

    def test_non_blocca_lo_staff(self, auth_client, cliente, configurazione_padel):
        configurazione_padel.attivo = False
        configurazione_padel.save()

        response = auth_client.post(LIST_URL, payload(cliente), format='json')

        assert response.status_code == 201


class TestGiornoChiuso:
    def test_blocca_la_richiesta_anonima(self, api_client, cliente, configurazione_padel):
        GiornoChiusoPadelFactory(data=timezone.localdate())

        response = api_client.post(LIST_URL, payload(cliente), format='json')

        assert response.status_code == 400
        assert 'data' in response.data

    def test_non_blocca_lo_staff(self, auth_client, cliente, configurazione_padel):
        GiornoChiusoPadelFactory(data=timezone.localdate())

        response = auth_client.post(LIST_URL, payload(cliente), format='json')

        assert response.status_code == 201

    def test_altro_giorno_non_e_toccato(self, api_client, cliente, configurazione_padel):
        GiornoChiusoPadelFactory(data=timezone.localdate() + timezone.timedelta(days=3))

        response = api_client.post(LIST_URL, payload(cliente), format='json')

        assert response.status_code == 201


class TestOrario:
    """
    L'allineamento alla griglia di slot vale per chiunque, staff incluso: un orario disallineato
    creerebbe una partita a cavallo di due slot che l'anti-overbooking non rileverebbe.
    """

    def test_orario_fuori_dall_apertura_rifiutato(self, api_client, cliente, configurazione_padel):
        response = api_client.post(LIST_URL, payload(cliente, ora='08:00'), format='json')

        assert response.status_code == 400
        assert 'ora' in response.data

    def test_orario_non_allineato_alla_griglia_rifiutato(self, api_client, cliente, configurazione_padel):
        # Griglia 10:00/11:00/12:00: le 10:30 sarebbero a cavallo di due slot.
        response = api_client.post(LIST_URL, payload(cliente, ora='10:30'), format='json')

        assert response.status_code == 400
        assert 'ora' in response.data

    def test_orario_non_allineato_rifiutato_anche_allo_staff(self, auth_client, cliente, configurazione_padel):
        response = auth_client.post(LIST_URL, payload(cliente, ora='10:30'), format='json')

        assert response.status_code == 400

    def test_ultimo_slot_che_termina_alla_chiusura_accettato(self, api_client, cliente, configurazione_padel):
        # 12:00 + 60 minuti = 13:00, esattamente l'orario di chiusura.
        response = api_client.post(LIST_URL, payload(cliente, ora='12:00'), format='json')

        assert response.status_code == 201

    def test_slot_che_sforerebbe_la_chiusura_rifiutato(self, api_client, cliente, configurazione_padel):
        response = api_client.post(LIST_URL, payload(cliente, ora='13:00'), format='json')

        assert response.status_code == 400


class TestAntiOverbooking:
    def test_slot_gia_prenotato_rifiutato(self, api_client, cliente, configurazione_padel):
        PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00')

        response = api_client.post(LIST_URL, payload(cliente, ora='10:00'), format='json')

        assert response.status_code == 400
        assert 'ora' in response.data

    def test_slot_libero_accanto_a_uno_occupato_accettato(self, api_client, cliente, configurazione_padel):
        PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00')

        response = api_client.post(LIST_URL, payload(cliente, ora='11:00'), format='json')

        assert response.status_code == 201

    def test_una_prenotazione_cancellata_non_occupa_lo_slot(self, api_client, cliente, configurazione_padel):
        PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00', stato='CANCELLED')

        response = api_client.post(LIST_URL, payload(cliente, ora='10:00'), format='json')

        assert response.status_code == 201

    def test_lo_stesso_slot_in_un_altro_giorno_e_libero(self, api_client, cliente, configurazione_padel):
        PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00')
        domani = (timezone.localdate() + timezone.timedelta(days=1)).isoformat()

        response = api_client.post(LIST_URL, payload(cliente, ora='10:00', data=domani), format='json')

        assert response.status_code == 201

    def test_sovrapposizione_con_una_partita_di_durata_diversa(self, api_client, cliente, configurazione_padel):
        # Partita creata quando la durata configurata era di 180 minuti (10:00-13:00): copre
        # anche lo slot delle 11:00 della griglia attuale, pur non condividendone l'orario di
        # inizio — il confronto per intervallo lo rileva, uno per uguaglianza di `ora` no.
        PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00', durata_minuti=180)

        response = api_client.post(LIST_URL, payload(cliente, ora='11:00'), format='json')

        assert response.status_code == 400
        assert 'ora' in response.data


class TestPartecipantiENoleggio:
    def test_oltre_il_massimo_configurato_rifiutato(self, api_client, cliente, configurazione_padel):
        response = api_client.post(LIST_URL, payload(cliente, partecipanti=5), format='json')

        assert response.status_code == 400
        assert 'partecipanti' in response.data

    def test_rifiutato_anche_allo_staff(self, auth_client, cliente, configurazione_padel):
        response = auth_client.post(LIST_URL, payload(cliente, partecipanti=5), format='json')

        assert response.status_code == 400

    def test_zero_partecipanti_rifiutato(self, api_client, cliente, configurazione_padel):
        response = api_client.post(LIST_URL, payload(cliente, partecipanti=0), format='json')

        assert response.status_code == 400
        assert 'partecipanti' in response.data

    def test_prenotazione_con_palline_accettata(self, api_client, cliente, configurazione_padel):
        # Le racchette non sono più un campo di questo payload: si aggiungono come righe
        # separate (/noleggi-racchetta/, vedi test_views_noleggio_racchetta.py).
        response = api_client.post(
            LIST_URL, payload(cliente, partecipanti=2, palline_noleggiate=True), format='json'
        )

        assert response.status_code == 201

    def test_partecipanti_non_scendono_sotto_le_racchette_gia_noleggiate(self, auth_client, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(partecipanti=4)
        NoleggioRacchettaFactory(prenotazione=prenotazione, quantita=3)

        url = reverse('prenotazione-padel-detail', args=[prenotazione.id])
        response = auth_client.patch(url, {'partecipanti': 2}, format='json')

        assert response.status_code == 400
        assert 'partecipanti' in response.data


class TestAggiornamento:
    def test_patch_parziale_non_si_blocca_da_solo_sullo_slot(self, auth_client, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00')

        url = reverse('prenotazione-padel-detail', args=[prenotazione.id])
        response = auth_client.patch(url, {'note': 'Portano le proprie racchette'}, format='json')

        assert response.status_code == 200

    def test_patch_verso_uno_slot_gia_occupato_rifiutato(self, auth_client, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00')
        PrenotazionePadelFactory(data=timezone.localdate(), ora='11:00')

        url = reverse('prenotazione-padel-detail', args=[prenotazione.id])
        response = auth_client.patch(url, {'ora': '11:00'}, format='json')

        assert response.status_code == 400
        assert 'ora' in response.data

    def test_patch_verso_uno_slot_libero_accettato(self, auth_client, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00')

        url = reverse('prenotazione-padel-detail', args=[prenotazione.id])
        response = auth_client.patch(url, {'ora': '12:00'}, format='json')

        assert response.status_code == 200

    def test_patch_che_supera_i_partecipanti_massimi_rifiutato(self, auth_client, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00')

        url = reverse('prenotazione-padel-detail', args=[prenotazione.id])
        response = auth_client.patch(url, {'partecipanti': 9}, format='json')

        assert response.status_code == 400

    def test_annullamento_libera_lo_slot(self, auth_client, cliente, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(data=timezone.localdate(), ora='10:00')

        url = reverse('prenotazione-padel-detail', args=[prenotazione.id])
        assert auth_client.patch(url, {'stato': 'CANCELLED'}, format='json').status_code == 200

        response = auth_client.post(LIST_URL, payload(cliente, ora='10:00'), format='json')
        assert response.status_code == 201
