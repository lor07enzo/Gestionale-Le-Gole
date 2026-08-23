import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status

from prenotazioni.test.factories import PrenotazioneAsportoFactory

from .factories import AllergeneFactory, CategoriaFactory, ProdottoFactory, VoceOrdineFactory

pytestmark = pytest.mark.django_db


def _immagine_test(nome="foto.png"):
    # Un PNG minimo ma genuino: ImageField valida il contenuto (via Pillow), un file finto
    # con solo bytes casuali verrebbe rifiutato con un 400.
    buffer = io.BytesIO()
    Image.new("RGB", (1, 1), color="red").save(buffer, format="PNG")
    return SimpleUploadedFile(nome, buffer.getvalue(), content_type="image/png")


class TestCategoriaPermessi:
    def test_anonimo_puo_elencare(self, api_client):
        CategoriaFactory()
        response = api_client.get(reverse("categoria-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_anonimo_non_puo_creare(self, api_client):
        response = api_client.post(reverse("categoria-list"), {"nome": "Panini"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_staff_puo_creare(self, auth_client):
        response = auth_client.post(reverse("categoria-list"), {"nome": "Panini"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_nome_duplicato_rifiutato(self, auth_client):
        CategoriaFactory(nome="Panini")
        response = auth_client.post(reverse("categoria-list"), {"nome": "Panini"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "nome" in response.data


class TestCategoriaSeed:
    def test_categoria_pizze_seminata_dalla_migrazione(self, api_client):
        response = api_client.get(reverse("categoria-list"))
        nomi = [c["nome"] for c in response.data]
        assert "Pizze" in nomi


class TestCategoriaEliminazione:
    def test_eliminabile_se_senza_prodotti(self, auth_client):
        categoria = CategoriaFactory()
        response = auth_client.delete(reverse("categoria-detail", args=[categoria.pk]))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_bloccata_se_esiste_un_prodotto_collegato(self, auth_client):
        categoria = CategoriaFactory()
        ProdottoFactory(categoria=categoria)

        response = auth_client.delete(reverse("categoria-detail", args=[categoria.pk]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "detail" in response.data


class TestAllergenePermessi:
    def test_anonimo_puo_elencare(self, api_client):
        AllergeneFactory()
        response = api_client.get(reverse("allergene-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_anonimo_non_puo_creare(self, api_client):
        response = api_client.post(reverse("allergene-list"), {"nome": "Coloranti"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_staff_puo_creare(self, auth_client):
        response = auth_client.post(reverse("allergene-list"), {"nome": "Coloranti"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED


class TestAllergeneIcona:
    def test_seminati_i_14_allergeni_standard_con_icona(self, api_client):
        # 0007_seed_allergeni_standard.py — verifica che la data migration abbia davvero popolato
        # il catalogo, non solo che il campo esista sul modello.
        response = api_client.get(reverse("allergene-list"))
        glutine = next(a for a in response.data if a["nome"] == "Glutine")
        assert glutine["icona"] == "🌾"
        assert len(response.data) >= 14

    def test_creazione_con_icona_personalizzata(self, auth_client):
        response = auth_client.post(
            reverse("allergene-list"), {"nome": "Coloranti", "icona": "🎨"}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["icona"] == "🎨"

    def test_icona_opzionale(self, auth_client):
        response = auth_client.post(reverse("allergene-list"), {"nome": "Coloranti"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["icona"] == ""


class TestAllergeneEliminazione:
    def test_eliminare_un_allergene_scollega_i_prodotti_senza_bloccare(self, auth_client, prodotto):
        allergene = AllergeneFactory()
        prodotto.allergeni.add(allergene)

        response = auth_client.delete(reverse("allergene-detail", args=[allergene.pk]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        prodotto.refresh_from_db()
        assert prodotto.allergeni.count() == 0


class TestProdottoPermessi:
    def test_anonimo_puo_elencare(self, api_client):
        ProdottoFactory()
        response = api_client.get(reverse("prodotto-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_anonimo_non_puo_creare(self, api_client, categoria):
        response = api_client.post(
            reverse("prodotto-list"),
            {"nome": "Margherita", "categoria": categoria.pk, "prezzo": "6.50"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_staff_puo_creare(self, auth_client, categoria):
        response = auth_client.post(
            reverse("prodotto-list"),
            {"nome": "Margherita", "categoria": categoria.pk, "prezzo": "6.50"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_categoria_obbligatoria(self, auth_client):
        response = auth_client.post(
            reverse("prodotto-list"), {"nome": "Margherita", "prezzo": "6.50"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "categoria" in response.data

    def test_staff_puo_creare_con_allergeni(self, auth_client, categoria):
        glutine = AllergeneFactory()
        lattosio = AllergeneFactory()
        response = auth_client.post(
            reverse("prodotto-list"),
            {
                "nome": "Margherita",
                "categoria": categoria.pk,
                "prezzo": "6.50",
                "allergeni": [str(glutine.pk), str(lattosio.pk)],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        # response.data contiene i valori Python pre-render (UUID), non le stringhe JSON.
        assert set(response.data["allergeni"]) == {glutine.pk, lattosio.pk}


class TestProdottoFiltri:
    def test_filtra_per_categoria(self, api_client):
        panini = CategoriaFactory(nome="Panini")
        bevande = CategoriaFactory(nome="Bevande")
        ProdottoFactory(categoria=panini)
        ProdottoFactory(categoria=bevande)

        response = api_client.get(reverse("prodotto-list"), {"categoria": panini.pk})

        categorie = [p["categoria_nome"] for p in response.data]
        assert categorie == ["Panini"]

    def test_filtra_per_disponibile(self, api_client):
        ProdottoFactory(disponibile=True)
        ProdottoFactory(disponibile=False)

        response = api_client.get(reverse("prodotto-list"), {"disponibile": "true"})

        assert len(response.data) == 1
        assert response.data[0]["disponibile"] is True


class TestProdottoCampiCalcolati:
    def test_espone_il_nome_della_categoria(self, api_client):
        categoria = CategoriaFactory(nome="Antipasti")
        prodotto = ProdottoFactory(categoria=categoria)

        response = api_client.get(reverse("prodotto-detail", args=[prodotto.pk]))

        assert response.data["categoria_nome"] == "Antipasti"


class TestProdottoImmagine:
    def test_creazione_con_immagine_multipart(self, auth_client, categoria):
        response = auth_client.post(
            reverse("prodotto-list"),
            {"nome": "Margherita", "categoria": categoria.pk, "prezzo": "6.50", "immagine": _immagine_test()},
            format="multipart",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["immagine"]

    def test_prodotto_senza_immagine_serializza_a_null(self, api_client, prodotto):
        response = api_client.get(reverse("prodotto-detail", args=[prodotto.pk]))
        assert response.data["immagine"] is None

    def test_un_file_non_immagine_viene_rifiutato(self, auth_client, categoria):
        file_finto = SimpleUploadedFile("note.txt", b"non e' un'immagine", content_type="text/plain")
        response = auth_client.post(
            reverse("prodotto-list"),
            {"nome": "Margherita", "categoria": categoria.pk, "prezzo": "6.50", "immagine": file_finto},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "immagine" in response.data

    def test_aggiornare_limmagine_sostituisce_quella_precedente(self, auth_client, prodotto):
        auth_client.patch(
            reverse("prodotto-detail", args=[prodotto.pk]),
            {"immagine": _immagine_test("prima.png")},
            format="multipart",
        )
        response = auth_client.patch(
            reverse("prodotto-detail", args=[prodotto.pk]),
            {"immagine": _immagine_test("seconda.png")},
            format="multipart",
        )
        assert response.status_code == status.HTTP_200_OK
        assert "seconda" in response.data["immagine"]


class TestVoceOrdinePermessi:
    def test_anonimo_non_puo_elencare(self, api_client):
        response = api_client.get(reverse("voce-ordine-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_anonimo_puo_creare(self, api_client, prodotto):
        prenotazione = PrenotazioneAsportoFactory()
        payload = {"prenotazione": str(prenotazione.pk), "prodotto": str(prodotto.pk), "quantita": 2}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED


class TestVoceOrdinePrezzoSnapshot:
    def test_il_prezzo_inviato_dal_client_viene_ignorato(self, api_client, prodotto):
        prodotto.prezzo = "9.00"
        prodotto.save()
        prenotazione = PrenotazioneAsportoFactory()
        payload = {
            "prenotazione": str(prenotazione.pk),
            "prodotto": str(prodotto.pk),
            "quantita": 1,
            "prezzo_unitario": "0.01",
        }

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["prezzo_unitario"] == "9.00"

    def test_un_cambio_di_prezzo_successivo_non_altera_le_voci_gia_create(self, api_client, prodotto):
        voce = VoceOrdineFactory(prodotto=prodotto, prezzo_unitario="8.50")
        prodotto.prezzo = "12.00"
        prodotto.save()

        voce.refresh_from_db()
        assert str(voce.prezzo_unitario) == "8.50"


class TestVoceOrdineDisponibilita:
    def test_anonimo_non_puo_ordinare_un_prodotto_non_disponibile(self, api_client):
        prodotto = ProdottoFactory(disponibile=False)
        prenotazione = PrenotazioneAsportoFactory()
        payload = {"prenotazione": str(prenotazione.pk), "prodotto": str(prodotto.pk), "quantita": 1}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_staff_puo_aggiungere_un_prodotto_non_disponibile(self, auth_client):
        prodotto = ProdottoFactory(disponibile=False)
        prenotazione = PrenotazioneAsportoFactory()
        payload = {"prenotazione": str(prenotazione.pk), "prodotto": str(prodotto.pk), "quantita": 1}

        response = auth_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED


class TestVoceOrdineFiltri:
    def test_filtra_per_prenotazione(self, auth_client):
        prenotazione = PrenotazioneAsportoFactory()
        propria = VoceOrdineFactory(prenotazione=prenotazione)
        VoceOrdineFactory()

        response = auth_client.get(reverse("voce-ordine-list"), {"prenotazione": str(prenotazione.pk)})

        ids = [v["id"] for v in response.data]
        assert ids == [str(propria.pk)]
