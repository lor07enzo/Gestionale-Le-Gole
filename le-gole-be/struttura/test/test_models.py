from datetime import time

import pytest

from .factories import PiscinaInventarioFactory, PostazioneFactory

pytestmark = pytest.mark.django_db


def test_str_inventario_attivo_include_stato_e_orari():
    inventario = PiscinaInventarioFactory(
        nome="Listino Estate",
        isActive=True,
        orario_apertura=time(9, 0),
        orario_chiusura=time(18, 0),
    )
    assert str(inventario) == "Listino Estate (Attivo) - [09:00 - 18:00]"


def test_str_inventario_inattivo():
    inventario = PiscinaInventarioFactory(isActive=False)
    assert "(Inattivo)" in str(inventario)


def test_postazione_deleted_at_none_di_default():
    postazione = PostazioneFactory()
    assert postazione.deleted_at is None


def test_str_postazione_include_tipo_numero_e_inventario():
    inventario = PiscinaInventarioFactory(nome="Listino Estate")
    postazione = PostazioneFactory(inventario=inventario, tipo="GAZEBO", numero=7)
    assert str(postazione) == "Gazebo #7 (Listino Estate)"


def test_postazioni_ordinate_per_numero_non_per_creazione():
    inventario = PiscinaInventarioFactory()
    PostazioneFactory(inventario=inventario, numero=3)
    PostazioneFactory(inventario=inventario, numero=1)
    PostazioneFactory(inventario=inventario, numero=2)

    numeri = list(inventario.postazioni.values_list("numero", flat=True))
    assert numeri == [1, 2, 3]
