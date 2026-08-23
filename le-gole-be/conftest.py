import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _use_local_file_storage(settings, tmp_path):
    """
    In produzione i file (es. Prodotto.immagine, menu/models.py) sono caricati su Cloudinary
    (STORAGES, backend/settings.py) — un upload reale ad ogni test colpirebbe l'API esterna e
    richiederebbe credenziali valide anche in CI, stesso principio per cui EMAIL_BACKEND è
    forzato su locmem nei test (sezione 9 di CLAUDE.md). Qui si scrive invece su un filesystem
    temporaneo locale, mai su Cloudinary.
    """
    settings.STORAGES = {
        **settings.STORAGES,
        'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    }
    settings.MEDIA_ROOT = str(tmp_path)


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
