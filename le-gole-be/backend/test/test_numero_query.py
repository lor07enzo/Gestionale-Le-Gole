"""
Numero di query degli elenchi caricati dalle pagine staff, costante al crescere dei record.

In produzione il database è remoto (Supabase): ogni query costa un round-trip di rete, quindi una
query per riga (N+1) su un elenco di qualche decina di prenotazioni basta a portare una pagina a
diversi secondi. Ogni test crea DIECI record e fissa un tetto che non dipende da quanti sono:
se qualcuno rimuove un `select_related`/`prefetch_related`, il conteggio cresce con le righe e
il test fallisce. Il tetto include le query di autenticazione/sessione (sempre le stesse).
"""
import datetime

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from menu.test.factories import VoceOrdineFactory
from prenotazioni.test.factories import (
    NoleggioRacchettaFactory,
    OccupazionePostazioneFactory,
    PrenotazioneAsportoFactory,
    PrenotazionePadelFactory,
    PrenotazionePiscinaFactory,
)
from struttura.test.factories import PostazioneFactory
from users.test.factories import ClienteFactory, UtenteFactory

pytestmark = pytest.mark.django_db

RIGHE = 10


@pytest.fixture
def staff_client():
    client = APIClient()
    client.force_authenticate(user=UtenteFactory())
    return client


def _get(client, url, params=None):
    response = client.get(url, params or {})
    assert response.status_code == 200, response.content
    return response.json()


def test_elenco_prenotazioni_piscina(staff_client, django_assert_max_num_queries):
    PrenotazionePiscinaFactory.create_batch(RIGHE)
    with django_assert_max_num_queries(3):
        assert len(_get(staff_client, reverse('prenotazione-piscina-list'))) == RIGHE


def test_feed_recenti_piscina(staff_client, django_assert_max_num_queries):
    PrenotazionePiscinaFactory.create_batch(RIGHE, creata_da_staff=False)
    with django_assert_max_num_queries(3):
        _get(staff_client, reverse('prenotazione-piscina-recenti'))


def test_elenco_ordini_asporto(staff_client, django_assert_max_num_queries):
    for ordine in PrenotazioneAsportoFactory.create_batch(RIGHE):
        VoceOrdineFactory.create_batch(2, prenotazione=ordine)
    with django_assert_max_num_queries(4):
        ordini = _get(staff_client, reverse('prenotazione-asporto-list'))
    assert len(ordini) == RIGHE
    assert all(o['totale'] != '0.00' for o in ordini)


def test_feed_recenti_asporto(staff_client, django_assert_max_num_queries):
    for ordine in PrenotazioneAsportoFactory.create_batch(RIGHE, creata_da_staff=False):
        VoceOrdineFactory(prenotazione=ordine)
    with django_assert_max_num_queries(4):
        _get(staff_client, reverse('prenotazione-asporto-recenti'))


def test_righe_ordine_asporto(staff_client, django_assert_max_num_queries):
    ordine = PrenotazioneAsportoFactory()
    VoceOrdineFactory.create_batch(RIGHE, prenotazione=ordine)
    with django_assert_max_num_queries(3):
        righe = _get(staff_client, reverse('voce-ordine-list'), {'prenotazione': ordine.pk})
    assert len(righe) == RIGHE


def test_elenco_partite_padel(staff_client, django_assert_max_num_queries):
    giorno = datetime.date.today()
    for indice in range(RIGHE):
        partita = PrenotazionePadelFactory(data=giorno + datetime.timedelta(days=indice))
        NoleggioRacchettaFactory(prenotazione=partita)
    with django_assert_max_num_queries(4):
        partite = _get(staff_client, reverse('prenotazione-padel-list'))
    assert len(partite) == RIGHE
    assert all(len(p['noleggi']) == 1 for p in partite)


def test_occupazioni_del_giorno(staff_client, django_assert_max_num_queries):
    giorno = datetime.date.today()
    for postazione in PostazioneFactory.create_batch(RIGHE):
        OccupazionePostazioneFactory(postazione=postazione, data=giorno)
    with django_assert_max_num_queries(3):
        _get(staff_client, reverse('occupazione-postazione-list'), {'data': giorno.isoformat()})


def test_righe_di_tutti_gli_ordini_di_un_cliente(staff_client, django_assert_max_num_queries):
    ordini = PrenotazioneAsportoFactory.create_batch(RIGHE)
    cliente = ordini[0].cliente_id
    for ordine in ordini[:3]:
        ordine.cliente_id = cliente
        ordine.save()
    for ordine in ordini:
        VoceOrdineFactory.create_batch(2, prenotazione=ordine)
    with django_assert_max_num_queries(3):
        righe = _get(staff_client, reverse('voce-ordine-list'), {'prenotazione__cliente_id': cliente.pk})
    # Solo le righe dei tre ordini del cliente, non quelle degli altri sette.
    assert len(righe) == 6
    assert {r['prenotazione'] for r in righe} == {str(o.pk) for o in ordini[:3]}


@pytest.mark.parametrize('servizio', ['piscina', 'asporto', 'padel'])
def test_storico_telefono_lato_cliente(servizio, django_assert_max_num_queries):
    """
    "Le mie prenotazioni": una query per i dati più il limite anti-abuso su cache a database
    (una lettura e una scrittura). Prima del limite unico minuto+giorno erano 13-15 query, ora 7-9 (padel precarica anche le racchette).
    """
    cliente = ClienteFactory(telefono='3331112222')
    giorno = datetime.date.today()
    for indice in range(RIGHE):
        if servizio == 'piscina':
            PrenotazionePiscinaFactory(cliente_id=cliente)
        elif servizio == 'asporto':
            VoceOrdineFactory.create_batch(2, prenotazione=PrenotazioneAsportoFactory(cliente_id=cliente))
        else:
            partita = PrenotazionePadelFactory(cliente_id=cliente, data=giorno + datetime.timedelta(days=indice))
            NoleggioRacchettaFactory(prenotazione=partita)
    url = reverse(f'prenotazione-{servizio}-storico-telefono')
    with django_assert_max_num_queries(9):
        response = APIClient().post(url, {'telefono': '3331112222'}, format='json')
    assert response.status_code == 200
    assert len(response.json()) == RIGHE
