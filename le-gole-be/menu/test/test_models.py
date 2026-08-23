import datetime
import pytest
from decimal import Decimal

from prenotazioni.test.factories import PrenotazioneAsportoFactory

from menu.models import ConfigurazioneAsporto, Prodotto
from .factories import (
    AllergeneFactory,
    CategoriaFactory,
    GiornoChiusoAsportoFactory,
    ProdottoFactory,
    VoceOrdineFactory,
)

pytestmark = pytest.mark.django_db


class TestStr:
    def test_categoria(self):
        categoria = CategoriaFactory(nome="Panini")
        assert str(categoria) == "Panini"

    def test_allergene(self):
        allergene = AllergeneFactory(nome="Coloranti")
        assert str(allergene) == "Coloranti"

    def test_prodotto(self):
        prodotto = ProdottoFactory(nome="Margherita", prezzo="6.50")
        assert str(prodotto) == "Margherita - €6.50"

    def test_voce_ordine(self):
        prodotto = ProdottoFactory(nome="Margherita")
        voce = VoceOrdineFactory(prodotto=prodotto, quantita=3)
        assert str(voce) == "3x Margherita"

    def test_giorno_chiuso_asporto(self):
        giorno = GiornoChiusoAsportoFactory(data="2026-12-25")
        assert str(giorno) == "Asporto chiuso il 2026-12-25"

    def test_configurazione_asporto(self):
        config = ConfigurazioneAsporto.get_solo()
        assert str(config) == "Asporto: 11:00 - 22:00"


class TestConfigurazioneAsportoSingleton:
    def test_get_solo_crea_la_riga_al_primo_accesso(self):
        assert ConfigurazioneAsporto.objects.count() == 0
        config = ConfigurazioneAsporto.get_solo()
        assert ConfigurazioneAsporto.objects.count() == 1
        assert config.orario_apertura == datetime.time(11, 0)

    def test_get_solo_ritorna_sempre_la_stessa_riga(self):
        prima = ConfigurazioneAsporto.get_solo()
        prima.orario_apertura = datetime.time(9, 0)
        prima.save()

        seconda = ConfigurazioneAsporto.get_solo()

        assert seconda.pk == prima.pk
        assert seconda.orario_apertura == datetime.time(9, 0)
        assert ConfigurazioneAsporto.objects.count() == 1


class TestSubtotale:
    def test_moltiplica_quantita_per_prezzo_unitario(self):
        voce = VoceOrdineFactory(quantita=3, prezzo_unitario=Decimal("4.50"))
        assert voce.subtotale == Decimal("13.50")


class TestTotalePrenotazioneAsporto:
    def test_somma_le_voci_ordine_collegate(self):
        prenotazione = PrenotazioneAsportoFactory()
        VoceOrdineFactory(prenotazione=prenotazione, quantita=2, prezzo_unitario=Decimal("6.50"))
        VoceOrdineFactory(prenotazione=prenotazione, quantita=1, prezzo_unitario=Decimal("3.00"))

        assert prenotazione.totale == Decimal("16.00")

    def test_zero_senza_voci_ordine(self):
        prenotazione = PrenotazioneAsportoFactory()
        assert prenotazione.totale == Decimal("0.00")


class TestProdottoAllergeni:
    def test_un_prodotto_puo_avere_piu_allergeni(self):
        coloranti = AllergeneFactory(nome="Coloranti")
        lattosio = AllergeneFactory(nome="Lattosio")
        prodotto = ProdottoFactory()

        prodotto.allergeni.set([coloranti, lattosio])

        assert set(prodotto.allergeni.values_list("nome", flat=True)) == {"Coloranti", "Lattosio"}

    def test_un_prodotto_puo_non_avere_allergeni(self):
        prodotto = ProdottoFactory()
        assert prodotto.allergeni.count() == 0

    def test_eliminare_un_allergene_scollega_ma_non_elimina_il_prodotto(self):
        allergene = AllergeneFactory()
        prodotto = ProdottoFactory()
        prodotto.allergeni.add(allergene)

        allergene.delete()

        prodotto.refresh_from_db()
        assert prodotto.allergeni.count() == 0


class TestProdottoOrdinamento:
    def test_ordinato_per_nome_categoria_poi_nome_prodotto(self):
        categoria_b = CategoriaFactory(nome="Bevande")
        categoria_a = CategoriaFactory(nome="Antipasti")
        ProdottoFactory(categoria=categoria_b, nome="Coca Cola")
        ProdottoFactory(categoria=categoria_a, nome="Bruschette")
        ProdottoFactory(categoria=categoria_a, nome="Affettati")

        nomi = list(Prodotto.objects.values_list("nome", flat=True))

        assert nomi == ["Affettati", "Bruschette", "Coca Cola"]
