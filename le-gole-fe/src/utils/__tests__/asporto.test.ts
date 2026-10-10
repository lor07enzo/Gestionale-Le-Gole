import {
  descrizioneOrari,
  etichettaPostiLiberi,
  finestreOrarie,
  getFinestraAttiva,
  isOraInFinestre,
  residuoPrenotazioni,
  residuoTextClassName,
  slotTuttiITurni,
} from '../asporto';

const UN_TURNO = {
  orario_apertura: '11:00:00',
  orario_chiusura: '14:00:00',
  orario_apertura_2: null,
  orario_chiusura_2: null,
};
const DUE_TURNI = { ...UN_TURNO, orario_apertura_2: '19:00:00', orario_chiusura_2: '22:00:00' };

const minuti = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

describe('finestre orarie', () => {
  it('un solo turno se il secondo non è configurato', () => {
    expect(finestreOrarie(UN_TURNO)).toEqual([{ apertura: '11:00', chiusura: '14:00' }]);
  });

  it('il secondo turno va configurato per intero, mai a metà', () => {
    expect(finestreOrarie({ ...UN_TURNO, orario_apertura_2: '19:00:00' })).toHaveLength(1);
    expect(finestreOrarie(DUE_TURNI)).toEqual([
      { apertura: '11:00', chiusura: '14:00' },
      { apertura: '19:00', chiusura: '22:00' },
    ]);
  });

  it('descrive entrambi i turni come il backend', () => {
    expect(descrizioneOrari(UN_TURNO)).toBe('dalle 11:00 alle 14:00');
    expect(descrizioneOrari(DUE_TURNI)).toBe('dalle 11:00 alle 14:00 e dalle 19:00 alle 22:00');
  });
});

describe('getFinestraAttiva', () => {
  it('resta sul pranzo finché non chiude, anche prima che apra', () => {
    expect(getFinestraAttiva(DUE_TURNI, minuti('09:00'))).toEqual({ apertura: '11:00', chiusura: '14:00' });
    expect(getFinestraAttiva(DUE_TURNI, minuti('13:59'))).toEqual({ apertura: '11:00', chiusura: '14:00' });
  });

  it('passa da sé alla cena dopo la chiusura del pranzo', () => {
    expect(getFinestraAttiva(DUE_TURNI, minuti('14:00'))).toEqual({ apertura: '19:00', chiusura: '22:00' });
  });

  it('a servizio chiuso resta sull’ultimo turno come riferimento', () => {
    expect(getFinestraAttiva(DUE_TURNI, minuti('23:00'))).toEqual({ apertura: '19:00', chiusura: '22:00' });
    expect(getFinestraAttiva(UN_TURNO, minuti('23:00'))).toEqual({ apertura: '11:00', chiusura: '14:00' });
  });
});

describe('isOraInFinestre', () => {
  it('accetta gli estremi di entrambi i turni e rifiuta la pausa', () => {
    expect(isOraInFinestre(DUE_TURNI, minuti('11:00'))).toBe(true);
    expect(isOraInFinestre(DUE_TURNI, minuti('14:00'))).toBe(true);
    expect(isOraInFinestre(DUE_TURNI, minuti('17:00'))).toBe(false);
    expect(isOraInFinestre(DUE_TURNI, minuti('22:00'))).toBe(true);
    expect(isOraInFinestre(UN_TURNO, minuti('20:00'))).toBe(false);
  });
});

it('slotTuttiITurni concatena gli slot da 15 minuti di entrambi i turni', () => {
  const slots = slotTuttiITurni(DUE_TURNI);
  expect(slots[0]).toBe('11:00');
  expect(slots).toContain('14:00');
  expect(slots).not.toContain('17:00');
  expect(slots.at(-1)).toBe('22:00');
  expect(slots).toHaveLength(13 + 13);
});

describe('residuo prenotazioni per orario', () => {
  it('senza limite non esiste un residuo', () => {
    expect(residuoPrenotazioni(null, { '12:00': 5 }, '12:00')).toBeNull();
  });

  it('sottrae le prenotazioni già presenti; un orario assente vale zero', () => {
    expect(residuoPrenotazioni(3, { '12:00': 2 }, '12:00')).toBe(1);
    expect(residuoPrenotazioni(3, { '12:00': 2 }, '12:15')).toBe(3);
  });

  it('etichetta e colore del residuo', () => {
    expect(etichettaPostiLiberi(1)).toBe('1 posto libero');
    expect(etichettaPostiLiberi(2)).toBe('2 posti liberi');
    expect(residuoTextClassName(1)).toBe('text-rose-600');
    expect(residuoTextClassName(2)).toBe('text-amber-600');
  });
});
