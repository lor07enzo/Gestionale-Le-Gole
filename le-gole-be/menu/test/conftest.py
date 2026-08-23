import pytest
from rest_framework.test import APIClient

from users.test.factories import UtenteFactory

from .factories import AllergeneFactory, CategoriaFactory, ProdottoFactory


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
def categoria(db):
    return CategoriaFactory()


@pytest.fixture
def allergene(db):
    return AllergeneFactory()


@pytest.fixture
def prodotto(db):
    return ProdottoFactory()
