# Pinnata al digest esatto (non al tag mobile "3.13-slim") per una build riproducibile.
# Va aggiornato manualmente per recepire nuove patch di sicurezza.
FROM python@sha256:6771159cd4fa5d9bba1258caf0b82e6b73458c694d178ad97c5e925c2d0e1a91

# Pango/fontconfig richiesti da WeasyPrint per generare il PDF del biglietto. Niente
# libgdk-pixbuf: WeasyPrint 69 non ne dipende più. Utente non privilegiato: l'immagine di base
# non ne definisce uno, il container girerebbe altrimenti come root. Il chown finale su
# /var/cache/fontconfig serve a fontconfig per scrivere la propria cache font.
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

# Separato dal resto del codice per sfruttare la cache dei layer Docker. Eseguito come root
# (prima dello USER sotto): site-packages resta sola lettura per appuser.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia esplicita per app, non un "COPY . ." ricorsivo su tutto il contesto — va aggiunta una
# riga se nasce una nuova app di primo livello. Nessun --chown: il codice resta di proprietà di
# root, sola lettura per appuser (un gunicorn compromesso non potrebbe alterare il proprio codice).
COPY manage.py .
COPY backend/ backend/
COPY users/ users/
COPY struttura/ struttura/
COPY prenotazioni/ prenotazioni/

USER appuser

EXPOSE 8000

# gunicorn (non il dev server Django), migrazioni applicate ad ogni avvio. GUNICORN_WORKERS
# opzionale, override via docker-compose.yml. Bind su ${PORT:-8000}: Render assegna la porta
# dinamicamente, altrove resta 8000. --no-control-socket: senza, gunicorn 25+ prova a scrivere
# in $HOME/.gunicorn (appuser, sola lettura) e fallisce con "Permission denied".
CMD ["sh", "-c", "python manage.py migrate && gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${GUNICORN_WORKERS:-3} --timeout 60 --no-control-socket"]
