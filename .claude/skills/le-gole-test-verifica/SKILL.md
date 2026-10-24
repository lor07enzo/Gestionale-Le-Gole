---
name: le-gole-test-verifica
description: Come scrivere ed eseguire i test di Le Gole (pytest/factory_boy nel backend, jest-expo nel frontend) e come verificare una modifica dal vivo senza toccare i server dell'utente (porte 8000/8081, container Docker, build web, Playwright). Usala quando scrivi test, prima di dichiarare finito un lavoro, o quando devi avviare backend/frontend per una verifica.
---

# Test e verifica — Le Gole

## Regola di sicurezza (la più importante)
L'utente tiene spesso in esecuzione i propri server: **backend su 8000** (di solito il container Docker `gestionale-le-gole-backend-1`, gunicorn, DB `le_gole_prod_db`; a volte `runserver` nativo con DB `le_gole_db`) e **Expo web su 8081**.
- Non fermarli, non riavviarli senza motivo, non lanciare un secondo dev server Expo nella stessa cartella (contesa su `.expo`/Metro; un `taskkill` sbagliato ha già abbattuto il server dell'utente).
- Per una verifica isolata usa porte dedicate (es. `runserver 8022`/`8077`, Expo `8093`) e termina **solo il tuo PID**. Estendi `CORS_ALLOWED_ORIGINS` via env per l'origine di verifica.
- Chi sta rispondendo su 8000? Guarda l'header `Server`: `gunicorn` = container Docker. Dati/account di prova in quel caso vanno creati con `docker compose exec backend python manage.py shell` (non nel Postgres nativo).
- Il container non ha `--reload`: dopo una modifica al backend serve `docker compose restart backend` (un'`@action` nuova altrimenti risponde 404). Cambi al `CMD` del Dockerfile richiedono `docker compose up -d --build backend`. Chiedi prima di riavviare.
- Ripulisci sempre dati e account temporanei, e verifica a zero.

## Backend
- `cd le-gole-be && .venv/Scripts/python -m pytest` (oppure `pytest <app>`): stampa la coverage (obiettivo 100% per app, 99% complessivo; l'unico ramo scoperto è il difensivo `except ProtectedError` di `struttura/views.py`).
- Struttura: pacchetto `test/` per app con `factories.py`, `conftest.py` e **più moduli `test_*.py` divisi per area**; mai un file unico, mai accodare a un file che copre altro. Test trasversali in `backend/test/`.
- Factory: `Decimal(...)` e `datetime.time(...)` veri, non stringhe (le property leggono il valore in memoria). Le factory di un'app possono importare quelle di un'altra nella direzione permessa (`menu` → `prenotazioni`).
- `APIClient`: sempre `format="json"` con un body (altrimenti multipart, `False` diventa `"False"`). Anonimo → 401, autenticato senza permesso → 403. `response.data` contiene UUID, non stringhe.
- Email: fixture con `settings.EMAIL_BACKEND = locmem` + `mail.outbox`. Cache azzerata tra i test dal conftest radice (throttling). Storage file locale su tmp.
- Date relative: `timezone.localdate()` + `timedelta` (nessun freezegun). Backdatare `created_at`/`deleted_at`: `Model.objects.filter(pk=…).update(…)`.
- Throttle nei test: `monkeypatch.setitem(api_settings.DEFAULT_THROTTLE_RATES, …)`.
- Guardiani da mantenere: `backend/test/test_openapi_schema.py` (zero warning, corpi richiesta, parametri filtrati a mano), `backend/test/test_numero_query.py` (tetto query per elenco).
- Dopo modifiche ai modelli: `manage.py makemigrations --check`.

## Frontend
- `cd le-gole-fe && npx tsc --noEmit && npx jest` (preset `jest-expo/web`, jsdom). Test accanto al codice in `__tests__/`.
- Coperti: `src/utils`, `src/services` (tabella metodo+path di ogni funzione), `src/context`, `src/hooks`. **Non** coperti: schermate `app/**` e componenti con gluestack (NativeWind non trasformabile; `collectCoverageFrom` non usabile).
- `render`/`renderHook` sono async: sempre `await`.
- Niente `jest.useFakeTimers()` insieme a `waitFor` (si blocca): usa date fisse remote o la data reale. Aggiornamenti da chiamate dirette a metodi di context: `await act(async () => {…})`.
- Mock per modulo (`jest.mock('../../services/…')`), mai axios reale. Rami nativi: `jest.replaceProperty(Platform, 'OS', 'android')`; moduli con valore da cambiare dopo l'import: mock con `__esModule: true` e getter.
- `jest-mock` è pinnato con override a 30.4.1; non lasciare che `expo install --fix` riporti jest alla 29.

## Build web (gate obbligatorio quando cambi dipendenze, layout radice o import condivisi)
`npx expo export -p web --clear && node scripts/verify-web-build.js` — serve `dist/` e apre `/`, `/cliente`, `/cliente/piscina`, `/login`, `/eliminazione-dati` con Chromium; fallisce su `pageerror`. Un crash Metro `FlatList undefined` (`react-native-web` ↔ `react-native-css`) è **non deterministico**: ogni export è un nuovo tentativo; non correggerlo, riesporta con `--clear`. La CI gira su `windows-latest` per questo.

## Verifica a schermo
- Playwright contro la build esportata o un dev server isolato, con API mockate via `page.route` quando possibile (nessun dato da creare). Viewport tipici: 390, 820, 1180, 1440.
- Misura via DOM (`getComputedStyle`, `getBoundingClientRect`), non solo screenshot.
- Su nativo non c'è emulatore: dichiara sempre all'utente cosa non hai potuto vedere su dispositivo.
