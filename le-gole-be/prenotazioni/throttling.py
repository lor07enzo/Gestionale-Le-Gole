from django.core.cache import caches
from rest_framework.throttling import SimpleRateThrottle


class _StoricoTelefonoThrottle(SimpleRateThrottle):
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
    multiplo di quello dichiarato. Solo questo limite paga la query in più; quello globale resta
    in memoria.
    """

    @property
    def cache(self):
        return caches['throttle']

    def get_cache_key(self, request, view):
        scope = f'{self.scope}_{getattr(view, "basename", "")}'
        return self.cache_format % {'scope': scope, 'ident': self.get_ident(request)}


class StoricoTelefonoMinutoThrottle(_StoricoTelefonoThrottle):
    scope = 'storico_telefono_minuto'


class StoricoTelefonoGiornoThrottle(_StoricoTelefonoThrottle):
    scope = 'storico_telefono_giorno'
