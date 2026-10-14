import time

from django.core.cache import caches
from rest_framework.settings import api_settings
from rest_framework.throttling import BaseThrottle

_SECONDI = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}


def _parse_rate(rate):
    """'5/min' -> (5, 60), stesso formato dei tassi DRF."""
    numero, periodo = rate.split('/')
    return int(numero), _SECONDI[periodo[0]]


class StoricoTelefonoThrottle(BaseThrottle):
    """
    Limite dedicato a storico_telefono, per IP e per servizio (piscina, asporto e padel hanno
    ciascuno il proprio contatore). Una ricerca da "Le mie prenotazioni" manda le tre richieste
    in parallelo: con un contatore unico tutte e tre scrivevano la stessa riga nello stesso
    istante, Postgres rifiutava gli INSERT duplicati (Django li ignora in silenzio) e il limite
    contava una richiesta invece di tre. Separate, non si contendono più nulla.

    Serve a rendere lento il tentativo di provare numeri di telefono a raffica: il limite globale
    anonimo (120/min, pensato per i flussi di prenotazione) da solo non lo impedisce.

    Usa la cache 'throttle' (su database) e non quella di default: la LocMemCache è per-processo,
    quindi con più worker gunicorn ognuno conterebbe per conto suo e il limite reale sarebbe un
    multiplo di quello dichiarato.

    Il limite al minuto e quello al giorno stanno in un'unica chiave: con due throttle separati
    ogni ricerca pagava due letture e due scritture sulla cache su database (12 query per
    richiesta, verso un database remoto). Così sono una lettura e una scrittura.
    """

    scope_minuto = 'storico_telefono_minuto'
    scope_giorno = 'storico_telefono_giorno'
    cache_format = 'throttle_storico_telefono_%(servizio)s_%(ident)s'
    timer = time.time

    def __init__(self):
        rates = api_settings.DEFAULT_THROTTLE_RATES
        self.limiti = [_parse_rate(rates[self.scope_minuto]), _parse_rate(rates[self.scope_giorno])]
        self.attesa = None

    @property
    def cache(self):
        return caches['throttle']

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'servizio': getattr(view, 'basename', ''),
            'ident': self.get_ident(request),
        }

    def allow_request(self, request, view):
        chiave = self.get_cache_key(request, view)
        adesso = self.timer()
        finestra_massima = max(durata for _, durata in self.limiti)
        storia = [t for t in self.cache.get(chiave, []) if t > adesso - finestra_massima]

        for numero, durata in self.limiti:
            recenti = [t for t in storia if t > adesso - durata]
            if len(recenti) >= numero:
                self.attesa = durata - (adesso - min(recenti))
                return False

        storia.append(adesso)
        self.cache.set(chiave, storia, finestra_massima)
        return True

    def wait(self):
        return self.attesa
