import pytest
from rest_framework.test import APIClient

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
