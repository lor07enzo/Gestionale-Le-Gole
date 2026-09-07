from datetime import time
from decimal import Decimal

import pytest

from struttura.test.factories import PostazioneFactory, RacchettaPadelFactory
from users.test.factories import ClienteFactory

from .factories import (
    GiornoPienoPiscinaFactory,
    NoleggioRacchettaFactory,
    OccupazionePostazioneFactory,
    PrenotazioneAsportoFactory,
    PrenotazionePadelFactory,
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


def test_str_prenotazione_padel_include_cliente_data_e_ora():
    cliente = ClienteFactory(nome="Mario Rossi")
    prenotazione = PrenotazionePadelFactory(cliente_id=cliente, data="2026-08-01", ora=time(10, 0))
    assert str(prenotazione) == "Padel - Mario Rossi del 2026-08-01 alle 10:00"


def test_orario_fine_padel_derivato_dalla_durata_snapshot():
    prenotazione = PrenotazionePadelFactory(ora=time(10, 0), durata_minuti=90)
    assert prenotazione.orario_fine == time(11, 30)


def test_totale_padel_somma_partita_righe_noleggio_e_palline():
    prenotazione = PrenotazionePadelFactory(palline_noleggiate=True)
    NoleggioRacchettaFactory(prenotazione=prenotazione, quantita=2, prezzo_unitario=Decimal("3.00"))
    # 30.00 partita + 2 x 3.00 racchette + 5.00 palline
    assert prenotazione.totale == Decimal("41.00")


def test_totale_padel_somma_righe_di_marche_diverse():
    prenotazione = PrenotazionePadelFactory(palline_noleggiate=False)
    NoleggioRacchettaFactory(prenotazione=prenotazione, quantita=2, prezzo_unitario=Decimal("5.00"))
    NoleggioRacchettaFactory(prenotazione=prenotazione, quantita=1, prezzo_unitario=Decimal("8.00"))
    assert prenotazione.totale == Decimal("48.00")
    assert prenotazione.racchette_totali == 3


def test_totale_padel_senza_noleggio_e_il_solo_prezzo_partita():
    prenotazione = PrenotazionePadelFactory(palline_noleggiate=False)
    assert prenotazione.totale == Decimal("30.00")
    assert prenotazione.racchette_totali == 0


def test_subtotale_riga_noleggio():
    noleggio = NoleggioRacchettaFactory(quantita=3, prezzo_unitario=Decimal("4.50"))
    assert noleggio.subtotale == Decimal("13.50")


def test_str_riga_noleggio_include_quantita_e_marca():
    racchetta = RacchettaPadelFactory(nome="Babolat Air Viper")
    noleggio = NoleggioRacchettaFactory(racchetta=racchetta, quantita=2)
    assert str(noleggio).startswith("2x Babolat Air Viper")


def test_totale_padel_ignora_il_prezzo_palline_se_non_noleggiate():
    prenotazione = PrenotazionePadelFactory(palline_noleggiate=False, prezzo_palline=Decimal("9.00"))
    assert prenotazione.totale == Decimal("30.00")
