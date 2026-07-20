# Guida allo Sviluppo: App Gestione Prenotazioni
**Stato**: Fase 1 Completata (Backend Area Piscina + Core Autenticazione) - Fase 2 in corso (Autenticazione Frontend Axios completata, UI Kit gluestack-ui + NativeWind integrata, schermate base di navigazione staff completate, mappa spaziale postazioni piscina completata)

Questa guida documenta l'architettura e la logica di business implementata per l'ecosistema Django/PostgreSQL e per il client React Native, con le configurazioni specifiche per le 4 app backend principali e per lo strato di autenticazione del frontend.

---

## 0. Stack Tecnologico
*   **Database**: PostgreSQL 17
*   **Backend**: Python 3.13, Django 6.0.4
*   **Frontend Mobile**: React Native 56.0.x (Expo SDK 56), Expo Router (routing basato su file system, `app/`)
*   **Librerie Core Backend**: Django REST Framework, djangorestframework-simplejwt (Auth, incl. `token_blacklist`), WeasyPrint (PDF), django-cors-headers, django-filter.
*   **Librerie Core Frontend**: Axios, expo-secure-store, NativeWind v5 (Tailwind CSS v4) come motore di styling, gluestack-ui v5 (alpha) come UI kit di componenti copy-paste.

---

## 1. Architettura delle App Django

Il progetto è suddiviso in 4 app principali: `users`, `struttura`, `prenotazioni`, e `menu`.

### App `users` (Gestione Accessi e Anagrafica)
1.  **Modello `Utente` (Staff/Admin)**
    *   **Scopo:** Gestire gli accessi al backend e alla dashboard amministrativa.
    *   **Campi Base:** `id` (UUID), `username`, `email`, `password`.
    *   **Permessi:** Ogni nuovo utente creato tramite l'API (`UtenteSerializer.create`, in `users/serializers.py`) ha `is_staff=True` ma **`is_superuser=False` di default**. Solo un account con `is_superuser=True` (creato via `python manage.py createsuperuser`, non tramite API) può gestire e monitorare tutti gli altri account staff/admin della piattaforma.
    *   **Permessi API (`UtenteViewSet`, in `users/views.py`):** protetto dalla permission custom `IsSuperUser` (`users/permissions.py`) per tutte le azioni di list/create/update/delete. Fa eccezione l'azione custom `GET /api/v1/users/staff/me/`, aperta a qualunque utente autenticato, che restituisce il profilo dell'utente loggato (usata dal frontend dopo il login, vedi sezione 4).
    *   **Autenticazione:** Sistema JWT (`djangorestframework-simplejwt`) configurato per mantenere le sessioni attive fino a **30 giorni** (access token), con refresh token della durata di **60 giorni**. `ROTATE_REFRESH_TOKENS` e `BLACKLIST_AFTER_ROTATION` sono attivi e resi effettivi dall'app `rest_framework_simplejwt.token_blacklist` (aggiunta a `INSTALLED_APPS` con le relative migrazioni applicate): ogni refresh invalida il token precedente ed emette una nuova coppia access/refresh.
2.  **Modello `Cliente` (Guest/Customer)**
    *   **Scopo:** Rappresentare l'anagrafica di chi usufruisce del servizio.
    *   **Campi:** `id` (UUID), `nome`, `telefono`, `note` (`TextField` opzionale, `blank=True, default=''` — note aggiuntive libere, es. allergie o richieste particolari), `created_at`, `updated_at`. Esposto in `PrenotazionePiscinaSerializer` come `cliente_note` (read-only, `source='cliente_id.note'`, stesso pattern di `cliente_nome`/`cliente_telefono`) per mostrarlo lato mappa piscina senza join lato frontend.

### App `struttura` (Risorse Fisiche e Inventario)
1.  **Modello `Piscina_Inventario`**
    *   **Scopo:** Definire la capacità massima, i listini prezzi, e gli orari di apertura della piscina.
    *   **Campi:** `id`, `nome`, prezzi (ingresso, ombrellone, ecc.), quantità totali delle risorse, `isActive` (per definire il listino in vigore).
    *   **Campi Temporali:** `orario_apertura`, `orario_chiusura`, `created_at`, `updated_at`.
2.  **Modello `Postazione`**
    *   **Scopo:** Rappresentare lo spot fisico (un ombrellone o un gazebo) sulla mappa spaziale di un dato `Piscina_Inventario`. È un dato **strutturale** (il layout fisico dell'area piscina), non legato a una data specifica — vedi `OccupazionePostazione` nell'app `prenotazioni` per l'assegnazione giornaliera.
    *   **Campi:** `id`, `inventario` (FK a `Piscina_Inventario`, `CASCADE`), `tipo` (`OMBRELLONE` / `GAZEBO`), `numero` (etichetta identificativa, univoca per inventario), `pos_x`/`pos_y` (float 0-100, posizione percentuale sul canvas della mappa, indipendente dallo zoom), `created_at`, `updated_at`.
    *   **API:** `PostazioneViewSet` (`struttura/views.py`) su `/api/v1/struttura/postazioni/`, filtrabile per `inventario` e `tipo`.
3.  **Modelli `Sala` e `Tavolo`** *(Da sviluppare)*
    *   **Scopo:** Mappatura della planimetria del ristorante per le prenotazioni dei tavoli.

### App `prenotazioni` (Logica Transazionale)
1.  **Modello `Prenotazione` (Base Astratta)**
    *   **Scopo:** Modello padre che accorpa i dati comuni (`abstract = True`).
    *   **Campi:** `id`, `cliente_id` (ForeignKey verso `users.Cliente`), `data`, `ora`, `stato`, `created_at`, `updated_at`.
2.  **Modello `Prenotazione_Piscina`**
    *   **Scopo:** Registrare le risorse bloccate per l'area piscina.
    *   **Campi:** `ingressi`, `ombrellone`, `gazebo`, `lettino`, `sdraia`. ForeignKey verso `struttura.Piscina_Inventario` (con vincolo `PROTECT` per preservare lo storico).
    *   **Serializer:** `PrenotazionePiscinaSerializer` espone anche `cliente_nome` (read-only, `SerializerMethodField`-like via `source='cliente_id.nome'`) per evitare una join lato frontend quando serve solo il nome del cliente (es. mappa postazioni).
    *   **Eliminazione di un `Piscina_Inventario` con prenotazioni collegate:** il `PROTECT` blocca correttamente la cancellazione (per non perdere lo storico), ma senza gestione esplicita Django solleva `ProtectedError` e DRF la propaga come 500 grezzo. `PiscinaInventarioViewSet.destroy()` (`struttura/views.py`) la intercetta e risponde `400` con un messaggio leggibile; il frontend (`PiscinaInventarioSection.tsx`, `confirmDelete`) lo mostra con un `alert`/`Alert.alert` immediato — l'eliminazione dalla card non apre l'`Actionsheet`, quindi il vecchio `error` di stato (mostrato solo dentro il form) non sarebbe mai stato visibile all'utente.
    *   **Regola di eliminazione data-based:** `PiscinaInventarioViewSet.destroy()` distingue le prenotazioni per data rispetto a `timezone.localdate()` (fuso `Europe/Rome`, coerente con `USE_TZ=True`). Se esiste **almeno una** `Prenotazione_Piscina` con `data >= oggi` (di qualsiasi stato, incluse `CANCELLED`) → **400**, eliminazione bloccata. Se esistono solo prenotazioni con `data < oggi`, queste vengono **eliminate automaticamente** (in una `transaction.atomic()` insieme all'inventario) per liberare il vincolo `PROTECT`; l'anagrafica `Cliente` collegata **non** viene mai toccata (un cliente può avere altre prenotazioni altrove).
3.  **Modello `OccupazionePostazione`**
    *   **Scopo:** Assegnazione **giornaliera** di una `struttura.Postazione` a un cliente — chi occupa quell'ombrellone/gazebo in una data specifica, quanti lettini/sdraie ha, ed eventualmente il collegamento alla prenotazione reale. Vive in `prenotazioni` (non in `struttura`) perché è un dato transazionale legato alla `data`, non al layout fisico.
    *   **Campi:** `id`, `postazione` (FK a `struttura.Postazione`, `CASCADE`), `data`, `prenotazione` (FK opzionale a `Prenotazione_Piscina`, `SET_NULL` — può essere assegnata anche manualmente senza una prenotazione reale), `cliente_nome`, `numero_lettini`, `numero_sdraie`, `orario_arrivo_previsto` (`TimeField` opzionale, `null=True, blank=True` — distinto da `Prenotazione.ora`: quello è l'orario della prenotazione originale se esiste, questo è l'orario di arrivo previsto per *questa* postazione/giorno, compilabile anche per i clienti walk-in che non hanno una prenotazione reale a monte), `created_at`, `updated_at`. Vincolo `unique_together = ('postazione', 'data')`: una sola occupazione per postazione al giorno.
    *   **API:** `OccupazionePostazioneViewSet` (`prenotazioni/views.py`) su `/api/v1/prenotazioni/occupazioni-postazione/`, filtrabile per `data`, `postazione` e `postazione__inventario`.
4.  **Modelli `Prenotazione_Tavolo` e `Prenotazione_Asporto`** *(Da sviluppare)*

### App `menu` (Catalogo Prodotti) *(Da sviluppare)*
1.  **Modelli `Prodotto` e `Voce_Ordine`**
    *   **Scopo:** Gestione del catalogo food & beverage e delle righe d'ordine.

---

## 2. Logica di Validazione e Output (Focus Piscina)

### Controllo Orari
Prima del salvataggio, il sistema verifica che l'`ora` richiesta per la prenotazione rientri strettamente tra l'`orario_apertura` e l'`orario_chiusura` definiti nel listino inventario attivo in quel momento.

### Calcolo Disponibilità in Tempo Reale (Anti-Overbooking)
Prima di confermare una `Prenotazione_Piscina`, il sistema (tramite Serializer):
1.  Identifica l'inventario attivo.
2.  Aggrega tramite query (`Sum`) le risorse già prenotate per la `data` richiesta (escludendo gli stati 'CANCELLED' e la prenotazione corrente in caso di update).
3.  Verifica che la nuova richiesta non ecceda la disponibilità residua (es. `richiesti <= totale - gia_prenotati`). Restituisce un errore specifico (400 Bad Request) per la singola risorsa esaurita.

### Generazione Biglietto d'Ingresso (PDF)
*   **Libreria:** `WeasyPrint` con template HTML dedicato.
*   **Trigger:** Disponibile tramite rotta custom (`/scarica_biglietto/`) solo per prenotazioni in stato `CONFIRMED`.
*   **Contenuto e Vincoli:** Il documento mostra il nome del cliente, data, ora e il riepilogo dettagliato delle risorse prenotate. **Non include alcun prezzo**, fungendo esclusivamente da titolo di accesso.

### Infrastruttura API
*   **CORS:** Configurati tramite `django-cors-headers` per permettere la comunicazione incondizionata con il frontend React Native.
*   **Filtri:** Implementati tramite `django-filter` per consentire query complesse in GET (es. ricerca per `data`, `stato` e `cliente_id`).

---

## 3. Autenticazione Frontend (Axios + Context)

Lo strato di autenticazione vive in `le-gole-fe/src/` ed è composto da tre moduli:

1.  **`utils/storage.ts`** — wrapper su `expo-secure-store` per salvare/leggere/cancellare `accessToken` e `refreshToken` nel keychain/keystore del device.
2.  **`services/api.ts`** — istanza Axios condivisa (`baseURL` puntato al backend Django) con due interceptor:
    *   **Request:** inietta automaticamente `Authorization: Bearer <accessToken>` letto da `storage.ts`.
    *   **Response:** su un 401 (esclusi gli endpoint `/v1/users/login/*`), avvia una singola chiamata di refresh a `/v1/users/login/refresh/` (condivisa tra richieste 401 concorrenti tramite promise cache), salva la nuova coppia access/refresh — dato che `ROTATE_REFRESH_TOKENS` è attivo lato backend — e ripete la richiesta originale. Se il refresh fallisce (refresh token scaduto/in blacklist), pulisce i token e notifica l'app tramite `setSessionExpiredHandler`.
3.  **`context/AuthContext.tsx`** — espone `AuthProvider` e l'hook `useAuth()` (`isAuthenticated`, `isLoading`, `user`, `login(username, password)`, `logout()`).
    *   Al mount, se esiste un `accessToken` salvato, chiama `GET /api/v1/users/staff/me/` per ripristinare la sessione.
    *   `login()` chiama `POST /api/v1/users/login/`, salva i token e poi recupera il profilo dallo stesso endpoint `me/`.
    *   È registrato come `onSessionExpired` handler di `api.ts`, così una sessione scaduta lato server pulisce anche lo stato React.

Il layout radice `app/_layout.tsx` (Expo Router) avvolge l'intera app in `<GluestackUIProvider mode="light"><AuthProvider>...</AuthProvider></GluestackUIProvider>`.

---

## 4. UI Kit Frontend: gluestack-ui v5 + NativeWind

Lo styling del frontend è basato su **NativeWind v5** (Tailwind CSS v4) con i componenti prefabbricati di **gluestack-ui v5 (alpha)**, integrati tramite la CLI ufficiale (`npx gluestack-ui@latest add <componente>`), che copia il codice sorgente del componente in `le-gole-fe/components/ui/<componente>/` (pattern "copy-paste", non una libreria da import diretto: i componenti sono file di progetto, modificabili liberamente).

1.  **Configurazione**
    *   `tailwind.config.js` — il `content` include `app/**`, `src/**`, **`components/**`** e **`node_modules/@gluestack-ui/**`** (necessario perché NativeWind processi le classi usate dai componenti gluestack-ui).
    *   `global.css` — definisce i design token come variabili CSS RGB (`--background`, `--foreground`, `--primary`, `--border`, `--destructive`, ecc.) in tre blocchi: `:root` (default light), `@media (prefers-color-scheme: dark)` e le classi `:root.dark` / `:root.light` (a specificità più alta, usate per il toggle manuale via `GluestackUIProvider`). I token sono poi esposti come colori Tailwind (`bg-background`, `text-foreground`, `bg-primary`, ecc.) tramite il blocco `@theme inline`.
    *   `babel.config.js` / `metro.config.js` — preset `nativewind/babel` e `withNativewind(config, { inlineRem: 16 })`, invariati rispetto al setup standard.
2.  **Tema forzato Light**
    *   L'app **non supporta il tema scuro**: `GluestackUIProvider` in `app/_layout.tsx` è impostato con `mode="light"` (non `"system"`), il che forza sia il colore native (`Appearance.setColorScheme`) sia la classe `.light` su web, ignorando le preferenze di sistema dark.
    *   Sfondo dell'app: **`#eae0c8`** (crema tenue, desaturato per non risultare troppo acceso), impostato una sola volta come `--background` in `global.css` (`:root` e `:root.light`) e propagato automaticamente a tutte le pagine tramite la classe utility `bg-background`.
3.  **Componenti installati** (in `components/ui/`): `box`, `button` (+ `ButtonText`, `ButtonSpinner`, `ButtonIcon`, `ButtonGroup`), `heading`, `hstack`, `input` (+ `InputField`, `InputIcon`, `InputSlot`), `spinner`, `text`, `vstack`, oltre al `gluestack-ui-provider` generato dall'`init`.
    *   **Nota:** il template generato per `spinner/index.tsx` usava l'API deprecata `nativeStyleToProp` con `target: 'style'`, incompatibile con la versione di `react-native-css` installata (errore di tipo). Corretto in `nativeStyleMapping` con `target: false`, che mappa il colore risolto dalla className direttamente alla prop `color` dello `ActivityIndicator` invece che a un attributo di stile.
4.  **Pagine convertite** a usare i componenti gluestack-ui invece dei primitivi React Native grezzi: `app/index.tsx` (selezione ruolo, con card centrata e pulsante "Area Cliente" disabilitato in attesa di implementazione), `app/login.tsx` (login staff) e `app/staff/index.tsx` (home staff).

---

## 5. Mappa Postazioni Piscina (Card Inventario + Pagina Mappa)

1.  **Home Staff (`app/staff/index.tsx`)**: saluto contestuale all'orario (Buongiorno/Buon pomeriggio/Buonasera/Buonanotte) + sottotitolo che spiega lo scopo della pagina.
2.  **Card Inventario (`src/components/staff/PiscinaInventarioSection.tsx`)**
    *   `PiscinaInventarioCard`: header con icona/nome/badge "Attivo", griglia 2×2 per le 4 risorse (ombrelloni/gazebi/lettini/sdraie).
    *   La zona "vai alla mappa" (header + risorse + pillola evidenziata "Gestisci mappa postazioni →") è un `Pressable` che naviga a `/staff/piscina/[inventarioId]`; i pulsanti "Modifica listino"/"Elimina" sono **fuori** da questo `Pressable`, separati da un divisorio, così non c'è ambiguità tra "apri la mappa" e "modifica il listino" (in precedenza erano annidati nello stesso `Pressable`).
    *   Stato di caricamento con `Spinner`; stato vuoto con icona, copy e CTA "+ Crea il primo listino".
    *   **Selettore tipo inventario:** ogni pulsante "+ Aggiungi" (header e stato vuoto) apre prima un `Actionsheet` di scelta tra **Piscina** / **Asporto** / **Sala** (`TIPO_INVENTARIO_OPTIONS`). Solo Piscina è implementata: sceglierla apre il form esistente. Asporto e Sala hanno badge "Presto" e, se toccate, mostrano solo un alert "in arrivo" — **non esistono ancora modelli/API backend per questi due tipi**, è un placeholder di UI in attesa di definire i campi necessari (numero tavoli/capienza per Sala, cosa rappresenta un "inventario" per Asporto).
3.  **Pagina Mappa (`app/staff/piscina/[inventarioId].tsx`)** — prima rotta dinamica del progetto (Expo Router, `useLocalSearchParams`).
    *   **Vista legata alla data:** selettore ◀ / "Oggi" / ▶ che carica postazioni, prenotazioni e occupazioni per il giorno selezionato (default: oggi).
    *   **Riepilogo disponibilità del giorno:** riga di 4 tessere (ombrelloni/gazebi/lettini/sdraie) con `residui / totale`, calcolate sottraendo dal totale dell'inventario la somma delle risorse già prenotate per la data selezionata (stessa logica anti-overbooking di `prenotazioni/serializers.py`, non conta solo le postazioni fisicamente piazzate sulla mappa). Colore dinamico: verde (disponibile), ambra (residuo ≤ 20% del totale), rosso (esaurito).
    *   **Canvas zoomabile:** area fissa (1000×560 unità logiche) con pulsanti "－"/"＋"/reset che applicano una `scale` (0.6-2.4×) via `transform`; il canvas è racchiuso in due `ScrollView` innestate (orizzontale + verticale) per il pan quando ingrandito.
    *   **Drag & drop postazioni:** ogni icona `Postazione` (⛱️ ombrellone, ⛺ gazebo) è trascinabile. **Attenzione:** la versione di `react-native-web` in uso non implementa più il responder system legacy su cui si basa `PanResponder` — su web gli handler vengono semplicemente ignorati (nessun tap, nessun drag). Il marker usa quindi due percorsi distinti nello stesso componente: **Pointer Events** (`onPointerDown` + listener `window` su `pointermove`/`pointerup`) su web, `PanResponder` nativo su iOS/Android — nessuna dipendenza aggiuntiva. Al rilascio la nuova posizione (`pos_x`/`pos_y`) viene salvata via `PATCH /postazioni/{id}/`.
        *   **Affidabilità del tap:** la soglia che distingue un tap da un drag (`TAP_MOVE_THRESHOLD_PX`) è 8px, non 3-4px — una persona raramente clicca con 0px di movimento tra mousedown e mouseup, e una soglia troppo stretta classificava tap reali come drag, impedendo l'apertura del form. I `Text` (emoji + numero) dentro il marker hanno anche `pointer-events-none select-none`: senza, un mousedown che parte esattamente sopra il glyph può innescare la selezione/trascinamento nativo del testo del browser invece del tap sul marker.
    *   **Assegnazione cliente — multi-unità:** se un cliente ha prenotato più di un ombrellone e/o più di un gazebo, va assegnato una volta per unità prenotata (2 ombrelloni ⇒ 2 postazioni ombrellone distinte). `remainingByPrenotazione` (nella pagina mappa) conta, per ogni prenotazione, quante `OccupazionePostazione` sono già collegate **distinte per tipo** (guardando `Postazione.tipo` di ogni occupazione), e calcola i residui `{ombrellone, gazebo}` separatamente — non basta un flag booleano "già assegnata/non assegnata". `daAssegnare` include una prenotazione finché ha almeno un'unità residua di un tipo qualsiasi; il pannello "Da assegnare" e il picker in-sheet mostrano i residui aggiornati (non i totali prenotati) e si filtrano per il tipo della postazione target (un cliente con solo gazebo residuo non compare come selezionabile per una postazione ombrellone). Dopo un'assegnazione, se il cliente ha ancora unità residue dello stesso tipo, resta selezionato per velocizzare le assegnazioni successive.
    *   **Creazione cliente walk-in — sezione separata:** la creazione di un cliente senza prenotazione **non avviene più dentro il foglio di assegnazione**. Un pulsante "+ Nuovo cliente" accanto a "Clienti del giorno" (sopra il pannello "Da assegnare") apre un `Actionsheet` dedicato con nome, telefono e **note aggiuntive opzionali** (`Cliente.note`). Alla conferma viene creato un vero record `users.Cliente` (`POST /api/v1/users/clienti/`, `src/services/clienti.ts`) — non solo testo libero — cosicché resti in anagrafica. Il cliente appena creato resta **selezionato** (`selectedWalkInCliente`, stato React `{id, nome, telefono}`), esattamente come un chip di prenotazione: compare come chip verde "🆕 {nome}" nel pannello "Da assegnare" (deselezionabile ritoccandolo) e fa comparire lo stesso hint "Tocca una postazione libera sulla mappa per assegnarla". A differenza di una prenotazione, un walk-in non ha vincoli di tipo ombrellone/gazebo (nessuna quantità prenotata da rispettare): **qualunque** postazione libera diventa selezionabile (bordo ambra) mentre è selezionato. La selezione di una prenotazione e quella di un walk-in sono mutuamente esclusive (`selectPrenotazioneCandidate`/`selectWalkInCliente` puliscono l'altra).
    *   **Form di assegnazione:** tap su una postazione libera apre un `Actionsheet` che si adatta a tre casi, senza più alcun toggle "Cliente esistente / Nuovo cliente" (quella scelta non esiste più qui):
        *   **Un cliente walk-in è selezionato:** il nome/telefono del `selectedWalkInCliente` vengono mostrati in sola lettura (già creati altrove); restano da compilare solo orario di arrivo/lettini/sdraie. Al submit, `confirmAssign` collega `prenotazione: null` e non richiama mai `createCliente` (il record esiste già).
        *   **Nessun walk-in selezionato, ma ci sono prenotazioni con residui per il tipo della postazione target:** un campo "select-like" (`Pressable` che apre un secondo `Actionsheet` con `ActionsheetItem` — nessun componente `select` di gluestack-ui installato, stessa logica del selettore tipo inventario) elenca le prenotazioni del giorno con residui > 0 per quel tipo, mostrando nome **e telefono** (`PrenotazionePiscinaSerializer.cliente_telefono`) e le unità ancora da assegnare. La scelta precompila nome/telefono/lettini/sdraie e collega `OccupazionePostazione.prenotazione`. Selezionare prima un chip dal pannello "Da assegnare" ha lo stesso effetto.
        *   **Nessuna delle due:** niente form — solo un messaggio ("Nessun cliente in attesa per questa postazione...") che rimanda al pannello "Da assegnare" o al pulsante "+ Nuovo cliente"; il pulsante "Assegna" non compare finché non c'è un candidato valido (walk-in selezionato o prenotazione disponibile), "Elimina postazione" resta sempre disponibile.
        *   **Orario di arrivo previsto:** campo testuale **obbligatorio** (placeholder "Es. 15:30", `OccupazionePostazione.orario_arrivo_previsto` non è più nullable a livello di modello/migrazione), presente anche nel foglio "occupant" di modifica. Precompilato con `Prenotazione.ora` quando si sceglie un cliente esistente, ma solo se quell'orario non è già passato rispetto ad adesso (confronto fatto solo se la data selezionata sulla mappa è **oggi** — per altre date non ha senso confrontare con l'ora attuale): se l'orario prenotato è nel passato (es. prenotazione delle 09:00 assegnata alle 16:00), il default ricade sull'orario attuale invece di riproporre un orario già scaduto. Stesso fallback sull'orario attuale per i walk-in. Validazione lato frontend al salvataggio (`validateOrarioArrivo`, sia in `confirmAssign` che in `confirmOccupantEdit`): formato "HH:MM" valido, campo non vuoto, e — solo se la data selezionata è oggi — orario non nel passato rispetto a quello attuale.
        Tap su una postazione occupata permette di modificarne i dati (incluso l'orario di arrivo) o "liberarla" (qui il nome resta testo libero, non passa dal picker).
        *   **Accessibilità dialog:** entrambi gli `Actionsheet` di questa pagina passano un `aria-label` esplicito a `ActionsheetContent` (dinamico in base a `sheetMode` per il foglio principale). Il rilevamento automatico del titolo di react-aria (usato internamente dal componente `Actionsheet` di gluestack-ui) via `<Heading>` interno è soggetto a una race condition con l'animazione di apertura del foglio — il warning "A dialog must have a title" in console appariva ad ogni apertura anche quando un `Heading` era presente; l'`aria-label` esplicito lo evita perché react-aria lo controlla per primo, prima di scansionare il DOM alla ricerca di un heading.
    *   **Pannello "Da assegnare":** prenotazioni del giorno con almeno un'unità residua (ombrellone e/o gazebo) non ancora assegnata; i chip mostrano i residui aggiornati, non i totali prenotati — oltre a ⛱️/⛺ mostrano anche i residui di 🛏️ lettini e 🪑 sdraie non ancora assegnati (calcolati sottraendo, per ciascuna prenotazione, la somma di `numero_lettini`/`numero_sdraie` di tutte le sue `OccupazionePostazione` collegate dal totale `lettino`/`sdraia` prenotato — stesso schema per-prenotazione già usato per ombrellone/gazebo in `remainingByPrenotazione`).
    *   **Pannello "Solo ingresso":** prenotazioni del giorno con `ombrellone === 0 && gazebo === 0` — mai mostrate sulla mappa, solo in questa lista di sola lettura.
    *   **Lista "Clienti del giorno":** pulsante accanto al titolo "Da assegnare" che apre un terzo `Actionsheet` (`aria-label="Clienti del giorno"`, stesso pattern di accessibilità) con **tutte** le prenotazioni del giorno selezionato (non solo quelle con residui), ordinate per nome. Ogni riga mostra nome, l'**orario previsto della prenotazione** (`Prenotazione.ora`, badge 🕐), telefono, le eventuali **note del cliente** (`cliente_note`, badge 📝, mostrato solo se non vuoto), la riga **"Prenotato:"** con **tutte** le risorse prenotate (🎟️ ingressi sempre, ⛱️/⛺/🛏️/🪑 solo se > 0 — i totali della prenotazione, non i residui) e un badge: **"Completo"** (verde) se non ha più unità residue di ombrellone/gazebo — vale anche per le prenotazioni "solo ingresso", sempre complete perché non prevedono postazioni — oppure **"Da assegnare"** (ambra) con il dettaglio delle unità residue (ombrellone/gazebo/lettini/sdraie) su una riga separata sotto "Prenotato:", stesso conteggio del pannello "Da assegnare".
        *   **Selezione per assegnazione:** toccare la parte informativa di una riga la seleziona come `selectedPrenotazioneId` (stesso effetto di un chip del pannello "Da assegnare") e chiude la lista, per assegnarla subito toccando una postazione libera sulla mappa — **solo se la prenotazione non è "Completo"**: un cliente già completamente assegnato non ha più unità da piazzare, quindi il tap sulla sua riga non fa nulla (in precedenza selezionava comunque la prenotazione, facendo comparire erroneamente il suggerimento "Tocca una postazione libera sulla mappa per assegnarla" anche se non c'era nulla da assegnare).
        *   **Modifica/elimina prenotazione:** ogni riga ha due icone impilate verticalmente sulla destra (non affiancate: più compatte e leggibili in una riga già densa di informazioni), ✏️ (apre un quarto `Actionsheet`, `aria-label` dinamico con il nome del cliente, e chiude la lista sottostante per evitare due fogli sovrapposti) e 🗑️ (con conferma `window.confirm`/`Alert.alert`, stesso pattern di `handleDeletePostazione`). Il foglio di modifica cambia solo i **dati della prenotazione** (orario, ingressi, ombrellone, gazebo, lettini, sdraie via `PATCH /v1/prenotazioni/piscina/{id}/`) — nome e telefono restano readonly qui perché vivono sull'anagrafica `Cliente` condivisa, non sulla singola prenotazione. L'eliminazione fa un `DELETE` reale della prenotazione: `PrenotazionePiscinaViewSet.destroy()` (`prenotazioni/views.py`) elimina esplicitamente, in una `transaction.atomic()`, anche tutte le `OccupazionePostazione` collegate prima di cancellare la prenotazione — senza questo intervento il vincolo `SET_NULL` le avrebbe lasciate "occupate" sulla mappa, solo scollegate. Le postazioni tornano quindi davvero libere; il frontend rispecchia subito la pulizia filtrando `occupazioni` in locale, senza aspettare un refetch.
        *   **Bug del validate() sui PATCH parziali:** `PrenotazionePiscinaSerializer.validate()` leggeva `data.get('inventario')`/`data.get('data')` assumendo sempre un payload completo; su un `PATCH` parziale (come il form di modifica qui sopra, che invia solo i campi cambiati) questi risultavano `None`, causando un 500 quando si confrontava `ora` con `inventario.orario_apertura`. Corretto facendo ricadere ogni campo omesso sul valore già presente su `self.instance` quando la request è un update parziale.
    *   **Stile pulsanti:** i pulsanti `variant="outline"` di gluestack-ui di default (`border-border` + `bg-background`) risultano poco visibili sopra gli sfondi `bg-sky-*` di questa pagina. Le icone di navigazione/zoom e il tasto indietro usano quindi `border-2 border-sky-300 bg-white shadow-sm`; i pulsanti distruttivi nei fogli (`Elimina postazione`, `Libera postazione`) usano `border-2 border-destructive bg-destructive/10` invece del semplice `border-destructive/40`; "+ Aggiungi postazione" usa il variant `default` (solido) invece di `outline`.
    *   **Posizione pulsanti azione:** "+ Nuovo cliente" (`variant="outline"`, `border-emerald-400 bg-emerald-50` — stesso tono verde smeraldo del chip walk-in selezionato) vive accanto a "+ Aggiungi postazione" in una `HStack` subito sotto il canvas della mappa: entrambi creano una nuova entità (postazione/cliente) indipendente dalla data selezionata, quindi stanno insieme come un'unica toolbar di azioni, non dentro il pannello "Da assegnare". "Clienti del giorno →", invece, resta accanto al titolo "Da assegnare" (è un filtro/vista sui dati di *quel* giorno) ma come `Button` bordato (`border-2 border-sky-300 bg-white shadow-sm`, stesso stile delle icone di navigazione) invece di un semplice `Text` sottolineato — in precedenza entrambi i pulsanti erano link di testo affiancati nell'header del pannello, poco leggibili come azioni.
    *   **Nuovi service frontend:** `src/services/struttura.ts` estesa con CRUD `Postazione`; nuovo `src/services/prenotazioni.ts` con `listPrenotazioniPiscina` e CRUD `OccupazionePostazione`.
    *   **Nota:** nessuna libreria di calendario/date-picker è installata — la navigazione data usa frecce ±1 giorno con formattazione manuale (`it-IT`). Possibile miglioramento futuro: calendario dedicato e pinch-to-zoom "nativo" via `react-native-gesture-handler`.

---

## 6. Prossimi Passi (Fase 2)
1.  ~~Configurazione Frontend: Setup di Axios su React Native per la gestione delle chiamate API e l'iniezione automatica del token JWT (Bearer).~~ **Completato** (vedi sezione 3).
2.  ~~UI Kit: integrazione gluestack-ui v5 + NativeWind, tema light forzato, schermate base (selezione ruolo, login staff, home staff).~~ **Completato** (vedi sezione 4).
3.  ~~Sviluppo UI Piscina: card inventario ristrutturate + mappa spaziale zoomabile per posizionare ombrelloni/gazebi e assegnare clienti/lettini/sdraie per data.~~ **Completato** (vedi sezione 5).
4.  **Area Cliente:** Il pulsante "Area Cliente" in `app/index.tsx` è al momento disabilitato/non funzionante — da implementare (flusso di accesso o registrazione per i clienti finali).
5.  **Estensione Backend Ristorante:** Creazione dei modelli per `Sala`, `Tavolo`, `Prenotazione_Tavolo` e `Prenotazione_Asporto`.
6.  **Estensione Backend Menu:** Creazione del catalogo prodotti.
7.  **Miglioramenti mappa piscina:** calendario per la selezione data, pinch-to-zoom nativo (`react-native-gesture-handler`), inserimento nuove prenotazioni direttamente dalla pagina mappa.
