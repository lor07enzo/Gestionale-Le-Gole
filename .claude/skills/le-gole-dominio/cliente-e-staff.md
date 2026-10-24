# Area cliente, storico, staff, notifiche

## Area cliente (`/cliente`)
- Landing: hero, avvisi "piattaforma in sviluppo" e "eventi/compleanni" (affiancati da `md:`), griglia servizi (`ServiziClienteSection`, disponibilità da `servizi-disponibili/` con cache in memoria; "Verifica disponibilità…" al primo caricamento), ricerca "Le mie prenotazioni", footer scuro full-bleed (contatti, social, Maps, assistenza tecnica separata dalla mail del ristorante, link privacy ed eliminazione dati).
- Badge servizio: "Non disponibile" (backend esiste ma servizio spento) vs "In arrivo" (nessun backend: Ristorante).
- Pagine legali `/privacy` e `/eliminazione-dati` (URL dichiarato a Play Console, nel gate di build): devono restare coerenti tra loro e con i dati raccolti davvero. Ogni nuovo trattamento dati (es. analytics, nuova consultazione) va dichiarato in privacy aggiornando la data.
- Cloudflare Web Analytics cookieless iniettato nel build web.

## "Le mie prenotazioni"
- Ricerca per telefono (match esatto, `POST storico_telefono/` con body, mai in URL) sui tre servizi; risultati tenuti **solo in memoria** (`storicoSessione.ts`), senza risultati messaggio d'errore e nessuna navigazione. 429 → "troppe ricerche".
- Elenco: dati minimi (nome abbreviato, niente telefono/note). Dettaglio via UUID: telefono mascherato, note, PDF, Riprenota/Riordina.
- Pagina storico: elenco unico per data, filtri Servizio/Stato in un foglio "Filtri" (conteggi Stato legati al servizio scelto), sezioni "In programma" (ascendente) e "Storico" (richiuso).
- Limite noto: chi conosce un numero vede le prenotazioni di quella persona. Passo successivo possibile (non fatto): codice prenotazione o OTP SMS.

## Account staff
- Creati solo da un superuser (`/staff/utenti`, gate ripetuto in pagina) con username+email, email di attivazione (`legole://activate`); reset password self-service; nessun cambio password da autenticato.
- Superuser: non eliminabili da nessuno, disattivabili da altri superuser, nessuno disattiva sé stesso. Menu "⋮" per azioni.
- Login con nota ⓘ sullo username, mostra/nascondi password, autofill.
- Deep link `legole://` funzionano solo da build/dev client, non da Expo Go.

## Dashboard e navigazione staff
- `/staff`: tessere Piscina, Asporto, Padel, Sala ("In arrivo"), Gestione Staff (solo superuser); 1 colonna telefono, 2 da `md:`. Ricerca clienti 🔍 nell'header (min 2 caratteri, debounce 300ms).
- Scheda cliente `/staff/clienti/[id]`: tab Piscina/Asporto/Padel/Sala (griglia 2×2 → 4 da `md:`), "In programma" + "Storico" richiuso, CTA "Chiama".

## Notifiche
- In-app: polling 20s di `recenti/` dei tre servizi (`Promise.allSettled`, errore solo se falliscono tutti), letture per id in localStorage (rilette al momento della scrittura per non perdere letture di altre schede), lette nascoste, tab per categoria, tap → schermata dove gestirla, banner per arrivi nuovi in sessione.
- Push di sistema: solo per prenotazioni anonime; token per dispositivo (`DispositivoStaff`, upsert per token, rimosso al logout prima di cancellare i JWT); tap apre la schermata (anche ad app chiusa, listener nel layout radice). Icona piccola Android `assets/notification-icon.png` (silhouette ridisegnata). Richiede FCM (google-services.json committato, chiave service account su EAS mai committata) e `EXPO_ACCESS_TOKEN` di un robot Viewer con push security attiva.

## Aggiornamento obbligatorio
- `AggiornamentoObbligatorio` confronta `expo.version` con `versione-app/` all'avvio e al ritorno in primo piano; modal bloccante con link allo store. Mai su web, mai se la richiesta fallisce o manca il link (oggi iOS).
