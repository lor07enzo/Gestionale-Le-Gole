import pytest
from django.urls import reverse
from rest_framework import status

from prenotazioni.test.factories import PrenotazioneAsportoFactory
from users.test.factories import ClienteFactory

from ..models import ConfigurazioneAsporto, GiornoChiusoAsporto

pytestmark = pytest.mark.django_db

# Stesso pattern direzionale già usato da menu/test/test_views_ricevuta_asporto.py: questo file
# vive in `menu/test/` (non in `prenotazioni/test/`) proprio perché ha bisogno di manipolare
# `ConfigurazioneAsporto`/`GiornoChiusoAsporto` (modelli di `menu`) insieme all'endpoint
# `PrenotazioneAsportoViewSet` (di `prenotazioni`) — mantiene `prenotazioni/test/` privo di
# qualunque riferimento a `menu`, coerente con la dipendenza "a senso unico" documentata in
# CLAUDE.md (sezione 1), che per la sola validazione lato serializer è ora bidirezionale.


class TestValidazioneOrarioRitiro:
    def test_rifiutato_se_prima_dell_orario_di_apertura(self, api_client):
        cliente = ClienteFactory()
        ConfigurazioneAsporto.get_solo()  # default 11:00-22:00
        payload = {"cliente_id": str(cliente.pk), "data": "2026-08-20", "ora": "09:00"}

        response = api_client.post(reverse("prenotazione-asporto-list"), payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ora" in response.data

    def test_rifiutato_se_dopo_l_orario_di_chiusura(self, api_client):
        cliente = ClienteFactory()
        ConfigurazioneAsporto.get_solo()
        payload = {"cliente_id": str(cliente.pk), "data": "2026-08-20", "ora": "23:00"}

        response = api_client.post(reverse("prenotazione-asporto-list"), payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ora" in response.data

    def test_rifiutato_anche_per_lo_staff_autenticato(self, auth_client):
        # A differenza del blocco "giorno chiuso" (sotto), l'orario di ritiro è vincolato per
        # chiunque: riflette quando la cucina prepara davvero gli ordini, non solo il canale
        # online — nessun bypass per lo staff, stesso trattamento incondizionato già riservato
        # all'orario apertura/chiusura piscina.
        cliente = ClienteFactory()
        ConfigurazioneAsporto.get_solo()
        payload = {"cliente_id": str(cliente.pk), "data": "2026-08-20", "ora": "23:30"}

        response = auth_client.post(reverse("prenotazione-asporto-list"), payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ora" in response.data

    def test_accettato_dentro_l_orario_configurato(self, api_client):
        cliente = ClienteFactory()
        configurazione = ConfigurazioneAsporto.get_solo()
        configurazione.orario_apertura = "10:00"
        configurazione.orario_chiusura = "15:00"
        configurazione.save()
        payload = {"cliente_id": str(cliente.pk), "data": "2026-08-20", "ora": "12:00"}

        response = api_client.post(reverse("prenotazione-asporto-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED

    def test_patch_parziale_su_altro_campo_non_richiede_di_ripetere_un_orario_gia_valido(self, auth_client):
        # Un PATCH che tocca solo `note` non deve fallire per l'orario: ricade su quello già
        # salvato sull'istanza (12:00, factory default — dentro i limiti di default 11:00-22:00).
        prenotazione = PrenotazioneAsportoFactory()
        response = auth_client.patch(
            reverse("prenotazione-asporto-detail", args=[prenotazione.pk]),
            {"note": "senza cipolla"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

    def test_patch_che_sposta_l_orario_fuori_apertura_viene_rifiutato(self, auth_client):
        prenotazione = PrenotazioneAsportoFactory()
        response = auth_client.patch(
            reverse("prenotazione-asporto-detail", args=[prenotazione.pk]),
            {"ora": "23:59"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ora" in response.data


class TestValidazioneGiornoChiuso:
    def test_ordine_anonimo_rifiutato_in_un_giorno_segnato_chiuso(self, api_client):
        cliente = ClienteFactory()
        GiornoChiusoAsporto.objects.create(data="2026-12-25")
        payload = {"cliente_id": str(cliente.pk), "data": "2026-12-25", "ora": "12:00"}

        response = api_client.post(reverse("prenotazione-asporto-list"), payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "data" in response.data

    def test_staff_puo_comunque_registrare_un_ordine_in_un_giorno_segnato_chiuso(self, auth_client):
        cliente = ClienteFactory()
        GiornoChiusoAsporto.objects.create(data="2026-12-25")
        payload = {"cliente_id": str(cliente.pk), "data": "2026-12-25", "ora": "12:00"}

        response = auth_client.post(reverse("prenotazione-asporto-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED

    def test_ordine_anonimo_accettato_in_un_giorno_non_segnato_chiuso(self, api_client):
        cliente = ClienteFactory()
        GiornoChiusoAsporto.objects.create(data="2026-12-25")
        payload = {"cliente_id": str(cliente.pk), "data": "2026-12-26", "ora": "12:00"}

        response = api_client.post(reverse("prenotazione-asporto-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
