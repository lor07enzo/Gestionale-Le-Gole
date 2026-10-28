---
name: le-gole-deploy-rilascio
description: Infrastruttura e rilascio di Le Gole — Docker locale, deploy backend su Render + Supabase, deploy web su Netlify, CI GitHub Actions e SonarQube Cloud, build Android/iOS con EAS, versione app e aggiornamento obbligatorio, credenziali push (FCM/Expo), Play Console. Usala per variabili d'ambiente, pipeline, build native, release, store, o quando qualcosa funziona in locale ma non in produzione.
---

# Deploy e rilascio — Le Gole

Ogni deploy in produzione o pubblicazione su store è visibile a tutti: **chiedi conferma** prima di eseguirlo.

## Ambienti
| | Backend | Database | Frontend |
|---|---|---|---|
| Locale | `runserver` (porta 8000) con `le-gole-be/.env` | Postgres nativo `le_gole_db` (pytest crea `test_…`) | `npm run web` (8081), `.env` → `localhost:8000/api` |
| Docker | `docker-compose.yml`: gunicorn su 8000, `.env` + `.env.prod` (vince il secondo) | container `db` (porta host **5433**), `le_gole_prod_db`, utente `le_gole_app` | — |
| Produzione | Render web service da Dockerfile (`render.yaml`), `https://api.osterialegole.com` (`le-gole-backend.onrender.com`) | Supabase (Session Pooler se IPv6 non va, `DB_SSLMODE=require`, `CONN_MAX_AGE=60`) | Netlify `https://osterialegole.com`, `.env.production` (tracciato) |

- Niente `$` nei valori di `.env` (Docker Compose li interpola in silenzio). Verifica con `docker compose config`.
- Variabili segrete/variabili su Render sono `sync: false`; aggiungile anche a `.env.example` e `render.yaml`.
- Creare un superuser in produzione: `createsuperuser` dal terminale locale con le `DB_*` di Supabase esportate nella shell (vincono su `.env`).
- Render free dorme dopo 15 minuti (503 con `Retry-After` al risveglio). Gunicorn `GUNICORN_WORKERS=2`, `--threads 4`.

## Frontend web (Netlify)
- `deploy-frontend.yml`: push su `main` che tocca `le-gole-fe/**` → `expo export -p web` → `fix-html-lang.js` (`lang="it"`, notranslate) → `inject-cloudflare-analytics.js` → `verify-web-build.js` → `netlify deploy --prod --dir=dist --no-build`. Runner `windows-latest`.
- Fallback manuale: `npm run deploy:web` (stessa sequenza, `--no-build` indispensabile).
- Le `EXPO_PUBLIC_*` sono inlineate al build: `.env.production` vince su `.env`, le variabili di shell no.
- Crediti Netlify free (300/mese) si possono esaurire con molti push: deploy rifiutato 403, serve azione in dashboard.
- Fallback SPA in `netlify.toml`: ogni URL risponde 200, quindi per verificare un deploy cerca le stringhe nuove nel bundle servito.

## CI e qualità (`.github/workflows/ci.yml`, SonarQube Cloud)
- Job: test backend (Postgres 17 service, librerie WeasyPrint) con un `coverage xml --include="<app>/*"` **per app** (un XML unico perde i file omonimi tra app) + `sed` del `<source>`; test frontend con lcov; scan Sonar.
- Nuova app backend o nuova cartella `__tests__` → aggiorna `sonar-project.properties` (`sonar.tests` + `sonar.exclusions` per non indicizzare due volte).
- `sonar.coverage.exclusions` esclude `le-gole-fe/app/**` e `le-gole-fe/src/components/**`; il Quality Gate richiede coverage ≥ 80% sul nuovo codice, duplicazione ≤ 3%, rating A.
- Per leggere i problemi senza token: API pubblica `https://sonarcloud.io/api/qualitygates/project_status?projectKey=lor07enzo_Gestionale-Le-Gole` e `api/issues/search?componentKeys=…&inNewCodePeriod=true`.

## App native (EAS)
- Package/bundle `com.osterialegole.legole`, nome store **"Le Gole"**. `eas.json` profili development/preview/production, `appVersionSource: remote` (versionCode/buildNumber gestiti da EAS).
- `.easignore` alla radice del repo: su Windows eas-cli ignora i `.gitignore` annidati; con `.easignore` non legge nessun `.gitignore`, quindi ogni nuovo file locale/segreto va aggiunto lì a mano. **Non** escludere `le-gole-fe/.env.production` né `le-gole-fe/google-services.json`. Ispeziona con `npx eas-cli build:inspect --platform android --profile production --stage archive --output <dir>`.
- R8 attivo (`expo-build-properties`): un crash solo in release si corregge con `android.extraProguardRules`, non disattivando R8. Tenere allineate le versioni Expo (`npx expo install --check`).
- Icone: `icon-appstore.png` (1024, RGB senza alpha), `icon-adaptive-android.png` (logo al 60%, safe zone), `favicon.png`, `notification-icon.png` (bianca su trasparente, quadrata 96). Logo nero/bianco per UI chiara/scura.
- iOS: `supportsTablet: false`, `ITSAppUsesNonExemptEncryption: false`; manca ancora account Apple Developer e primo build.
- EAS esegue `npm ci --include=dev`: niente tool pesanti nelle devDependencies. `netlify-cli` (→ `ipx` → `sharp`) faceva fallire la build iOS (sharp compilato da sorgente); ora si usa `npx netlify-cli`.
- Avvisi Play Console su API edge-to-edge deprecate vengono da librerie terze: nessuna azione.
- `expo-dev-client` aggiunto per i development build (push e deep link non funzionano in Expo Go).

## Versione app e aggiornamento obbligatorio
1. Alza `expo.version` in `app.json` (minor per release pubbliche, patch durante il test chiuso; attuale 1.2.2). È il solo numero confrontato.
2. `eas build` + pubblicazione sugli store.
3. **Solo dopo** che è scaricabile: imposta `APP_VERSIONE_MINIMA` su Render (alzarla prima blocca utenti senza nulla da scaricare). `APP_STORE_URL_IOS` vuoto = nessun blocco su iOS.

## Push
- Client: `google-services.json` committato (non è un segreto) e referenziato in `app.json`. Server FCM: chiave service account caricata con `eas credentials`, **mai committata** (`.gitignore` la copre).
- `EXPO_ACCESS_TOKEN` = token di un robot user Viewer (non un personal token). La push security si attiva dalle impostazioni **account** Expo, dopo aver messo il token su Render. Verifica un token con un invio a `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`: `DeviceNotRegistered` = autenticato.

## Hardening già fatto (non regredire)
Dockerfile pinnato a digest, non-root, COPY espliciti per app, `--only-binary --require-hashes`; `ALLOWED_HOSTS` esatti in produzione; HSTS; GitGuardian ignora il token beacon Cloudflare (pubblico per natura).
