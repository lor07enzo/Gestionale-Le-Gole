import type { PrenotazionePiscina } from '../services/prenotazioni';
import type { ResiduiPrenotazione } from '../utils/piscinaMappa';

export type SheetMode = 'add-postazione' | 'assign' | 'occupant' | null;

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

// "+ Nuovo cliente" crea sempre, insieme all'anagrafica, una vera Prenotazione_Piscina (stato
// CONFIRMED, cliente fisicamente presente): questi campi rispecchiano quindi le stesse risorse
// di EditPrenotazioneFormState, non solo nome/telefono/note.
export type NewClienteFormState = {
  nome: string;
  telefono: string;
  note: string;
  orarioArrivo: string;
  ingressi: string;
  ingressiRidotti: string;
  ingressiBambini: string;
  ingressiGratuiti: string;
  ombrellone: string;
  gazebo: string;
  lettino: string;
  sdraia: string;
};

export const EMPTY_NEW_CLIENTE_FORM: NewClienteFormState = {
  nome: '',
  telefono: '',
  note: '',
  orarioArrivo: '',
  ingressi: '1',
  ingressiRidotti: '0',
  ingressiBambini: '0',
  ingressiGratuiti: '0',
  ombrellone: '0',
  gazebo: '0',
  lettino: '0',
  sdraia: '0',
};

export type EditPrenotazioneFormState = {
  ora: string;
  ingressi: string;
  ingressiRidotti: string;
  ingressiBambini: string;
  ingressiGratuiti: string;
  ombrellone: string;
  gazebo: string;
  lettino: string;
  sdraia: string;
  note: string;
};

export const EMPTY_EDIT_PRENOTAZIONE_FORM: EditPrenotazioneFormState = {
  ora: '',
  ingressi: '0',
  ingressiRidotti: '0',
  ingressiBambini: '0',
  ingressiGratuiti: '0',
  ombrellone: '0',
  gazebo: '0',
  lettino: '0',
  sdraia: '0',
  note: '',
};

// Voce del pannello "Clienti del giorno": la prenotazione insieme ai residui di ombrellone/gazebo/
// lettini/sdraie non ancora assegnati e al flag "completo" (nessuna unità residua da piazzare).
export type ClienteDelGiornoEntry = {
  prenotazione: PrenotazionePiscina;
  residui: ResiduiPrenotazione | undefined;
  completo: boolean;
};
