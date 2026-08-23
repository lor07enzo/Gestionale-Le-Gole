import api, { API_BASE_URL } from './api';
import type { VoceOrdine } from './menu';

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

export type PrenotazioneAsporto = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefono: string;
  note: string;
  data: string;
  ora: string;
  stato: StatoPrenotazione;
  // Forzato lato backend in base all'autenticazione, stesso principio di PrenotazionePiscina sopra.
  creata_da_staff: boolean;
  // Somma a runtime delle VoceOrdine collegate (menu.VoceOrdine.subtotale), mai persistito.
  totale: string;
  created_at: string;
  updated_at: string;
};

export type CreatePrenotazioneAsportoPayload = Pick<PrenotazioneAsporto, 'cliente_id' | 'data' | 'ora' | 'stato'> &
  Partial<Pick<PrenotazioneAsporto, 'note'>>;

// Usato dalla pagina staff "Storico Ordini" (app/staff/asporto/ordini.tsx) per modificare
// orario/note/stato di un ordine già esistente — stesso sottoinsieme di campi modificabili di
// UpdatePrenotazionePiscinaPayload, senza le quantità risorsa (che qui vivono su menu.VoceOrdine,
// non su questo modello).
export type UpdatePrenotazioneAsportoPayload = Partial<Pick<PrenotazioneAsporto, 'ora' | 'note' | 'stato'>>;

const PRENOTAZIONI_PISCINA_PATH = '/v1/prenotazioni/piscina/';
const PRENOTAZIONI_ASPORTO_PATH = '/v1/prenotazioni/asporto/';
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

// GET /v1/prenotazioni/piscina/storico_telefono/?telefono=... — pubblico, match esatto sul
// telefono (mai icontains/parziale, per non trasformarlo in una ricerca libera dell'anagrafica
// clienti). Usato dalla consultazione self-service "Le mie prenotazioni" (Area Cliente).
export function getStoricoPiscinaPerTelefono(telefono: string): Promise<PrenotazionePiscina[]> {
  return api
    .get<PrenotazionePiscina[]>(`${PRENOTAZIONI_PISCINA_PATH}storico_telefono/`, { params: { telefono } })
    .then((response) => response.data);
}

// GET /v1/prenotazioni/piscina/{id}/dettaglio_pubblico/ — pubblico, l'UUID funge da segreto,
// stesso principio di getBigliettoUrl. Usato dalla pagina di dettaglio raggiunta da una card
// di getStoricoPiscinaPerTelefono.
export function getDettaglioPubblicoPiscina(id: string): Promise<PrenotazionePiscina> {
  return api
    .get<PrenotazionePiscina>(`${PRENOTAZIONI_PISCINA_PATH}${id}/dettaglio_pubblico/`)
    .then((response) => response.data);
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

// GET /v1/prenotazioni/asporto/recenti/?limit={limit} — usato dal pannello notifiche staff,
// stessa forma/scopo di listPrenotazioniRecenti (piscina).
export function listPrenotazioniAsportoRecenti(limit = 50): Promise<PrenotazioneAsporto[]> {
  return api
    .get<PrenotazioneAsporto[]>(`${PRENOTAZIONI_ASPORTO_PATH}recenti/`, { params: { limit } })
    .then((response) => response.data);
}

// POST /v1/prenotazioni/asporto/ — pubblico (self-service): stato/creata_da_staff forzati
// lato backend per una richiesta anonima, a prescindere da cosa viene inviato qui.
export function createPrenotazioneAsporto(
  payload: CreatePrenotazioneAsportoPayload
): Promise<PrenotazioneAsporto> {
  return api.post<PrenotazioneAsporto>(PRENOTAZIONI_ASPORTO_PATH, payload).then((response) => response.data);
}

// GET /v1/prenotazioni/asporto/?data={data} — usato dalla pagina staff "Storico Ordini".
export function listPrenotazioniAsporto(params: { data: string }): Promise<PrenotazioneAsporto[]> {
  return api.get<PrenotazioneAsporto[]>(PRENOTAZIONI_ASPORTO_PATH, { params }).then((response) => response.data);
}

// GET /v1/prenotazioni/asporto/{id}/ — usato dalla pagina di dettaglio ordine
// (app/staff/asporto/ordini/[ordineId].tsx), raggiunta da una riga compatta di "Storico Ordini"
// che non porta più con sé l'oggetto ordine completo.
export function getPrenotazioneAsporto(id: string): Promise<PrenotazioneAsporto> {
  return api.get<PrenotazioneAsporto>(`${PRENOTAZIONI_ASPORTO_PATH}${id}/`).then((response) => response.data);
}

// GET /v1/prenotazioni/asporto/?cliente_id={id} — storico completo del cliente, stesso pattern
// 1:1 di listPrenotazioniPiscinaByCliente (sopra), usato dalla scheda cliente staff.
export function listPrenotazioniAsportoByCliente(clienteId: string): Promise<PrenotazioneAsporto[]> {
  return api
    .get<PrenotazioneAsporto[]>(PRENOTAZIONI_ASPORTO_PATH, { params: { cliente_id: clienteId } })
    .then((response) => response.data);
}

// PATCH /v1/prenotazioni/asporto/{id}/
export function updatePrenotazioneAsporto(
  id: string,
  payload: UpdatePrenotazioneAsportoPayload
): Promise<PrenotazioneAsporto> {
  return api
    .patch<PrenotazioneAsporto>(`${PRENOTAZIONI_ASPORTO_PATH}${id}/`, payload)
    .then((response) => response.data);
}

// GET /v1/prenotazioni/asporto/{id}/scarica_ricevuta/ — pubblico, bloccato solo per CANCELLED.
// Stesso identico pattern di getBigliettoUrl (piscina).
export function getRicevutaUrl(prenotazioneId: string): string {
  return `${API_BASE_URL}${PRENOTAZIONI_ASPORTO_PATH}${prenotazioneId}/scarica_ricevuta/`;
}

// GET /v1/prenotazioni/asporto/storico_telefono/?telefono=... — pubblico, stesso identico
// pattern/scopo di getStoricoPiscinaPerTelefono (sopra).
export function getStoricoAsportoPerTelefono(telefono: string): Promise<PrenotazioneAsporto[]> {
  return api
    .get<PrenotazioneAsporto[]>(`${PRENOTAZIONI_ASPORTO_PATH}storico_telefono/`, { params: { telefono } })
    .then((response) => response.data);
}

// PrenotazioneAsporto + le sue VoceOrdine annidate — solo l'azione 'dettaglio_pubblico' le
// espone (unico punto public-safe: VoceOrdineViewSet.list() resta IsAuthenticated).
export type PrenotazioneAsportoDettaglio = PrenotazioneAsporto & { voci: VoceOrdine[] };

// GET /v1/prenotazioni/asporto/{id}/dettaglio_pubblico/ — pubblico, stesso identico principio di
// getDettaglioPubblicoPiscina, con in più le righe prodotto dell'ordine.
export function getDettaglioPubblicoAsporto(id: string): Promise<PrenotazioneAsportoDettaglio> {
  return api
    .get<PrenotazioneAsportoDettaglio>(`${PRENOTAZIONI_ASPORTO_PATH}${id}/dettaglio_pubblico/`)
    .then((response) => response.data);
}
