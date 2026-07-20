import type { PiscinaInventario, TipoPostazione } from '../services/struttura';

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 560;
export const ICON_SIZE = 56;
export const MIN_SCALE = 0.6;
export const MAX_SCALE = 2.4;
export const SCALE_STEP = 0.2;
// Un click reale raramente ha 0px di movimento tra mousedown e mouseup (tremore della mano,
// mouse/trackpad poco precisi): una soglia troppo stretta classifica il tap come "drag" e il
// form di assegnazione non si apre mai. Va confrontata con lo spostamento in pixel reali sullo
// schermo (prima di dividere per `scale`), non con quello in unità logiche del canvas.
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

// Default per "orario di arrivo previsto": se c'è una prenotazione con un orario ancora valido
// (>= adesso, quando si sta operando su oggi) lo si usa; altrimenti si ricade sull'orario attuale.
// Per date diverse da oggi il confronto con "adesso" non ha senso: si usa l'orario della
// prenotazione se presente, altrimenti si lascia vuoto (compilazione manuale obbligatoria).
export function computeDefaultOrario(baseOra: string | null | undefined, selectedDate: Date): string {
  const base = formatTime(baseOra);
  const isToday = isSameDay(selectedDate, new Date());
  if (!isToday) {
    return base;
  }
  const nowStr = nowHHMM();
  const baseMinutes = base ? parseHHMMToMinutes(base) : null;
  const nowMinutes = parseHHMMToMinutes(nowStr)!;
  return baseMinutes !== null && baseMinutes >= nowMinutes ? base : nowStr;
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

export type ResiduiPrenotazione = { ombrellone: number; gazebo: number; lettino: number; sdraia: number };

export function remainingForTipo(residui: ResiduiPrenotazione | undefined, tipo: TipoPostazione): number {
  if (!residui) return 0;
  return tipo === 'GAZEBO' ? residui.gazebo : residui.ombrellone;
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
