FROM python:3.13-slim

# Librerie di sistema richieste da WeasyPrint per generare il PDF del biglietto piscina
# (prenotazioni/views.py::scarica_biglietto, sezione 2 di CLAUDE.md) — i pacchetti Python in
# requirements.txt non bastano da soli: servono Pango (layout/shaping del testo) e fontconfig
# (risoluzione dei font di sistema). Niente libgdk-pixbuf: le WeasyPrint recenti (qui 69.0) non
# dipendono più da cairo/gdk-pixbuf, e su Debian trixie (base di python:3.13-slim al momento di
# questo Dockerfile) il pacchetto libgdk-pixbuf2.0-0 non esiste comunque più con questo nome.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    fontconfig \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiato e installato separatamente dal resto del codice per sfruttare la cache dei layer
# Docker: le dipendenze cambiano molto meno spesso del codice applicativo.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Vero server WSGI (gunicorn) al posto del dev server di Django: gestisce più worker/richieste
# concorrenti ed è pensato per restare in piedi in un ambiente non di sviluppo (a differenza di
# runserver, single-threaded e con warning esplicito di Django sconsigliandolo in produzione).
# Le migrazioni vengono comunque applicate automaticamente ad ogni avvio del container.
# GUNICORN_WORKERS è opzionale (default 3, adeguato per un traffico contenuto come questo
# progetto in fase di test web) — override passando la variabile d'ambiente al servizio
# "backend" in docker-compose.yml se serve alzarlo. Nessun `--reload`: un cambiamento al codice
# (bind mount, sezione 10) richiede un riavvio esplicito (`docker compose restart backend`),
# coerente con un ambiente che si comporta come un vero deploy e non come un dev server.
# Bind su ${PORT:-8000}, non un 8000 fisso: Render (sezione 12) assegna dinamicamente la porta
# di ascolto tramite la variabile d'ambiente PORT — in locale/Docker Compose, dove PORT non è
# impostata, il fallback a 8000 lascia invariato il comportamento di sempre.
CMD ["sh", "-c", "python manage.py migrate && gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${GUNICORN_WORKERS:-3} --timeout 60"]
