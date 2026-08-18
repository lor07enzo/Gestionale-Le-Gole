# Le Gole — Gestionale Prenotazioni

Applicazione di gestione prenotazioni per Osteria/Pizzeria Le Gole: area piscina (staff + self-service cliente), con ristorante, asporto e padel in arrivo. Backend Django/PostgreSQL + app React Native (Expo Router), rilasciata attualmente in versione **solo web** in fase di test.

[![CI](https://github.com/lor07enzo/Gestionale-Le-Gole/actions/workflows/ci.yml/badge.svg)](https://github.com/lor07enzo/Gestionale-Le-Gole/actions/workflows/ci.yml)
[![Deploy Frontend](https://github.com/lor07enzo/Gestionale-Le-Gole/actions/workflows/deploy-frontend.yml/badge.svg)](https://github.com/lor07enzo/Gestionale-Le-Gole/actions/workflows/deploy-frontend.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lor07enzo_Gestionale-Le-Gole&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lor07enzo_Gestionale-Le-Gole)

**Sito in produzione:** [osterialegole.com](https://osterialegole.com)
**API in produzione:** `https://api.osterialegole.com/api/v1/`

> Documentazione tecnica: [diagrammi UML](UML.md) · [diagramma ER](ER.md)

---

## Indice

- [Stack tecnologico](#stack-tecnologico)
- [Struttura del repository](#struttura-del-repository)
- [Funzionalità implementate](#funzionalità-implementate)
- [Roadmap — funzionalità da implementare](#roadmap--funzionalità-da-implementare)
- [Setup ambiente di sviluppo](#setup-ambiente-di-sviluppo)
- [Testing](#testing)
- [CI/CD e deploy](#cicd-e-deploy)
- [Documentazione aggiuntiva](#documentazione-aggiuntiva)

---

## Stack tecnologico

| Livello | Tecnologie |
|---|---|
| **Database** | PostgreSQL 17 |
| **Backend** | Python 3.13, Django 6.0, Django REST Framework, `djangorestframework-simplejwt` (auth JWT), WeasyPrint (PDF biglietti), `django-cors-headers`, `django-filter`, `django-anymail` (email transazionali via Resend), pytest + pytest-django + factory_boy |
| **Frontend** | React Native 0.85 (Expo SDK 56), Expo Router, Axios, `expo-secure-store`, NativeWind v5 (Tailwind CSS v4), gluestack-ui v5 (alpha), Zod, `expo-file-system` + `expo-sharing`, `react-native-paper`/`react-native-paper-dates` (solo per il time picker cliente), jest-expo + `@testing-library/react-native` |
| **Infrastruttura** | Render (backend, Docker), Supabase (Postgres gestito), Netlify (frontend web statico), GitHub Actions (CI/CD), SonarQube Cloud (analisi qualità/coverage) |

---

## Struttura del repository

```
Gestionale-Le-Gole/
├── le-gole-be/            # Backend Django REST Framework
│   ├── users/              # Autenticazione staff, anagrafica clienti
│   ├── struttura/           # Inventario piscina, postazioni (layout fisico)
│   ├── prenotazioni/         # Prenotazioni, occupazioni postazione, logica di business
│   └── menu/                # (da sviluppare) catalogo prodotti
├── le-gole-fe/             # Frontend Expo Router (React Native + Web)
│   ├── app/                 # Routing a file system (staff, cliente, rotte pubbliche)
│   ├── src/                  # Context, componenti, servizi API, utility
│   └── components/ui/        # Componenti gluestack-ui (copy-paste)
├── docker-compose.yml       # Backend + Postgres containerizzati (solo sviluppo)
├── render.yaml              # Blueprint di deploy del backend su Render
├── sonar-project.properties # Configurazione analisi SonarQube Cloud
└── .github/workflows/       # CI (test) + deploy automatico frontend
```

---

## Funzionalità implementate

### 🔐 Autenticazione e gestione staff
- Login staff via JWT (access token 15 giorni, refresh 60 giorni, rotazione + blacklist automatica)
- Creazione staff **su invito**: l'admin inserisce solo username/email, l'account nasce senza password utilizzabile e riceve un'email di attivazione
- Attivazione account e reset password **self-service** via link email (deep link nativo + fallback web)
- Attiva/disattiva account (riservato ai superuser), con guardrail anti-lockout (un superuser non può disattivare se stesso)
- **I superuser sono disattivabili ma mai eliminabili** (né da sé stessi né da altri superuser) — solo lo staff normale può essere eliminato definitivamente
- Sezione "Gestione Staff" visibile solo ai superuser, con azioni (Modifica/Disattiva/Elimina) raccolte in un menu a comparsa per riga

### 🏊 Area Piscina — lato staff
- Gestione listini piscina (prezzi, orari di apertura, quantità disponibili per risorsa)
- Tariffe di ingresso multiple: intero, ridotto pomeridiano, bambini (fascia d'età), gratuito
- Mappa spaziale zoomabile e pannabile (pinch-to-zoom, drag libero) per posizionare ombrelloni/gazebi
- Drag & drop delle postazioni con storico delle posizioni per data (la mappa consultata su un giorno passato non viene alterata da uno spostamento successivo)
- Soft delete delle postazioni (lo storico occupazioni/posizioni non viene mai perso)
- Limite di capacità per tipo di postazione, allineato al listino
- Assegnazione clienti alle postazioni (anche multi-unità), con gestione di lettini/sdraie per postazione
- Check-in "cliente arrivato" per singola postazione
- Creazione walk-in ("+ Nuovo cliente") direttamente dalla mappa
- Calendario con conteggio prenotazioni per giorno (viste Mese/Settimana)
- Marcatura manuale "giorno pieno" per chiudere le prenotazioni online mantenendo aperta la gestione walk-in
- Ricerca clienti (per nome o telefono) con scheda cliente e storico prenotazioni
- Modifica/annullamento prenotazioni (l'annullamento sostituisce l'eliminazione definitiva, ormai non più disponibile da UI)
- Generazione biglietto di ingresso in PDF (WeasyPrint)
- Sola lettura automatica per i giorni passati (consultabili ma non modificabili)

### 👥 Area Cliente — self-service
- Landing pubblica con selezione servizio (Piscina attiva, Ristorante/Asporto/Padel "in arrivo")
- Flusso di prenotazione piscina completo: dati cliente, scelta data/orario (con time picker a quadrante), disponibilità residua in tempo reale, selezione ombrellone/gazebo direttamente sulla mappa
- Anti-overbooking e validazione orari lato client e lato server
- Prenotazione confermata **immediatamente** (nessuna attesa di conferma manuale dello staff)
- Biglietto PDF scaricabile subito dopo l'invio (cross-platform: download diretto su web, condivisione di sistema su nativo)
- Note su come contattare il locale per eventi/compleanni e sezione "Assistenza e feedback" per segnalazioni sulla piattaforma
- Privacy policy dedicata

### 🔔 Notifiche in-app staff
- Pannello notifiche con polling automatico per le nuove prenotazioni self-service
- Stato letto/non letto per singola notifica (persistito, sincronizzato correttamente anche tra più schede del browser)
- Filtri per categoria di servizio (Piscina attiva, Asporto/Sala predisposte per il futuro)
- Tap su una notifica → apertura diretta della mappa staff sul giorno della prenotazione

### 🔒 Sicurezza e infrastruttura
- CORS ristretto alle origini reali di produzione
- Hardening di sicurezza Django (cookie sicuri, HSTS) attivo in produzione
- Rate-limiting/throttling su tutte le API (limiti differenziati anonimo/autenticato)
- `ALLOWED_HOSTS` ristretto agli host esatti di produzione
- Variabili sensibili sempre lette da ambiente, mai hardcoded

### ✅ Testing automatico
- **Backend:** suite pytest (170+ test, ~99% di copertura) organizzata per app e per area funzionale
- **Frontend:** suite jest (utility di business logic, context/hook), introdotta per coprire i punti più delicati dell'app
- Gate automatico in CI che verifica l'assenza di crash JS sulla build web esportata prima di ogni deploy

### 🚀 CI/CD e deploy
- GitHub Actions: test backend + frontend ad ogni push, analisi qualità/coverage su SonarQube Cloud
- Deploy automatico del backend su Render (Docker) a ogni push su `main`
- Deploy automatico del frontend (build statica) su Netlify, con verifica pre-deploy della build
- Ambiente Docker Compose per lo sviluppo locale del backend (facoltativo, alternativo al venv nativo)

---

## Roadmap — funzionalità da implementare

| Area | Stato | Note |
|---|---|---|
| **Ristorante** (`Sala`, `Tavolo`, `Prenotazione_Tavolo`) | 📋 Da sviluppare | Nessun modello/API backend ancora definito |
| **Asporto** (`Prenotazione_Asporto`) | 📋 Da sviluppare | Dipende anche dal catalogo prodotti (`menu`) |
| **Padel** | 📋 Da sviluppare | Card/UI già predisposte come "in arrivo", nessun backend |
| **Catalogo prodotti** (app `menu`, `Prodotto`/`Voce_Ordine`) | 📋 Da sviluppare | Necessario per Asporto e futuri menu digitali |
| **Area cliente "Le mie prenotazioni"** | 📋 Da sviluppare | Oggi il cliente riceve solo la conferma a schermo/PDF, nessuna vista di consultazione successiva |
| **Build native iOS/Android** (EAS Build) | 📋 Da sviluppare | Fase attuale è "solo web" per i test; nessun profilo `eas.json` configurato |
| **Cache condivisa per il rate-limiting** (Redis) | 📋 Valutazione futura | Non giustificata al livello di traffico attuale |

---

## Setup ambiente di sviluppo

### Prerequisiti
- Python 3.13, Node.js, PostgreSQL 17 (o Docker per l'alternativa containerizzata)
- Un file `.env` in `le-gole-be/` (vedi `.env.example`) con le variabili richieste (`SECRET_KEY`, `DB_*`, `RESEND_API_KEY`, ecc.)

### Backend

```bash
cd le-gole-be
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

### Frontend

```bash
cd le-gole-fe
npm install
npx expo start --web
```

### Alternativa containerizzata (solo backend + database)

```bash
docker compose up
```

---

## Testing

```bash
# Backend (dalla root di le-gole-be/, venv attivo)
pytest

# Frontend (dalla root di le-gole-fe/)
npm test
npm run test:coverage
```

---

## CI/CD e deploy

- **Backend:** Render (Docker), database gestito su Supabase — deploy automatico ad ogni push su `main`
- **Frontend:** Netlify (build statica via `expo export -p web`) — deploy automatico via GitHub Actions, con fallback manuale documentato (`npm run deploy:web`) in caso di build CI non riproducibile
- **Qualità:** SonarQube Cloud, analisi CI-based con coverage backend e frontend

---

## Documentazione aggiuntiva

- [Diagrammi UML](UML.md) — architettura, casi d'uso, classi, stati, sequenze
- [Diagramma ER](ER.md) — schema del database, vincoli, comportamento `ON DELETE`
