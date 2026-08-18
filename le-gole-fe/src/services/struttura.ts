import api from './api';

export type PiscinaInventario = {
  id: string;
  nome: string;
  descrizione: string;
  prezzo_ingresso: string;
  // 0.00 = non configurata.
  prezzo_ingresso_ridotto: string;
  prezzo_ingresso_bambino: string;
  prezzo_ombrellone: string;
  prezzo_gazebo: string;
  prezzo_lettino: string;
  prezzo_sdraia: string;
  totale_ombrelloni: number;
  totale_gazebi: number;
  totale_lettini: number;
  totale_sdraie: number;
  orario_apertura: string;
  orario_chiusura: string;
  orario_inizio_ridotto: string;
  // Fascia [eta_minima_bambino, eta_massima_bambino]; sotto il minimo, gratuito.
  eta_minima_bambino: number;
  eta_massima_bambino: number;
  isActive: boolean;
  created_at: string;
  updated_at: string;
};

export type CreatePiscinaInventarioPayload = Omit<
  PiscinaInventario,
  'id' | 'created_at' | 'updated_at'
>;

export type TipoPostazione = 'OMBRELLONE' | 'GAZEBO';

export type Postazione = {
  id: string;
  inventario: string;
  tipo: TipoPostazione;
  numero: number;
  pos_x: number;
  pos_y: number;
  // Gazebo creati in blocco condividono lo stesso `gruppo` e si spostano sempre insieme. Null per
  // l'ombrellone e per un gazebo creato singolarmente.
  gruppo: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatePostazionePayload = Omit<Postazione, 'id' | 'created_at' | 'updated_at'>;

export type UpdatePostazionePayload = Partial<CreatePostazionePayload>;

const PISCINA_INVENTARIO_PATH = '/v1/struttura/inventario-piscina/';
const POSTAZIONI_PATH = '/v1/struttura/postazioni/';

// GET /v1/struttura/inventario-piscina/
export function listPiscinaInventari(): Promise<PiscinaInventario[]> {
  return api.get<PiscinaInventario[]>(PISCINA_INVENTARIO_PATH).then((response) => response.data);
}

// GET /v1/struttura/inventario-piscina/{id}/
export function getPiscinaInventario(id: string): Promise<PiscinaInventario> {
  return api
    .get<PiscinaInventario>(`${PISCINA_INVENTARIO_PATH}${id}/`)
    .then((response) => response.data);
}

// POST /v1/struttura/inventario-piscina/
export function createPiscinaInventario(
  payload: CreatePiscinaInventarioPayload
): Promise<PiscinaInventario> {
  return api
    .post<PiscinaInventario>(PISCINA_INVENTARIO_PATH, payload)
    .then((response) => response.data);
}

// PUT /v1/struttura/inventario-piscina/{id}/
export function updatePiscinaInventario(
  id: string,
  payload: CreatePiscinaInventarioPayload
): Promise<PiscinaInventario> {
  return api
    .put<PiscinaInventario>(`${PISCINA_INVENTARIO_PATH}${id}/`, payload)
    .then((response) => response.data);
}

// DELETE /v1/struttura/inventario-piscina/{id}/
export function deletePiscinaInventario(id: string): Promise<void> {
  return api.delete(`${PISCINA_INVENTARIO_PATH}${id}/`).then(() => undefined);
}

// GET /v1/struttura/postazioni/?inventario={inventarioId}&data={data}
// `data` opzionale: se passata, il backend sovrascrive pos_x/pos_y con la posizione storica.
export function listPostazioni(inventarioId: string, data?: string): Promise<Postazione[]> {
  return api
    .get<Postazione[]>(POSTAZIONI_PATH, { params: { inventario: inventarioId, data } })
    .then((response) => response.data);
}

// POST /v1/struttura/postazioni/
export function createPostazione(payload: CreatePostazionePayload): Promise<Postazione> {
  return api.post<Postazione>(POSTAZIONI_PATH, payload).then((response) => response.data);
}

// PATCH /v1/struttura/postazioni/{id}/
export function updatePostazione(
  id: string,
  payload: UpdatePostazionePayload
): Promise<Postazione> {
  return api.patch<Postazione>(`${POSTAZIONI_PATH}${id}/`, payload).then((response) => response.data);
}

// DELETE /v1/struttura/postazioni/{id}/
export function deletePostazione(id: string): Promise<void> {
  return api.delete(`${POSTAZIONI_PATH}${id}/`).then(() => undefined);
}
