---
name: le-gole-backend
description: Convenzioni e pattern del backend Django/DRF di Le Gole (app users, struttura, prenotazioni, menu). Usala prima di creare o modificare modelli, serializer, viewset, @action, migrazioni, permessi, throttling, PDF WeasyPrint, notifiche push, dipendenze Python o il Dockerfile in le-gole-be/.
---

# Backend Django — Le Gole

Python 3.13, Django 6.0.4, DRF, simplejwt (+ `token_blacklist`), django-filter, WeasyPrint, drf-spectacular, PostgreSQL 17. Codice in `le-gole-be/`. Per le regole di business dei singoli servizi vedi la skill `le-gole-dominio`; per i test `le-gole-test-verifica`.

Mappa modelli/endpoint: [riferimento-api.md](riferimento-api.md).

## Struttura e dipendenze tra app

- `users` (Utente staff, Cliente, DispositivoStaff push), `struttura` (risorse fisiche e configurazioni: PiscinaInventario, Postazione, ConfigurazionePadel, GiornoChiusoPadel, RacchettaPadel), `prenotazioni` (tutto ciò che è legato a una data), `menu` (catalogo asporto, VoceOrdine, ConfigurazioneAsporto, GiornoChiusoAsporto). `backend/` contiene settings, urls, `openapi.py` e le view trasversali (`servizi-disponibili`, `versione-app`).
- Import a livello di modulo **solo verticali**: `prenotazioni → struttura, users`; `menu → prenotazioni`. `prenotazioni` importa `menu` **solo dentro le funzioni** (unico caso: `PrenotazioneAsportoSerializer.validate()`, `dettaglio_pubblico`, `get_voci`). Non rendere strutturale la dipendenza inversa.
- Test che toccano modelli di `menu` e `prenotazioni` insieme vanno in `menu/test/`, mai in `prenotazioni/test/`.
- Configurazione nuova di un servizio va in `struttura` se `prenotazioni` deve leggerla (evita l'import locale).
- **Nuova app Django di primo livello** → aggiungi `COPY <app>/ <app>/` nel `Dockerfile` (è già successo un crash in produzione per `menu`), `INSTALLED_APPS`, `pytest.ini` (testpaths + `--cov`), `ci.yml` (`coverage xml --include` per app), `sonar-project.properties`.

## Pattern ricorrenti (copiali, non reinventarli)

**Self-service pubblico + staff autenticato**
- `get_permissions()`: solo `create` (e le `@action` pubbliche con `permission_classes=[AllowAny]`) è `AllowAny`; il resto `IsAuthenticated`. Lettura cataloghi/configurazioni: `IsAuthenticatedOrReadOnly`.
- `perform_create()` forza server-side, **mai dal payload**: richiesta anonima → `stato='CONFIRMED'`, `creata_da_staff=False`; staff → `creata_da_staff=True`, stato libero. Snapshot di prezzi/durate idem.
- Lo staff bypassa solo i blocchi del **canale online** (giorno pieno/chiuso, servizio disattivato, prodotto/racchetta nascosti). I vincoli fisici (orari di apertura, anti-overbooking, limite prenotazioni per orario, capacità) valgono per tutti.

**Singleton di configurazione** (`ConfigurazioneAsporto`, `ConfigurazionePadel`): PK fissa come costante di modulo + `get_solo()` con `get_or_create`. Esposti da un `APIView` GET/PATCH (non ModelViewSet), annotato con `@extend_schema_view` altrimenti sparisce da Swagger.

**Serializer**
- `validate()` su PATCH parziale: ogni campo omesso ricade su `self.instance` (bug storico che dava 500).
- Prezzi delle righe (`VoceOrdine.prezzo_unitario`, `NoleggioRacchetta.prezzo_unitario`, snapshot padel) sono `read_only` e impostati in `perform_create`.
- Totali **mai persistiti**: property sul modello (`totale`, `subtotale`, `orario_fine`).
- `min_value` espliciti: `PositiveSmallIntegerField` accetta 0, `DecimalField` accetta negativi.
- Un campo `unique` che deve fare upsert: `extra_kwargs = {'campo': {'validators': []}}`.
- Serializer pubblici (storico via telefono, dettaglio via UUID): **elenco campi esplicito, mai `'__all__'`**; nome abbreviato, telefono mascherato, niente note nell'elenco.

**Eliminazioni**: un `PROTECT` senza gestione dà 500. Intercetta `ProtectedError` in `destroy()` → 400 leggibile (fatto per inventario piscina, categoria, prodotto, racchetta). M2M non serve. Nessun DELETE reale delle prenotazioni lato frontend: si annulla (`stato='CANCELLED'`), e l'annullamento piscina libera le `OccupazionePostazione` in `perform_update()`.

**Soft delete** `Postazione.deleted_at` + `UniqueConstraint` condizionale (replicato in `validate()` perché DRF non lo introspeziona). Lo storico posizioni è in `PostazionePosizioneStorico` (una riga per giorno di spostamento).

**Upsert cliente per telefono**: `ClienteViewSet.create()` fa `get_or_create(telefono=…)` in `transaction.atomic()`, 201/200. Nessun vincolo `unique` a DB (né su `Cliente.telefono` né su `Utente.email`, controllata case-insensitive in applicazione).

**@action**
- L'URL è il **nome del metodo con gli underscore** (`prenotazioni_per_orario/`); solo il nome per `reverse()` usa i trattini. I test con `reverse()` non scoprono un URL sbagliato nel frontend (bug già capitato): verifica il path letterale.
- Su un'`@action`, `throttle_classes` **sostituisce** i default: ripeti anche `AnonRateThrottle`/`UserRateThrottle`.
- Ogni nuova `@action` va annotata con `@extend_schema` (parametri di query, risposta, `request=` se ha un body diverso dal serializer della viewset, `filters=False` se non filtra). Il test `backend/test/test_openapi_schema.py` fallisce sui warning; un body sbagliato **non** genera warning → aggiungi un caso in `TestCorpoRichiesta`. Pezzi riusabili in `backend/openapi.py`.

**Prestazioni (DB remoto Supabase, ogni query è un round-trip)**
- Ogni elenco usa `select_related`/`prefetch_related` nel `queryset` della viewset (anche in `recenti`/`storico_telefono`). Nel serializer, su una relazione precaricata usa solo `.all()`, mai `.filter()`/`.select_related()` (scavalca il prefetch).
- `backend/test/test_numero_query.py` fissa un tetto di query per elenco: aggiornalo per i nuovi elenchi.

**PDF**: WeasyPrint + template in `prenotazioni/templates/` (`ticket_piscina.html`, `ricevuta_asporto.html`, `biglietto_padel.html`). Endpoint pubblici via UUID, 400 solo per `CANCELLED`. In OpenAPI usa la chiave `(200, 'application/pdf')`, non `renderer_classes`.

**Notifiche push** (`users/push.py`): `invia_notifica_staff()` chiamato solo nel ramo anonimo di `perform_create`; invio in un thread, mai bloccante, `connections.close_all()` nel finally del wrapper; solo `DeviceNotRegistered` cancella il token; `channelId` deve combaciare con il canale dell'app.

## Settings e sicurezza

- Tutto da env (`django-environ`, `.env` non sovrascrive variabili già nel processo). `DEBUG` default False. `CORS_ALLOWED_ORIGINS` lista da env.
- Throttling globale `120/min` anon, `300/min` user (cache in memoria per-processo, quindi ~2× con 2 worker). Storico via telefono: `StoricoTelefonoThrottle` (`prenotazioni/throttling.py`) 5/min e 50/giorno per IP **e per servizio**, su cache a DB `throttle_cache`.
- `NUM_PROXIES` (env → `REST_FRAMEWORK['NUM_PROXIES']`, già in `settings.py`/`.env.example`/`render.yaml`; vuoto o 0 = `None`, nessun proxy fidato: corretto per locale/Docker). In produzione vale **2** (Cloudflare + Render, verificato con due client su reti diverse): con 1 il limite 5/min dello storico era condiviso da tutti i client (blocco alla sesta richiesta totale); senza variabile un `X-Forwarded-For` inventato aggira i limiti. Se cambia l'infrastruttura (es. si toglie Cloudflare) riverificalo. Il parsing tollera la stringa vuota (`env.int` andrebbe in crash).
- Con `DEBUG=False`: cookie secure + HSTS 1 giorno. **Non** attivare `SECURE_SSL_REDIRECT` (rompe l'health check di Render).
- Email: anymail/Resend, `DEFAULT_FROM_EMAIL = Le Gole <noreply@osterialegole.com>`. Link attivazione/reset da `FRONTEND_ACTIVATION_URL`/`FRONTEND_RESET_URL`.
- Foto prodotti su Cloudinary (`STORAGES['default']`); nei test il conftest forza FileSystemStorage su tmp.
- JWT: access 15 giorni, refresh 60, rotazione + blacklist.

## Dipendenze Python

`requirements.txt` è installato con `--only-binary :all: --require-hashes`: ogni pacchetto **e tutta la sua chiusura transitiva** va pinnato con `==` e `--hash`. Per i wheel compilati usa gli hash **linux manylinux x86_64** (dall'API JSON di PyPI o da un container dal digest del `FROM`), non quelli risolti dal venv Windows. Verifica con `pip install --dry-run --require-hashes --only-binary :all: --platform manylinux_2_17_x86_64 --platform manylinux2014_x86_64 --platform manylinux_2_28_x86_64 --platform any --python-version 3.13 --implementation cp --target <tmp> -r requirements.txt`.

Il `FROM` del Dockerfile è pinnato a digest; utente non-root `appuser`, codice di proprietà di root, unica directory scrivibile `/var/cache/fontconfig`.

## Migrazioni

- Data migration di seed idempotenti (`get_or_create`, nessun rollback): categorie Pizze/Bevande/Vini, i 14 allergeni UE con icona. Usare quei nomi nei test collide con l'unicità: usa nomi non seminati ("Panini", "Dolci", "Coloranti").
- Migrazioni non ancora committate/rilasciate: rollback + rigenera invece di accumulare una migrazione che crea e rimuove.
- Cambio di tipo su una tabella con dati: prima migra i dati, non affidarti a un `AlterField` automatico.

## Gotcha ambiente Windows

- Heredoc Bash mangia gli escape `\'`: per file Python con escape usa Write/Edit.
- Emoji passate a `curl` da Git Bash arrivano come `??`: scrivi dati unicode da `manage.py shell` con escape `\U…`.
