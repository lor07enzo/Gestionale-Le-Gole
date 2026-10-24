# Piscina

## Listino (`PiscinaInventario`)
- Nome, orari apertura/chiusura, `isActive`, totali risorse (ombrelloni, gazebi, lettini, sdraie), prezzi per risorsa e per ingresso.
- Tariffe opzionali: `prezzo_ingresso_ridotto` + `orario_inizio_ridotto` (default 14:00), `prezzo_ingresso_bambino` + fascia `eta_minima_bambino`–`eta_massima_bambino` (sotto la minima = gratuito). Prezzo 0 nasconde la tariffa ovunque (`PREZZO_ITEMS.hideIfZero`).
- Una risorsa con totale 0 non compare (né prezzo né campo).
- Eliminazione: bloccata se esiste una prenotazione con `data >= oggi` non cancellata; altrimenti elimina in transazione le collegate (passate o cancellate). I clienti restano.
- Lato staff i listini stanno in `/staff/piscina`; "Nuovo listino" apre direttamente il form.

## Prenotazione (`PrenotazionePiscina`)
- `ora` deve stare tra apertura e chiusura.
- Ridotto: `ingressi_ridotti > 0` richiede `ora >= orario_inizio_ridotto`; viceversa, se il ridotto è configurato, `ingressi > 0` richiede `ora < soglia`.
- Anti-overbooking: somma per data delle risorse non cancellate (esclusa l'istanza in update) ≤ totale; errore per risorsa. Logica unica in `calcola_disponibilita()` (`prenotazioni/utils.py`), riusata da `disponibilita`. I contatori ingresso non hanno limite.
- `GiornoPienoPiscina` (inventario, data): blocca solo l'anonimo; `disponibilita` restituisce `pieno`. Il calendario cliente mostra i giorni pieni in rosa barrato.
- Biglietto PDF senza prezzi.

## Flusso cliente (`/cliente/piscina/[inventarioId]`)
- Data ≥ oggi, orario obbligatorio (quadrante `TimePickerModal` di react-native-paper-dates, validazione al submit), stepper per ingressi/lettini/sdraie (tetto = residuo), ombrellone/gazebo scelti sulla mappa (`PiscinaMappaSelettore`, postazioni occupate da `occupate/`, solo id).
- Submit: cliente (upsert) → prenotazione → una `OccupazionePostazione` per postazione scelta con lettini/sdraie distribuiti equamente (`Promise.allSettled`: una postazione nel frattempo occupata resta "Da assegnare", non fa fallire).
- Totale stimato solo informativo. Conferma con biglietto PDF.
- Riprenota dallo storico: stesse risorse, il cliente sceglie solo data e ora, nessuna postazione.

## Mappa staff (`/staff/piscina/[inventarioId]`, `?data=` opzionale)
- `Postazione` è **strutturale** (condivisa da tutte le date); l'assegnazione giornaliera è `OccupazionePostazione` (unique postazione+data).
- Postazioni: numero assegnato automaticamente (il più piccolo libero, unico per inventario a prescindere dal tipo); limite numero postazioni per tipo = totale del listino (solo in creazione). Gazebo creabili in blocco (quantità, colonna/riga, numerazione crescente/decrescente) con `gruppo` condiviso: si spostano solo insieme, resi come un unico rettangolo.
- Soft delete e storico posizioni: la mappa di un giorno passato mostra le postazioni e le posizioni di quel giorno.
- **Modalità modifica** (matita): fuori modalità il tocco apre sempre il foglio, dentro si trascina e il tocco non assegna. Esce cambiando data.
- Giorni passati: niente drag, assegnazione, creazione, modifica, liberazione, eliminazione; il foglio si apre in sola lettura.
- Assegnazione multi-unità per tipo (`remainingByPrenotazione`); lettini/sdraie precompilati e limitati al residuo. L'orario nel foglio di assegnazione è ereditato da `Prenotazione.ora` (sola lettura); in modifica occupante è editabile.
- Check-in "arrivato" per singola postazione (toggle immediato, badge verde sul marker, "N/M arrivati" nella lista).
- "Clienti del giorno": ordinati per orario effettivo (il più presto tra le occupazioni, altrimenti `ora`), azioni Conferma (solo PENDING storici)/Modifica/Annulla.
- "+ Nuovo cliente": crea cliente + prenotazione CONFIRMED per la data della mappa, con orario scelto.
- Colori stati: libera verde, occupata rosa, selezionata blu, neutra slate; bordo ambra in modalità modifica.
- Da `lg:` mappa a sinistra e "Da assegnare"/"Solo ingresso" a destra.
- Calendario con conteggio prenotazioni per giorno (`conteggi/`).
