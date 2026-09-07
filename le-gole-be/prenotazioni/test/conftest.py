import datetime
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from struttura.models import ConfigurazionePadel
from struttura.test.factories import PiscinaInventarioFactory
from users.test.factories import ClienteFactory, UtenteFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def staff_user(db):
    return UtenteFactory()


@pytest.fixture
def auth_client(api_client, staff_user):
    api_client.force_authenticate(user=staff_user)
    return api_client


@pytest.fixture
def inventario(db):
    return PiscinaInventarioFactory()


@pytest.fixture
def cliente(db):
    return ClienteFactory()


@pytest.fixture
def configurazione_padel(db):
    """
    Configurazione padel attiva con una griglia piccola e prevedibile: 10:00-13:00, partite da
    60 minuti -> slot 10:00 / 11:00 / 12:00. Il singleton non ha una factory (esiste una sola
    riga, get_solo() la crea al primo accesso), quindi la fixture ne imposta i valori.
    """
    config = ConfigurazionePadel.get_solo()
    config.attivo = True
    config.orario_apertura = datetime.time(10, 0)
    config.orario_chiusura = datetime.time(13, 0)
    config.durata_partita_minuti = 60
    config.prezzo_partita = Decimal('30.00')
    config.max_partecipanti = 4
    config.prezzo_noleggio_palline = Decimal('5.00')
    config.save()
    return config
