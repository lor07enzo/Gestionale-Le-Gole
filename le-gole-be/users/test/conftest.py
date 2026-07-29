import pytest
from rest_framework.test import APIClient

from .factories import ClienteFactory, SuperUserFactory, UtenteFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def staff_user(db):
    return UtenteFactory()


@pytest.fixture
def superuser(db):
    return SuperUserFactory()


@pytest.fixture
def cliente(db):
    return ClienteFactory()


@pytest.fixture
def staff_client(api_client, staff_user):
    api_client.force_authenticate(user=staff_user)
    return api_client


@pytest.fixture
def superuser_client(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    return api_client
