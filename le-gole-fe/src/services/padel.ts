import api, { API_BASE_URL } from './api';
import type { StatoPrenotazione } from './prenotazioni';

// Il padel vive in un solo file di servizio pur toccando due app Django (`struttura` per
// configurazione/chiusure/catalogo racchette, `prenotazioni` per le partite): quella divisione è
// una scelta interna al backend (sezione 16 di CLAUDE.md), non un confine utile qui — lato
// frontend "padel" è un dominio unico.

export type ConfigurazionePadel = {
  id: string;
  // Interruttore del canale online: a false il self-service non può prenotare, lo staff sì.
  attivo: boolean;
  // "HH:MM:SS" (formato backend).
  orario_apertura: string;
  orario_chiusura: string;
  durata_partita_minuti: number;
  prezzo_partita: string;
  max_partecipanti: number;
  prezzo_noleggio_palline: string;
  // Sola lettura: gli orari di inizio realmente prenotabili, già derivati dal backend.
  slot_disponibili: string[];
  updated_at: string;
};

export type UpdateConfigurazionePadelPayload = Partial<
  Pick<
    ConfigurazionePadel,
    | 'attivo'
    | 'orario_apertura'
    | 'orario_chiusura'
    | 'durata_partita_minuti'
    | 'prezzo_partita'
    | 'max_partecipanti'
    | 'prezzo_noleggio_palline'
  >
>;

export type GiornoChiusoPadel = {
  id: string;
  data: string;
  created_at: string;
};

export type RacchettaPadel = {
  id: string;
  // Marca ed eventuale modello, univoco a catalogo.
  nome: string;
  prezzo_noleggio: string;
  // Pezzi posseduti: tetto per singola prenotazione, non una disponibilità per data/ora.
  quantita_disponibile: number;
  // Nasconde la racchetta dal noleggio online senza eliminarla dal catalogo.
  disponibile: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateRacchettaPadelPayload = Omit<RacchettaPadel, 'id' | 'created_at' | 'updated_at'>;

export type UpdateRacchettaPadelPayload = Partial<CreateRacchettaPadelPayload>;

export type NoleggioRacchetta = {
  id: string;
  prenotazione: string;
  racchetta: string;
  racchetta_nome: string;
  quantita: number;
  // Snapshot del prezzo a catalogo al momento del noleggio, sempre forzato lato backend.
  prezzo_unitario: string;
  subtotale: string;
  created_at: string;
  updated_at: string;
};

export type CreateNoleggioRacchettaPayload = {
  prenotazione: string;
  racchetta: string;
  quantita: number;
};

export type PrenotazionePadel = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefono: string;
  note: string;
  data: string;
  // Orario di inizio partita, sempre allineato alla griglia di slot.
  ora: string;
  stato: StatoPrenotazione;
  partecipanti: number;
  palline_noleggiate: boolean;
  // Snapshot al momento della prenotazione: la configurazione è una riga unica e mutabile,
  // senza snapshot un cambio di tariffa riscriverebbe il costo delle partite già prenotate.
  durata_minuti: number;
  prezzo_partita: string;
  prezzo_palline: string;
  creata_da_staff: boolean;
  // Calcolati a runtime dal backend, mai persistiti.
  totale: string;
  orario_fine: string;
  racchette_totali: number;
  // Righe di noleggio annidate in sola lettura: si scrivono dal proprio endpoint.
  noleggi: NoleggioRacchetta[];
  created_at: string;
  updated_at: string;
};

export type CreatePrenotazionePadelPayload = Pick<
  PrenotazionePadel,
  'cliente_id' | 'data' | 'ora' | 'partecipanti' | 'palline_noleggiate'
> &
  Partial<Pick<PrenotazionePadel, 'note' | 'stato'>>;

export type UpdatePrenotazionePadelPayload = Partial<
  Pick<PrenotazionePadel, 'ora' | 'partecipanti' | 'palline_noleggiate' | 'note' | 'stato'>
>;

export type SlotPadel = { ora: string; disponibile: boolean };

// Risposta pubblica di GET /prenotazioni/padel/disponibilita/: `slots` è vuoto se il servizio è
// disattivato o il giorno è chiuso, così il picker non propone orari che il backend rifiuterebbe.
export type DisponibilitaPadel = {
  attivo: boolean;
  chiuso: boolean;
  durata_minuti: number;
  max_partecipanti: number;
  prezzo_partita: string;
  prezzo_noleggio_palline: string;
  slots: SlotPadel[];
};

const CONFIGURAZIONE_PATH = '/v1/struttura/configurazione-padel/';
const GIORNI_CHIUSI_PATH = '/v1/struttura/giorni-chiusi-padel/';
const RACCHETTE_PATH = '/v1/struttura/racchette-padel/';
const PRENOTAZIONI_PATH = '/v1/prenotazioni/padel/';
const NOLEGGI_PATH = '/v1/prenotazioni/noleggi-racchetta/';

export function getConfigurazionePadel(): Promise<ConfigurazionePadel> {
  return api.get<ConfigurazionePadel>(CONFIGURAZIONE_PATH).then((response) => response.data);
}

export function updateConfigurazionePadel(
  payload: UpdateConfigurazionePadelPayload
): Promise<ConfigurazionePadel> {
  return api.patch<ConfigurazionePadel>(CONFIGURAZIONE_PATH, payload).then((response) => response.data);
}

export function listGiorniChiusiPadel(): Promise<GiornoChiusoPadel[]> {
  return api.get<GiornoChiusoPadel[]>(GIORNI_CHIUSI_PATH).then((response) => response.data);
}

// Pubblico — solo le date di chiusura da oggi in poi (oggi incluso), ordinate crescenti. Usato dal
// calendario self-service per evidenziare in anticipo i giorni non prenotabili.
export function getProssimeChiusurePadel(): Promise<string[]> {
  return api.get<string[]>(`${GIORNI_CHIUSI_PATH}prossime/`).then((response) => response.data);
}

export function createGiornoChiusoPadel(data: string): Promise<GiornoChiusoPadel> {
  return api.post<GiornoChiusoPadel>(GIORNI_CHIUSI_PATH, { data }).then((response) => response.data);
}

export function deleteGiornoChiusoPadel(id: string): Promise<void> {
  return api.delete(`${GIORNI_CHIUSI_PATH}${id}/`).then(() => undefined);
}

export function listRacchettePadel(params?: { disponibile?: boolean }): Promise<RacchettaPadel[]> {
  return api.get<RacchettaPadel[]>(RACCHETTE_PATH, { params }).then((response) => response.data);
}

export function createRacchettaPadel(payload: CreateRacchettaPadelPayload): Promise<RacchettaPadel> {
  return api.post<RacchettaPadel>(RACCHETTE_PATH, payload).then((response) => response.data);
}

export function updateRacchettaPadel(
  id: string,
  payload: UpdateRacchettaPadelPayload
): Promise<RacchettaPadel> {
  return api.patch<RacchettaPadel>(`${RACCHETTE_PATH}${id}/`, payload).then((response) => response.data);
}

// Risponde 400 (non 500) se esistono noleggi collegati: la racchetta va nascosta, non eliminata.
export function deleteRacchettaPadel(id: string): Promise<void> {
  return api.delete(`${RACCHETTE_PATH}${id}/`).then(() => undefined);
}

export function listPrenotazioniPadel(params: { data: string }): Promise<PrenotazionePadel[]> {
  return api.get<PrenotazionePadel[]>(PRENOTAZIONI_PATH, { params }).then((response) => response.data);
}

export function listPrenotazioniPadelByCliente(clienteId: string): Promise<PrenotazionePadel[]> {
  return api
    .get<PrenotazionePadel[]>(PRENOTAZIONI_PATH, { params: { cliente_id: clienteId } })
    .then((response) => response.data);
}

export function getPrenotazionePadel(id: string): Promise<PrenotazionePadel> {
  return api.get<PrenotazionePadel>(`${PRENOTAZIONI_PATH}${id}/`).then((response) => response.data);
}

export function createPrenotazionePadel(
  payload: CreatePrenotazionePadelPayload
): Promise<PrenotazionePadel> {
  return api.post<PrenotazionePadel>(PRENOTAZIONI_PATH, payload).then((response) => response.data);
}

export function updatePrenotazionePadel(
  id: string,
  payload: UpdatePrenotazionePadelPayload
): Promise<PrenotazionePadel> {
  return api
    .patch<PrenotazionePadel>(`${PRENOTAZIONI_PATH}${id}/`, payload)
    .then((response) => response.data);
}

// GET .../recenti/?limit={limit} — feed del tab "Padel" del pannello notifiche staff.
export function listPrenotazioniPadelRecenti(limit = 50): Promise<PrenotazionePadel[]> {
  return api
    .get<PrenotazionePadel[]>(`${PRENOTAZIONI_PATH}recenti/`, { params: { limit } })
    .then((response) => response.data);
}

export function getDisponibilitaPadel(params: { data: string }): Promise<DisponibilitaPadel> {
  return api
    .get<DisponibilitaPadel>(`${PRENOTAZIONI_PATH}disponibilita/`, { params })
    .then((response) => response.data);
}

// Pubblico, bloccato solo per le CANCELLED — stesso principio di getBigliettoUrl (piscina).
export function getBigliettoPadelUrl(prenotazioneId: string): string {
  return `${API_BASE_URL}${PRENOTAZIONI_PATH}${prenotazioneId}/scarica_biglietto/`;
}

// Pubblico, match esatto sul telefono — stesso identico principio di getStoricoPiscinaPerTelefono
// (il numero di telefono è l'unico "segreto" richiesto, nessun login cliente esiste in questo
// progetto). Usato dalla consultazione self-service "Le mie prenotazioni".
export function getStoricoPadelPerTelefono(telefono: string): Promise<PrenotazionePadel[]> {
  return api
    .get<PrenotazionePadel[]>(`${PRENOTAZIONI_PATH}storico_telefono/`, { params: { telefono } })
    .then((response) => response.data);
}

// Pubblico, l'UUID v4 della prenotazione funge da segreto — stesso principio di
// getDettaglioPubblicoPiscina. `noleggi` è già annidata dal serializer, nessun tipo dedicato.
export function getDettaglioPubblicoPadel(id: string): Promise<PrenotazionePadel> {
  return api
    .get<PrenotazionePadel>(`${PRENOTAZIONI_PATH}${id}/dettaglio_pubblico/`)
    .then((response) => response.data);
}

export function createNoleggioRacchetta(
  payload: CreateNoleggioRacchettaPayload
): Promise<NoleggioRacchetta> {
  return api.post<NoleggioRacchetta>(NOLEGGI_PATH, payload).then((response) => response.data);
}

export function updateNoleggioRacchetta(id: string, quantita: number): Promise<NoleggioRacchetta> {
  return api.patch<NoleggioRacchetta>(`${NOLEGGI_PATH}${id}/`, { quantita }).then((response) => response.data);
}

export function deleteNoleggioRacchetta(id: string): Promise<void> {
  return api.delete(`${NOLEGGI_PATH}${id}/`).then(() => undefined);
}
