# Componenti e utility da riusare

Prima di scrivere un nuovo blocco UI controlla qui: molti esistono già in forma parametrizzata.

## `src/components/shared/`
- `CalendarPicker` — calendario mensile/settimanale; `minDate`, `maxDate`, `countsByDate` (abilita il toggle Mese/Settimana, solo staff), `fullDates` (giorni pieni/chiusi non selezionabili, rosa).
- `DateNavigatorConCalendario` — pillola ◀ data ▶ + calendario in Actionsheet + "Torna a oggi"; wrapper: `DateNavigatorPadel`, `DateNavigatorAsporto` (maxDate oggi). `DateNavigator` della mappa piscina è legato al context.
- `DateNavBar` — solo ±1 giorno. `CalendarioSheet`.
- `GiorniChiusuraCalendarCard` — riepilogo + calendario a tocco (toggle immediato) con `load/create/remove`.
- `StatoServizioCard` — toggle attivo/disattivo a salvataggio immediato (wrapper asporto/padel).
- `PickerOrarioAsporto` — fasce orarie → slot da 15'; tono `sky|emerald`, `statoSlot` decide passato/esaurito. Usato da checkout, riordino, nuovo ordine staff, modifica ordine.
- `SlotPickerPadel`, `RacchetteNoleggioPicker`, `StepperQuantita`, `DisponibilitaCards`, `ZoomPanCanvas`, `AggiornamentoObbligatorio`.

## Staff (`src/components/staff/`)
- `StaffPageHeader` (freccia indietro + titolo, `fallbackHref` obbligatorio), `ServizioStaffCard` (tessera dashboard; senza `href` = "In arrivo"), `SezioneLinkCard` (teaser verso pagina figlia, tono emerald per creazione), `ClienteInfoCard` (anagrafica + "Chiama"), `CatalogListEditor` (lista crea/elimina con `iconOptions` opzionali), `NotificationsBell`.
- `asporto/OrdineAsportoUI.tsx`: `OrdineRow`, `EditOrdineSheet`, `AggiungiProdottoSheet`, `calcolaTotale`.
- `piscina-mappa/`: `PostazioneMarker` (condiviso con la mappa cliente), sheets, `ZoomControls` (riceve `scale/setScale` come props).
- `padel/`: card configurazione, catalogo racchette, card/sheet partita, `NoleggiRacchetteEditor`.

## Cliente (`src/components/cliente/`)
- `ConfermaLayout` + `ConfermaPrenotazionePiscina|OrdineAsporto|PrenotazionePadel` (una conferma per servizio, condivisa tra prenotazione e riprenota).
- `DateNavCliente`, `DatiClienteCard`, `BackButton`, `ClienteFooter`, `PaginaLegale`, `PiscinaMappaSelettore`, `ServiziClienteSection`, `StoricoPrenotazioniSearch`, `storico/DettaglioStoricoUI`.

## Utility (`src/utils/`)
- `piscinaMappa.ts`: date (`toISODate`, `parseISODate` — mai `new Date(iso)`), `formatOrarioInput` (maschera HH:MM con backspace sul `:`), `parseHHMMToMinutes`, validazioni orario/ridotto/intero, `nextAvailableNumeri`, `computeBulkPositions`, `groupGazeboAttaccati`, `generaSlotOrario`, `raggruppaSlotPerOra`, `STATO_PRENOTAZIONE_*`, `formatIngressiSummary` (mostra "🎟️ 0": dove non lo vuoi costruisci le icone a mano).
- `asporto.ts` (turni, finestra attiva, residuo per orario), `ordiniAsporto.ts` (raggruppamento "Adesso" ±30'), `padel.ts`, `prezzi.ts`, `calendar.ts`, `dialog.ts`, `errors.ts`, `navigation.ts`, `biglietto.ts`, `push.ts`, `storage.ts`, `storicoSessione.ts`, `versione.ts`.
- Hook: `useScaricaPdf`.
