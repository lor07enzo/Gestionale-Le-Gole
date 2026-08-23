import { Platform } from 'react-native';
import api from './api';

export type Categoria = {
  id: string;
  nome: string;
  created_at: string;
};

export type CreateCategoriaPayload = Omit<Categoria, 'id' | 'created_at'>;

export type Allergene = {
  id: string;
  nome: string;
  // Emoji libera, opzionale — riconoscibile a colpo d'occhio nei badge del catalogo. I 14
  // allergeni previsti dal Reg. UE 1169/2011 arrivano già seminati con un'icona (backend,
  // migrazione 0007), ma restano righe normali: modificabili/eliminabili come le altre.
  icona: string;
  created_at: string;
};

export type CreateAllergenePayload = Omit<Allergene, 'id' | 'created_at'>;

export type Prodotto = {
  id: string;
  nome: string;
  descrizione: string;
  // FK verso Categoria: id, non più testo libero.
  categoria: string;
  // Comodo per mostrare il nome senza dover incrociare la lista categorie.
  categoria_nome: string;
  // Id degli Allergene collegati.
  allergeni: string[];
  prezzo: string;
  // Nasconde il prodotto dal menu pubblico senza eliminarlo.
  disponibile: boolean;
  // URL assoluto (Cloudinary), o null se il prodotto non ha ancora una foto. Mai scritto tramite
  // il payload JSON di create/update: sempre via uploadProdottoImmagine (multipart), sotto.
  immagine: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProdottoPayload = Omit<
  Prodotto,
  'id' | 'categoria_nome' | 'immagine' | 'created_at' | 'updated_at'
>;

// Asset scelto da expo-image-picker (fotocamera o galleria), ridotto ai soli campi che servono
// per costruire l'upload.
export type ImmagineProdottoFile = {
  uri: string;
  name: string;
  mimeType: string;
};

export type ConfigurazioneAsporto = {
  id: string;
  // "HH:MM:SS" (formato backend).
  orario_apertura: string;
  orario_chiusura: string;
  updated_at: string;
};

export type UpdateConfigurazioneAsportoPayload = Partial<
  Pick<ConfigurazioneAsporto, 'orario_apertura' | 'orario_chiusura'>
>;

export type GiornoChiusoAsporto = {
  id: string;
  // "YYYY-MM-DD".
  data: string;
  created_at: string;
};

export type CreateGiornoChiusoAsportoPayload = Pick<GiornoChiusoAsporto, 'data'>;

export type VoceOrdine = {
  id: string;
  prenotazione: string;
  prodotto: string;
  // Comodo per il riepilogo lato client, evita una join.
  prodotto_nome: string;
  quantita: number;
  // Sempre uno snapshot server-side di Prodotto.prezzo al momento della creazione — mai scrivibile.
  prezzo_unitario: string;
  subtotale: string;
  note: string;
};

export type CreateVoceOrdinePayload = {
  prenotazione: string;
  prodotto: string;
  quantita: number;
  note?: string;
};

// Usato dalla pagina staff "Storico Ordini" per correggere la quantità/nota di una riga già
// esistente — mai `prezzo_unitario` (read-only lato backend, sempre lo snapshot al momento
// della creazione della riga) né `prodotto` (sostituire il prodotto di una riga non è supportato:
// si rimuove la riga e se ne aggiunge una nuova, stesso principio del carrello self-service).
export type UpdateVoceOrdinePayload = Partial<Pick<VoceOrdine, 'quantita' | 'note'>>;

const CONFIGURAZIONE_ASPORTO_PATH = '/v1/menu/configurazione-asporto/';
const CATEGORIE_PATH = '/v1/menu/categorie/';
const ALLERGENI_PATH = '/v1/menu/allergeni/';
const PRODOTTI_PATH = '/v1/menu/prodotti/';
const VOCI_ORDINE_PATH = '/v1/menu/voci-ordine/';
const GIORNI_CHIUSI_ASPORTO_PATH = '/v1/menu/giorni-chiusi-asporto/';

// GET /v1/menu/configurazione-asporto/ — riga singleton, pubblica in lettura.
export function getConfigurazioneAsporto(): Promise<ConfigurazioneAsporto> {
  return api.get<ConfigurazioneAsporto>(CONFIGURAZIONE_ASPORTO_PATH).then((response) => response.data);
}

// PATCH /v1/menu/configurazione-asporto/ — riservata allo staff.
export function updateConfigurazioneAsporto(
  payload: UpdateConfigurazioneAsportoPayload
): Promise<ConfigurazioneAsporto> {
  return api
    .patch<ConfigurazioneAsporto>(CONFIGURAZIONE_ASPORTO_PATH, payload)
    .then((response) => response.data);
}

// GET /v1/menu/categorie/
export function listCategorie(): Promise<Categoria[]> {
  return api.get<Categoria[]>(CATEGORIE_PATH).then((response) => response.data);
}

// POST /v1/menu/categorie/
export function createCategoria(payload: CreateCategoriaPayload): Promise<Categoria> {
  return api.post<Categoria>(CATEGORIE_PATH, payload).then((response) => response.data);
}

// DELETE /v1/menu/categorie/{id}/
export function deleteCategoria(id: string): Promise<void> {
  return api.delete(`${CATEGORIE_PATH}${id}/`).then(() => undefined);
}

// GET /v1/menu/allergeni/
export function listAllergeni(): Promise<Allergene[]> {
  return api.get<Allergene[]>(ALLERGENI_PATH).then((response) => response.data);
}

// POST /v1/menu/allergeni/
export function createAllergene(payload: CreateAllergenePayload): Promise<Allergene> {
  return api.post<Allergene>(ALLERGENI_PATH, payload).then((response) => response.data);
}

// DELETE /v1/menu/allergeni/{id}/
export function deleteAllergene(id: string): Promise<void> {
  return api.delete(`${ALLERGENI_PATH}${id}/`).then(() => undefined);
}

// GET /v1/menu/prodotti/
export function listProdotti(): Promise<Prodotto[]> {
  return api.get<Prodotto[]>(PRODOTTI_PATH).then((response) => response.data);
}

// POST /v1/menu/prodotti/
export function createProdotto(payload: CreateProdottoPayload): Promise<Prodotto> {
  return api.post<Prodotto>(PRODOTTI_PATH, payload).then((response) => response.data);
}

// PUT /v1/menu/prodotti/{id}/
export function updateProdotto(id: string, payload: CreateProdottoPayload): Promise<Prodotto> {
  return api.put<Prodotto>(`${PRODOTTI_PATH}${id}/`, payload).then((response) => response.data);
}

// DELETE /v1/menu/prodotti/{id}/
export function deleteProdotto(id: string): Promise<void> {
  return api.delete(`${PRODOTTI_PATH}${id}/`).then(() => undefined);
}

// GET /v1/menu/giorni-chiusi-asporto/ — riservata allo staff, elenco completo (nessun filtro:
// il numero di chiusure gestite è tipicamente piccolo).
export function listGiorniChiusiAsporto(): Promise<GiornoChiusoAsporto[]> {
  return api.get<GiornoChiusoAsporto[]>(GIORNI_CHIUSI_ASPORTO_PATH).then((response) => response.data);
}

// POST /v1/menu/giorni-chiusi-asporto/ — riservata allo staff.
export function createGiornoChiusoAsporto(
  payload: CreateGiornoChiusoAsportoPayload
): Promise<GiornoChiusoAsporto> {
  return api
    .post<GiornoChiusoAsporto>(GIORNI_CHIUSI_ASPORTO_PATH, payload)
    .then((response) => response.data);
}

// DELETE /v1/menu/giorni-chiusi-asporto/{id}/ — riservata allo staff.
export function deleteGiornoChiusoAsporto(id: string): Promise<void> {
  return api.delete(`${GIORNI_CHIUSI_ASPORTO_PATH}${id}/`).then(() => undefined);
}

// GET .../prossime/ — pubblico, solo le date di chiusura da oggi in poi (oggi incluso), ordinate.
export function getProssimeChiusureAsporto(): Promise<string[]> {
  return api
    .get<string[]>(`${GIORNI_CHIUSI_ASPORTO_PATH}prossime/`)
    .then((response) => response.data);
}

// POST /v1/menu/voci-ordine/ — pubblico (self-service): prezzo_unitario è sempre ignorato se
// inviato dal client, il backend lo forza sempre allo snapshot del prezzo corrente del prodotto.
export function createVoceOrdine(payload: CreateVoceOrdinePayload): Promise<VoceOrdine> {
  return api.post<VoceOrdine>(VOCI_ORDINE_PATH, payload).then((response) => response.data);
}

// GET /v1/menu/voci-ordine/?prenotazione={id} — riservata allo staff, righe di un singolo ordine.
export function listVociOrdine(params: { prenotazione: string }): Promise<VoceOrdine[]> {
  return api.get<VoceOrdine[]>(VOCI_ORDINE_PATH, { params }).then((response) => response.data);
}

// PATCH /v1/menu/voci-ordine/{id}/ — riservata allo staff (modifica quantità/nota di una riga).
export function updateVoceOrdine(id: string, payload: UpdateVoceOrdinePayload): Promise<VoceOrdine> {
  return api.patch<VoceOrdine>(`${VOCI_ORDINE_PATH}${id}/`, payload).then((response) => response.data);
}

// DELETE /v1/menu/voci-ordine/{id}/ — riservata allo staff (rimuove una riga dall'ordine).
export function deleteVoceOrdine(id: string): Promise<void> {
  return api.delete(`${VOCI_ORDINE_PATH}${id}/`).then(() => undefined);
}

// PATCH /v1/menu/prodotti/{id}/ — multipart, tocca solo il campo immagine. Separata dal normale
// updateProdotto() (JSON) perché un file non può viaggiare in un payload JSON: due richieste,
// non una sola con tutto — coerente con "un'azione isolata, un endpoint" già usato altrove
// (es. set-active dello staff) invece di appesantire il salvataggio testuale del form.
//
// Cross-platform: su web l'uri restituito da expo-image-picker (blob:/data:) va prima convertito
// in un vero Blob per poter essere allegato a un FormData — su nativo basta l'oggetto
// {uri, name, type}, che il livello RN/XHR sa già interpretare come file.
export async function uploadProdottoImmagine(
  id: string,
  file: ImmagineProdottoFile
): Promise<Prodotto> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    formData.append('immagine', blob, file.name);
  } else {
    formData.append('immagine', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }
  return api.patch<Prodotto>(`${PRODOTTI_PATH}${id}/`, formData).then((response) => response.data);
}
