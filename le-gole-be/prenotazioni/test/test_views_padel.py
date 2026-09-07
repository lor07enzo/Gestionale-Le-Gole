import datetime
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from prenotazioni.models import PrenotazionePadel
from prenotazioni.test.factories import NoleggioRacchettaFactory, PrenotazionePadelFactory
from struttura.test.factories import GiornoChiusoPadelFactory, RacchettaPadelFactory

pytestmark = pytest.mark.django_db

LIST_URL = reverse('prenotazione-padel-list')
DISPONIBILITA_URL = reverse('prenotazione-padel-disponibilita')
RECENTI_URL = reverse('prenotazione-padel-recenti')
STORICO_URL = reverse('prenotazione-padel-storico-telefono')


def payload(cliente, **overrides):
    base = {
        'cliente_id': str(cliente.id),
        'data': timezone.localdate().isoformat(),
        'ora': '10:00',
        'partecipanti': 4,
    }
    base.update(overrides)
    return base


class TestPermessi:
    def test_anonimo_non_puo_elencare(self, api_client):
        assert api_client.get(LIST_URL).status_code == 401

    def test_staff_puo_elencare(self, auth_client):
        assert auth_client.get(LIST_URL).status_code == 200

    def test_anonimo_puo_creare(self, api_client, cliente, configurazione_padel):
        response = api_client.post(LIST_URL, payload(cliente), format='json')

        assert response.status_code == 201


class TestCreazione:
    def test_richiesta_anonima_nasce_confermata_e_non_da_staff(self, api_client, cliente, configurazione_padel):
        # Anche se il payload tenta esplicitamente stato/creata_da_staff, perform_create li forza.
        response = api_client.post(
            LIST_URL,
            payload(cliente, stato='PENDING', creata_da_staff=True),
            format='json',
        )

        assert response.status_code == 201
        prenotazione = PrenotazionePadel.objects.get(pk=response.data['id'])
        assert prenotazione.stato == 'CONFIRMED'
        assert prenotazione.creata_da_staff is False

    def test_staff_sceglie_lo_stato_e_risulta_creata_da_staff(self, auth_client, cliente, configurazione_padel):
        response = auth_client.post(LIST_URL, payload(cliente, stato='PENDING'), format='json')

        assert response.status_code == 201
        prenotazione = PrenotazionePadel.objects.get(pk=response.data['id'])
        assert prenotazione.stato == 'PENDING'
        assert prenotazione.creata_da_staff is True

    def test_durata_e_prezzi_sono_uno_snapshot_della_configurazione(self, api_client, cliente, configurazione_padel):
        # Il payload prova a imporre valori propri: sono read_only, vanno sempre ignorati.
        response = api_client.post(
            LIST_URL,
            payload(
                cliente,
                durata_minuti=5,
                prezzo_partita='0.01',
                prezzo_palline='0.01',
            ),
            format='json',
        )

        assert response.status_code == 201
        prenotazione = PrenotazionePadel.objects.get(pk=response.data['id'])
        assert prenotazione.durata_minuti == 60
        assert prenotazione.prezzo_partita == Decimal('30.00')
        assert prenotazione.prezzo_palline == Decimal('5.00')

    def test_snapshot_non_cambia_se_la_configurazione_cambia_dopo(self, api_client, cliente, configurazione_padel):
        response = api_client.post(LIST_URL, payload(cliente), format='json')
        configurazione_padel.prezzo_partita = Decimal('99.00')
        configurazione_padel.save()

        prenotazione = PrenotazionePadel.objects.get(pk=response.data['id'])
        assert prenotazione.prezzo_partita == Decimal('30.00')


class TestSerializzazione:
    def test_espone_totale_orario_fine_e_dati_cliente(self, auth_client, cliente, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(cliente_id=cliente, palline_noleggiate=True)
        racchetta = RacchettaPadelFactory(nome='Babolat Air Viper')
        NoleggioRacchettaFactory(
            prenotazione=prenotazione, racchetta=racchetta, quantita=2,
            prezzo_unitario=Decimal('3.00'),
        )

        url = reverse('prenotazione-padel-detail', args=[prenotazione.id])
        response = auth_client.get(url)

        assert response.status_code == 200
        # 30.00 partita + 2 racchette x 3.00 + 5.00 palline
        assert Decimal(response.data['totale']) == Decimal('41.00')
        assert response.data['racchette_totali'] == 2
        # Le righe di noleggio sono annidate in sola lettura, per evitare una seconda richiesta.
        assert len(response.data['noleggi']) == 1
        assert response.data['noleggi'][0]['racchetta_nome'] == 'Babolat Air Viper'
        assert response.data['orario_fine'] == '11:00:00'
        assert response.data['cliente_nome'] == cliente.nome
        assert response.data['cliente_telefono'] == cliente.telefono


class TestFiltri:
    def test_filtro_per_data(self, auth_client, configurazione_padel):
        oggi = timezone.localdate()
        PrenotazionePadelFactory(data=oggi)
        PrenotazionePadelFactory(data=oggi + datetime.timedelta(days=1))

        response = auth_client.get(LIST_URL, {'data': oggi.isoformat()})

        assert len(response.data) == 1

    def test_filtro_per_stato(self, auth_client, configurazione_padel):
        PrenotazionePadelFactory(stato='CONFIRMED')
        PrenotazionePadelFactory(stato='CANCELLED', ora='11:00')

        response = auth_client.get(LIST_URL, {'stato': 'CANCELLED'})

        assert len(response.data) == 1


class TestDisponibilita:
    def test_richiede_il_parametro_data(self, api_client, configurazione_padel):
        assert api_client.get(DISPONIBILITA_URL).status_code == 400

    def test_rifiuta_una_data_malformata(self, api_client, configurazione_padel):
        assert api_client.get(DISPONIBILITA_URL, {'data': '01-01-2030'}).status_code == 400

    def test_elenca_gli_slot_liberi(self, api_client, configurazione_padel):
        oggi = timezone.localdate()

        response = api_client.get(DISPONIBILITA_URL, {'data': oggi.isoformat()})

        assert response.status_code == 200
        assert response.data['attivo'] is True
        assert response.data['chiuso'] is False
        assert response.data['durata_minuti'] == 60
        assert response.data['slots'] == [
            {'ora': '10:00', 'disponibile': True},
            {'ora': '11:00', 'disponibile': True},
            {'ora': '12:00', 'disponibile': True},
        ]

    def test_uno_slot_gia_prenotato_risulta_occupato(self, api_client, configurazione_padel):
        oggi = timezone.localdate()
        PrenotazionePadelFactory(data=oggi, ora='11:00')

        response = api_client.get(DISPONIBILITA_URL, {'data': oggi.isoformat()})

        assert response.data['slots'] == [
            {'ora': '10:00', 'disponibile': True},
            {'ora': '11:00', 'disponibile': False},
            {'ora': '12:00', 'disponibile': True},
        ]

    def test_una_prenotazione_cancellata_non_occupa_lo_slot(self, api_client, configurazione_padel):
        oggi = timezone.localdate()
        PrenotazionePadelFactory(data=oggi, ora='11:00', stato='CANCELLED')

        response = api_client.get(DISPONIBILITA_URL, {'data': oggi.isoformat()})

        assert all(slot['disponibile'] for slot in response.data['slots'])

    def test_servizio_disattivato_non_espone_alcuno_slot(self, api_client, configurazione_padel):
        configurazione_padel.attivo = False
        configurazione_padel.save()

        response = api_client.get(DISPONIBILITA_URL, {'data': timezone.localdate().isoformat()})

        assert response.data['attivo'] is False
        assert response.data['slots'] == []

    def test_giorno_chiuso_non_espone_alcuno_slot(self, api_client, configurazione_padel):
        oggi = timezone.localdate()
        GiornoChiusoPadelFactory(data=oggi)

        response = api_client.get(DISPONIBILITA_URL, {'data': oggi.isoformat()})

        assert response.data['chiuso'] is True
        assert response.data['slots'] == []


class TestRecenti:
    def test_riservata_allo_staff(self, api_client, configurazione_padel):
        assert api_client.get(RECENTI_URL).status_code == 401

    def test_esclude_cancellate_e_prenotazioni_registrate_dallo_staff(self, auth_client, configurazione_padel):
        PrenotazionePadelFactory(ora='10:00')
        PrenotazionePadelFactory(ora='11:00', stato='CANCELLED')
        PrenotazionePadelFactory(ora='12:00', creata_da_staff=True)

        response = auth_client.get(RECENTI_URL)

        assert len(response.data) == 1
        assert response.data[0]['ora'] == '10:00:00'

    def test_rispetta_il_limite(self, auth_client, configurazione_padel):
        PrenotazionePadelFactory(ora='10:00')
        PrenotazionePadelFactory(ora='11:00')

        assert len(auth_client.get(RECENTI_URL, {'limit': 1}).data) == 1

    def test_limite_non_numerico_ricade_sul_default(self, auth_client, configurazione_padel):
        PrenotazionePadelFactory(ora='10:00')

        assert len(auth_client.get(RECENTI_URL, {'limit': 'molte'}).data) == 1


class TestStoricoTelefono:
    def test_richiede_il_telefono(self, api_client, configurazione_padel):
        assert api_client.get(STORICO_URL).status_code == 400

    def test_match_esatto_e_include_le_cancellate(self, api_client, cliente, configurazione_padel):
        PrenotazionePadelFactory(cliente_id=cliente, ora='10:00')
        PrenotazionePadelFactory(cliente_id=cliente, ora='11:00', stato='CANCELLED')
        PrenotazionePadelFactory(ora='12:00')

        response = api_client.get(STORICO_URL, {'telefono': cliente.telefono})

        assert response.status_code == 200
        assert len(response.data) == 2

    def test_telefono_parziale_non_matcha(self, api_client, cliente, configurazione_padel):
        PrenotazionePadelFactory(cliente_id=cliente)

        response = api_client.get(STORICO_URL, {'telefono': cliente.telefono[:4]})

        assert response.data == []


class TestDettaglioPubblico:
    def test_pubblico_anche_per_una_prenotazione_cancellata(self, api_client, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(stato='CANCELLED')

        url = reverse('prenotazione-padel-dettaglio-pubblico', args=[prenotazione.id])
        response = api_client.get(url)

        assert response.status_code == 200
        assert response.data['id'] == str(prenotazione.id)

    def test_id_inesistente_da_404(self, api_client, configurazione_padel):
        url = reverse(
            'prenotazione-padel-dettaglio-pubblico',
            args=['11111111-1111-1111-1111-111111111111'],
        )

        assert api_client.get(url).status_code == 404


class TestScaricaBiglietto:
    @pytest.mark.parametrize('stato', ['PENDING', 'CONFIRMED'])
    def test_genera_il_pdf(self, api_client, stato, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(
            stato=stato, palline_noleggiate=True, note='Campo coperto'
        )
        NoleggioRacchettaFactory(prenotazione=prenotazione, quantita=2)

        url = reverse('prenotazione-padel-scarica-biglietto', args=[prenotazione.id])
        response = api_client.get(url)

        assert response.status_code == 200
        assert response['Content-Type'] == 'application/pdf'
        assert response.content.startswith(b'%PDF')

    def test_non_disponibile_per_una_prenotazione_cancellata(self, api_client, configurazione_padel):
        prenotazione = PrenotazionePadelFactory(stato='CANCELLED')

        url = reverse('prenotazione-padel-scarica-biglietto', args=[prenotazione.id])

        assert api_client.get(url).status_code == 400
