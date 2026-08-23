from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status

from prenotazioni.test.factories import PrenotazioneAsportoFactory

from .factories import ProdottoFactory, VoceOrdineFactory

pytestmark = pytest.mark.django_db


class TestRicevutaAsportoConVoci:
    # Stesso pattern direzionale già usato da menu/test/factories.py (VoceOrdineFactory importa
    # PrenotazioneAsportoFactory da prenotazioni.test.factories, non il contrario) — i test più
    # semplici dell'azione (bloccata per CANCELLED, generata senza voci) vivono invece in
    # prenotazioni/test/test_views_asporto.py, che non ha bisogno di alcun modello di menu.
    def test_genera_il_pdf_con_le_righe_ordine_reali_e_il_totale_corretto(self, api_client):
        prenotazione = PrenotazioneAsportoFactory(stato="CONFIRMED")
        prodotto = ProdottoFactory(nome="Margherita", prezzo=Decimal("6.00"))
        VoceOrdineFactory(prenotazione=prenotazione, prodotto=prodotto, quantita=2, prezzo_unitario=Decimal("6.00"))
        VoceOrdineFactory(prenotazione=prenotazione, quantita=1, prezzo_unitario=Decimal("2.50"))

        response = api_client.get(reverse("prenotazione-asporto-scarica-ricevuta", args=[prenotazione.pk]))

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"
        # Un PDF reale (WeasyPrint), non solo una risposta vuota: verifica indiretta che il
        # template abbia effettivamente renderizzato le righe (nessuna eccezione sollevata da
        # `voce.prodotto.nome`/`.subtotale` nel loop) e sia stato prodotto un file non banale.
        assert response.content.startswith(b"%PDF")
        assert prenotazione.totale == Decimal("14.50")
