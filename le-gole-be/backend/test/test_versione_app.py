from django.urls import reverse
from rest_framework.test import APIClient

URL = reverse('versione-app')


def test_pubblica_con_i_default(settings):
    settings.APP_VERSIONE_MINIMA = '0.0.0'
    settings.APP_STORE_URL_IOS = ''
    response = APIClient().get(URL)
    assert response.status_code == 200
    assert response.json() == {
        'versione_minima': '0.0.0',
        'url_android': settings.APP_STORE_URL_ANDROID,
        'url_ios': '',
    }


def test_riflette_le_impostazioni(settings):
    settings.APP_VERSIONE_MINIMA = '1.3.0'
    settings.APP_STORE_URL_ANDROID = 'https://play.example/app'
    settings.APP_STORE_URL_IOS = 'https://apps.example/app'
    assert APIClient().get(URL).json() == {
        'versione_minima': '1.3.0',
        'url_android': 'https://play.example/app',
        'url_ios': 'https://apps.example/app',
    }


def test_nessuna_query(django_assert_num_queries, db):
    with django_assert_num_queries(0):
        APIClient().get(URL)
