import pytest
from rest_framework.test import APIRequestFactory

from users.permissions import IsSuperUser

from .factories import SuperUserFactory, UtenteFactory

pytestmark = pytest.mark.django_db

factory = APIRequestFactory()


def test_nega_utente_anonimo():
    request = factory.get("/")
    request.user = None
    assert IsSuperUser().has_permission(request, view=None) is False


def test_nega_staff_non_superuser():
    request = factory.get("/")
    request.user = UtenteFactory()
    assert IsSuperUser().has_permission(request, view=None) is False


def test_consente_superuser():
    request = factory.get("/")
    request.user = SuperUserFactory()
    assert IsSuperUser().has_permission(request, view=None) is True
