import type { PiscinaInventario, TipoPostazione } from '../services/struttura';
import type { StatoPrenotazione } from '../services/prenotazioni';

// Etichette/colori badge per stato prenotazione, condivisi tra la scheda cliente
// (app/staff/clienti/[clienteId].tsx) e la lista "Clienti del giorno" della mappa staff.
export const STATO_PRENOTAZIONE_LABEL: Record<StatoPrenotazione, string> = {
  PENDING: 'In attesa',
  CONFIRMED: 'Confermata',
  CANCELLED: 'Cancellata',
};

export const STATO_PRENOTAZIONE_BADGE: Record<StatoPrenotazione, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700' },
  CONFIRMED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  CANCELLED: { bg: 'bg-rose-100', text: 'text-rose-700' },
};

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 560;
export const ICON_SIZE = 56;
export const MIN_SCALE = 0.6;
export const MAX_SCALE = 2.4;
export const SCALE_STEP = 0.2;
// Una soglia troppo stretta classifica un tap reale (mai a 0px esatti) come drag. Va confrontata
// con lo spostamento in pixel reali sullo schermo, non con le unità logiche del canvas.
export const TAP_MOVE_THRESHOLD_PX = 8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

export function formatDisplayDate(date: Date): string {
  const label = date.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

// "HH:MM:SS" (formato backend) -> "HH:MM" per la UI; passthrough per input utente già in "HH:MM".
export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  return time.slice(0, 5);
}

// "YYYY-MM-DD" (formato backend) -> "DD/MM/YYYY" per la UI.
export function formatDateDDMMYYYY(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function nowHHMM(): string {
  const now = new Date();
  return minutesToHHMM(now.getHours() * 60 + now.getMinutes());
}

// Ritorna i minuti dalla mezzanotte per una stringa "H:MM"/"HH:MM", o null se il formato non è valido.
export function parseHHMMToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

// Default per "orario di arrivo previsto": usa l'orario della prenotazione se ancora valido
// (>= adesso, solo per oggi), altrimenti ricade sull'orario attuale (o vuoto per altre date).
// `orarioMinimo` (opzionale): soglia sotto cui il default non deve mai scendere (es.
// orario_inizio_ridotto, per un cliente con ingressi ridotti pomeridiani).
export function computeDefaultOrario(
  baseOra: string | null | undefined,
  selectedDate: Date,
  orarioMinimo?: string
): string {
  const base = formatTime(baseOra);
  const isToday = isSameDay(selectedDate, new Date());

  let risultato: string;
  if (!isToday) {
    risultato = base;
  } else {
    const nowStr = nowHHMM();
    const baseMinutes = base ? parseHHMMToMinutes(base) : null;
    const nowMinutes = parseHHMMToMinutes(nowStr)!;
    risultato = baseMinutes !== null && baseMinutes >= nowMinutes ? base : nowStr;
  }

  if (orarioMinimo) {
    const minimoMinuti = parseHHMMToMinutes(orarioMinimo);
    const risultatoMinuti = risultato ? parseHHMMToMinutes(risultato) : null;
    if (minimoMinuti !== null && (risultatoMinuti === null || risultatoMinuti < minimoMinuti)) {
      return orarioMinimo;
    }
  }
  return risultato;
}

// Maschera "solo cifre, ':' automatico" per i campi orario testuali. Richiede il valore
// precedente per il backspace: se l'utente cancella il ':' (cifre invariate), rimuove anche
// l'ultima cifra, altrimenti il ':' si "ri-materializzerebbe" subito dopo.
export function formatOrarioInput(previous: string, rawNext: string): string {
  let digits = rawNext.replace(/\D/g, '').slice(0, 4);
  const previousDigits = previous.replace(/\D/g, '');
  const isDeleting = rawNext.length < previous.length;
  if (isDeleting && digits.length > 0 && digits.length === previousDigits.length) {
    digits = digits.slice(0, -1);
  }
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

// A differenza dell'età bambini (solo testo guida), l'orario ridotto pomeridiano lega due campi
// della stessa prenotazione ed è verificabile davvero — stessa regola replicata lato backend.
// Ritorna il messaggio d'errore, o null se l'orario rispetta la soglia.
export function validateOrarioIngressoRidotto(
  orario: string,
  ingressiRidotti: number,
  orarioInizioRidotto: string
): string | null {
  if (ingressiRidotti <= 0) return null;
  const orarioMinuti = parseHHMMToMinutes(orario);
  const sogliaMinuti = parseHHMMToMinutes(orarioInizioRidotto.slice(0, 5));
  if (orarioMinuti === null || sogliaMinuti === null) return null;
  if (orarioMinuti < sogliaMinuti) {
    return `L'ingresso ridotto pomeridiano è disponibile dalle ${orarioInizioRidotto.slice(0, 5)}: imposta un orario di arrivo successivo o azzera gli ingressi ridotti.`;
  }
  return null;
}

// Complementare a validateOrarioIngressoRidotto: dalla soglia in poi un ingresso intero andrebbe
// venduto come ridotto. Il chiamante deve invocarla solo se la tariffa ridotta è configurata
// (prezzo > 0), altrimenti la soglia è solo un default non realmente disponibile.
export function validateOrarioIngressoIntero(
  orario: string,
  ingressiInteri: number,
  orarioInizioRidotto: string
): string | null {
  if (ingressiInteri <= 0) return null;
  const orarioMinuti = parseHHMMToMinutes(orario);
  const sogliaMinuti = parseHHMMToMinutes(orarioInizioRidotto.slice(0, 5));
  if (orarioMinuti === null || sogliaMinuti === null) return null;
  if (orarioMinuti >= sogliaMinuti) {
    return `Dalle ${orarioInizioRidotto.slice(0, 5)} è disponibile solo l'ingresso ridotto pomeridiano: usa gli ingressi ridotti invece di quelli interi.`;
  }
  return null;
}

export type OrarioValidationResult = { valid: true; minutes: number } | { valid: false; error: string };

// L'orario di arrivo previsto è obbligatorio e, quando si opera sulla data odierna, non può
// essere nel passato rispetto all'ora attuale (per le altre date il confronto non ha senso).
export function validateOrarioArrivo(value: string, selectedDate: Date): OrarioValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: "L'orario di arrivo previsto è obbligatorio." };
  }
  const minutes = parseHHMMToMinutes(trimmed);
  if (minutes === null) {
    return { valid: false, error: 'Inserisci un orario valido (HH:MM).' };
  }
  if (isSameDay(selectedDate, new Date()) && minutes < parseHHMMToMinutes(nowHHMM())!) {
    return { valid: false, error: "L'orario di arrivo previsto non può essere nel passato." };
  }
  return { valid: true, minutes };
}

// Numero più basso non ancora in uso tra le postazioni attive dell'inventario — `numero` è unico
// per (inventario, numero) a prescindere dal tipo (sezione 5 CLAUDE.md, vincolo condiviso tra
// ombrelloni e gazebi), quindi il calcolo ignora il tipo scelto per la nuova postazione.
export function nextAvailableNumero(postazioni: { numero: number }[]): number {
  const usati = new Set(postazioni.map((p) => p.numero));
  let candidato = 1;
  while (usati.has(candidato)) candidato += 1;
  return candidato;
}

export type ResiduiPrenotazione = { ombrellone: number; gazebo: number; lettino: number; sdraia: number };

export function remainingForTipo(residui: ResiduiPrenotazione | undefined, tipo: TipoPostazione): number {
  if (!residui) return 0;
  return tipo === 'GAZEBO' ? residui.gazebo : residui.ombrellone;
}

// Riepilogo ingressi "🎟️ N 🌇 N 🧒 N 🆓 N" per le liste staff (ClientiDelGiornoSheet, scheda
// cliente): interi sempre mostrati (anche 0, per coerenza con le altre risorse), le altre tre
// tariffe solo se > 0 — condiviso per non duplicare la stessa concatenazione in più file.
export function formatIngressiSummary(p: {
  ingressi: number;
  ingressi_ridotti: number;
  ingressi_bambini: number;
  ingressi_gratuiti: number;
}): string {
  const parti = [`🎟️ ${p.ingressi}`];
  if (p.ingressi_ridotti > 0) parti.push(`🌇 ${p.ingressi_ridotti}`);
  if (p.ingressi_bambini > 0) parti.push(`🧒 ${p.ingressi_bambini}`);
  if (p.ingressi_gratuiti > 0) parti.push(`🆓 ${p.ingressi_gratuiti}`);
  return parti.join(' ');
}

export const DISPONIBILITA_ITEMS: Array<{
  key: 'ombrellone' | 'gazebo' | 'lettino' | 'sdraia';
  totaleKey: keyof PiscinaInventario;
  icon: string;
  label: string;
}> = [
  { key: 'ombrellone', totaleKey: 'totale_ombrelloni', icon: '⛱️', label: 'Ombrelloni' },
  { key: 'gazebo', totaleKey: 'totale_gazebi', icon: '⛺', label: 'Gazebi' },
  { key: 'lettino', totaleKey: 'totale_lettini', icon: '🛏️', label: 'Lettini' },
  { key: 'sdraia', totaleKey: 'totale_sdraie', icon: '🪑', label: 'Sdraie' },
];
