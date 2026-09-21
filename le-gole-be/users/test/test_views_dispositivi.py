"""
Registrazione dei dispositivi per le notifiche push (`DispositivoStaffViewSet`).

Il comportamento meno ovvio è l'**upsert per token**: il token identifica l'installazione
dell'app, non la persona, quindi non può esistere due volte — se un altro account fa login sullo
stesso telefono la riga cambia proprietario, altrimenti chi si è disconnesso continuerebbe a
ricevere le notifiche su un dispositivo che non usa più.
"""

import pytest
from django.urls import reverse

from users.models import DispositivoStaff

from .factories import DispositivoStaffFactory, UtenteFactory

TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'


@pytest.fixture
def url_registra():
    return reverse('dispositivi-list')


@pytest.fixture
def url_rimuovi():
    return reverse('dispositivi-rimuovi')


@pytest.mark.django_db
class TestRegistrazione:
    def test_anonimo_non_puo_registrare(self, api_client, url_registra):
        risposta = api_client.post(url_registra, {'token': TOKEN}, format='json')
        assert risposta.status_code == 401

    def test_staff_registra_il_proprio_dispositivo(self, staff_client, staff_user, url_registra):
        risposta = staff_client.post(
            url_registra, {'token': TOKEN, 'piattaforma': 'android'}, format='json'
        )

        assert risposta.status_code == 201
        dispositivo = DispositivoStaff.objects.get()
        assert dispositivo.utente == staff_user
        assert dispositivo.piattaforma == 'android'

    def test_registrare_due_volte_lo_stesso_token_non_duplica(self, staff_client, url_registra):
        staff_client.post(url_registra, {'token': TOKEN}, format='json')
        risposta = staff_client.post(url_registra, {'token': TOKEN}, format='json')

        assert risposta.status_code == 200
        assert DispositivoStaff.objects.count() == 1

    def test_un_altro_account_sullo_stesso_dispositivo_ne_prende_il_posto(
        self, api_client, url_registra
    ):
        primo, secondo = UtenteFactory(), UtenteFactory()

        api_client.force_authenticate(user=primo)
        api_client.post(url_registra, {'token': TOKEN}, format='json')

        api_client.force_authenticate(user=secondo)
        risposta = api_client.post(url_registra, {'token': TOKEN}, format='json')

        assert risposta.status_code == 200
        assert DispositivoStaff.objects.count() == 1
        assert DispositivoStaff.objects.get().utente == secondo

    def test_un_account_puo_avere_piu_dispositivi(self, staff_client, staff_user, url_registra):
        """Telefono personale e tablet del locale sono due installazioni distinte."""
        staff_client.post(url_registra, {'token': TOKEN}, format='json')
        staff_client.post(url_registra, {'token': 'ExponentPushToken[altro]'}, format='json')

        assert DispositivoStaff.objects.filter(utente=staff_user).count() == 2

    @pytest.mark.parametrize('token', ['', 'non-un-token', 'ExponentPushToken[', 'abc[def]'])
    def test_token_malformato_rifiutato(self, staff_client, url_registra, token):
        """Un token che Expo rifiuterebbe comunque non deve entrare nella tabella."""
        risposta = staff_client.post(url_registra, {'token': token}, format='json')

        assert risposta.status_code == 400
        assert not DispositivoStaff.objects.exists()


@pytest.mark.django_db
class TestRimozione:
    def test_lo_staff_rimuove_il_proprio_dispositivo(self, staff_client, staff_user, url_rimuovi):
        dispositivo = DispositivoStaffFactory(utente=staff_user)

        risposta = staff_client.post(url_rimuovi, {'token': dispositivo.token}, format='json')

        assert risposta.status_code == 204
        assert not DispositivoStaff.objects.exists()

    def test_non_si_puo_rimuovere_il_dispositivo_di_un_collega(self, staff_client, url_rimuovi):
        altrui = DispositivoStaffFactory()

        risposta = staff_client.post(url_rimuovi, {'token': altrui.token}, format='json')

        assert risposta.status_code == 204
        assert DispositivoStaff.objects.filter(pk=altrui.pk).exists()

    def test_anonimo_non_puo_rimuovere(self, api_client, url_rimuovi):
        dispositivo = DispositivoStaffFactory()

        risposta = api_client.post(url_rimuovi, {'token': dispositivo.token}, format='json')

        assert risposta.status_code == 401
        assert DispositivoStaff.objects.filter(pk=dispositivo.pk).exists()
