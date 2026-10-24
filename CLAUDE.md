# Le Gole — Guida allo Sviluppo (sintesi)

Gestionale prenotazioni per Osteria Le Gole: backend Django/DRF (`le-gole-be/`) + app Expo/React Native per web, Android e iOS (`le-gole-fe/`). Area **Cliente** pubblica senza login (self-service) e area **Staff** con JWT.

**Stato (ottobre 2026):** piscina, asporto e padel completi end-to-end (backend, staff, cliente, PDF, storico "Le mie prenotazioni", notifiche in-app e push); documentazione API OpenAPI/Swagger; aggiornamento obbligatorio dell'app. App Android in test chiuso su Play (v1.2.2), web in produzione su `osterialegole.com`. **Da fare:** Sala/Tavoli (nessun modello: tessere "In arrivo"), primo rilascio iOS (manca l'account Apple), `NUM_PROXIES=2` da impostare su Render (verificato; con 1 i limiti sono condivisi), chiave FCM server su EAS se non ancora caricata, revoca del vecchio personal token Expo.

## Skill di progetto (`.claude/skills/`) — caricale prima di lavorare nell'area
| Skill | Quando |
|---|---|
| `le-gole-backend` | modelli, serializer, viewset, `@action`, migrazioni, permessi, OpenAPI, dipendenze Python, Dockerfile |
| `le-gole-frontend` | schermate, componenti, stili NativeWind/gluestack, gesti, scroll, differenze web ↔ nativo |
| `le-gole-dominio` | regole di business di piscina, asporto, padel, area cliente, staff, notifiche |
| `le-gole-test-verifica` | scrivere/eseguire test, verificare dal vivo **senza toccare i server dell'utente** |
| `le-gole-deploy-rilascio` | Docker, Render/Supabase, Netlify, CI/Sonar, EAS, versioni, store, push |

## Stack
PostgreSQL 17 · Python 3.13, Django 6.0.4, DRF, simplejwt, django-filter, drf-spectacular, WeasyPrint, anymail/Resend, Cloudinary · Expo SDK 56 (React Native 0.85, Expo Router), NativeWind v5 (alpha), gluestack-ui v5, Axios, Zod, react-native-gesture-handler, expo-notifications · pytest + factory_boy, jest-expo + Testing Library · Render, Supabase, Netlify, EAS, GitHub Actions, SonarQube Cloud.

Per le API Expo leggi i doc versionati v56 (`le-gole-fe/AGENTS.md`).

## Mappa del repository
- `le-gole-be/` — app `users`, `struttura`, `prenotazioni`, `menu`; `backend/` (settings, urls, `openapi.py`, view trasversali); `Dockerfile`; `requirements.txt` con hash.
- `le-gole-fe/` — `app/` (rotte: `cliente/*`, `staff/*`, pagine pubbliche), `src/{services,context,utils,hooks,components,schemas}`, `components/ui/` (gluestack copy-paste), `scripts/` (post-processing e gate del build web).
- Radice — `docker-compose.yml`, `render.yaml`, `.easignore`, `sonar-project.properties`, `.github/workflows/{ci,deploy-frontend}.yml`, `README.md` (onboarding), `ER.md`/`UML.md`.
- `docs/archivio/guida-completa-2026-10-14.md` — la guida integrale precedente, **congelata**: cronologia dettagliata di decisioni, bug e verifiche. I commenti nel codice che citano "sezione N di CLAUDE.md" si riferiscono alla numerazione di quel file. Non aggiornarlo; usalo con grep quando serve il perché storico di una scelta.

## Invarianti da non rompere (dettagli nelle skill)
1. Il canale online si chiude (giorno pieno/chiuso, servizio spento, prodotto nascosto); i vincoli fisici (orari, anti-overbooking, limiti per orario) valgono anche per lo staff.
2. Stato, `creata_da_staff` e prezzi/snapshot sono decisi dal server, mai dal payload; il self-service nasce `CONFIRMED`.
3. Niente eliminazione definitiva di prenotazioni dall'app: si annulla.
4. Import tra app solo verticali (`prenotazioni → struttura/users`, `menu → prenotazioni`); `prenotazioni → menu` solo dentro funzioni.
5. Ogni `@action` annotata per OpenAPI; ogni elenco senza N+1; serializer pubblici con campi espliciti.
6. Tutto deve funzionare su web **e** nativo; colori/dimensioni critici come valori letterali inline.
7. Mai fermare/riavviare i server dell'utente (8000 Docker o runserver, 8081 Expo) senza chiedere; verifiche su porte dedicate.

## Comandi rapidi
- Backend test: `cd le-gole-be && .venv/Scripts/python -m pytest`
- Frontend: `cd le-gole-fe && npx tsc --noEmit && npx jest`
- Gate build web: `npx expo export -p web --clear && node scripts/verify-web-build.js`
- Docker: `docker compose up -d` · dopo modifiche backend `docker compose restart backend`

## Come documentare le modifiche
Dopo ogni modifica importante (nuova funzionalità, decisione architetturale, bug con causa non ovvia, nuova dipendenza, convenzione cambiata), nello stesso giro di lavoro:
1. Aggiorna la **skill pertinente** (o il suo file di riferimento) con la regola/trappola/decisione in forma sintetica: cosa, perché, in 1-3 righe. Niente diari di verifica, niente cronologia dei tentativi falliti (resta il solo insegnamento).
2. Aggiorna questo file solo se cambia lo **stato** del progetto, la mappa del repo, un invariante o l'elenco delle skill.
3. Aggiorna `README.md` solo se cambia lo stato implementato/da fare di una funzionalità a livello macro.
Scrivi in italiano, frasi brevi. Se una skill supera ~250 righe, sposta i dettagli in un file di riferimento accanto a `SKILL.md`.
