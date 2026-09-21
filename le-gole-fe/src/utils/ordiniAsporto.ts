import type { StatoPrenotazione } from '../services/prenotazioni';
import { formatTime, parseHHMMToMinutes } from './piscinaMappa';

// Quanto largo è, in minuti, l'intorno di "adesso" entro cui un ordine è considerato imminente.
// Copre entrambe le direzioni: un ritiro tra poco e uno il cui orario è appena passato (cliente in
// ritardo, o consegna in corso proprio in questo momento) restano insieme, perché per lo staff sono
// la stessa identica cosa — roba da avere sottomano adesso.
export const FINESTRA_ADESSO_MINUTI = 30;

type OrdineRaggruppabile = { ora: string; stato: StatoPrenotazione };

export type GruppiOrdiniGiorno<T> = {
  adesso: T[];
  piuTardi: T[];
  passati: T[];
  annullati: T[];
};

// Minuti che mancano al ritiro (negativi se l'orario è già passato), o null se `ora` non è
// interpretabile. `formatTime` prima di tutto perché il backend manda "HH:MM:SS" mentre
// `parseHHMMToMinutes` accetta solo "HH:MM".
export function minutiAlRitiro(ora: string, nowMinuti: number): number | null {
  const minuti = parseHHMMToMinutes(formatTime(ora));
  return minuti === null ? null : minuti - nowMinuti;
}

// Divide gli ordini di OGGI per rilevanza rispetto all'ora corrente, non per semplice ordine
// cronologico: durante il servizio lo staff deve trovare in cima ciò che serve adesso, non gli
// ordini di pranzo quando è ora di cena.
//
// Un ordine annullato non va mai tra quelli da gestire, a prescindere dall'orario: non c'è nulla
// da preparare né da consegnare.
export function raggruppaOrdiniDelGiorno<T extends OrdineRaggruppabile>(
  ordini: readonly T[],
  nowMinuti: number,
): GruppiOrdiniGiorno<T> {
  const gruppi: GruppiOrdiniGiorno<T> = { adesso: [], piuTardi: [], passati: [], annullati: [] };

  ordini.forEach((ordine) => {
    if (ordine.stato === 'CANCELLED') {
      gruppi.annullati.push(ordine);
      return;
    }

    const diff = minutiAlRitiro(ordine.ora, nowMinuti);
    // Un orario illeggibile (dato storico malformato) non deve sparire dalla vista: finisce tra
    // quelli da gestire, dove lo staff lo vede e può correggerlo, invece che in un gruppo richiuso.
    if (diff === null || Math.abs(diff) <= FINESTRA_ADESSO_MINUTI) {
      gruppi.adesso.push(ordine);
      return;
    }
    if (diff > FINESTRA_ADESSO_MINUTI) {
      gruppi.piuTardi.push(ordine);
    } else {
      gruppi.passati.push(ordine);
    }
  });

  const perOraCrescente = (a: T, b: T) => a.ora.localeCompare(b.ora);
  gruppi.adesso.sort(perOraCrescente);
  gruppi.piuTardi.sort(perOraCrescente);
  gruppi.annullati.sort(perOraCrescente);
  // I passati al contrario (il più recente in cima): in un gruppo richiuso si cerca quasi sempre
  // l'ordine di poco fa, non quello di stamattina.
  gruppi.passati.sort((a, b) => b.ora.localeCompare(a.ora));

  return gruppi;
}

// Il primo ritiro non ancora arrivato, per il riepilogo in cima alla pagina. `null` se sono tutti
// già passati: meglio non mostrare come "prossimo" un orario alle spalle.
export function prossimoRitiro<T extends OrdineRaggruppabile>(
  ordini: readonly T[],
  nowMinuti: number,
): T | null {
  const futuri = ordini
    .filter((o) => o.stato !== 'CANCELLED')
    .filter((o) => {
      const diff = minutiAlRitiro(o.ora, nowMinuti);
      return diff !== null && diff >= 0;
    })
    .sort((a, b) => a.ora.localeCompare(b.ora));
  return futuri[0] ?? null;
}

// Etichetta relativa mostrata sulle sole card imminenti ("tra 10 min" / "adesso" / "12 min fa"):
// sulle altre l'orario assoluto basta e avanza.
export function formatAttesaRitiro(diffMinuti: number): string {
  if (diffMinuti === 0) return 'adesso';
  if (diffMinuti > 0) return `tra ${diffMinuti} min`;
  return `${Math.abs(diffMinuti)} min fa`;
}
