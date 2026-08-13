import type { PiscinaInventario, Postazione, TipoPostazione } from '../services/struttura';
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

export type MarkerStyle = {
  // 'circle' = cerchio con nome cliente in un cartellino esterno sotto l'icona (ombrellone, stile
  // originale). 'rectangle' = rettangolo compatto con numero (e nome cliente, se occupato)
  // scritti DENTRO il rettangolo stesso, non in un cartellino esterno — necessario per il gazebo
  // (sotto): quando più gazebi sono "attaccati" in colonna (computeBulkPositions, passo = altezza
  // esatta, nessun margine) un cartellino esterno sotto l'icona finirebbe coperto dal gazebo
  // immediatamente successivo nella striscia, che lo tocca senza alcuno spazio in mezzo.
  shape: 'circle' | 'rectangle';
  width: number;
  height: number;
  iconFontSize: number;
  labelFontSize: number;
  // Usati solo per shape 'circle' (cartellino esterno sotto l'icona) — ignorati per 'rectangle',
  // che tronca invece a nameLabelMaxChars ma disegna il nome dentro al rettangolo stesso.
  nameLabelWidth: number;
  nameLabelMaxChars: number;
};

// Dimensioni/forma marker per tipo (sezione 5 CLAUDE.md, 2026-08-12/13/14). I gazebi possono
// arrivare a 15+ posizionati in una sola colonna (CANVAS_HEIGHT, 560px logici, è il vincolo
// stretto): non più cerchi ma rettangoli compatti, pensati per essere piazzati "attaccati" in
// blocco da computeBulkPositions() sotto (uno accanto/sotto l'altro, in riga o in colonna) invece
// che uno a uno, e renderizzati come un unico rettangolo allungato da groupGazeboAttaccati()/
// PostazioneMarker più sotto (non N riquadri separati).
// L'ombrellone (sempre un cerchio singolo, mai in blocco) aveva invece un diametro di 48px
// (nessun bisogno di comprimerlo quanto il gazebo, essendo al massimo 15 in tutto) — visivamente
// però risultava sproporzionato accanto ai gazebi da 30px di altezza sulla stessa mappa (segnalato
// dall'utente, 2026-08-14): un cerchio nettamente più grande del rettangolo adiacente. Diametro
// ridotto a 30px, pari all'altezza del gazebo, per un ingombro visivo coerente tra i due tipi
// quando condividono la stessa mappa — font/cartellino nome ridimensionati di conseguenza.
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
// Una soglia troppo stretta classifica un tap reale (mai a 0px esatti) come drag. Va confrontata
// con lo spostamento in pixel reali sullo schermo, non con le unità logiche del canvas.
export const TAP_MOVE_THRESHOLD_PX = 8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// UUID v4 per raggruppare un blocco di gazebo creati insieme (Postazione.gruppo, sezione 5
// CLAUDE.md, 2026-08-13) — solo una chiave di raggruppamento locale, non un segreto, ma deve
// comunque essere un UUID sintatticamente valido perché il backend lo salva in un UUIDField.
// Preferisce `crypto.randomUUID()` (browser reali) e ricade su un generatore manuale altrimenti —
// **non solo per compatibilità nativa**: l'ambiente jsdom usato dalla suite Jest (sezione 9)
// espone un `crypto` globale ma SENZA `randomUUID` (gotcha reale, scoperto scrivendo i test di
// questa funzionalità), quindi affidarsi solo all'API nativa avrebbe fatto fallire silenziosamente
// ogni creazione in blocco durante i test.
export function generateGruppoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // NOSONAR: pseudo-casuale non crittografico, adatto: `gruppo` è solo una chiave di
  // raggruppamento locale (vedi commento sopra), non un token/segreto che richieda CSPRNG.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.trunc(Math.random() * 16);
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

// "YYYY-MM-DD" -> Date locale a mezzanotte (simmetrico a toISODate sopra: usa i componenti
// anno/mese/giorno diretti, non new Date(iso) che parserebbe come UTC e potrebbe spostare il
// giorno in fusi con offset negativo). Usato per riportare la mappa staff sulla data di una
// prenotazione quando si arriva da un link diretto (es. il pannello notifiche).
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

// Stessa logica di nextAvailableNumero, ma riserva `quantita` numeri in un colpo solo (usata
// dalla creazione in blocco dei gazebi, sotto) — ogni numero scelto viene aggiunto all'insieme
// "usati" prima di cercare il successivo, così i numeri restituiti non collidono mai tra loro
// anche se nessuno dei due esiste ancora nelle postazioni reali.
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

// Passo (in punti percentuali di pos_x/pos_y) tra due postazioni consecutive create in blocco.
// Usa la dimensione reale del marker sull'asse di disposizione (width per una fila orizzontale,
// height per una colonna verticale — un rettangolo non è quadrato come un cerchio, le due
// dimensioni divergono). Le due dimensioni del canvas non sono quadrate (1000x560 unità logiche),
// quindi lo stesso spostamento in pixel corrisponde a percentuali diverse su orizzontale/verticale.
//
// I rettangoli (gazebo) devono risultare "attaccati" — bordi a contatto, nessuno spazio in mezzo,
// come richiesto esplicitamente per poterne impilare più di 15 in colonna — quindi il passo è
// esattamente pari alla dimensione del marker. I cerchi (ombrellone, mai usati in blocco dalla UI
// oggi) restano invece con un piccolo margine (+10%) per non sembrare incollati l'uno all'altro.
function bulkStepPercent(tipo: TipoPostazione, orientamento: OrientamentoGriglia): number {
  const style = MARKER_STYLE[tipo];
  const dimensioneReale = orientamento === 'verticale' ? style.height : style.width;
  const margine = style.shape === 'rectangle' ? 1 : 1.1;
  const pixelStep = dimensioneReale * margine;
  const canvasDim = orientamento === 'verticale' ? CANVAS_HEIGHT : CANVAS_WIDTH;
  return (pixelStep / canvasDim) * 100;
}

// Calcola le posizioni pos_x/pos_y (percentuali 0-100) per `quantita` postazioni create in
// blocco, centrate sul punto di partenza e distribuite in colonna o in riga — usato dal foglio
// "+ Aggiungi postazione" per posizionare più gazebi in fila senza doverli trascinare
// manualmente uno per uno (sezione 5 CLAUDE.md, 2026-08-12). Se il passo "naturale" (bulkStepPercent)
// farebbe uscire la fila dai margini del canvas (tanti elementi richiesti), viene ridotto quel
// tanto che basta a farli stare tutti tra il 2% e il 98% — un affollamento leggermente superiore
// all'ideale è preferibile a postazioni piazzate fuori dall'area visibile.
export function computeBulkPositions(
  tipo: TipoPostazione,
  quantita: number,
  orientamento: OrientamentoGriglia,
  center: { x: number; y: number } = { x: 50, y: 50 }
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

// Info di gruppo per un singolo gazebo (sezione 5 CLAUDE.md, 2026-08-13): i gazebo con lo stesso
// `Postazione.gruppo` si disegnano come un unico rettangolo allungato (un solo bordo esterno)
// invece che come N riquadri separati — vedi PostazioneMarker. `isFirst`/`isLast` riferiti
// all'ordine lungo l'asse di disposizione (pos_y crescente per un gruppo verticale, pos_x
// crescente per uno orizzontale): un gazebo senza gruppo (o l'unico membro di un gruppo) ha
// entrambi `true` (nessun lato "interno" da nascondere, si comporta come un riquadro singolo).
export type GazeboGroupInfo = { isFirst: boolean; isLast: boolean; orientamento: OrientamentoGriglia };

// Tolleranza (punti percentuali di pos_x/pos_y) usata solo per stabilire su quale asse si
// dispone un gruppo (tutti sulla stessa pos_x → verticale, tutti sulla stessa pos_y →
// orizzontale) — non per decidere l'appartenenza al gruppo, che è data unicamente dal campo
// `gruppo` (sotto). In teoria i membri di un gruppo non driftano mai (si spostano sempre insieme,
// stesso delta, PiscinaMappaDataContext.dragPostazione), quindi le posizioni restano bit-esatte;
// la tolleranza resta solo come margine di sicurezza contro arrotondamenti.
const TOLLERANZA_ASSE = 0.6;

// Raggruppa i gazebo per `Postazione.gruppo` (sezione 5 CLAUDE.md, 2026-08-13) — usato da
// MappaCanvas.tsx/PiscinaMappaSelettore.tsx per calcolare `GazeboGroupInfo` per ogni postazione.
// A differenza di una prima versione puramente geometrica (adiacenza per posizione, scartata su
// richiesta esplicita dell'utente), l'appartenenza al gruppo è ora un dato persistito: un blocco
// creato insieme non si divide né si unisce mai trascinando (il drag sposta l'intero gruppo in
// blocco, PiscinaMappaDataContext.dragPostazione) — l'unico modo di cambiare composizione di un
// gruppo è ricrearlo. I gazebo con `gruppo` nullo (creati singolarmente, o storico pre-2026-08-13)
// restano semplicemente riquadri singoli, mai raggruppati con nessun altro.
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
    if (membri.length <= 1) continue; // gruppo di un solo elemento: si comporta come non raggruppato
    // Asse di disposizione: se tutti i membri condividono la stessa pos_x, il gruppo è verticale
    // (si estende su pos_y), altrimenti si assume orizzontale — gli unici due layout che
    // computeBulkPositions() può aver prodotto per un gruppo reale.
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
