---
name: le-gole-dominio
description: Regole di business dei servizi di Le Gole — piscina (listini, mappa postazioni, ingressi ridotti/bambini, anti-overbooking, giorno pieno), asporto (menu, carrello, turni, limite prenotazioni per orario, chiusure, ricevute), padel (slot, racchette, snapshot), area cliente self-service, "Le mie prenotazioni", gestione staff e notifiche. Usala quando una modifica tocca il comportamento di un servizio, una validazione, chi può fare cosa, o un flusso cliente/staff.
---

# Dominio — Le Gole

Gestionale per Osteria Le Gole: piscina, asporto, padel (completi end-to-end); Sala/Ristorante non sviluppati (tessere "In arrivo"). Due mondi: **Area Cliente** pubblica senza login (self-service) e **area Staff** con JWT.

Dettagli per servizio — leggi solo quello che serve:
- [piscina.md](piscina.md) — listini, prenotazione, mappa postazioni, assegnazione, check-in.
- [asporto.md](asporto.md) — catalogo, checkout, turni, limiti, chiusure, ordini staff.
- [padel.md](padel.md) — configurazione, slot, racchette, prenotazioni.
- [cliente-e-staff.md](cliente-e-staff.md) — area cliente, storico via telefono, account staff, notifiche, aggiornamento app.

## Principi trasversali (valgono per tutti i servizi)

1. **Il canale online si può chiudere, la realtà fisica no.** Giorno pieno/chiuso, servizio disattivato, prodotto/racchetta nascosti bloccano solo le richieste anonime. Orari di apertura, griglia slot, anti-overbooking, capacità e limiti per orario valgono anche per lo staff.
2. **Il backend è l'autorità.** Ogni regola lato client è ripetuta lato server; ogni azione disabilitata in UI ha un backstop nella funzione che la esegue.
3. **Self-service nasce `CONFIRMED`** (forzato server-side). Walk-in staff nasce `CONFIRMED` con `creata_da_staff=True` e non genera notifiche.
4. **Nessuna eliminazione definitiva di prenotazioni dall'app**: si annulla (`CANCELLED`). Le cancellate non contano in disponibilità/limiti/conteggi.
5. **Giorni passati in sola lettura** lato staff (mappa piscina, storico ordini, storico cliente); i giorni futuri non si consultano dove non hanno senso (storico ordini asporto).
6. **Snapshot di prezzo/durata** su righe e prenotazioni quando la sorgente è mutabile; totali calcolati, mai salvati.
7. **Upsert cliente per telefono**: lo stesso numero ritrova storico e preferenze; non esiste login cliente. Il telefono è l'unico "segreto" per vedere il proprio storico; l'UUID è il segreto per dettaglio e PDF.
8. **Prezzo a 0.00 = tariffa non configurata** (nascosta), non "gratis".
9. **Soglie età/consigli** (fascia bambini, max 3 lettini per postazione) sono testo guida, non validazioni.
10. Testi UI in italiano, brevi, una idea per frase; niente anglicismi non spiegati ("walk-in" va evitato nelle note utente).
