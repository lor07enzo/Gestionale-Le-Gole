from datetime import time

import pytest

from struttura.models import ConfigurazionePadel
from .factories import GiornoChiusoPadelFactory

pytestmark = pytest.mark.django_db


class TestSingleton:
    def test_get_solo_crea_la_riga_al_primo_accesso(self):
        assert ConfigurazionePadel.objects.count() == 0

        ConfigurazionePadel.get_solo()

        assert ConfigurazionePadel.objects.count() == 1

    def test_get_solo_restituisce_sempre_la_stessa_riga(self):
        prima = ConfigurazionePadel.get_solo()
        seconda = ConfigurazionePadel.get_solo()

        assert prima.pk == seconda.pk
        assert ConfigurazionePadel.objects.count() == 1


class TestSlotDisponibili:
    def test_slot_generati_a_passi_di_durata(self, configurazione_padel):
        assert configurazione_padel.slot_disponibili() == [time(10, 0), time(11, 0), time(12, 0)]

    def test_esclude_lo_slot_che_sforerebbe_la_chiusura(self, configurazione_padel):
        # 10:00-13:00 con partite da 120 minuti: solo le 10:00 (12:00 finirebbe alle 14:00).
        configurazione_padel.durata_partita_minuti = 120
        configurazione_padel.save()

        assert configurazione_padel.slot_disponibili() == [time(10, 0)]

    def test_nessuno_slot_se_la_durata_supera_la_finestra(self, configurazione_padel):
        configurazione_padel.durata_partita_minuti = 240
        configurazione_padel.save()

        assert configurazione_padel.slot_disponibili() == []


class TestOrarioValido:
    def test_accetta_un_orario_della_griglia(self, configurazione_padel):
        assert configurazione_padel.orario_valido(time(11, 0)) is True

    @pytest.mark.parametrize('ora', [time(10, 30), time(9, 0), time(13, 0)])
    def test_rifiuta_un_orario_fuori_griglia(self, configurazione_padel, ora):
        assert configurazione_padel.orario_valido(ora) is False


class TestStr:
    def test_str_configurazione_attiva(self, configurazione_padel):
        assert str(configurazione_padel) == (
            "Padel (Attivo) - dalle 10:00 alle 13:00 - partite da 60 min"
        )

    def test_str_configurazione_disattivata(self, configurazione_padel):
        configurazione_padel.attivo = False

        assert "(Disattivato)" in str(configurazione_padel)

    def test_str_giorno_chiuso(self):
        giorno = GiornoChiusoPadelFactory(data="2026-09-10")

        assert str(giorno) == "Padel chiuso il 2026-09-10"

    def test_str_racchetta_include_nome_e_prezzo(self):
        from decimal import Decimal

        from .factories import RacchettaPadelFactory

        racchetta = RacchettaPadelFactory(nome="Babolat Air Viper", prezzo_noleggio=Decimal("6.50"))

        assert str(racchetta) == "Babolat Air Viper - €6.50"
