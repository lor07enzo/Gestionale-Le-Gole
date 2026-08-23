from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status

from prenotazioni.test.factories import PrenotazioneAsportoFactory

from .factories import ProdottoFactory, VoceOrdineFactory

pytestmark = pytest.mark.django_db

# Stesso pattern direzionale già usato da menu/test/test_views_ricevuta_asporto.py: il caso senza
# righe reali (voci=[]) vive in prenotazioni/test/test_views_asporto.py, che non ha bisogno di
# alcun modello di menu — qui solo lo scenario che richiede VoceOrdine/Prodotto reali.


class TestDettaglioPubblicoConVoci:
    def test_include_le_righe_ordine_con_nome_prodotto_e_subtotale(self, api_client):
        prenotazione = PrenotazioneAsportoFactory()
        prodotto = ProdottoFactory(nome="Margherita", prezzo=Decimal("6.00"))
        VoceOrdineFactory(prenotazione=prenotazione, prodotto=prodotto, quantita=2, prezzo_unitario=Decimal("6.00"))

        response = api_client.get(reverse("prenotazione-asporto-dettaglio-pubblico", args=[prenotazione.pk]))

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["voci"]) == 1
        voce = response.data["voci"][0]
        assert voce["prodotto_nome"] == "Margherita"
        assert voce["quantita"] == 2
        assert Decimal(voce["subtotale"]) == Decimal("12.00")
