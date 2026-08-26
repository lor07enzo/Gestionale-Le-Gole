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
        assert str(config) == "Asporto: dalle 11:00 alle 22:00"

    def test_configurazione_asporto_con_secondo_turno(self):
        config = ConfigurazioneAsporto.get_solo()
        config.orario_apertura_2 = datetime.time(19, 0)
        config.orario_chiusura_2 = datetime.time(22, 30)
        config.save()
        assert str(config) == "Asporto: dalle 11:00 alle 22:00 e dalle 19:00 alle 22:30"


class TestConfigurazioneAsportoOrari:
    # `descrizione_orari()`/`orario_valido()` — secondo turno opzionale (pranzo/cena), sezione 15.
    def test_descrizione_orari_un_solo_turno(self):
        config = ConfigurazioneAsporto.get_solo()
        assert config.descrizione_orari() == "dalle 11:00 alle 22:00"

    def test_descrizione_orari_due_turni(self):
        config = ConfigurazioneAsporto.get_solo()
        config.orario_apertura_2 = datetime.time(19, 0)
        config.orario_chiusura_2 = datetime.time(22, 30)
        config.save()
        assert config.descrizione_orari() == "dalle 11:00 alle 22:00 e dalle 19:00 alle 22:30"

    def test_orario_valido_dentro_il_primo_turno(self):
        config = ConfigurazioneAsporto.get_solo()
        assert config.orario_valido(datetime.time(12, 0)) is True

    def test_orario_valido_fuori_da_ogni_turno_senza_secondo_turno(self):
        config = ConfigurazioneAsporto.get_solo()
        assert config.orario_valido(datetime.time(23, 30)) is False

    def test_orario_valido_nel_secondo_turno(self):
        config = ConfigurazioneAsporto.get_solo()
        config.orario_apertura_2 = datetime.time(19, 0)
        config.orario_chiusura_2 = datetime.time(22, 30)
        config.save()
        assert config.orario_valido(datetime.time(20, 0)) is True

    def test_orario_valido_nella_pausa_tra_i_due_turni_e_falso(self):
        config = ConfigurazioneAsporto.get_solo()
        config.orario_apertura = datetime.time(12, 0)
        config.orario_chiusura = datetime.time(15, 30)
        config.orario_apertura_2 = datetime.time(19, 0)
        config.orario_chiusura_2 = datetime.time(22, 0)
        config.save()
        assert config.orario_valido(datetime.time(17, 0)) is False


class TestConfigurazioneAsportoSingleton:
    def test_get_solo_crea_la_riga_al_primo_accesso(self):
        assert ConfigurazioneAsporto.objects.count() == 0
        config = ConfigurazioneAsporto.get_solo()
        assert ConfigurazioneAsporto.objects.count() == 1
        assert config.orario_apertura == datetime.time(11, 0)

    def test_limite_prodotti_orario_nessun_limite_di_default(self):
        # Default None = nessun limite di capacità per orario impostato (sezione 15) — distinto
        # da 0, che PositiveSmallIntegerField+min_value=1 lato serializer esclude comunque.
        config = ConfigurazioneAsporto.get_solo()
        assert config.limite_prodotti_orario is None

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
        categoria_b = CategoriaFactory(nome="Dolci")
        categoria_a = CategoriaFactory(nome="Antipasti")
        ProdottoFactory(categoria=categoria_b, nome="Coca Cola")
        ProdottoFactory(categoria=categoria_a, nome="Bruschette")
        ProdottoFactory(categoria=categoria_a, nome="Affettati")

        nomi = list(Prodotto.objects.values_list("nome", flat=True))

        assert nomi == ["Affettati", "Bruschette", "Coca Cola"]
