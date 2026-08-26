import type { PiscinaInventario, Postazione, TipoPostazione } from '../services/struttura';
import type { StatoPrenotazione } from '../services/prenotazioni';

// Etichette/colori badge stato prenotazione, condivisi tra più schermate staff.
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

export type MarkerStyle = {
  // 'rectangle' scrive numero/nome dentro il marker: per il gazebo, un cartellino esterno
  // finirebbe coperto dal gazebo successivo quando sono "attaccati" in blocco.
  shape: 'circle' | 'rectangle';
  width: number;
  height: number;
  iconFontSize: number;
  labelFontSize: number;
  // Usati solo per shape 'circle'; 'rectangle' tronca a nameLabelMaxChars e disegna il nome dentro.
  nameLabelWidth: number;
  nameLabelMaxChars: number;
};

// Il gazebo è un rettangolo compatto (non un cerchio) per poterne piazzare 15+ in colonna,
// attaccati l'uno all'altro (computeBulkPositions). Diametro ombrellone allineato all'altezza
// del gazebo (30px) per coerenza visiva quando condividono la stessa mappa.
export const MARKER_STYLE: Record<TipoPostazione, MarkerStyle> = {
  OMBRELLONE: {
    shape: 'circle',
    width: 30,
    height: 30,
    iconFontSize: 13,
    labelFontSize: 8,
    nameLabelWidth: 70,
    nameLabelMaxChars: 12,
  },
  GAZEBO: {
    shape: 'rectangle',
    width: 48,
    height: 30,
    iconFontSize: 13,
    labelFontSize: 9,
    nameLabelWidth: 0,
    nameLabelMaxChars: 9,
  },
};
export const MIN_SCALE = 0.6;
export const MAX_SCALE = 2.4;
export const SCALE_STEP = 0.2;
// Un tap reale non è mai a 0px esatti: una soglia troppo stretta lo classificherebbe come drag.
export const TAP_MOVE_THRESHOLD_PX = 8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// UUID per raggruppare un blocco di gazebo creati insieme (Postazione.gruppo). Fallback manuale
// perché jsdom (test Jest) espone `crypto` senza `randomUUID`.
export function generateGruppoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.trunc(Math.random() * 16); // NOSONAR: pseudo-casuale non crittografico, `gruppo` non è un segreto
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Simmetrico a toISODate: componenti diretti, non new Date(iso) (parserebbe UTC, spostando il giorno).
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
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

// Timestamp ISO (created_at) -> "adesso" / "5 min fa" / "3 h fa" / "2 giorni fa" — usato dalle
// card del pannello notifiche staff per mostrare quanto tempo fa è arrivata la prenotazione.
export function formatRelativeTime(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'adesso';
  if (diffMinutes < 60) return `${diffMinutes} min fa`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h fa`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 giorno fa';
  if (diffDays < 30) return `${diffDays} giorni fa`;
  return formatDateDDMMYYYY(toISODate(new Date(isoTimestamp)));
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

// Elenco "HH:MM" tra apertura e chiusura, ogni `stepMinuti` — usato dai picker orario di ritiro
// asporto (checkout self-service, riordino, creazione manuale staff). Estratta qui il 2026-08-26
// (SonarQube, duplicazione) dopo che un terzo chiamante ha reso non più giustificabile la copia
// diretta in ciascun file (principio già seguito nel progetto solo per due soli chiamanti).
export function generaSlotOrario(apertura: string, chiusura: string, stepMinuti = 15): string[] {
  const inizio = parseHHMMToMinutes(apertura);
  const fine = parseHHMMToMinutes(chiusura);
  if (inizio === null || fine === null) return [];
  const slots: string[] = [];
  for (let minuti = inizio; minuti <= fine; minuti += stepMinuti) {
    slots.push(minutesToHHMM(minuti));
  }
  return slots;
}

export type BloccoOrario = { ora: string; label: string; slots: string[] };

// Raggruppa gli slot da 15 minuti per fascia oraria di appartenenza (es. "12:00-13:00" contiene
// 12:00/12:15/12:30/12:45) — un tap su una fascia espande solo i suoi orari, invece di mostrare
// fin da subito un'unica griglia lunga con ogni slot tra apertura e chiusura.
export function raggruppaSlotPerOra(slots: string[]): BloccoOrario[] {
  const blocchi: BloccoOrario[] = [];
  for (const slot of slots) {
    const ora = slot.slice(0, 2);
    const ultimo = blocchi.at(-1);
    if (ultimo?.ora === ora) {
      ultimo.slots.push(slot);
      continue;
    }
    const oraFine = String((Number.parseInt(ora, 10) + 1) % 24).padStart(2, '0');
    blocchi.push({ ora, label: `${ora}:00-${oraFine}:00`, slots: [slot] });
  }
  return blocchi;
}

// Usa l'orario della prenotazione se ancora valido (>= adesso, solo per oggi), altrimenti l'ora
// attuale. `orarioMinimo`: soglia sotto cui il default non deve mai scendere.
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

// Maschera "solo cifre, ':' automatico". Richiede il valore precedente: se l'utente cancella il
// ':' (cifre invariate), rimuove anche l'ultima cifra, altrimenti si "ri-materializzerebbe" subito.
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

// Ritorna il messaggio d'errore, o null se l'orario rispetta la soglia (stessa regola lato backend).
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

// Complementare a validateOrarioIngressoRidotto. Va invocata solo se la tariffa ridotta è
// configurata (prezzo > 0), altrimenti la soglia non è realmente disponibile.
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

// Numero più basso non in uso: `numero` è unico per inventario a prescindere dal tipo.
export function nextAvailableNumero(postazioni: { numero: number }[]): number {
  const usati = new Set(postazioni.map((p) => p.numero));
  let candidato = 1;
  while (usati.has(candidato)) candidato += 1;
  return candidato;
}

// Come nextAvailableNumero, ma riserva `quantita` numeri in un colpo solo (creazione in blocco).
export function nextAvailableNumeri(postazioni: { numero: number }[], quantita: number): number[] {
  const usati = new Set(postazioni.map((p) => p.numero));
  const risultato: number[] = [];
  let candidato = 1;
  while (risultato.length < quantita) {
    if (!usati.has(candidato)) {
      usati.add(candidato);
      risultato.push(candidato);
    }
    candidato += 1;
  }
  return risultato;
}

export type OrientamentoGriglia = 'verticale' | 'orizzontale';

// Passo tra due postazioni consecutive create in blocco: i rettangoli (gazebo) restano a contatto
// (passo = dimensione esatta), i cerchi hanno un margine +10%.
function bulkStepPercent(tipo: TipoPostazione, orientamento: OrientamentoGriglia): number {
  const style = MARKER_STYLE[tipo];
  const dimensioneReale = orientamento === 'verticale' ? style.height : style.width;
  const margine = style.shape === 'rectangle' ? 1 : 1.1;
  const pixelStep = dimensioneReale * margine;
  const canvasDim = orientamento === 'verticale' ? CANVAS_HEIGHT : CANVAS_WIDTH;
  return (pixelStep / canvasDim) * 100;
}

// Centro di default (percentuale 0-100): costante condivisa, non un literal nel default del
// parametro sotto — solo letta (mai mutata) da computeBulkPositions, sicura da riusare tra le chiamate.
const DEFAULT_BULK_CENTER: { x: number; y: number } = { x: 50, y: 50 };

// Posizioni pos_x/pos_y per `quantita` postazioni create in blocco, centrate e distribuite in
// colonna o riga. Se il passo naturale farebbe uscire la fila dal canvas, viene ridotto per
// restare tra il 2% e il 98%.
export function computeBulkPositions(
  tipo: TipoPostazione,
  quantita: number,
  orientamento: OrientamentoGriglia,
  center: { x: number; y: number } = DEFAULT_BULK_CENTER
): Array<{ pos_x: number; pos_y: number }> {
  if (quantita <= 1) return [{ pos_x: center.x, pos_y: center.y }];

  const MARGINE_MIN = 2;
  const MARGINE_MAX = 98;
  const spanDisponibile = MARGINE_MAX - MARGINE_MIN;
  const stepNaturale = bulkStepPercent(tipo, orientamento);
  const spanNaturale = stepNaturale * (quantita - 1);
  const step = spanNaturale > spanDisponibile ? spanDisponibile / (quantita - 1) : stepNaturale;
  const span = step * (quantita - 1);
  const start = (orientamento === 'verticale' ? center.y : center.x) - span / 2;

  const posizioni: Array<{ pos_x: number; pos_y: number }> = [];
  for (let i = 0; i < quantita; i++) {
    const offset = clamp(start + step * i, MARGINE_MIN, MARGINE_MAX);
    posizioni.push(
      orientamento === 'verticale'
        ? { pos_x: center.x, pos_y: offset }
        : { pos_x: offset, pos_y: center.y }
    );
  }
  return posizioni;
}

// I gazebo con lo stesso `Postazione.gruppo` si disegnano come un unico rettangolo allungato
// (vedi PostazioneMarker). `isFirst`/`isLast`: entrambi `true` se non raggruppato.
export type GazeboGroupInfo = { isFirst: boolean; isLast: boolean; orientamento: OrientamentoGriglia };

// Solo per stabilire l'asse di un gruppo (stessa pos_x → verticale), non l'appartenenza (data dal
// campo `gruppo`) — margine di sicurezza contro arrotondamenti.
const TOLLERANZA_ASSE = 0.6;

// Raggruppa i gazebo per `Postazione.gruppo`: l'appartenenza è un dato persistito (un blocco
// creato insieme si sposta sempre come corpo unico), non geometrico.
export function groupGazeboAttaccati(postazioni: Postazione[]): Map<string, GazeboGroupInfo> {
  const gazebi = postazioni.filter((p) => p.tipo === 'GAZEBO');
  const perGruppo = new Map<string, Postazione[]>();
  for (const g of gazebi) {
    if (!g.gruppo) continue;
    const lista = perGruppo.get(g.gruppo) ?? [];
    lista.push(g);
    perGruppo.set(g.gruppo, lista);
  }

  const risultato = new Map<string, GazeboGroupInfo>();
  for (const membri of perGruppo.values()) {
    if (membri.length <= 1) continue;
    const stessaX = membri.every((m) => Math.abs(m.pos_x - membri[0].pos_x) < TOLLERANZA_ASSE);
    const orientamento: OrientamentoGriglia = stessaX ? 'verticale' : 'orizzontale';
    const ordinati = [...membri].sort((a, b) =>
      orientamento === 'verticale' ? a.pos_y - b.pos_y : a.pos_x - b.pos_x
    );
    ordinati.forEach((p, index) => {
      risultato.set(p.id, { isFirst: index === 0, isLast: index === ordinati.length - 1, orientamento });
    });
  }
  return risultato;
}

export type ResiduiPrenotazione = { ombrellone: number; gazebo: number; lettino: number; sdraia: number };

export function remainingForTipo(residui: ResiduiPrenotazione | undefined, tipo: TipoPostazione): number {
  if (!residui) return 0;
  return tipo === 'GAZEBO' ? residui.gazebo : residui.ombrellone;
}

// Riepilogo ingressi "🎟️ N 🌇 N 🧒 N 🆓 N": interi sempre mostrati, le altre tariffe solo se > 0.
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
