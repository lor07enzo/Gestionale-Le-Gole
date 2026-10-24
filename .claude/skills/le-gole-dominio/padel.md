# Padel

## Modello concettuale (decisioni prese con l'utente)
- **Un solo campo**: nessun modello campo, anti-overbooking = nessuna sovrapposizione temporale. Un secondo campo richiederebbe una vera migrazione dati.
- **Durata unica** configurabile, griglia di slot automatica; **prezzo fisso a partita** (partecipanti non moltiplicano).
- Palline: booleano con prezzo unico. Racchette: catalogo di marche (`RacchettaPadel`: nome unico, prezzo, pezzi posseduti, `disponibile`), mai contese tra prenotazioni.

## Configurazione (`struttura.ConfigurazionePadel`, singleton)
- `attivo` (default False), orari (default 09–22), `durata_partita_minuti` (90), `prezzo_partita`, `max_partecipanti` (4), `prezzo_noleggio_palline`.
- `slot_disponibili()`: passi di durata dall'apertura, solo slot che **finiscono** entro la chiusura. `orario_valido()` richiede l'appartenenza alla griglia (parte dell'anti-overbooking).
- Validazione: apertura < chiusura; durata non più lunga della finestra (darebbe zero slot).
- `GiornoChiusoPadel` (data unica), `prossime/` pubblica.

## Prenotazione (`prenotazioni.PrenotazionePadel`)
- `ora` = inizio. Snapshot `durata_minuti`, `prezzo_partita`, `prezzo_palline` (la configurazione è mutabile). `orario_fine`, `totale`, `racchette_totali` calcolati.
- Righe `NoleggioRacchetta` (unique per marca, prezzo snapshot, PROTECT sul catalogo).
- Sovrapposizione per **intervallo** `[inizio, fine)` con la durata della prenotazione esistente (una vecchia partita più lunga può coprire slot diversi).
- Solo anonimo: servizio disattivato, giorno chiuso, racchetta nascosta. Tutti: orario in griglia, slot libero, `1 ≤ partecipanti ≤ max`, somma racchette ≤ partecipanti e ≤ pezzi per marca; non si abbassano i partecipanti sotto le racchette noleggiate.
- `disponibilita` restituisce `slots: []` se spento/chiuso: lo staff in creazione calcola gli slot lato client (`calcolaSlotOccupazione`) perché deve poter scavalcare quei blocchi.
- Biglietto PDF con prezzi e una riga per marca.

## Frontend
- Staff `/staff/padel`: stato servizio, configurazione, chiusure, catalogo racchette, link a partite. `/staff/padel/prenotazioni` (giorno, calendario con conteggi), `[prenotazioneId]` (modifica, noleggi salvati subito), `nuova` (data ≥ oggi, racchette scelte già in creazione). Lo slot occupato dalla partita in modifica resta selezionabile.
- Cliente `/cliente/padel`: pagina bloccata se spento; banner se giorno chiuso; slot passati di oggi nascosti; stepper partecipanti, switch palline, stepper per marca (tetto min(pezzi, partecipanti residui)). Storico e dettaglio con riprenota (stessi partecipanti/palline/note, niente racchette).
