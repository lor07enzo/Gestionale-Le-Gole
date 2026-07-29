import uuid

import pytest

from .factories import ClienteFactory, UtenteFactory

pytestmark = pytest.mark.django_db


def test_utente_ha_pk_uuid_generata_automaticamente():
    utente = UtenteFactory()
    assert isinstance(utente.pk, uuid.UUID)


def test_utente_str_include_username():
    utente = UtenteFactory(username="mario")
    assert str(utente) == "mario (Staff)"


def test_cliente_ha_pk_uuid_generata_automaticamente():
    cliente = ClienteFactory()
    assert isinstance(cliente.pk, uuid.UUID)


def test_cliente_str_include_nome_e_telefono():
    cliente = ClienteFactory(nome="Luigi Verdi", telefono="3331234567")
    assert str(cliente) == "Luigi Verdi - 3331234567"
