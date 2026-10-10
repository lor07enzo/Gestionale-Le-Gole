import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from menu.models import ConfigurazioneAsporto
from menu.test.factories import AllergeneFactory, ProdottoFactory
from struttura.models import ConfigurazionePadel
from struttura.test.factories import PiscinaInventarioFactory

pytestmark = pytest.mark.django_db

URL = reverse('servizi-disponibili')


def _get():
    response = APIClient().get(URL)
    assert response.status_code == 200
    return response.json()


def test_tutto_spento_di_default():
    ConfigurazioneAsporto.objects.update_or_create(pk=ConfigurazioneAsporto.get_solo().pk, defaults={'attivo': False})
    assert _get() == {'piscina': False, 'asporto': False, 'padel': False}


def test_piscina_solo_con_un_listino_attivo():
    PiscinaInventarioFactory(isActive=False)
    assert _get()['piscina'] is False
    PiscinaInventarioFactory(isActive=True)
    assert _get()['piscina'] is True


def test_asporto_richiede_servizio_attivo_e_un_prodotto_visibile():
    ProdottoFactory(disponibile=False)
    assert _get()['asporto'] is False

    ProdottoFactory(disponibile=True)
    assert _get()['asporto'] is True

    configurazione = ConfigurazioneAsporto.get_solo()
    configurazione.attivo = False
    configurazione.save()
    assert _get()['asporto'] is False


def test_padel_segue_l_interruttore():
    configurazione = ConfigurazionePadel.get_solo()
    configurazione.attivo = True
    configurazione.save()
    assert _get()['padel'] is True


def test_numero_di_query_costante(django_assert_max_num_queries):
    PiscinaInventarioFactory.create_batch(5, isActive=True)
    ProdottoFactory.create_batch(10, disponibile=True)
    ConfigurazioneAsporto.get_solo()
    ConfigurazionePadel.get_solo()
    with django_assert_max_num_queries(4):
        _get()


def test_catalogo_prodotti_senza_query_per_riga(django_assert_max_num_queries):
    # Una volta le query crescevano con i prodotti (categoria + allergeni per ciascuno).
    allergeni = AllergeneFactory.create_batch(2)
    for prodotto in ProdottoFactory.create_batch(10):
        prodotto.allergeni.set(allergeni)
    with django_assert_max_num_queries(3):
        response = APIClient().get(reverse('prodotto-list'))
    assert response.status_code == 200
    assert len(response.json()) == 10
