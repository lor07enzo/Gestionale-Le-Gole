import { formatTime, generaSlotOrario, parseHHMMToMinutes } from './piscinaMappa';

// Logica degli orari del servizio asporto (uno o due turni, pranzo/cena), condivisa tra checkout
// self-service, riordino dallo storico e creazione manuale lato staff.

export type ConfigurazioneConTurni = {
  orario_apertura: string;
  orario_chiusura: string;
  orario_apertura_2: string | null;
  orario_chiusura_2: string | null;
};

export type FinestraOraria = { apertura: string; chiusura: string };

// Sotto questo numero di prenotazioni ancora accettabili per un orario si mostra il residuo sotto
// lo slot; sotto RESIDUO_CRITICO il testo passa da ambra a rosa.
export const SOGLIA_AVVISO_RESIDUO_ORARIO = 2;
export const RESIDUO_CRITICO = 1;

export function finestreOrarie(configurazione: ConfigurazioneConTurni): FinestraOraria[] {
  const finestre: FinestraOraria[] = [
    { apertura: formatTime(configurazione.orario_apertura), chiusura: formatTime(configurazione.orario_chiusura) },
  ];
  if (configurazione.orario_apertura_2 && configurazione.orario_chiusura_2) {
    finestre.push({
      apertura: formatTime(configurazione.orario_apertura_2),
      chiusura: formatTime(configurazione.orario_chiusura_2),
    });
  }
  return finestre;
}

// "Un turno alla volta" lato cliente: la finestra attiva è la prima non ancora chiusa, così lo
// switch tra pranzo e cena avviene da solo dopo la chiusura del turno in corso. Se anche l'ultimo
// è chiuso si mostra comunque quello, come riferimento per il messaggio "servizio chiuso".
export function getFinestraAttiva(configurazione: ConfigurazioneConTurni, nowMinuti: number): FinestraOraria {
  const finestre = finestreOrarie(configurazione);
  return finestre.find((f) => (parseHHMMToMinutes(f.chiusura) ?? 0) > nowMinuti) ?? finestre.at(-1)!;
}

// Stessa forma di `ConfigurazioneAsporto.descrizione_orari()` lato backend.
export function descrizioneOrari(configurazione: ConfigurazioneConTurni): string {
  return finestreOrarie(configurazione)
    .map((f) => `dalle ${f.apertura} alle ${f.chiusura}`)
    .join(' e ');
}

// Stessa logica di `ConfigurazioneAsporto.orario_valido()` lato backend, su minuti.
export function isOraInFinestre(configurazione: ConfigurazioneConTurni, minuti: number): boolean {
  return finestreOrarie(configurazione).some((f) => {
    const apertura = parseHHMMToMinutes(f.apertura);
    const chiusura = parseHHMMToMinutes(f.chiusura);
    return apertura !== null && chiusura !== null && minuti >= apertura && minuti <= chiusura;
  });
}

// Tutti gli slot da 15 minuti di entrambi i turni (lato staff si vedono sempre insieme).
export function slotTuttiITurni(configurazione: ConfigurazioneConTurni): string[] {
  return finestreOrarie(configurazione).flatMap((f) => generaSlotOrario(f.apertura, f.chiusura));
}

export function residuoTextClassName(residuo: number): string {
  return residuo <= RESIDUO_CRITICO ? 'text-rose-600' : 'text-amber-600';
}

export function etichettaPostiLiberi(residuo: number): string {
  return residuo === 1 ? '1 posto libero' : `${residuo} posti liberi`;
}

// Residuo di prenotazioni per uno slot rispetto al limite globale per orario (`null` = nessun limite).
export function residuoPrenotazioni(
  limite: number | null,
  prenotazioniPerOrario: Record<string, number>,
  slot: string
): number | null {
  if (limite === null) return null;
  return limite - (prenotazioniPerOrario[slot] ?? 0);
}
