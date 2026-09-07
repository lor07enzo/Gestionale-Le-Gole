import datetime
from decimal import Decimal

import pytest
from django.urls import reverse

from struttura.models import ConfigurazionePadel

pytestmark = pytest.mark.django_db

URL = reverse('configurazione-padel')


class TestLettura:
    def test_lettura_pubblica_restituisce_i_default(self, api_client):
        response = api_client.get(URL)

        assert response.status_code == 200
        assert response.data['attivo'] is False
        assert response.data['orario_apertura'] == '09:00:00'
        assert response.data['orario_chiusura'] == '22:00:00'
        assert response.data['durata_partita_minuti'] == 90
        assert response.data['max_partecipanti'] == 4

    def test_lettura_non_duplica_la_riga_singleton(self, api_client):
        api_client.get(URL)
        api_client.get(URL)

        assert ConfigurazionePadel.objects.count() == 1

    def test_espone_gli_slot_prenotabili(self, api_client, configurazione_padel):
        response = api_client.get(URL)

        assert response.data['slot_disponibili'] == ['10:00', '11:00', '12:00']


class TestScrittura:
    def test_anonimo_non_puo_modificare(self, api_client):
        response = api_client.patch(URL, {'attivo': True}, format='json')

        assert response.status_code == 401

    def test_staff_attiva_il_servizio(self, auth_client):
        response = auth_client.patch(URL, {'attivo': True}, format='json')

        assert response.status_code == 200
        assert ConfigurazionePadel.get_solo().attivo is True

    def test_patch_parziale_non_tocca_gli_altri_campi(self, auth_client, configurazione_padel):
        response = auth_client.patch(URL, {'prezzo_partita': '35.00'}, format='json')

        assert response.status_code == 200
        config = ConfigurazionePadel.get_solo()
        assert config.prezzo_partita == Decimal('35.00')
        assert config.orario_apertura == datetime.time(10, 0)
        assert config.durata_partita_minuti == 60


class TestValidazione:
    def test_chiusura_prima_dell_apertura_rifiutata(self, auth_client):
        response = auth_client.patch(
            URL, {'orario_apertura': '20:00', 'orario_chiusura': '10:00'}, format='json'
        )

        assert response.status_code == 400
        assert 'orario_chiusura' in response.data

    def test_patch_parziale_confronta_con_il_valore_gia_salvato(self, auth_client, configurazione_padel):
        # Sposta solo l'apertura oltre la chiusura già salvata (13:00), senza reinviarla.
        response = auth_client.patch(URL, {'orario_apertura': '14:00'}, format='json')

        assert response.status_code == 400
        assert 'orario_chiusura' in response.data

    def test_durata_piu_lunga_della_finestra_di_apertura_rifiutata(self, auth_client, configurazione_padel):
        # Finestra 10:00-13:00 = 180 minuti: una partita da 240 non lascerebbe alcuno slot.
        response = auth_client.patch(URL, {'durata_partita_minuti': 240}, format='json')

        assert response.status_code == 400
        assert 'durata_partita_minuti' in response.data

    def test_durata_pari_alla_finestra_accettata(self, auth_client, configurazione_padel):
        response = auth_client.patch(URL, {'durata_partita_minuti': 180}, format='json')

        assert response.status_code == 200
        assert response.data['slot_disponibili'] == ['10:00']

    @pytest.mark.parametrize('campo', ['durata_partita_minuti', 'max_partecipanti'])
    def test_valore_zero_rifiutato(self, auth_client, campo):
        response = auth_client.patch(URL, {campo: 0}, format='json')

        assert response.status_code == 400
        assert campo in response.data

    @pytest.mark.parametrize(
        'campo', ['prezzo_partita', 'prezzo_noleggio_palline']
    )
    def test_prezzo_negativo_rifiutato(self, auth_client, campo):
        response = auth_client.patch(URL, {campo: '-1.00'}, format='json')

        assert response.status_code == 400
        assert campo in response.data
