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

// Default per "orario di arrivo previsto": se c'è una prenotazione con un orario ancora valido
// (>= adesso, quando si sta operando su oggi) lo si usa; altrimenti si ricade sull'orario attuale.
// Per date diverse da oggi il confronto con "adesso" non ha senso: si usa l'orario della
// prenotazione se presente, altrimenti si lascia vuoto (compilazione manuale obbligatoria).
// `orarioMinimo` (opzionale): se il cliente ha ingressi ridotti pomeridiani, il chiamante passa
// qui la soglia dell'inventario (orario_inizio_ridotto) — il default proposto non scende mai
// sotto questa soglia, anche quando il ramo sopra ricadrebbe altrimenti su un orario precedente
// (es. "adesso" prima delle 14:00, o l'orario della prenotazione se anteriore alla soglia).
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

// Maschera "solo cifre, ':' inserito da solo" per i campi orario testuali (es. "orario di arrivo
// previsto" nel form di prenotazione cliente): l'utente digita solo numeri, il separatore compare
// automaticamente dopo la seconda cifra. Richiede il valore precedente per gestire correttamente
// il backspace: se l'utente cancella proprio il ':' (le cifre restano invariate), viene rimossa
// anche l'ultima cifra — altrimenti il ':' si "ri-materializza" subito dopo, dando l'impressione
// che il tasto canc non abbia avuto alcun effetto.
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

// A differenza delle altre soglie ingresso (età bambini: solo testo guida, non validate — il
// sistema non ha un'anagrafica età per persona), l'orario ridotto pomeridiano lega due campi già
// presenti sulla stessa prenotazione (orario e ingressi_ridotti), quindi è verificabile davvero
// — stessa validazione replicata lato backend in PrenotazionePiscinaSerializer.validate() come
// rete di sicurezza. Ritorna il messaggio d'errore, o null se non c'è nulla da validare/l'orario
// rispetta la soglia.
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

// Complementare di validateOrarioIngressoRidotto: dalla soglia del ridotto pomeridiano in poi, un
// nuovo ingresso a tariffa intera non ha più senso (andrebbe venduto come ridotto) — stessa
// validazione replicata lato backend in PrenotazionePiscinaSerializer.validate(). Il chiamante deve
// invocarla solo quando la tariffa ridotta è effettivamente configurata sull'inventario (prezzo >
// 0): altrimenti `orarioInizioRidotto` è solo il valore di default del campo, non un'alternativa
// realmente disponibile a cui dirottare il cliente.
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
