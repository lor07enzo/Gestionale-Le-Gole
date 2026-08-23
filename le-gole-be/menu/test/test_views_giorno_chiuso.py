import datetime

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from menu.models import GiornoChiusoAsporto

from .factories import GiornoChiusoAsportoFactory

pytestmark = pytest.mark.django_db


class TestPermessi:
    def test_anonimo_non_puo_elencare(self, api_client):
        response = api_client.get(reverse("giorno-chiuso-asporto-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_autenticato_puo_creare_e_cancellare(self, auth_client):
        response = auth_client.post(
            reverse("giorno-chiuso-asporto-list"), {"data": "2026-12-25"}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert GiornoChiusoAsporto.objects.filter(data="2026-12-25").exists()

        response = auth_client.delete(reverse("giorno-chiuso-asporto-detail", args=[response.data["id"]]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not GiornoChiusoAsporto.objects.filter(data="2026-12-25").exists()

    def test_rifiuta_di_marcare_due_volte_lo_stesso_giorno(self, auth_client):
        GiornoChiusoAsportoFactory(data="2026-12-25")

        response = auth_client.post(
            reverse("giorno-chiuso-asporto-list"), {"data": "2026-12-25"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_anonimo_non_puo_creare(self, api_client):
        response = api_client.post(
            reverse("giorno-chiuso-asporto-list"), {"data": "2026-12-25"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestProssime:
    def test_e_pubblica(self, api_client):
        response = api_client.get(reverse("giorno-chiuso-asporto-prossime"))
        assert response.status_code == status.HTTP_200_OK

    def test_esclude_le_date_passate_e_include_oggi(self, api_client):
        oggi = timezone.localdate()
        GiornoChiusoAsportoFactory(data=oggi - datetime.timedelta(days=1))  # passata, esclusa
        GiornoChiusoAsportoFactory(data=oggi)  # oggi, inclusa
        GiornoChiusoAsportoFactory(data=oggi + datetime.timedelta(days=3))  # futura, inclusa

        response = api_client.get(reverse("giorno-chiuso-asporto-prossime"))

        assert response.data == [oggi.isoformat(), (oggi + datetime.timedelta(days=3)).isoformat()]

    def test_ordinate_crescenti(self, api_client):
        oggi = timezone.localdate()
        GiornoChiusoAsportoFactory(data=oggi + datetime.timedelta(days=5))
        GiornoChiusoAsportoFactory(data=oggi + datetime.timedelta(days=1))
        GiornoChiusoAsportoFactory(data=oggi + datetime.timedelta(days=3))

        response = api_client.get(reverse("giorno-chiuso-asporto-prossime"))

        assert response.data == [
            (oggi + datetime.timedelta(days=1)).isoformat(),
            (oggi + datetime.timedelta(days=3)).isoformat(),
            (oggi + datetime.timedelta(days=5)).isoformat(),
        ]
