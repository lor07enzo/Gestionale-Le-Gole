import type { PrenotazionePiscina } from '../services/prenotazioni';
import type { ResiduiPrenotazione } from '../utils/piscinaMappa';

export type SheetMode = 'add-postazione' | 'assign' | 'occupant' | null;

export type WalkInCliente = { id: string; nome: string; telefono: string };

export type SimpleFormState = {
  clienteNome: string;
  clienteTelefono: string;
  lettini: string;
  sdraie: string;
  orarioArrivo: string;
};

export const EMPTY_FORM: SimpleFormState = {
  clienteNome: '',
  clienteTelefono: '',
  lettini: '0',
  sdraie: '0',
  orarioArrivo: '',
};

export type NewClienteFormState = { nome: string; telefono: string; note: string };

export const EMPTY_NEW_CLIENTE_FORM: NewClienteFormState = { nome: '', telefono: '', note: '' };

export type EditPrenotazioneFormState = {
  ora: string;
  ingressi: string;
  ombrellone: string;
  gazebo: string;
  lettino: string;
  sdraia: string;
};

export const EMPTY_EDIT_PRENOTAZIONE_FORM: EditPrenotazioneFormState = {
  ora: '',
  ingressi: '0',
  ombrellone: '0',
  gazebo: '0',
  lettino: '0',
  sdraia: '0',
};

// Voce del pannello "Clienti del giorno": la prenotazione insieme ai residui di ombrellone/gazebo/
// lettini/sdraie non ancora assegnati e al flag "completo" (nessuna unità residua da piazzare).
export type ClienteDelGiornoEntry = {
  prenotazione: PrenotazionePiscina;
  residui: ResiduiPrenotazione | undefined;
  completo: boolean;
};
