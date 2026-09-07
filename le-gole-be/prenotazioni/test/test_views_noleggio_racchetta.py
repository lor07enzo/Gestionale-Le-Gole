from decimal import Decimal

import pytest
from django.urls import reverse

from prenotazioni.models import NoleggioRacchetta
from prenotazioni.test.factories import NoleggioRacchettaFactory, PrenotazionePadelFactory
from struttura.test.factories import RacchettaPadelFactory

pytestmark = pytest.mark.django_db

LIST_URL = reverse('noleggio-racchetta-list')


@pytest.fixture
def prenotazione(configurazione_padel):
    return PrenotazionePadelFactory(partecipanti=4)


@pytest.fixture
def racchetta():
    return RacchettaPadelFactory(prezzo_noleggio=Decimal('5.00'), quantita_disponibile=4)


def payload(prenotazione, racchetta, **overrides):
    base = {
        'prenotazione': str(prenotazione.id),
        'racchetta': str(racchetta.id),
        'quantita': 1,
    }
    base.update(overrides)
    return base


class TestPermessi:
    def test_anonimo_puo_creare(self, api_client, prenotazione, racchetta):
        response = api_client.post(LIST_URL, payload(prenotazione, racchetta), format='json')

        assert response.status_code == 201

    def test_anonimo_non_puo_elencare(self, api_client):
        assert api_client.get(LIST_URL).status_code == 401

    def test_staff_puo_elencare(self, auth_client):
        assert auth_client.get(LIST_URL).status_code == 200


class TestSnapshotPrezzo:
    def test_prezzo_copiato_dal_catalogo(self, api_client, prenotazione, racchetta):
        # Il payload prova a imporre un prezzo proprio: prezzo_unitario è read-only.
        response = api_client.post(
            LIST_URL, payload(prenotazione, racchetta, prezzo_unitario='0.01'), format='json'
        )

        assert response.status_code == 201
        assert NoleggioRacchetta.objects.get(pk=response.data['id']).prezzo_unitario == Decimal('5.00')

    def test_cambio_prezzo_a_catalogo_non_tocca_i_noleggi_gia_fatti(self, api_client, prenotazione, racchetta):
        response = api_client.post(LIST_URL, payload(prenotazione, racchetta), format='json')
        racchetta.prezzo_noleggio = Decimal('99.00')
        racchetta.save()

        assert NoleggioRacchetta.objects.get(pk=response.data['id']).prezzo_unitario == Decimal('5.00')

    def test_subtotale_e_marca_esposti(self, auth_client, prenotazione, racchetta):
        noleggio = NoleggioRacchettaFactory(
            prenotazione=prenotazione, racchetta=racchetta, quantita=3,
            prezzo_unitario=Decimal('5.00'),
        )

        url = reverse('noleggio-racchetta-detail', args=[noleggio.id])
        response = auth_client.get(url)

        assert Decimal(response.data['subtotale']) == Decimal('15.00')
        assert response.data['racchetta_nome'] == racchetta.nome


class TestValidazione:
    def test_quantita_zero_rifiutata(self, api_client, prenotazione, racchetta):
        response = api_client.post(
            LIST_URL, payload(prenotazione, racchetta, quantita=0), format='json'
        )

        assert response.status_code == 400
        assert 'quantita' in response.data

    def test_oltre_i_pezzi_posseduti_rifiutata(self, api_client, prenotazione):
        racchetta = RacchettaPadelFactory(quantita_disponibile=2)

        response = api_client.post(
            LIST_URL, payload(prenotazione, racchetta, quantita=3), format='json'
        )

        assert response.status_code == 400
        assert 'quantita' in response.data

    def test_oltre_i_pezzi_posseduti_rifiutata_anche_allo_staff(self, auth_client, prenotazione):
        racchetta = RacchettaPadelFactory(quantita_disponibile=2)

        response = auth_client.post(
            LIST_URL, payload(prenotazione, racchetta, quantita=3), format='json'
        )

        assert response.status_code == 400

    def test_racchetta_non_disponibile_rifiutata_all_anonimo(self, api_client, prenotazione):
        racchetta = RacchettaPadelFactory(disponibile=False)

        response = api_client.post(LIST_URL, payload(prenotazione, racchetta), format='json')

        assert response.status_code == 400
        assert 'racchetta' in response.data

    def test_racchetta_non_disponibile_registrabile_dallo_staff(self, auth_client, prenotazione):
        racchetta = RacchettaPadelFactory(disponibile=False)

        response = auth_client.post(LIST_URL, payload(prenotazione, racchetta), format='json')

        assert response.status_code == 201


class TestTettoPartecipanti:
    """
    Il limite "non più racchette dei giocatori" va contato sull'intera prenotazione, non sulla
    singola riga: altrimenti tre righe da una racchetta ciascuna lo aggirerebbero.
    """

    def test_una_racchetta_per_partecipante_accettata(self, api_client, racchetta):
        prenotazione = PrenotazionePadelFactory(partecipanti=2)

        response = api_client.post(
            LIST_URL, payload(prenotazione, racchetta, quantita=2), format='json'
        )

        assert response.status_code == 201

    def test_una_sola_riga_oltre_i_partecipanti_rifiutata(self, api_client, racchetta):
        prenotazione = PrenotazionePadelFactory(partecipanti=2)

        response = api_client.post(
            LIST_URL, payload(prenotazione, racchetta, quantita=3), format='json'
        )

        assert response.status_code == 400
        assert 'quantita' in response.data

    def test_somma_di_marche_diverse_oltre_i_partecipanti_rifiutata(self, api_client):
        prenotazione = PrenotazionePadelFactory(partecipanti=2)
        prima = RacchettaPadelFactory(quantita_disponibile=4)
        seconda = RacchettaPadelFactory(quantita_disponibile=4)
        NoleggioRacchettaFactory(prenotazione=prenotazione, racchetta=prima, quantita=2)

        response = api_client.post(
            LIST_URL, payload(prenotazione, seconda, quantita=1), format='json'
        )

        assert response.status_code == 400
        assert 'quantita' in response.data

    def test_marche_diverse_entro_il_limite_accettate(self, api_client):
        prenotazione = PrenotazionePadelFactory(partecipanti=4)
        prima = RacchettaPadelFactory(quantita_disponibile=4)
        seconda = RacchettaPadelFactory(quantita_disponibile=4)
        NoleggioRacchettaFactory(prenotazione=prenotazione, racchetta=prima, quantita=2)

        response = api_client.post(
            LIST_URL, payload(prenotazione, seconda, quantita=2), format='json'
        )

        assert response.status_code == 201

    def test_patch_non_conta_due_volte_la_riga_stessa(self, auth_client, racchetta):
        # Alzare la quantità di una riga esistente deve escluderla dal proprio conteggio,
        # altrimenti una riga già al limite non sarebbe più modificabile.
        prenotazione = PrenotazionePadelFactory(partecipanti=4)
        noleggio = NoleggioRacchettaFactory(
            prenotazione=prenotazione, racchetta=racchetta, quantita=3
        )

        url = reverse('noleggio-racchetta-detail', args=[noleggio.id])
        response = auth_client.patch(url, {'quantita': 4}, format='json')

        assert response.status_code == 200

    def test_stessa_marca_due_volte_sulla_stessa_prenotazione_rifiutata(self, api_client, racchetta):
        # unique_together: due racchette della stessa marca sono quantita=2, non due righe.
        prenotazione = PrenotazionePadelFactory(partecipanti=4)
        NoleggioRacchettaFactory(prenotazione=prenotazione, racchetta=racchetta, quantita=1)

        response = api_client.post(LIST_URL, payload(prenotazione, racchetta), format='json')

        assert response.status_code == 400

    def test_eliminare_una_riga_libera_il_tetto(self, auth_client, racchetta):
        prenotazione = PrenotazionePadelFactory(partecipanti=2)
        noleggio = NoleggioRacchettaFactory(
            prenotazione=prenotazione, racchetta=racchetta, quantita=2
        )

        url = reverse('noleggio-racchetta-detail', args=[noleggio.id])
        assert auth_client.delete(url).status_code == 204
        assert prenotazione.racchette_totali == 0

    def test_eliminare_la_prenotazione_elimina_le_righe(self, auth_client, racchetta):
        # CASCADE: una riga di noleggio non ha senso senza la sua partita.
        prenotazione = PrenotazionePadelFactory(partecipanti=2)
        NoleggioRacchettaFactory(prenotazione=prenotazione, racchetta=racchetta)

        url = reverse('prenotazione-padel-detail', args=[prenotazione.id])
        assert auth_client.delete(url).status_code == 204
        assert NoleggioRacchetta.objects.count() == 0
