import {
  costoRacchetteScelte,
  maxRacchettaSelezionabile,
  ricalibraRacchette,
  slotPadelFuturi,
  totaleRacchetteScelte,
  totaleStimatoPadel,
} from '../padel';
import { validateOrarioPiscina } from '../piscinaMappa';

// Logica condivisa tra la prenotazione padel self-service e la creazione partita lato staff.

const SLOTS = [
  { ora: '10:00', disponibile: true },
  { ora: '11:30', disponibile: false },
  { ora: '13:00', disponibile: true },
];

describe('slotPadelFuturi', () => {
  it('oggi nasconde gli orari già iniziati, l’orario corrente resta', () => {
    const adesso = new Date(2026, 8, 20, 11, 30);
    expect(slotPadelFuturi(SLOTS, new Date(2026, 8, 20), adesso).map((s) => s.ora)).toEqual(['11:30', '13:00']);
  });

  it('in un altro giorno li mostra tutti', () => {
    const adesso = new Date(2026, 8, 20, 23, 0);
    expect(slotPadelFuturi(SLOTS, new Date(2026, 8, 21), adesso)).toBe(SLOTS);
  });
});

describe('racchette scelte', () => {
  it('somma le quantità di tutte le marche', () => {
    expect(totaleRacchetteScelte({ a: 2, b: 1, c: 0 })).toBe(3);
    expect(totaleRacchetteScelte({})).toBe(0);
  });

  it('ricalibra togliendo le eccedenti quando scendono i partecipanti', () => {
    expect(ricalibraRacchette({ a: 2, b: 2 }, 3)).toEqual({ a: 1, b: 2 });
    expect(ricalibraRacchette({ a: 3, b: 1 }, 1)).toEqual({ a: 0, b: 1 });
  });

  it('non tocca (stesso oggetto) le quantità già entro il tetto', () => {
    const quantita = { a: 1, b: 1 };
    expect(ricalibraRacchette(quantita, 4)).toBe(quantita);
  });

  it('il tetto per marca è il minimo tra pezzi posseduti e giocatori ancora senza racchetta', () => {
    expect(maxRacchettaSelezionabile(5, 4, { a: 1, b: 2 }, 'a')).toBe(2);
    expect(maxRacchettaSelezionabile(1, 4, {}, 'a')).toBe(1);
    expect(maxRacchettaSelezionabile(5, 2, { b: 3 }, 'a')).toBe(0);
  });
});

describe('totale stimato di una partita non ancora creata', () => {
  const configurazione = { prezzo_partita: '30.00', prezzo_noleggio_palline: '5.00' };
  const catalogo = [
    { id: 'a', prezzo_noleggio: '6.00' },
    { id: 'b', prezzo_noleggio: '4.50' },
  ];

  it('somma partita, palline se scelte e racchette dal catalogo', () => {
    expect(costoRacchetteScelte(catalogo, { a: 2, b: 1 })).toBe(16.5);
    expect(totaleStimatoPadel(configurazione, true, catalogo, { a: 2, b: 1 })).toBe(51.5);
    expect(totaleStimatoPadel(configurazione, false, catalogo, {})).toBe(30);
  });

  it('un prezzo non numerico vale zero', () => {
    expect(totaleStimatoPadel({ prezzo_partita: '', prezzo_noleggio_palline: 'x' }, true, [], {})).toBe(0);
  });
});

describe('validateOrarioPiscina', () => {
  const inventario = { orario_apertura: '09:00:00', orario_chiusura: '19:00:00' };
  const oggi = new Date(2026, 8, 20);
  const adesso = new Date(2026, 8, 20, 12, 0);

  it('orario obbligatorio e in formato HH:MM', () => {
    expect(validateOrarioPiscina('  ', inventario, oggi, adesso)).toBe("L'orario è obbligatorio.");
    expect(validateOrarioPiscina('25:00', inventario, oggi, adesso)).toBe('Inserisci un orario valido (HH:MM).');
  });

  it('dentro l’apertura del listino', () => {
    expect(validateOrarioPiscina('08:30', inventario, new Date(2026, 8, 21), adesso)).toBe(
      'La piscina è aperta dalle 09:00 alle 19:00.'
    );
    expect(validateOrarioPiscina('19:00', inventario, new Date(2026, 8, 21), adesso)).toBeNull();
  });

  it('non nel passato solo se la data è oggi', () => {
    expect(validateOrarioPiscina('10:00', inventario, oggi, adesso)).toBe("L'orario non può essere nel passato.");
    expect(validateOrarioPiscina('10:00', inventario, new Date(2026, 8, 21), adesso)).toBeNull();
    expect(validateOrarioPiscina('12:00', inventario, oggi, adesso)).toBeNull();
  });
});
