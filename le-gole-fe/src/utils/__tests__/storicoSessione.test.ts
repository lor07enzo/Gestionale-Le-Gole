import {
  haPrenotazioni,
  leggiStoricoCliente,
  salvaStoricoCliente,
  svuotaStoricoCliente,
  type StoricoCliente,
} from '../storicoSessione';

const STORICO: StoricoCliente = {
  telefono: '3331234567',
  piscina: [],
  asporto: [{ id: 'a1', data: '2026-09-01', ora: '19:00:00', stato: 'CONFIRMED', cliente_nome: 'Mario R.', totale: '12.00' }],
  padel: [],
};

describe('storicoSessione', () => {
  afterEach(() => svuotaStoricoCliente());

  it('parte vuoto e restituisce ciò che è stato salvato', () => {
    expect(leggiStoricoCliente()).toBeNull();
    salvaStoricoCliente(STORICO);
    expect(leggiStoricoCliente()).toBe(STORICO);
  });

  it('non tocca localStorage: su un dispositivo condiviso non deve restare nulla', () => {
    salvaStoricoCliente(STORICO);
    expect(JSON.stringify({ ...localStorage })).not.toContain('3331234567');
  });

  it('svuota su richiesta ("Cerca un altro numero")', () => {
    salvaStoricoCliente(STORICO);
    svuotaStoricoCliente();
    expect(leggiStoricoCliente()).toBeNull();
  });

  it('haPrenotazioni guarda tutti e tre i servizi', () => {
    expect(haPrenotazioni({ piscina: [], asporto: [], padel: [] })).toBe(false);
    expect(haPrenotazioni(STORICO)).toBe(true);
  });
});
