import type { StoricoAsporto, StoricoPiscina } from '../services/prenotazioni';
import type { StoricoPadel } from '../services/padel';

// Risultato dell'ultima ricerca di "Le mie prenotazioni", tenuto solo in memoria: la pagina
// storico lo legge da qui invece di ricevere il telefono come query param. Un numero in un URL
// resterebbe nella cronologia del browser e nei log di accesso; qui sparisce alla chiusura o al
// ricaricamento della pagina (e la pagina ripropone la ricerca). Niente localStorage apposta: su
// un dispositivo condiviso non deve restare nulla dopo che il cliente se n'è andato.
export type StoricoCliente = {
  telefono: string;
  piscina: StoricoPiscina[];
  asporto: StoricoAsporto[];
  padel: StoricoPadel[];
};

let corrente: StoricoCliente | null = null;

export function salvaStoricoCliente(storico: StoricoCliente): void {
  corrente = storico;
}

export function leggiStoricoCliente(): StoricoCliente | null {
  return corrente;
}

export function svuotaStoricoCliente(): void {
  corrente = null;
}

export function haPrenotazioni(storico: Omit<StoricoCliente, 'telefono'>): boolean {
  return storico.piscina.length + storico.asporto.length + storico.padel.length > 0;
}
