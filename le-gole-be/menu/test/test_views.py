import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status

from prenotazioni.test.factories import PrenotazioneAsportoFactory

from menu.models import Categoria, ConfigurazioneAsporto

from .factories import (
    AllergeneFactory,
    CategoriaFactory,
    ProdottoFactory,
    VoceOrdineFactory,
)

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

    def test_categorie_bevande_e_vini_seminate_dalla_migrazione(self, api_client):
        response = api_client.get(reverse("categoria-list"))
        nomi = [c["nome"] for c in response.data]
        assert "Bevande" in nomi
        assert "Vini" in nomi


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
        dolci = CategoriaFactory(nome="Dolci")
        ProdottoFactory(categoria=panini)
        ProdottoFactory(categoria=dolci)

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


class TestVoceOrdineLimiteOrario:
    # `ConfigurazioneAsporto.limite_prodotti_orario` — un unico valore globale, applicato
    # automaticamente a *qualunque* orario (non scelto per singola fascia), vincolato per
    # chiunque, staff incluso (a differenza di `validate_prodotto`/GiornoChiusoAsporto, che
    # bypassano solo lo staff): riflette la reale capacità di preparazione della cucina.
    def _imposta_limite(self, limite):
        config = ConfigurazioneAsporto.get_solo()
        config.limite_prodotti_orario = limite
        config.save()

    def test_nessun_limite_configurato_nessuna_restrizione(self, api_client, prodotto):
        prenotazione = PrenotazioneAsportoFactory(ora="12:15")
        payload = {"prenotazione": str(prenotazione.pk), "prodotto": str(prodotto.pk), "quantita": 100}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED

    def test_accetta_esattamente_al_limite(self, api_client, prodotto):
        self._imposta_limite(15)
        esistente = PrenotazioneAsportoFactory(ora="12:15")
        VoceOrdineFactory(prenotazione=esistente, quantita=10)
        nuova = PrenotazioneAsportoFactory(ora="12:15")
        payload = {"prenotazione": str(nuova.pk), "prodotto": str(prodotto.pk), "quantita": 5}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED

    def test_rifiuta_se_supera_il_limite_anonimo(self, api_client, prodotto):
        self._imposta_limite(15)
        esistente = PrenotazioneAsportoFactory(ora="12:15")
        VoceOrdineFactory(prenotazione=esistente, quantita=10)
        nuova = PrenotazioneAsportoFactory(ora="12:15")
        payload = {"prenotazione": str(nuova.pk), "prodotto": str(prodotto.pk), "quantita": 6}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "quantita" in response.data

    def test_rifiuta_se_supera_il_limite_anche_per_lo_staff(self, auth_client, prodotto):
        self._imposta_limite(15)
        esistente = PrenotazioneAsportoFactory(ora="12:15")
        VoceOrdineFactory(prenotazione=esistente, quantita=10)
        nuova = PrenotazioneAsportoFactory(ora="12:15")
        payload = {"prenotazione": str(nuova.pk), "prodotto": str(prodotto.pk), "quantita": 6}

        response = auth_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "quantita" in response.data

    def test_prenotazioni_cancellate_non_contano_nel_limite(self, api_client, prodotto):
        self._imposta_limite(15)
        cancellata = PrenotazioneAsportoFactory(ora="12:15", stato="CANCELLED")
        VoceOrdineFactory(prenotazione=cancellata, quantita=10)
        nuova = PrenotazioneAsportoFactory(ora="12:15")
        payload = {"prenotazione": str(nuova.pk), "prodotto": str(prodotto.pk), "quantita": 15}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED

    def test_lo_stesso_limite_globale_si_applica_a_ogni_orario_indipendentemente(self, api_client, prodotto):
        # Il limite è unico e globale, ma il conteggio "già prenotato" resta scoped per
        # orario+data: esaurire le 12:15 non deve toccare il residuo delle 12:00.
        self._imposta_limite(15)
        esistente = PrenotazioneAsportoFactory(ora="12:15")
        VoceOrdineFactory(prenotazione=esistente, quantita=15)
        altro_orario = PrenotazioneAsportoFactory(ora="12:00")
        payload = {"prenotazione": str(altro_orario.pk), "prodotto": str(prodotto.pk), "quantita": 15}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED

    def test_patch_esclude_la_riga_stessa_dal_conteggio(self, auth_client, prodotto):
        self._imposta_limite(15)
        prenotazione = PrenotazioneAsportoFactory(ora="12:15")
        voce = VoceOrdineFactory(prenotazione=prenotazione, prodotto=prodotto, quantita=5)

        # Alzare la quantità di questa stessa riga fino al limite deve funzionare: la riga non va
        # sommata due volte (una come "esistente", una come quella da validare).
        response = auth_client.patch(
            reverse("voce-ordine-detail", args=[voce.pk]), {"quantita": 15}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK

        response = auth_client.patch(
            reverse("voce-ordine-detail", args=[voce.pk]), {"quantita": 16}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "quantita" in response.data

    # Bevande/Vini (categorie seminate dalla migrazione, sopra) sono escluse dal limite: non
    # contano nel conteggio "già prenotato" di un altro prodotto, né la loro stessa quantità è
    # mai confrontata col limite — CATEGORIE_ESCLUSE_LIMITE_ORARIO in menu/serializers.py.
    def test_bevande_non_contano_nel_conteggio_di_un_altro_prodotto(self, api_client, prodotto):
        self._imposta_limite(15)
        bevanda = ProdottoFactory(categoria=Categoria.objects.get(nome="Bevande"))
        esistente = PrenotazioneAsportoFactory(ora="12:15")
        VoceOrdineFactory(prenotazione=esistente, prodotto=bevanda, quantita=100)
        nuova = PrenotazioneAsportoFactory(ora="12:15")
        payload = {"prenotazione": str(nuova.pk), "prodotto": str(prodotto.pk), "quantita": 15}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED

    def test_bevanda_ordinabile_anche_col_limite_gia_esaurito_da_altri_prodotti(self, api_client, prodotto):
        self._imposta_limite(5)
        esistente = PrenotazioneAsportoFactory(ora="12:15")
        VoceOrdineFactory(prenotazione=esistente, prodotto=prodotto, quantita=5)
        bevanda = ProdottoFactory(categoria=Categoria.objects.get(nome="Bevande"))
        payload = {"prenotazione": str(esistente.pk), "prodotto": str(bevanda.pk), "quantita": 50}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED

    def test_vino_non_e_soggetto_al_limite(self, api_client):
        self._imposta_limite(5)
        vino = ProdottoFactory(categoria=Categoria.objects.get(nome="Vini"))
        prenotazione = PrenotazioneAsportoFactory(ora="12:15")
        payload = {"prenotazione": str(prenotazione.pk), "prodotto": str(vino.pk), "quantita": 100}

        response = api_client.post(reverse("voce-ordine-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED


class TestVoceOrdinePrenotatiPerOrario:
    def test_e_pubblica(self, api_client):
        response = api_client.get(reverse("voce-ordine-prenotati-per-orario"), {"data": "2026-12-25"})
        assert response.status_code == status.HTTP_200_OK

    def test_richiede_il_parametro_data(self, api_client):
        response = api_client.get(reverse("voce-ordine-prenotati-per-orario"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_rifiuta_data_malformata(self, api_client):
        response = api_client.get(reverse("voce-ordine-prenotati-per-orario"), {"data": "non-una-data"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_orario_senza_voci_non_compare(self, api_client):
        response = api_client.get(reverse("voce-ordine-prenotati-per-orario"), {"data": "2026-12-25"})
        assert response.data == {}

    def test_somma_le_quantita_per_orario(self, api_client, prodotto):
        prenotazione = PrenotazioneAsportoFactory(data="2026-12-25", ora="12:15", stato="CONFIRMED")
        VoceOrdineFactory(prenotazione=prenotazione, prodotto=prodotto, quantita=6)
        VoceOrdineFactory(prenotazione=prenotazione, prodotto=prodotto, quantita=4)

        response = api_client.get(reverse("voce-ordine-prenotati-per-orario"), {"data": "2026-12-25"})

        assert response.data == {"12:15": 10}

    def test_esclude_le_voci_di_prenotazioni_cancellate(self, api_client, prodotto):
        prenotazione = PrenotazioneAsportoFactory(data="2026-12-25", ora="12:15", stato="CANCELLED")
        VoceOrdineFactory(prenotazione=prenotazione, prodotto=prodotto, quantita=10)

        response = api_client.get(reverse("voce-ordine-prenotati-per-orario"), {"data": "2026-12-25"})

        assert response.data == {}

    def test_conteggio_isolato_per_data(self, api_client, prodotto):
        oggi = PrenotazioneAsportoFactory(data="2026-12-25", ora="12:15", stato="CONFIRMED")
        VoceOrdineFactory(prenotazione=oggi, prodotto=prodotto, quantita=5)
        domani = PrenotazioneAsportoFactory(data="2026-12-26", ora="12:15", stato="CONFIRMED")
        VoceOrdineFactory(prenotazione=domani, prodotto=prodotto, quantita=9)

        response = api_client.get(reverse("voce-ordine-prenotati-per-orario"), {"data": "2026-12-25"})

        assert response.data == {"12:15": 5}


class TestVoceOrdineFiltri:
    def test_filtra_per_prenotazione(self, auth_client):
        prenotazione = PrenotazioneAsportoFactory()
        propria = VoceOrdineFactory(prenotazione=prenotazione)
        VoceOrdineFactory()

        response = auth_client.get(reverse("voce-ordine-list"), {"prenotazione": str(prenotazione.pk)})

        ids = [v["id"] for v in response.data]
        assert ids == [str(propria.pk)]
