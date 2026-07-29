from datetime import datetime, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from prenotazioni.models import PostazionePosizioneStorico
from struttura.models import Postazione

from .factories import PostazioneFactory, PostazionePosizioneStoricoFactory

pytestmark = pytest.mark.django_db


def _datetime_aware(giorno):
    return timezone.make_aware(datetime.combine(giorno, datetime.min.time().replace(hour=12)))


def _backdate_creazione(postazione, giorno):
    Postazione.objects.filter(pk=postazione.pk).update(created_at=_datetime_aware(giorno))
    postazione.refresh_from_db()


def _elimina_al(postazione, giorno):
    Postazione.objects.filter(pk=postazione.pk).update(deleted_at=_datetime_aware(giorno))
    postazione.refresh_from_db()


class TestRegistrazioneStorico:
    def test_la_creazione_registra_lo_storico_per_oggi(self, auth_client, inventario):
        response = auth_client.post(
            reverse("postazione-list"),
            {"inventario": str(inventario.pk), "tipo": "OMBRELLONE", "numero": 1, "pos_x": 30, "pos_y": 40},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

        postazione_id = response.data["id"]
        riga = PostazionePosizioneStorico.objects.get(postazione_id=postazione_id, data=timezone.localdate())
        assert riga.pos_x == 30
        assert riga.pos_y == 40

    def test_piu_spostamenti_nello_stesso_giorno_aggiornano_la_stessa_riga(self, auth_client, inventario):
        postazione = PostazioneFactory(inventario=inventario, pos_x=10, pos_y=10)
        # Il seed della factory sopra ha già creato la postazione via ORM diretto (non via API),
        # quindi non ha ancora una riga di storico: il primo PATCH la crea, il secondo la aggiorna.
        url = reverse("postazione-detail", args=[postazione.pk])

        auth_client.patch(url, {"pos_x": 20, "pos_y": 20}, format="json")
        auth_client.patch(url, {"pos_x": 60, "pos_y": 70}, format="json")

        righe = PostazionePosizioneStorico.objects.filter(postazione=postazione, data=timezone.localdate())
        assert righe.count() == 1
        assert righe.first().pos_x == 60
        assert righe.first().pos_y == 70


class TestListaPerDataPassata:
    def test_data_oggi_o_futura_ignora_lo_storico_e_usa_la_posizione_live(self, api_client, inventario):
        postazione = PostazioneFactory(inventario=inventario, pos_x=99, pos_y=99)

        response = api_client.get(reverse("postazione-list"), {"inventario": inventario.pk, "data": str(timezone.localdate())})

        item = next(i for i in response.data if i["id"] == str(postazione.pk))
        assert item["pos_x"] == 99
        assert item["pos_y"] == 99

    def test_formato_data_non_valido_restituisce_400(self, api_client):
        response = api_client.get(reverse("postazione-list"), {"data": "31-12-2026"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_ricostruisce_la_posizione_storica_alla_data_richiesta(self, api_client, inventario):
        oggi = timezone.localdate()
        creazione = oggi - timedelta(days=10)
        primo_spostamento = oggi - timedelta(days=5)

        postazione = PostazioneFactory(inventario=inventario, pos_x=999, pos_y=999)
        _backdate_creazione(postazione, creazione)
        PostazionePosizioneStoricoFactory(postazione=postazione, data=creazione, pos_x=10, pos_y=10)
        PostazionePosizioneStoricoFactory(postazione=postazione, data=primo_spostamento, pos_x=40, pos_y=45)

        # Una data intermedia tra i due spostamenti deve rispecchiare l'ultima posizione nota
        # PRIMA di quella data, non quella attuale (999, 999).
        data_intermedia = oggi - timedelta(days=7)
        response = api_client.get(
            reverse("postazione-list"), {"inventario": inventario.pk, "data": str(data_intermedia)}
        )

        item = next(i for i in response.data if i["id"] == str(postazione.pk))
        assert item["pos_x"] == 10
        assert item["pos_y"] == 10

    def test_esclude_postazioni_create_dopo_la_data_richiesta(self, api_client, inventario):
        oggi = timezone.localdate()
        postazione = PostazioneFactory(inventario=inventario)
        _backdate_creazione(postazione, oggi - timedelta(days=1))

        response = api_client.get(
            reverse("postazione-list"), {"inventario": inventario.pk, "data": str(oggi - timedelta(days=5))}
        )

        ids = [item["id"] for item in response.data]
        assert str(postazione.pk) not in ids

    def test_include_postazioni_eliminate_dopo_la_data_richiesta(self, api_client, inventario):
        oggi = timezone.localdate()
        postazione = PostazioneFactory(inventario=inventario)
        _backdate_creazione(postazione, oggi - timedelta(days=10))
        _elimina_al(postazione, oggi - timedelta(days=1))

        response = api_client.get(
            reverse("postazione-list"), {"inventario": inventario.pk, "data": str(oggi - timedelta(days=5))}
        )

        ids = [item["id"] for item in response.data]
        assert str(postazione.pk) in ids

    def test_esclude_postazioni_eliminate_prima_della_data_richiesta(self, api_client, inventario):
        oggi = timezone.localdate()
        postazione = PostazioneFactory(inventario=inventario)
        _backdate_creazione(postazione, oggi - timedelta(days=10))
        _elimina_al(postazione, oggi - timedelta(days=8))

        response = api_client.get(
            reverse("postazione-list"), {"inventario": inventario.pk, "data": str(oggi - timedelta(days=5))}
        )

        ids = [item["id"] for item in response.data]
        assert str(postazione.pk) not in ids
