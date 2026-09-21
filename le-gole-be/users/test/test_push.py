"""
Invio delle notifiche push allo staff (users/push.py).

`spedisci()` è esercitata sempre in modo **sincrono**, mai attraverso il thread: il thread è solo
il mezzo con cui `invia_notifica_staff()` la stacca dalla richiesta HTTP, non ha logica propria, e
farlo partire nei test renderebbe le asserzioni una corsa contro il tempo.
"""

from unittest.mock import Mock, patch

import pytest
import requests

from users.models import DispositivoStaff
from users.push import CANALE_ANDROID, _esegui_in_thread, invia_notifica_staff, spedisci

from .factories import DispositivoStaffFactory, UtenteFactory


def _risposta(esiti):
    """Risposta finta dell'API Expo: un esito per messaggio, nello stesso ordine."""
    risposta = Mock()
    risposta.json.return_value = {'data': esiti}
    risposta.raise_for_status.return_value = None
    return risposta


def _ok(quanti):
    return [{'status': 'ok', 'id': f'id-{i}'} for i in range(quanti)]


@pytest.mark.django_db
class TestRaccoltaToken:
    """`invia_notifica_staff` decide *se* c'è qualcuno da avvisare; il resto lo fa il thread."""

    def test_nessun_dispositivo_non_spedisce_nulla(self):
        with patch('users.push.threading.Thread') as thread:
            invia_notifica_staff('Titolo', 'Corpo')
        thread.assert_not_called()

    def test_i_dispositivi_di_un_account_disattivato_sono_esclusi(self):
        DispositivoStaffFactory(utente=UtenteFactory(is_active=False))

        with patch('users.push.threading.Thread') as thread:
            invia_notifica_staff('Titolo', 'Corpo')
        thread.assert_not_called()

    def test_con_dispositivi_attivi_parte_il_thread_con_i_token(self):
        primo = DispositivoStaffFactory()
        secondo = DispositivoStaffFactory()

        with patch('users.push.threading.Thread') as thread:
            invia_notifica_staff('Titolo', 'Corpo', {'categoria': 'ASPORTO'})

        tokens, titolo, corpo, dati = thread.call_args.kwargs['args']
        assert set(tokens) == {primo.token, secondo.token}
        assert (titolo, corpo, dati) == ('Titolo', 'Corpo', {'categoria': 'ASPORTO'})


class TestThread:
    """
    Il wrapper eseguito nel thread. Le connessioni Django sono thread-local: la pulizia dei token
    ne apre una nuova qui dentro che, con CONN_MAX_AGE>0 in produzione, resterebbe appesa senza un
    close esplicito — va chiuso **anche** se l'invio è andato male.
    """

    def test_chiude_la_connessione_dopo_l_invio(self):
        with patch('users.push.spedisci') as invio, patch('users.push.connections') as conn:
            _esegui_in_thread(['ExponentPushToken[a]'], 'Titolo', 'Corpo', {})

        invio.assert_called_once()
        conn.close_all.assert_called_once()

    def test_chiude_la_connessione_anche_se_l_invio_solleva(self):
        with patch('users.push.spedisci', side_effect=RuntimeError('boom')), \
                patch('users.push.connections') as conn:
            with pytest.raises(RuntimeError):
                _esegui_in_thread(['ExponentPushToken[a]'], 'Titolo', 'Corpo', {})

        conn.close_all.assert_called_once()


@pytest.mark.django_db
class TestComposizioneMessaggio:
    def test_un_messaggio_per_token_con_i_campi_attesi(self):
        with patch('users.push.requests.post', return_value=_risposta(_ok(2))) as post:
            spedisci(['ExponentPushToken[a]', 'ExponentPushToken[b]'], 'Titolo', 'Corpo', {'x': 1})

        messaggi = post.call_args.kwargs['json']
        assert [m['to'] for m in messaggi] == ['ExponentPushToken[a]', 'ExponentPushToken[b]']
        assert messaggi[0]['title'] == 'Titolo'
        assert messaggi[0]['body'] == 'Corpo'
        assert messaggi[0]['data'] == {'x': 1}
        # Senza un canale esistente Android 8+ scarta la notifica in silenzio.
        assert messaggi[0]['channelId'] == CANALE_ANDROID

    def test_oltre_cento_token_vengono_spezzati_in_piu_richieste(self):
        """100 messaggi per richiesta è il limite documentato dell'API Expo."""
        tokens = [f'ExponentPushToken[{i}]' for i in range(250)]

        with patch('users.push.requests.post', return_value=_risposta(_ok(100))) as post:
            spedisci(tokens, 'Titolo', 'Corpo', {})

        assert post.call_count == 3
        assert [len(c.kwargs['json']) for c in post.call_args_list] == [100, 100, 50]

    def test_il_token_di_accesso_expo_e_opzionale(self, settings):
        settings.EXPO_ACCESS_TOKEN = ''
        with patch('users.push.requests.post', return_value=_risposta(_ok(1))) as post:
            spedisci(['ExponentPushToken[a]'], 'Titolo', 'Corpo', {})
        assert 'Authorization' not in post.call_args.kwargs['headers']

        settings.EXPO_ACCESS_TOKEN = 'segreto'
        with patch('users.push.requests.post', return_value=_risposta(_ok(1))) as post:
            spedisci(['ExponentPushToken[a]'], 'Titolo', 'Corpo', {})
        assert post.call_args.kwargs['headers']['Authorization'] == 'Bearer segreto'


@pytest.mark.django_db
class TestPuliziaToken:
    def test_un_token_non_piu_registrato_viene_eliminato(self):
        """App disinstallata o token ruotato: non tornerà mai più valido."""
        vivo = DispositivoStaffFactory()
        morto = DispositivoStaffFactory()
        esiti = [
            {'status': 'ok', 'id': 'x'},
            {'status': 'error', 'message': '...', 'details': {'error': 'DeviceNotRegistered'}},
        ]

        with patch('users.push.requests.post', return_value=_risposta(esiti)):
            spedisci([vivo.token, morto.token], 'Titolo', 'Corpo', {})

        assert list(DispositivoStaff.objects.values_list('token', flat=True)) == [vivo.token]

    def test_un_errore_diverso_non_elimina_il_token(self):
        """MessageRateExceeded è temporaneo: il dispositivo è ancora perfettamente valido."""
        dispositivo = DispositivoStaffFactory()
        esiti = [{'status': 'error', 'message': '...', 'details': {'error': 'MessageRateExceeded'}}]

        with patch('users.push.requests.post', return_value=_risposta(esiti)):
            spedisci([dispositivo.token], 'Titolo', 'Corpo', {})

        assert DispositivoStaff.objects.filter(pk=dispositivo.pk).exists()


@pytest.mark.django_db
class TestFallimenti:
    """Gira in un thread staccato: un'eccezione non la vedrebbe nessuno, quindi non deve uscire."""

    def test_expo_irraggiungibile_non_solleva(self):
        dispositivo = DispositivoStaffFactory()

        with patch('users.push.requests.post', side_effect=requests.ConnectionError('boom')):
            spedisci([dispositivo.token], 'Titolo', 'Corpo', {})

        assert DispositivoStaff.objects.filter(pk=dispositivo.pk).exists()

    def test_risposta_malformata_non_solleva(self):
        risposta = Mock()
        risposta.raise_for_status.return_value = None
        risposta.json.side_effect = ValueError('non è JSON')

        with patch('users.push.requests.post', return_value=risposta):
            spedisci(['ExponentPushToken[a]'], 'Titolo', 'Corpo', {})
