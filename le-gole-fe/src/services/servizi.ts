import api from './api';

export type ServiziDisponibili = {
  piscina: boolean;
  asporto: boolean;
  padel: boolean;
};

// Ultima risposta ricevuta: tornando sulla home dell'Area Cliente le card si mostrano subito
// con questo valore, mentre la richiesta successiva lo aggiorna in background.
let ultimaRisposta: ServiziDisponibili | null = null;

export function getServiziDisponibiliInCache(): ServiziDisponibili | null {
  return ultimaRisposta;
}

export type VersioneApp = {
  versione_minima: string;
  url_android: string;
  url_ios: string;
};

export async function getVersioneApp(): Promise<VersioneApp> {
  const { data } = await api.get<VersioneApp>('/v1/versione-app/');
  return data;
}

export async function getServiziDisponibili(): Promise<ServiziDisponibili> {
  const { data } = await api.get<ServiziDisponibili>('/v1/servizi-disponibili/');
  ultimaRisposta = data;
  return data;
}
