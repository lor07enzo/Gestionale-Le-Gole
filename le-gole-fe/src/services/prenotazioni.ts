import api, { API_BASE_URL } from './api';

export type StatoPrenotazione = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type PrenotazionePiscina = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefono: string;
  note: string;
  data: string;
  ora: string;
  stato: StatoPrenotazione;
  inventario: string;
  inventario_nome: string;
  ingressi: number;
  ingressi_ridotti: number;
  ingressi_bambini: number;
  ingressi_gratuiti: number;
  ombrellone: number;
  gazebo: number;
  lettino: number;
  sdraia: number;
  // Forzato lato backend in base all'autenticazione: true per un walk-in staff, false per il
  // self-service — usato server-side per non notificare allo staff le prenotazioni che ha appena creato.
  creata_da_staff: boolean;
  created_at: string;
  updated_at: string;
};

export type OccupazionePostazione = {
  id: string;
  postazione: string;
  data: string;
  prenotazione: string | null;
  cliente_nome: string;
  numero_lettini: number;
  numero_sdraie: number;
  orario_arrivo_previsto: string;
  // Per singola postazione, non per prenotazione.
  arrivato: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateOccupazionePayload = Omit<
  OccupazionePostazione,
  'id' | 'created_at' | 'updated_at'
>;

export type UpdateOccupazionePayload = Partial<CreateOccupazionePayload>;

export type UpdatePrenotazionePiscinaPayload = Partial<
  Pick<
    PrenotazionePiscina,
    | 'ora'
    | 'ingressi'
    | 'ingressi_ridotti'
    | 'ingressi_bambini'
    | 'ingressi_gratuiti'
    | 'ombrellone'
    | 'gazebo'
    | 'lettino'
    | 'sdraia'
    | 'stato'
    | 'note'
  >
>;

export type CreatePrenotazionePiscinaPayload = Pick<
  PrenotazionePiscina,
  | 'cliente_id'
  | 'data'
  | 'ora'
  | 'stato'
  | 'inventario'
  | 'ingressi'
  | 'ingressi_ridotti'
  | 'ingressi_bambini'
  | 'ingressi_gratuiti'
  | 'ombrellone'
  | 'gazebo'
  | 'lettino'
  | 'sdraia'
> &
  Partial<Pick<PrenotazionePiscina, 'note'>>;

export type DisponibilitaPiscina = {
  ombrellone: number;
  gazebo: number;
  lettino: number;
  sdraia: number;
  // Flag manuale staff (GiornoPienoPiscina), indipendente dai conteggi sopra.
  pieno: boolean;
};

export type GiornoPienoPiscina = {
  id: string;
  inventario: string;
  data: string;
  note: string;
  created_at: string;
};

export type CreateGiornoPienoPayload = Pick<GiornoPienoPiscina, 'inventario' | 'data'> &
  Partial<Pick<GiornoPienoPiscina, 'note'>>;

const PRENOTAZIONI_PISCINA_PATH = '/v1/prenotazioni/piscina/';
const OCCUPAZIONI_POSTAZIONE_PATH = '/v1/prenotazioni/occupazioni-postazione/';
const GIORNI_PIENI_PATH = '/v1/prenotazioni/giorni-pieni/';

// GET /v1/prenotazioni/piscina/?data={data}
export function listPrenotazioniPiscina(params: { data: string }): Promise<PrenotazionePiscina[]> {
  return api
    .get<PrenotazionePiscina[]>(PRENOTAZIONI_PISCINA_PATH, { params })
    .then((response) => response.data);
}

// GET /v1/prenotazioni/piscina/?cliente_id={id} — storico completo del cliente.
export function listPrenotazioniPiscinaByCliente(clienteId: string): Promise<PrenotazionePiscina[]> {
  return api
    .get<PrenotazionePiscina[]>(PRENOTAZIONI_PISCINA_PATH, { params: { cliente_id: clienteId } })
    .then((response) => response.data);
}

// GET /v1/prenotazioni/piscina/recenti/?limit={limit} — usato dal pannello notifiche staff.
export function listPrenotazioniRecenti(limit = 50): Promise<PrenotazionePiscina[]> {
  return api
    .get<PrenotazionePiscina[]>(`${PRENOTAZIONI_PISCINA_PATH}recenti/`, { params: { limit } })
    .then((response) => response.data);
}

// GET /v1/prenotazioni/piscina/disponibilita/?inventario={id}&data={data} — pubblico, nessuna auth richiesta
export function getDisponibilitaPiscina(params: {
  inventario: string;
  data: string;
}): Promise<DisponibilitaPiscina> {
  return api
    .get<DisponibilitaPiscina>(`${PRENOTAZIONI_PISCINA_PATH}disponibilita/`, { params })
    .then((response) => response.data);
}

// GET /v1/prenotazioni/piscina/conteggi/?inventario={id}&anno={anno}&mese={mese} — staff, {ISODate: numero} sparso
export function getConteggiPrenotazioniPiscina(params: {
  inventario: string;
  anno: number;
  mese: number;
}): Promise<Record<string, number>> {
  return api
    .get<Record<string, number>>(`${PRENOTAZIONI_PISCINA_PATH}conteggi/`, { params })
    .then((response) => response.data);
}

// POST /v1/prenotazioni/piscina/
export function createPrenotazionePiscina(
  payload: CreatePrenotazionePiscinaPayload
): Promise<PrenotazionePiscina> {
  return api
    .post<PrenotazionePiscina>(PRENOTAZIONI_PISCINA_PATH, payload)
    .then((response) => response.data);
}

// PATCH /v1/prenotazioni/piscina/{id}/
export function updatePrenotazionePiscina(
  id: string,
  payload: UpdatePrenotazionePiscinaPayload
): Promise<PrenotazionePiscina> {
  return api
    .patch<PrenotazionePiscina>(`${PRENOTAZIONI_PISCINA_PATH}${id}/`, payload)
    .then((response) => response.data);
}

// GET /v1/prenotazioni/piscina/{id}/scarica_biglietto/ — pubblico, bloccato solo per CANCELLED.
export function getBigliettoUrl(prenotazioneId: string): string {
  return `${API_BASE_URL}${PRENOTAZIONI_PISCINA_PATH}${prenotazioneId}/scarica_biglietto/`;
}

// GET /v1/prenotazioni/occupazioni-postazione/?data={data}&postazione__inventario={inventarioId}
export function listOccupazioni(params: {
  data: string;
  postazione__inventario: string;
}): Promise<OccupazionePostazione[]> {
  return api
    .get<OccupazionePostazione[]>(OCCUPAZIONI_POSTAZIONE_PATH, { params })
    .then((response) => response.data);
}

// GET .../occupate/?inventario={id}&data={data} — pubblico, solo id, nessun dato personale.
export function getPostazioniOccupate(params: { inventario: string; data: string }): Promise<string[]> {
  return api
    .get<string[]>(`${OCCUPAZIONI_POSTAZIONE_PATH}occupate/`, { params })
    .then((response) => response.data);
}

// POST /v1/prenotazioni/occupazioni-postazione/
export function createOccupazione(
  payload: CreateOccupazionePayload
): Promise<OccupazionePostazione> {
  return api
    .post<OccupazionePostazione>(OCCUPAZIONI_POSTAZIONE_PATH, payload)
    .then((response) => response.data);
}

// PATCH /v1/prenotazioni/occupazioni-postazione/{id}/
export function updateOccupazione(
  id: string,
  payload: UpdateOccupazionePayload
): Promise<OccupazionePostazione> {
  return api
    .patch<OccupazionePostazione>(`${OCCUPAZIONI_POSTAZIONE_PATH}${id}/`, payload)
    .then((response) => response.data);
}

// DELETE /v1/prenotazioni/occupazioni-postazione/{id}/
export function deleteOccupazione(id: string): Promise<void> {
  return api.delete(`${OCCUPAZIONI_POSTAZIONE_PATH}${id}/`).then(() => undefined);
}

// GET /v1/prenotazioni/giorni-pieni/?inventario={id}&data={data} — staff, al più un risultato.
export function listGiorniPieni(params: { inventario: string; data: string }): Promise<GiornoPienoPiscina[]> {
  return api
    .get<GiornoPienoPiscina[]>(GIORNI_PIENI_PATH, { params })
    .then((response) => response.data);
}

// POST /v1/prenotazioni/giorni-pieni/ — segna un giorno come "tutto prenotato"
export function marcaGiornoPieno(payload: CreateGiornoPienoPayload): Promise<GiornoPienoPiscina> {
  return api.post<GiornoPienoPiscina>(GIORNI_PIENI_PATH, payload).then((response) => response.data);
}

// DELETE /v1/prenotazioni/giorni-pieni/{id}/ — rimuove il flag "tutto prenotato"
export function rimuoviGiornoPieno(id: string): Promise<void> {
  return api.delete(`${GIORNI_PIENI_PATH}${id}/`).then(() => undefined);
}

// GET .../calendario/?inventario={id}&anno={anno}&mese={mese} — pubblico, solo le date "piene".
export function getGiorniPieniMese(params: {
  inventario: string;
  anno: number;
  mese: number;
}): Promise<string[]> {
  return api
    .get<string[]>(`${GIORNI_PIENI_PATH}calendario/`, { params })
    .then((response) => response.data);
}
