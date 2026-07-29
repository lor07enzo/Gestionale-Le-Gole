import pytest

from prenotazioni.utils import calcola_disponibilita

from .factories import PrenotazionePiscinaFactory

pytestmark = pytest.mark.django_db


class TestCalcolaDisponibilita:
    def test_residuo_pieno_senza_prenotazioni(self, inventario):
        residui = calcola_disponibilita(inventario, "2026-08-01")

        assert residui["ombrellone"] == inventario.totale_ombrelloni
        assert residui["gazebo"] == inventario.totale_gazebi
        assert residui["lettino"] == inventario.totale_lettini
        assert residui["sdraia"] == inventario.totale_sdraie

    def test_sottrae_le_prenotazioni_attive(self, inventario):
        data = "2026-08-01"
        PrenotazionePiscinaFactory(inventario=inventario, data=data, ombrellone=2, gazebo=1, lettino=3, sdraia=4)

        residui = calcola_disponibilita(inventario, data)

        assert residui["ombrellone"] == inventario.totale_ombrelloni - 2
        assert residui["gazebo"] == inventario.totale_gazebi - 1
        assert residui["lettino"] == inventario.totale_lettini - 3
        assert residui["sdraia"] == inventario.totale_sdraie - 4

    def test_somma_piu_prenotazioni_della_stessa_data(self, inventario):
        data = "2026-08-01"
        PrenotazionePiscinaFactory(inventario=inventario, data=data, ombrellone=2)
        PrenotazionePiscinaFactory(inventario=inventario, data=data, ombrellone=3)

        residui = calcola_disponibilita(inventario, data)
        assert residui["ombrellone"] == inventario.totale_ombrelloni - 5

    def test_ignora_le_prenotazioni_cancellate(self, inventario):
        data = "2026-08-01"
        PrenotazionePiscinaFactory(inventario=inventario, data=data, ombrellone=2, stato="CANCELLED")

        residui = calcola_disponibilita(inventario, data)
        assert residui["ombrellone"] == inventario.totale_ombrelloni

    def test_esclude_la_prenotazione_indicata_da_exclude_id(self, inventario):
        data = "2026-08-01"
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, data=data, ombrellone=2)

        residui = calcola_disponibilita(inventario, data, exclude_id=prenotazione.id)
        assert residui["ombrellone"] == inventario.totale_ombrelloni

    def test_ignora_le_prenotazioni_di_altre_date(self, inventario):
        PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-02", ombrellone=2)

        residui = calcola_disponibilita(inventario, "2026-08-01")
        assert residui["ombrellone"] == inventario.totale_ombrelloni

    def test_ignora_le_prenotazioni_di_un_altro_inventario(self, inventario):
        from struttura.test.factories import PiscinaInventarioFactory

        altro_inventario = PiscinaInventarioFactory()
        PrenotazionePiscinaFactory(inventario=altro_inventario, data="2026-08-01", ombrellone=2)

        residui = calcola_disponibilita(inventario, "2026-08-01")
        assert residui["ombrellone"] == inventario.totale_ombrelloni
