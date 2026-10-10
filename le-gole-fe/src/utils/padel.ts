import type { NoleggioRacchetta, PrenotazionePadel, SlotPadel } from '../services/padel';
import { formatTime, isSameDay, parseHHMMToMinutes } from './piscinaMappa';

// Il backend non filtra gli orari già passati (nessun concetto di anticipo minimo per il padel):
// oggi un orario delle 10:00 resterebbe "disponibile" anche alle 15:00. Lato cliente li si nasconde
// invece di mostrarli disabilitati, per non introdurre una terza etichetta nel picker condiviso.
export function slotPadelFuturi(slots: SlotPadel[], data: Date, adesso: Date = new Date()): SlotPadel[] {
  if (!isSameDay(data, adesso)) return slots;
  const nowMinuti = adesso.getHours() * 60 + adesso.getMinutes();
  return slots.filter((slot) => (parseHHMMToMinutes(slot.ora) ?? 0) >= nowMinuti);
}

export function totaleRacchetteScelte(quantita: Record<string, number>): number {
  return Object.values(quantita).reduce((somma, qty) => somma + qty, 0);
}

// Un partecipante in meno può riportare il totale delle racchette scelte sopra il nuovo tetto
// (al massimo una per giocatore): toglie le eccedenti partendo dalla prima marca.
export function ricalibraRacchette(quantita: Record<string, number>, partecipanti: number): Record<string, number> {
  let totale = totaleRacchetteScelte(quantita);
  if (totale <= partecipanti) return quantita;
  const next = { ...quantita };
  for (const id of Object.keys(next)) {
    while (totale > partecipanti && next[id] > 0) {
      next[id] -= 1;
      totale -= 1;
    }
    if (totale <= partecipanti) break;
  }
  return next;
}

// Tetto dello stepper di una marca: né più dei pezzi posseduti, né oltre i partecipanti ancora
// senza racchetta (contando anche quelle già scelte di altre marche).
export function maxRacchettaSelezionabile(
  pezziPosseduti: number,
  partecipanti: number,
  quantita: Record<string, number>,
  racchettaId: string
): number {
  const valore = quantita[racchettaId] ?? 0;
  const residuoPartecipanti = partecipanti - (totaleRacchetteScelte(quantita) - valore);
  return Math.max(0, Math.min(pezziPosseduti, residuoPartecipanti));
}

// Costo delle racchette scelte, dal catalogo corrente (la prenotazione non esiste ancora).
export function costoRacchetteScelte(
  catalogo: Array<{ id: string; prezzo_noleggio: string }>,
  quantita: Record<string, number>
): number {
  return catalogo.reduce((somma, racchetta) => {
    const qty = quantita[racchetta.id] ?? 0;
    return somma + qty * (Number.parseFloat(racchetta.prezzo_noleggio) || 0);
  }, 0);
}

export function formatDurata(minuti: number): string {
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  return resto === 0 ? `${ore}h` : `${ore}h ${resto}min`;
}

// "18:00 - 19:30" dall'orario di inizio e dalla property `orario_fine` calcolata dal backend.
export function formatFasciaPartita(ora: string, orarioFine: string): string {
  return `${formatTime(ora)} - ${formatTime(orarioFine)}`;
}

export function racchetteNoleggiate(noleggi: NoleggioRacchetta[]): number {
  return noleggi.reduce((somma, riga) => somma + riga.quantita, 0);
}

// `PrenotazionePadel.totale` arriva dal backend ed è già stale non appena si aggiunge o rimuove
// una racchetta: dopo ogni modifica alle righe il totale mostrato va ricalcolato da qui, come
// `calcolaTotale` fa per le righe di un ordine asporto.
export function calcolaTotalePadel(
  prenotazione: Pick<PrenotazionePadel, 'prezzo_partita' | 'prezzo_palline' | 'palline_noleggiate'>,
  noleggi: NoleggioRacchetta[]
): number {
  const partita = Number.parseFloat(prenotazione.prezzo_partita) || 0;
  const palline = prenotazione.palline_noleggiate
    ? Number.parseFloat(prenotazione.prezzo_palline) || 0
    : 0;
  const racchette = noleggi.reduce(
    (somma, riga) => somma + (Number.parseFloat(riga.subtotale) || 0),
    0
  );
  return partita + palline + racchette;
}

// Totale di una partita non ancora creata: prezzi dalla configurazione e dal catalogo correnti.
export function totaleStimatoPadel(
  configurazione: { prezzo_partita: string; prezzo_noleggio_palline: string },
  palline: boolean,
  catalogo: Array<{ id: string; prezzo_noleggio: string }>,
  racchette: Record<string, number>
): number {
  const partita = Number.parseFloat(configurazione.prezzo_partita) || 0;
  const costoPalline = palline ? Number.parseFloat(configurazione.prezzo_noleggio_palline) || 0 : 0;
  return partita + costoPalline + costoRacchetteScelte(catalogo, racchette);
}

export function formatTotaleEuro(totale: number): string {
  return totale % 1 === 0 ? `${totale}` : totale.toFixed(2).replace('.', ',');
}

type PartitaOccupante = Pick<PrenotazionePadel, 'ora' | 'durata_minuti' | 'stato'> & { id?: string };

// Griglia di slot con lo stato di ciascuno, calcolata lato client dalla configurazione e dalle
// partite già in calendario. L'azione pubblica `disponibilita` restituisce zero slot quando il
// servizio è spento o il giorno è chiuso — corretto per il cliente, inutilizzabile per lo staff,
// che quelle due condizioni le scavalca. Il confronto è per sovrapposizione di intervalli, non per
// uguaglianza dell'orario: ogni partita porta con sé la propria durata, che può differire da
// quella configurata oggi.
export function calcolaSlotOccupazione(
  orariGriglia: string[],
  partite: PartitaOccupante[],
  durataMinuti: number,
  escludiId?: string
): SlotPadel[] {
  const occupati = partite
    // Il confronto con `escludiId` va fatto solo quando è stato davvero passato: altrimenti una
    // partita senza id verrebbe scartata dal confronto `undefined !== undefined`.
    .filter((partita) => partita.stato !== 'CANCELLED' && (!escludiId || partita.id !== escludiId))
    .map((partita) => {
      const inizio = parseHHMMToMinutes(formatTime(partita.ora)) ?? 0;
      return { inizio, fine: inizio + partita.durata_minuti };
    });

  return orariGriglia.map((ora) => {
    const inizio = parseHHMMToMinutes(ora) ?? 0;
    const fine = inizio + durataMinuti;
    return {
      ora,
      disponibile: occupati.every((occupato) => fine <= occupato.inizio || inizio >= occupato.fine),
    };
  });
}
