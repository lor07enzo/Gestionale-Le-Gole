import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """
    Il rate-limiting DRF (REST_FRAMEWORK.DEFAULT_THROTTLE_CLASSES, backend/settings.py) conta le
    richieste nella cache Django di default (LocMemCache, per-processo) — che pytest-django non
    azzera da sé tra un test e l'altro. Senza questo fixture, le centinaia di richieste
    anonime/autenticate dell'intera suite si accumulerebbero nella stessa finestra temporale e
    potrebbero far scattare il limite a metà suite, con fallimenti intermittenti non legati alla
    logica testata.
    """
    cache.clear()
    yield
    cache.clear()
