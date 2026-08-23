import pytest

from menu.serializers import ProdottoSerializer, VoceOrdineSerializer

from .factories import AllergeneFactory, CategoriaFactory, ProdottoFactory
from prenotazioni.test.factories import PrenotazioneAsportoFactory

pytestmark = pytest.mark.django_db


class TestProdottoSerializer:
    def test_espone_il_nome_della_categoria(self):
        categoria = CategoriaFactory(nome="Panini")
        prodotto = ProdottoFactory(categoria=categoria)

        data = ProdottoSerializer(prodotto).data

        assert data["categoria_nome"] == "Panini"

    def test_accetta_una_lista_di_allergeni_scrivibile(self):
        categoria = CategoriaFactory()
        glutine = AllergeneFactory()
        lattosio = AllergeneFactory()
        serializer = ProdottoSerializer(
            data={
                "nome": "Pizza ai quattro formaggi",
                "categoria": categoria.pk,
                "prezzo": "9.00",
                "allergeni": [glutine.pk, lattosio.pk],
            }
        )
        assert serializer.is_valid(), serializer.errors
        prodotto = serializer.save()

        assert set(prodotto.allergeni.values_list("id", flat=True)) == {glutine.pk, lattosio.pk}

    def test_allergeni_e_opzionale(self):
        categoria = CategoriaFactory()
        serializer = ProdottoSerializer(
            data={"nome": "Acqua naturale", "categoria": categoria.pk, "prezzo": "1.50"}
        )
        assert serializer.is_valid(), serializer.errors
        prodotto = serializer.save()

        assert prodotto.allergeni.count() == 0


class TestQuantita:
    def test_rifiuta_quantita_zero(self):
        prenotazione = PrenotazioneAsportoFactory()
        prodotto = ProdottoFactory()
        serializer = VoceOrdineSerializer(
            data={"prenotazione": prenotazione.pk, "prodotto": prodotto.pk, "quantita": 0}
        )
        assert not serializer.is_valid()
        assert "quantita" in serializer.errors

    def test_accetta_quantita_positiva(self):
        prenotazione = PrenotazioneAsportoFactory()
        prodotto = ProdottoFactory()
        serializer = VoceOrdineSerializer(
            data={"prenotazione": prenotazione.pk, "prodotto": prodotto.pk, "quantita": 2}
        )
        assert serializer.is_valid(), serializer.errors


class TestPrezzoUnitarioReadOnly:
    def test_un_prezzo_inviato_dal_client_viene_ignorato(self):
        # prezzo_unitario è sempre uno snapshot server-side (VoceOrdineViewSet.perform_create):
        # un valore nel payload non deve mai finire in validated_data.
        prenotazione = PrenotazioneAsportoFactory()
        prodotto = ProdottoFactory(prezzo="8.50")
        serializer = VoceOrdineSerializer(
            data={
                "prenotazione": prenotazione.pk,
                "prodotto": prodotto.pk,
                "quantita": 1,
                "prezzo_unitario": "0.01",
            }
        )
        assert serializer.is_valid(), serializer.errors
        assert "prezzo_unitario" not in serializer.validated_data
