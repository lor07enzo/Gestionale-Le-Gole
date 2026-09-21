import {
  FINESTRA_ADESSO_MINUTI,
  formatAttesaRitiro,
  minutiAlRitiro,
  prossimoRitiro,
  raggruppaOrdiniDelGiorno,
} from '../ordiniAsporto';
import type { StatoPrenotazione } from '../../services/prenotazioni';

type Ordine = { id: string; ora: string; stato: StatoPrenotazione };

function ordine(id: string, ora: string, stato: StatoPrenotazione = 'CONFIRMED'): Ordine {
  return { id, ora, stato };
}

// Ora di riferimento per tutti i test: 19:00 = 1140 minuti dalla mezzanotte.
const ORA_19 = 19 * 60;

describe('minutiAlRitiro', () => {
  it('accetta il formato "HH:MM:SS" del backend', () => {
    expect(minutiAlRitiro('19:30:00', ORA_19)).toBe(30);
  });

  it('è negativo per un orario già passato', () => {
    expect(minutiAlRitiro('18:45:00', ORA_19)).toBe(-15);
  });

  it('null su un orario non interpretabile', () => {
    expect(minutiAlRitiro('', ORA_19)).toBeNull();
    expect(minutiAlRitiro('boh', ORA_19)).toBeNull();
  });
});

describe('raggruppaOrdiniDelGiorno', () => {
  it('mette nella finestra "adesso" sia i ritiri imminenti sia quelli appena passati', () => {
    const gruppi = raggruppaOrdiniDelGiorno(
      [ordine('a', '18:35:00'), ordine('b', '19:00:00'), ordine('c', '19:25:00')],
      ORA_19,
    );
    expect(gruppi.adesso.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(gruppi.piuTardi).toHaveLength(0);
    expect(gruppi.passati).toHaveLength(0);
  });

  it('include gli estremi esatti della finestra, esclude ciò che la supera', () => {
    const gruppi = raggruppaOrdiniDelGiorno(
      [
        ordine('bordo-prima', '18:30:00'),
        ordine('bordo-dopo', '19:30:00'),
        ordine('oltre-prima', '18:29:00'),
        ordine('oltre-dopo', '19:31:00'),
      ],
      ORA_19,
    );
    expect(FINESTRA_ADESSO_MINUTI).toBe(30);
    expect(gruppi.adesso.map((o) => o.id)).toEqual(['bordo-prima', 'bordo-dopo']);
    expect(gruppi.passati.map((o) => o.id)).toEqual(['oltre-prima']);
    expect(gruppi.piuTardi.map((o) => o.id)).toEqual(['oltre-dopo']);
  });

  it('separa gli annullati a prescindere dall orario', () => {
    const gruppi = raggruppaOrdiniDelGiorno(
      [
        ordine('annullato-imminente', '19:05:00', 'CANCELLED'),
        ordine('annullato-tardi', '21:00:00', 'CANCELLED'),
        ordine('attivo', '19:05:00'),
      ],
      ORA_19,
    );
    expect(gruppi.annullati.map((o) => o.id)).toEqual(['annullato-imminente', 'annullato-tardi']);
    expect(gruppi.adesso.map((o) => o.id)).toEqual(['attivo']);
    expect(gruppi.piuTardi).toHaveLength(0);
  });

  it('non perde un ordine con orario malformato: resta tra quelli da gestire', () => {
    const gruppi = raggruppaOrdiniDelGiorno([ordine('rotto', '')], ORA_19);
    expect(gruppi.adesso.map((o) => o.id)).toEqual(['rotto']);
  });

  it('ordina i passati dal più recente, gli altri gruppi in ordine di giornata', () => {
    const gruppi = raggruppaOrdiniDelGiorno(
      [
        ordine('pranzo', '12:00:00'),
        ordine('merenda', '17:00:00'),
        ordine('tardi-2', '21:00:00'),
        ordine('tardi-1', '20:00:00'),
      ],
      ORA_19,
    );
    expect(gruppi.passati.map((o) => o.id)).toEqual(['merenda', 'pranzo']);
    expect(gruppi.piuTardi.map((o) => o.id)).toEqual(['tardi-1', 'tardi-2']);
  });

  it('non muta l array ricevuto', () => {
    const lista = [ordine('b', '21:00:00'), ordine('a', '12:00:00')];
    raggruppaOrdiniDelGiorno(lista, ORA_19);
    expect(lista.map((o) => o.id)).toEqual(['b', 'a']);
  });
});

describe('prossimoRitiro', () => {
  it('è il primo orario non ancora arrivato, annullati esclusi', () => {
    const prossimo = prossimoRitiro(
      [
        ordine('passato', '18:00:00'),
        ordine('annullato', '19:10:00', 'CANCELLED'),
        ordine('buono', '19:20:00'),
        ordine('dopo', '20:00:00'),
      ],
      ORA_19,
    );
    expect(prossimo?.id).toBe('buono');
  });

  it('null se ogni ritiro è già passato', () => {
    expect(prossimoRitiro([ordine('a', '12:00:00'), ordine('b', '18:00:00')], ORA_19)).toBeNull();
  });
});

describe('formatAttesaRitiro', () => {
  it('distingue futuro, presente e passato', () => {
    expect(formatAttesaRitiro(12)).toBe('tra 12 min');
    expect(formatAttesaRitiro(0)).toBe('adesso');
    expect(formatAttesaRitiro(-8)).toBe('8 min fa');
  });
});
