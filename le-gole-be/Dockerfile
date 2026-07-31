# Pinnata al digest esatto, non al tag mobile "3.13-slim" (riassegnato ad ogni rebuild
# dell'immagine upstream) — richiesto da SonarQube docker:S6596 ("Specific version tag for image
# should be used") per una build riproducibile e verificabile. Solo il digest, non tag+digest
# insieme (docker:S8431 li vuole alternativi, non combinati). Digest ottenuto con
# `docker pull python:3.13-slim && docker inspect ... RepoDigests`, corrisponde a
# 3.13.14-slim-trixie al momento del pinning. **Va aggiornato manualmente** quando si vuole
# recepire una nuova patch (nessun update automatico, trade-off consapevole tra riproducibilità e
# patch di sicurezza automatiche — la stessa immagine viene comunque ricostruita dal Dockerfile
# ad ogni deploy, sezione 10/12, quindi il codice applicativo resta sempre aggiornato).
FROM python@sha256:6771159cd4fa5d9bba1258caf0b82e6b73458c694d178ad97c5e925c2d0e1a91

# Librerie di sistema richieste da WeasyPrint per generare il PDF del biglietto piscina
# (prenotazioni/views.py::scarica_biglietto, sezione 2 di CLAUDE.md) — i pacchetti Python in
# requirements.txt non bastano da soli: servono Pango (layout/shaping del testo) e fontconfig
# (risoluzione dei font di sistema). Niente libgdk-pixbuf: le WeasyPrint recenti (qui 69.0) non
# dipendono più da cairo/gdk-pixbuf, e su Debian trixie (base di python:3.13-slim al momento di
# questo Dockerfile) il pacchetto libgdk-pixbuf2.0-0 non esiste comunque più con questo nome.
# Unita nella stessa RUN anche la creazione dell'utente non privilegiato sotto (docker:S7031
# vuole RUN consecutive accorpate, per non sprecare un layer immagine a testa).
#
# Utente non privilegiato: l'immagine di base non ne definisce uno, quindi senza questo il
# container (incluso il processo gunicorn che serve le richieste HTTP) girerebbe come root —
# non necessario per nessuna operazione dell'app (bind su una porta >1024, nessun accesso a
# device/file di sistema). Regola SonarQube docker:S6471 ("Running containers as a privileged
# user is security-sensitive"). Il chown finale su /var/cache/fontconfig è invece necessario per
# WeasyPrint: fontconfig scrive lì la propria cache font, e appuser altrimenti non potrebbe
# scriverci (verificato: senza, ogni generazione del biglietto PDF stampa ripetuti
# "Fontconfig error: No writable cache directories" e ricostruisce la cache da zero ad ogni
# chiamata invece di riusarla — funziona comunque, solo più lento e con log rumorosi).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    fontconfig \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system appuser \
    && useradd --system --gid appuser --home /app --no-create-home appuser \
    && chown appuser:appuser /var/cache/fontconfig

WORKDIR /app

# Copiato e installato separatamente dal resto del codice per sfruttare la cache dei layer
# Docker: le dipendenze cambiano molto meno spesso del codice applicativo. Resta eseguito come
# root (prima dello USER sotto): i pacchetti installati in site-packages restano di proprietà di
# root e sola lettura per appuser, che non può quindi modificarli a runtime — proprietà
# desiderabile, non un refuso.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia esplicita per app invece di un unico "COPY . ." ricorsivo su tutto il contesto — quel
# pattern è segnalato come security-sensitive da SonarQube (docker:S6470, "Recursively copying
# context directories"): anche con un .dockerignore già presente, un file sensibile aggiunto in
# futuro alla root del progetto senza aggiornare .dockerignore finirebbe comunque nell'immagine
# in silenzio. L'elenco rispecchia le app Django reali del progetto (sezione 1 di CLAUDE.md, la
# app "menu" non esiste ancora sul filesystem) — va aggiunta una riga se in futuro nascerà una
# nuova app di primo livello. Nessun --chown verso appuser (a differenza di un primo tentativo):
# il codice applicativo resta di proprietà di root, sola lettura/esecuzione per appuser, che non
# ha quindi motivo né modo di scriverci a runtime — se il processo gunicorn venisse compromesso
# non potrebbe alterare il proprio codice sorgente (docker:S6504, "Make sure the copied resource
# cannot be modified by a non-root user").
COPY manage.py .
COPY backend/ backend/
COPY users/ users/
COPY struttura/ struttura/
COPY prenotazioni/ prenotazioni/

USER appuser

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
# --no-control-socket: gunicorn 25+ crea di default un "control socket" per la gestione runtime
# via gunicornc (non usata qui) in $HOME/.gunicorn/gunicorn.ctl — con appuser il cui $HOME è
# /app (sopra) e /app di sola lettura per lui (docker:S6504, niente --chown sul codice), la
# creazione fallisce con "Control server error: [Errno 13] Permission denied: '/app/.gunicorn'"
# non appena l'immagine gira senza un bind mount scrivibile a coprire /app (riscontrato in
# produzione su Render, non in locale con Docker Compose — lì il bind mount di sviluppo rende
# /app scrivibile indipendentemente dal proprietario). Disattivata perché non serve.
CMD ["sh", "-c", "python manage.py migrate && gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${GUNICORN_WORKERS:-3} --timeout 60 --no-control-socket"]
