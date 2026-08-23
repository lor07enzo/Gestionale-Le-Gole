import pytest

from struttura.test.factories import PostazioneFactory
from users.test.factories import ClienteFactory

from .factories import (
    GiornoPienoPiscinaFactory,
    OccupazionePostazioneFactory,
    PrenotazioneAsportoFactory,
    PrenotazionePiscinaFactory,
)

pytestmark = pytest.mark.django_db


def test_str_prenotazione_piscina_include_cliente_e_data():
    cliente = ClienteFactory(nome="Mario Rossi")
    prenotazione = PrenotazionePiscinaFactory(cliente_id=cliente, data="2026-08-01")
    assert str(prenotazione) == "Piscina - Mario Rossi del 2026-08-01"


def test_str_prenotazione_asporto_include_cliente_e_data():
    cliente = ClienteFactory(nome="Mario Rossi")
    prenotazione = PrenotazioneAsportoFactory(cliente_id=cliente, data="2026-08-01")
    assert str(prenotazione) == "Asporto - Mario Rossi del 2026-08-01"


def test_str_giorno_pieno_piscina():
    giorno_pieno = GiornoPienoPiscinaFactory(data="2026-08-01")
    assert str(giorno_pieno).endswith("2026-08-01 - TUTTO PRENOTATO")


def test_str_occupazione_postazione_libera_quando_senza_nome():
    occupazione = OccupazionePostazioneFactory(cliente_nome="")
    assert str(occupazione).endswith("libera")


def test_str_occupazione_postazione_con_cliente():
    occupazione = OccupazionePostazioneFactory(cliente_nome="Mario Rossi")
    assert str(occupazione).endswith("Mario Rossi")


def test_str_postazione_posizione_storico_include_coordinate():
    postazione = PostazioneFactory(numero=3)
    from prenotazioni.models import PostazionePosizioneStorico

    storico = PostazionePosizioneStorico.objects.create(postazione=postazione, data="2026-08-01", pos_x=12.3, pos_y=45.6)
    assert str(storico) == f"{postazione} @ 2026-08-01 (12.3, 45.6)"
