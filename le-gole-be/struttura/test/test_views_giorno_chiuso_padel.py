import datetime

import pytest
from django.urls import reverse
from django.utils import timezone

from struttura.models import GiornoChiusoPadel
from struttura.test.factories import GiornoChiusoPadelFactory

pytestmark = pytest.mark.django_db

LIST_URL = reverse('giorno-chiuso-padel-list')
PROSSIME_URL = reverse('giorno-chiuso-padel-prossime')


class TestPermessi:
    def test_anonimo_non_puo_elencare(self, api_client):
        assert api_client.get(LIST_URL).status_code == 401

    def test_anonimo_non_puo_creare(self, api_client):
        response = api_client.post(LIST_URL, {'data': '2030-01-01'}, format='json')

        assert response.status_code == 401


class TestCrud:
    def test_staff_marca_un_giorno_come_chiuso(self, auth_client):
        response = auth_client.post(LIST_URL, {'data': '2030-01-01'}, format='json')

        assert response.status_code == 201
        assert GiornoChiusoPadel.objects.filter(data=datetime.date(2030, 1, 1)).exists()

    def test_stesso_giorno_due_volte_rifiutato(self, auth_client):
        GiornoChiusoPadelFactory(data=datetime.date(2030, 1, 1))

        response = auth_client.post(LIST_URL, {'data': '2030-01-01'}, format='json')

        assert response.status_code == 400
        assert 'data' in response.data

    def test_staff_riapre_un_giorno_eliminando_la_riga(self, auth_client):
        giorno = GiornoChiusoPadelFactory(data=datetime.date(2030, 1, 1))

        url = reverse('giorno-chiuso-padel-detail', args=[giorno.id])
        assert auth_client.delete(url).status_code == 204
        assert not GiornoChiusoPadel.objects.exists()


class TestProssime:
    def test_pubblica_ed_esclude_le_date_passate(self, api_client):
        oggi = timezone.localdate()
        GiornoChiusoPadelFactory(data=oggi - datetime.timedelta(days=1))
        GiornoChiusoPadelFactory(data=oggi)
        GiornoChiusoPadelFactory(data=oggi + datetime.timedelta(days=2))

        response = api_client.get(PROSSIME_URL)

        assert response.status_code == 200
        assert response.data == [
            oggi.isoformat(),
            (oggi + datetime.timedelta(days=2)).isoformat(),
        ]

    def test_nessuna_chiusura_restituisce_lista_vuota(self, api_client):
        assert api_client.get(PROSSIME_URL).data == []
