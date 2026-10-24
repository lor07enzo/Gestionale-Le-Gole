# Asporto

## Catalogo (staff, `/staff/asporto`)
- `Categoria` e `Allergene` sono entità (nome unico); prodotto con FK categoria (PROTECT), M2M allergeni, prezzo, `disponibile` (nasconde dal menu pubblico), foto opzionale (camera o galleria, upload multipart separato su Cloudinary).
- Seed sempre presenti: categorie Pizze, Bevande, Vini; i 14 allergeni UE con icona. Tavolozza icone extra solo frontend.
- Eliminare un prodotto con ordini → 400, va nascosto. Eliminare una categoria con prodotti → 400.
- UI: catalogo a card per categoria, barra categorie sticky con scroll-spy (anche su nativo), ricerca, filtro Tutti/Visibili/Nascosti, foglio ⚙️ per categorie/allergeni, max 3 badge allergene + "+N".

## Configurazione (`ConfigurazioneAsporto`, singleton)
- `attivo` (default True): spento blocca solo il self-service, la pagina cliente mostra "Ordini online non disponibili".
- Primo turno `orario_apertura/chiusura`, secondo turno opzionale `_2` (entrambi o nessuno, non sovrapposti, il secondo inizia ≥ chiusura del primo). `orario_valido()`/`descrizione_orari()` sul modello.
- `limite_prenotazioni_orario` (null = nessuno, min 1): numero massimo di **ordini distinti** per stesso data+ora, vale per tutti (staff incluso). Conteggio pubblico via `prenotazioni_per_orario/`. Gli slot pieni mostrano "Esaurito"; da 2 posti liberi in giù compare "N posti liberi" sotto lo slot.
- `GiornoChiusoAsporto`: blocca solo l'anonimo. Calendario staff a tocco dentro Actionsheet (evita tocchi accidentali).

## Ordine (`PrenotazioneAsporto` + `VoceOrdine`)
- Sempre **per oggi** (cliente e walk-in staff). `ora` = ritiro, slot da 15 minuti raggruppati per fascia oraria (`PickerOrarioAsporto`).
- Validazione backend: orario dentro uno dei turni (tutti), giorno chiuso e servizio spento (solo anonimo), limite prenotazioni per orario (tutti).
- Riga: prezzo snapshot server-side, quantità ≥ 1, prodotto non disponibile rifiutato solo all'anonimo.
- Il frontend crea prima la prenotazione, poi le righe con `Promise.all` (una riga fallita = errore visibile).

## Checkout cliente (`/cliente/asporto`)
- Menu a card per categoria con righe stile Deliveroo, quick-add "+" che diventa stepper, dettaglio prodotto in pagina dedicata (`[prodottoId]`) con foto a schermo intero, allergeni completi, barra quantità+"Aggiungi per €X" fissa in fondo.
- Carrello in `CarrelloAsportoContext` (scoped al gruppo `asporto/`), derivato dai soli prodotti disponibili. Da `lg:` carrello e dati in colonna destra sticky.
- Filtri (Actionsheet): categoria e prezzo (OR nel gruppo), "Allergeni da evitare" (nasconde i prodotti che li contengono); AND tra gruppi. I filtri non toccano il carrello.
- Turno mostrato: il primo non ancora chiuso (`getFinestraAttiva`); lo staff vede entrambi i turni.
- Anticipo minimo 15', 30' con più di 10 pizze (categoria "Pizze") — solo lato client, non verificabile lato server con l'architettura attuale. Banner "servizio chiuso" anche quando adesso + anticipo supera la chiusura.
- Avvisi: chiusura oggi = blocco totale; chiusura da domani = avviso; banner fisso "possibili ritardi".
- Conferma con ricevuta PDF (con prezzi e totale).
- Riordino dallo storico: stesse righe, oggi, sceglie solo l'orario; bloccato se chiuso oggi, senza righe, o se un prodotto non è più disponibile (controllato **prima** di creare l'ordine, per non lasciarne di orfani).

## Ordini staff
- `/staff/asporto/ordini`: oggi raggruppato in "Adesso" (±30'), "Più tardi", "Orario già passato" e "Annullati" (richiusi), riepilogo "in arrivo" + prossimo ritiro, aggiornamento silenzioso ogni minuto. Giorni passati in sola lettura, futuri non navigabili, calendario con conteggi.
- Dettaglio `ordini/[ordineId]`: modifica righe (salvate subito) e orario/note (pulsante Salva), conferma, annulla. Il picker di modifica non disabilita slot passati.
- `ordini/nuovo`: walk-in per oggi, prodotti anche nascosti, slot passati disabilitati (senza anticipo), pulsante fluttuante verso il riepilogo.
