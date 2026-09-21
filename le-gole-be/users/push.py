"""
Notifiche push verso i dispositivi dello staff, tramite l'Expo Push Service.

**Perché esiste.** Il pannello notifiche in-app (sezione 11 di CLAUDE.md) è un polling ogni 20
secondi: funziona solo mentre l'app è in primo piano, perché con l'app in background il timer JS
viene sospeso dal sistema operativo e a telefono bloccato non arriva niente. Finché il rilascio
era solo web non era un difetto; con l'app installata su Android lo è diventato — lo staff
scopriva un ordine self-service solo riaprendo l'app.

**Perché un thread e non una coda.** Il progetto non ha Celery e introdurlo solo per questo
sarebbe sproporzionato allo stadio attuale. L'invio parte quindi in un thread separato: una
chiamata HTTP lenta, o l'intero servizio Expo irraggiungibile, non deve rallentare né tantomeno
far fallire la creazione della prenotazione, che è l'unica cosa che conti davvero in quella
richiesta. Per lo stesso motivo `spedisci()` non solleva mai: logga e basta.

Nessuna dipendenza nuova — `requests` è già nell'albero (catena di cloudinary), il che evita di
dover rigenerare gli hash di `requirements.txt` sotto `--require-hashes` (sezione 10).
"""

import logging
import threading

import requests
from django.conf import settings
from django.db import connections

from .models import DispositivoStaff

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
TIMEOUT_SECONDI = 10
# Limite documentato dell'API Expo: al massimo 100 messaggi per richiesta.
MAX_MESSAGGI_PER_RICHIESTA = 100
# Deve combaciare con il canale creato lato app (src/utils/push.ts): su Android 8+ una notifica
# senza un canale esistente viene scartata in silenzio dal sistema.
CANALE_ANDROID = 'prenotazioni'


def invia_notifica_staff(titolo, corpo, dati=None):
    """
    Punto d'ingresso unico: raccoglie i token e delega l'invio a un thread.

    La query sui token resta nel thread della richiesta (è una sola, indicizzata, e la
    connessione al DB è già aperta): al thread staccato arrivano solo stringhe, così non deve
    toccare il database se non per l'eventuale pulizia dei token scaduti.
    """
    tokens = list(
        DispositivoStaff.objects.filter(utente__is_active=True).values_list('token', flat=True)
    )
    if not tokens:
        return

    threading.Thread(
        target=_esegui_in_thread,
        args=(tokens, titolo, corpo, dati or {}),
        daemon=True,
    ).start()


def _esegui_in_thread(tokens, titolo, corpo, dati):
    try:
        spedisci(tokens, titolo, corpo, dati)
    finally:
        # Le connessioni Django sono thread-local: la pulizia dei token non più validi ne apre
        # una nuova in questo thread, che senza un close esplicito resterebbe appesa (con
        # CONN_MAX_AGE=60 in produzione, sezione 12, non verrebbe chiusa a fine richiesta).
        connections.close_all()


def spedisci(tokens, titolo, corpo, dati):
    """
    Invio vero e proprio, separato da `invia_notifica_staff` per poter essere esercitato dai test
    in modo sincrono, senza thread di mezzo.

    Non solleva mai: gira in un thread staccato, dove un'eccezione non verrebbe vista da nessuno
    se non nei log.
    """
    try:
        non_registrati = []
        for blocco in _a_blocchi(tokens, MAX_MESSAGGI_PER_RICHIESTA):
            non_registrati.extend(_spedisci_blocco(blocco, titolo, corpo, dati))

        if non_registrati:
            # App disinstallata, o token ruotato dal sistema operativo: la riga non tornerà mai
            # più valida, tenerla vuol dire solo ripetere l'errore a ogni notifica futura.
            DispositivoStaff.objects.filter(token__in=non_registrati).delete()
    except Exception:
        logger.exception('Invio notifiche push allo staff fallito')


def _spedisci_blocco(tokens, titolo, corpo, dati):
    """Spedisce un blocco di messaggi e restituisce i token risultati non più registrati."""
    messaggi = [
        {
            'to': token,
            'title': titolo,
            'body': corpo,
            'data': dati,
            'sound': 'default',
            'priority': 'high',
            'channelId': CANALE_ANDROID,
        }
        for token in tokens
    ]

    risposta = requests.post(
        EXPO_PUSH_URL, json=messaggi, headers=_headers(), timeout=TIMEOUT_SECONDI
    )
    risposta.raise_for_status()

    # Expo risponde con un esito per messaggio, nello stesso ordine in cui sono stati inviati.
    esiti = risposta.json().get('data') or []
    return [
        token
        for token, esito in zip(tokens, esiti)
        if _e_device_non_registrato(esito)
    ]


def _e_device_non_registrato(esito):
    if not isinstance(esito, dict) or esito.get('status') != 'error':
        return False
    return (esito.get('details') or {}).get('error') == 'DeviceNotRegistered'


def _headers():
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
    # Opzionale: serve solo se su Expo è stata attivata la "push security" (consigliata, ma
    # l'invio funziona anche senza). Mai hardcoded, stesso trattamento di RESEND_API_KEY.
    access_token = getattr(settings, 'EXPO_ACCESS_TOKEN', '')
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    return headers


def _a_blocchi(elementi, dimensione):
    for inizio in range(0, len(elementi), dimensione):
        yield elementi[inizio:inizio + dimensione]
