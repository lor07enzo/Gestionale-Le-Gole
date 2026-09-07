import {
  calcolaSlotOccupazione,
  calcolaTotalePadel,
  formatDurata,
  formatFasciaPartita,
  formatTotaleEuro,
  racchetteNoleggiate,
} from '../padel';
import type { NoleggioRacchetta } from '../../services/padel';

function noleggio(overrides: Partial<NoleggioRacchetta> = {}): NoleggioRacchetta {
  return {
    id: 'noleggio-1',
    prenotazione: 'partita-1',
    racchetta: 'racchetta-1',
    racchetta_nome: 'Babolat Air Viper',
    quantita: 1,
    prezzo_unitario: '6.00',
    subtotale: '6.00',
    created_at: '2026-09-04T10:00:00.000Z',
    updated_at: '2026-09-04T10:00:00.000Z',
    ...overrides,
  };
}

describe('formatDurata', () => {
  it('resta in minuti sotto l\'ora', () => {
    expect(formatDurata(45)).toBe('45 min');
  });

  it('mostra le ore intere senza minuti', () => {
    expect(formatDurata(120)).toBe('2h');
  });

  it('mostra ore e minuti quando il resto non è zero', () => {
    expect(formatDurata(90)).toBe('1h 30min');
  });
});

describe('formatFasciaPartita', () => {
  it('taglia i secondi degli orari del backend', () => {
    expect(formatFasciaPartita('18:00:00', '19:30:00')).toBe('18:00 - 19:30');
  });
});

describe('racchetteNoleggiate', () => {
  it('somma le quantità di tutte le righe', () => {
    expect(racchetteNoleggiate([noleggio({ quantita: 2 }), noleggio({ id: 'n2', quantita: 1 })])).toBe(3);
  });

  it('è zero senza righe', () => {
    expect(racchetteNoleggiate([])).toBe(0);
  });
});

describe('calcolaTotalePadel', () => {
  const partita = { prezzo_partita: '30.00', prezzo_palline: '5.00', palline_noleggiate: false };

  it('conta la sola partita senza noleggi', () => {
    expect(calcolaTotalePadel(partita, [])).toBe(30);
  });

  it('aggiunge le palline solo se noleggiate', () => {
    expect(calcolaTotalePadel({ ...partita, palline_noleggiate: true }, [])).toBe(35);
  });

  it('somma i subtotali delle righe di noleggio', () => {
    const righe = [noleggio({ subtotale: '12.00' }), noleggio({ id: 'n2', subtotale: '8.50' })];
    expect(calcolaTotalePadel(partita, righe)).toBe(50.5);
  });
});

describe('formatTotaleEuro', () => {
  it('omette i decimali quando sono zero', () => {
    expect(formatTotaleEuro(30)).toBe('30');
  });

  it('usa la virgola italiana per i centesimi', () => {
    expect(formatTotaleEuro(50.5)).toBe('50,50');
  });
});

describe('calcolaSlotOccupazione', () => {
  const griglia = ['10:00', '11:00', '12:00'];

  it('marca liberi tutti gli slot senza partite', () => {
    expect(calcolaSlotOccupazione(griglia, [], 60)).toEqual([
      { ora: '10:00', disponibile: true },
      { ora: '11:00', disponibile: true },
      { ora: '12:00', disponibile: true },
    ]);
  });

  it('occupa solo lo slot della partita, non quelli adiacenti', () => {
    const slots = calcolaSlotOccupazione(
      griglia,
      [{ ora: '11:00:00', durata_minuti: 60, stato: 'CONFIRMED' }],
      60
    );
    expect(slots.map((s) => s.disponibile)).toEqual([true, false, true]);
  });

  it('rileva la sovrapposizione con una partita di durata diversa dalla griglia attuale', () => {
    // Partita creata quando la durata configurata era di 180 minuti: copre anche gli slot
    // successivi pur non condividendone l'orario di inizio.
    const slots = calcolaSlotOccupazione(
      griglia,
      [{ ora: '10:00:00', durata_minuti: 180, stato: 'CONFIRMED' }],
      60
    );
    expect(slots.map((s) => s.disponibile)).toEqual([false, false, false]);
  });

  it('ignora le partite cancellate', () => {
    const slots = calcolaSlotOccupazione(
      griglia,
      [{ ora: '11:00:00', durata_minuti: 60, stato: 'CANCELLED' }],
      60
    );
    expect(slots.every((s) => s.disponibile)).toBe(true);
  });

  it('esclude la partita indicata, per non bloccarsi da sola in modifica', () => {
    const slots = calcolaSlotOccupazione(
      griglia,
      [{ id: 'partita-1', ora: '11:00:00', durata_minuti: 60, stato: 'CONFIRMED' }],
      60,
      'partita-1'
    );
    expect(slots.every((s) => s.disponibile)).toBe(true);
  });
});
