import api from './api';

export type StatoPrenotazione = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type PrenotazionePiscina = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefono: string;
  cliente_note: string;
  data: string;
  ora: string;
  stato: StatoPrenotazione;
  inventario: string;
  ingressi: number;
  ombrellone: number;
  gazebo: number;
  lettino: number;
  sdraia: number;
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
  created_at: string;
  updated_at: string;
};

export type CreateOccupazionePayload = Omit<
  OccupazionePostazione,
  'id' | 'created_at' | 'updated_at'
>;

export type UpdateOccupazionePayload = Partial<CreateOccupazionePayload>;

export type UpdatePrenotazionePiscinaPayload = Partial<
  Pick<PrenotazionePiscina, 'ora' | 'ingressi' | 'ombrellone' | 'gazebo' | 'lettino' | 'sdraia' | 'stato'>
>;

const PRENOTAZIONI_PISCINA_PATH = '/v1/prenotazioni/piscina/';
const OCCUPAZIONI_POSTAZIONE_PATH = '/v1/prenotazioni/occupazioni-postazione/';

// GET /v1/prenotazioni/piscina/?data={data}
export function listPrenotazioniPiscina(params: { data: string }): Promise<PrenotazionePiscina[]> {
  return api
    .get<PrenotazionePiscina[]>(PRENOTAZIONI_PISCINA_PATH, { params })
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

// DELETE /v1/prenotazioni/piscina/{id}/ (elimina in cascata anche le OccupazionePostazione collegate, lato backend)
export function deletePrenotazionePiscina(id: string): Promise<void> {
  return api.delete(`${PRENOTAZIONI_PISCINA_PATH}${id}/`).then(() => undefined);
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
