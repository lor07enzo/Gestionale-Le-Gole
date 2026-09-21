"""
Notifica push allo staff quando arriva una prenotazione self-service (sezione 8 punto 13).

`invia_notifica_staff` è sempre mockata: qui interessa **se e con cosa** viene chiamata, non come
spedisce — quello è coperto da `users/test/test_push.py`. Mockarla evita anche di far partire un
thread reale in mezzo alla suite.

Il punto centrale è il filtro: solo le richieste anonime generano una notifica, esattamente come
`creata_da_staff=False`. Avvisare lo staff di un walk-in che ha appena registrato lui stesso
sarebbe rumore, non un segnale — stesso principio già in vigore per il feed `recenti` del
pannello in-app (sezione 11).
"""

from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone

pytestmark = pytest.mark.django_db

OGGI = timezone.localdate().isoformat()


@pytest.fixture
def notifica():
    with patch('prenotazioni.views.invia_notifica_staff') as mock:
        yield mock


def _payload_piscina(inventario, cliente, **overrides):
    base = {
        'cliente_id': str(cliente.pk),
        'inventario': str(inventario.pk),
        'data': OGGI,
        'ora': '12:00',
        'ingressi': 1,
        'ombrellone': 0,
        'gazebo': 0,
        'lettino': 0,
        'sdraia': 0,
    }
    base.update(overrides)
    return base


class TestPiscina:
    def test_una_prenotazione_anonima_avvisa_lo_staff(
        self, api_client, inventario, cliente, notifica
    ):
        risposta = api_client.post(
            reverse('prenotazione-piscina-list'),
            _payload_piscina(inventario, cliente),
            format='json',
        )
        assert risposta.status_code == 201

        argomenti = notifica.call_args.kwargs
        assert argomenti['titolo'] == '🏊 Nuova prenotazione piscina'
        assert argomenti['corpo'] == f'{cliente.nome} · alle 12:00'

    def test_i_dati_permettono_di_aprire_la_mappa_del_giorno_giusto(
        self, api_client, inventario, cliente, notifica
    ):
        """La mappa staff è per (inventario, data): senza entrambi il tap non saprebbe dove andare."""
        api_client.post(
            reverse('prenotazione-piscina-list'),
            _payload_piscina(inventario, cliente),
            format='json',
        )

        dati = notifica.call_args.kwargs['dati']
        assert dati['categoria'] == 'PISCINA'
        assert dati['inventarioId'] == str(inventario.pk)
        assert dati['data'] == OGGI
        assert dati['prenotazioneId']

    def test_una_prenotazione_dello_staff_non_avvisa_nessuno(
        self, auth_client, inventario, cliente, notifica
    ):
        risposta = auth_client.post(
            reverse('prenotazione-piscina-list'),
            _payload_piscina(inventario, cliente),
            format='json',
        )

        assert risposta.status_code == 201
        notifica.assert_not_called()


class TestAsporto:
    def test_un_ordine_anonimo_avvisa_lo_staff(self, api_client, cliente, notifica):
        risposta = api_client.post(
            reverse('prenotazione-asporto-list'),
            {'cliente_id': str(cliente.pk), 'data': OGGI, 'ora': '18:30'},
            format='json',
        )
        assert risposta.status_code == 201

        argomenti = notifica.call_args.kwargs
        assert argomenti['titolo'] == '🥡 Nuovo ordine asporto'
        assert argomenti['corpo'] == f'{cliente.nome} · ritiro alle 18:30'
        assert argomenti['dati']['categoria'] == 'ASPORTO'

    def test_un_ordine_dello_staff_non_avvisa_nessuno(self, auth_client, cliente, notifica):
        risposta = auth_client.post(
            reverse('prenotazione-asporto-list'),
            {'cliente_id': str(cliente.pk), 'data': OGGI, 'ora': '18:30'},
            format='json',
        )

        assert risposta.status_code == 201
        notifica.assert_not_called()


class TestPadel:
    def test_una_partita_anonima_avvisa_lo_staff(
        self, api_client, cliente, configurazione_padel, notifica
    ):
        risposta = api_client.post(
            reverse('prenotazione-padel-list'),
            {'cliente_id': str(cliente.pk), 'data': OGGI, 'ora': '10:00', 'partecipanti': 4},
            format='json',
        )
        assert risposta.status_code == 201

        argomenti = notifica.call_args.kwargs
        assert argomenti['titolo'] == '🎾 Nuova partita padel'
        assert argomenti['corpo'] == f'{cliente.nome} · alle 10:00'
        assert argomenti['dati']['categoria'] == 'PADEL'

    def test_una_partita_dello_staff_non_avvisa_nessuno(
        self, auth_client, cliente, configurazione_padel, notifica
    ):
        risposta = auth_client.post(
            reverse('prenotazione-padel-list'),
            {'cliente_id': str(cliente.pk), 'data': OGGI, 'ora': '10:00', 'partecipanti': 4},
            format='json',
        )

        assert risposta.status_code == 201
        notifica.assert_not_called()


class TestFormatoOrario:
    def test_la_data_compare_solo_se_non_e_oggi(self, api_client, inventario, cliente, notifica):
        """Su una schermata di blocco lo spazio è poco: "oggi" resta implicito."""
        api_client.post(
            reverse('prenotazione-piscina-list'),
            _payload_piscina(inventario, cliente, data='2026-12-24', ora='15:30'),
            format='json',
        )

        assert notifica.call_args.kwargs['corpo'] == f'{cliente.nome} · 24/12 alle 15:30'
