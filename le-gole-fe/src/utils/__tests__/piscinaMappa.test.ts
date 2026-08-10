import {
  addDays,
  clamp,
  computeDefaultOrario,
  formatDateDDMMYYYY,
  formatIngressiSummary,
  formatOrarioInput,
  formatRelativeTime,
  formatTime,
  isSameDay,
  minutesToHHMM,
  nextAvailableNumero,
  parseHHMMToMinutes,
  parseISODate,
  remainingForTipo,
  toISODate,
  validateOrarioArrivo,
  validateOrarioIngressoIntero,
  validateOrarioIngressoRidotto,
} from '../piscinaMappa';

describe('clamp', () => {
  it('lascia invariato un valore già dentro il range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('taglia sopra al massimo e sotto al minimo', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
  });
});

describe('toISODate / parseISODate', () => {
  it('sono simmetriche indipendentemente dal fuso orario locale del runner', () => {
    const originale = new Date(2026, 7, 5); // 5 agosto 2026, mezzanotte locale
    const iso = toISODate(originale);
    expect(iso).toBe('2026-08-05');

    const riparsata = parseISODate(iso);
    expect(toISODate(riparsata)).toBe(iso);
    expect(riparsata.getFullYear()).toBe(2026);
    expect(riparsata.getMonth()).toBe(7);
    expect(riparsata.getDate()).toBe(5);
  });

  it('padda mese e giorno a due cifre', () => {
    expect(toISODate(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('addDays / isSameDay', () => {
  it('somma giorni preservando lo stesso orario', () => {
    const base = new Date(2026, 7, 30);
    const next = addDays(base, 3);
    expect(toISODate(next)).toBe('2026-09-02');
  });

  it('isSameDay ignora l\'orario, confronta solo la data', () => {
    const mattina = new Date(2026, 7, 5, 8, 0);
    const sera = new Date(2026, 7, 5, 23, 59);
    const altroGiorno = new Date(2026, 7, 6, 0, 0);
    expect(isSameDay(mattina, sera)).toBe(true);
    expect(isSameDay(mattina, altroGiorno)).toBe(false);
  });
});

describe('formatTime / formatDateDDMMYYYY', () => {
  it('tronca "HH:MM:SS" del backend a "HH:MM"', () => {
    expect(formatTime('14:30:00')).toBe('14:30');
  });

  it('passa invariato un valore già "HH:MM"', () => {
    expect(formatTime('14:30')).toBe('14:30');
  });

  it('ritorna stringa vuota per valori assenti', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
  });

  it('converte "YYYY-MM-DD" in "DD/MM/YYYY"', () => {
    expect(formatDateDDMMYYYY('2026-08-05')).toBe('05/08/2026');
  });
});

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-08-05T12:00:00.000Z').getTime();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mostra "adesso" sotto il minuto', () => {
    expect(formatRelativeTime(new Date(NOW - 30_000).toISOString())).toBe('adesso');
  });

  it('mostra i minuti sotto l\'ora', () => {
    expect(formatRelativeTime(new Date(NOW - 5 * 60_000).toISOString())).toBe('5 min fa');
  });

  it('mostra le ore sotto il giorno', () => {
    expect(formatRelativeTime(new Date(NOW - 3 * 3_600_000).toISOString())).toBe('3 h fa');
  });

  it('distingue "1 giorno fa" dal plurale', () => {
    expect(formatRelativeTime(new Date(NOW - 24 * 3_600_000).toISOString())).toBe('1 giorno fa');
    expect(formatRelativeTime(new Date(NOW - 2 * 24 * 3_600_000).toISOString())).toBe('2 giorni fa');
  });

  it('ricade su una data assoluta oltre i 30 giorni', () => {
    const trentacinqueGiorniFa = new Date(NOW - 35 * 24 * 3_600_000);
    expect(formatRelativeTime(trentacinqueGiorniFa.toISOString())).toBe(
      formatDateDDMMYYYY(toISODate(trentacinqueGiorniFa))
    );
  });
});

describe('minutesToHHMM / parseHHMMToMinutes', () => {
  it('converte minuti in "HH:MM" con zero-padding', () => {
    expect(minutesToHHMM(5)).toBe('00:05');
    expect(minutesToHHMM(9 * 60 + 5)).toBe('09:05');
    expect(minutesToHHMM(23 * 60 + 59)).toBe('23:59');
  });

  it('fa il percorso inverso per un formato valido', () => {
    expect(parseHHMMToMinutes('14:30')).toBe(14 * 60 + 30);
    expect(parseHHMMToMinutes('9:05')).toBe(9 * 60 + 5);
  });

  it('ritorna null per un formato non valido o fuori range', () => {
    expect(parseHHMMToMinutes('non un orario')).toBeNull();
    expect(parseHHMMToMinutes('24:00')).toBeNull();
    expect(parseHHMMToMinutes('12:60')).toBeNull();
    expect(parseHHMMToMinutes('')).toBeNull();
  });
});

describe('computeDefaultOrario', () => {
  it('per una data futura ritorna sempre l\'orario base, senza clamp su "adesso"', () => {
    const domani = addDays(new Date(), 5);
    expect(computeDefaultOrario('10:00:00', domani)).toBe('10:00');
  });

  it('per oggi ricade sull\'orario attuale se la base è già passata', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 5, 15, 0));
    const oggi = new Date(2026, 7, 5);
    expect(computeDefaultOrario('08:00:00', oggi)).toBe('15:00');
    jest.useRealTimers();
  });

  it('per oggi mantiene la base se è ancora nel futuro rispetto a "adesso"', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 5, 15, 0));
    const oggi = new Date(2026, 7, 5);
    expect(computeDefaultOrario('18:00:00', oggi)).toBe('18:00');
    jest.useRealTimers();
  });

  it('non scende mai sotto orarioMinimo quando fornito', () => {
    const domani = addDays(new Date(), 5);
    expect(computeDefaultOrario('10:00:00', domani, '14:00')).toBe('14:00');
    // Se la base è già oltre la soglia, resta quella (il minimo non alza inutilmente un valore
    // già valido).
    expect(computeDefaultOrario('16:00:00', domani, '14:00')).toBe('16:00');
  });
});

describe('formatOrarioInput', () => {
  it('inserisce automaticamente i due punti dopo la seconda cifra', () => {
    expect(formatOrarioInput('', '1')).toBe('1');
    expect(formatOrarioInput('1', '14')).toBe('14');
    expect(formatOrarioInput('14', '143')).toBe('14:3');
  });

  it('scarta i caratteri non numerici e taglia oltre 4 cifre', () => {
    expect(formatOrarioInput('', '14:3a0X9')).toBe('14:30');
  });

  it('il backspace esattamente sul separatore ":" rimuove anche l\'ultima cifra', () => {
    // A video "14:3": l'utente posiziona il cursore subito dopo ":" e preme backspace,
    // cancellando SOLO quel carattere — le cifre digitate ("143") restano invariate, un solo
    // carattere in meno rispetto a "previous". Senza il ramo dedicato per questo caso, il ":"
    // verrebbe semplicemente re-inserito dal ricalcolo (digits.length > 2), dando di nuovo
    // "14:3" e facendo sembrare il backspace privo di effetto.
    expect(formatOrarioInput('14:3', '143')).toBe('14');
  });

  it('cancellare l\'ultima cifra di un orario di 2 cifre funziona normalmente', () => {
    expect(formatOrarioInput('14', '1')).toBe('1');
  });
});

describe('validateOrarioIngressoRidotto / validateOrarioIngressoIntero', () => {
  const SOGLIA = '14:00:00';

  it('nessun errore se non ci sono ingressi ridotti', () => {
    expect(validateOrarioIngressoRidotto('10:00', 0, SOGLIA)).toBeNull();
  });

  it('rifiuta un ridotto prima della soglia', () => {
    expect(validateOrarioIngressoRidotto('10:00', 2, SOGLIA)).toMatch(/ridotto pomeridiano/);
  });

  it('accetta un ridotto dalla soglia in poi', () => {
    expect(validateOrarioIngressoRidotto('14:00', 2, SOGLIA)).toBeNull();
    expect(validateOrarioIngressoRidotto('16:00', 2, SOGLIA)).toBeNull();
  });

  it('nessun errore se non ci sono ingressi interi', () => {
    expect(validateOrarioIngressoIntero('16:00', 0, SOGLIA)).toBeNull();
  });

  it('rifiuta un intero dalla soglia in poi (complementare al ridotto)', () => {
    expect(validateOrarioIngressoIntero('14:00', 2, SOGLIA)).toMatch(/ridotto pomeridiano/);
    expect(validateOrarioIngressoIntero('16:00', 2, SOGLIA)).toMatch(/ridotto pomeridiano/);
  });

  it('accetta un intero prima della soglia', () => {
    expect(validateOrarioIngressoIntero('10:00', 2, SOGLIA)).toBeNull();
  });

  it('le due validazioni sono mutuamente esclusive sullo stesso orario/soglia', () => {
    // Un orario non può violare contemporaneamente sia la regola del ridotto sia quella
    // dell'intero, altrimenti nessun orario sarebbe mai valido per nessuno dei due contatori.
    const orari = ['09:00', '13:59', '14:00', '14:01', '20:00'];
    for (const orario of orari) {
      const erroreRidotto = validateOrarioIngressoRidotto(orario, 1, SOGLIA);
      const erroreIntero = validateOrarioIngressoIntero(orario, 1, SOGLIA);
      expect(erroreRidotto === null || erroreIntero === null).toBe(true);
    }
  });
});

describe('validateOrarioArrivo', () => {
  it('rifiuta un valore vuoto', () => {
    const result = validateOrarioArrivo('', new Date());
    expect(result.valid).toBe(false);
  });

  it('rifiuta un formato non valido', () => {
    const result = validateOrarioArrivo('non un orario', new Date());
    expect(result.valid).toBe(false);
  });

  it('accetta un orario futuro per una data non odierna, anche se "nel passato" in assoluto', () => {
    const ieri = addDays(new Date(), -1);
    const result = validateOrarioArrivo('00:01', ieri);
    expect(result.valid).toBe(true);
  });

  it('rifiuta un orario già passato per la data odierna', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 5, 20, 0));
    const result = validateOrarioArrivo('08:00', new Date(2026, 7, 5));
    expect(result.valid).toBe(false);
    jest.useRealTimers();
  });

  it('accetta un orario futuro per la data odierna', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 5, 8, 0));
    const result = validateOrarioArrivo('20:00', new Date(2026, 7, 5));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.minutes).toBe(20 * 60);
    }
    jest.useRealTimers();
  });
});

describe('nextAvailableNumero', () => {
  it('ritorna 1 se non ci sono postazioni', () => {
    expect(nextAvailableNumero([])).toBe(1);
  });

  it('ritorna il primo numero libero, non il massimo + 1', () => {
    expect(nextAvailableNumero([{ numero: 1 }, { numero: 2 }, { numero: 4 }])).toBe(3);
  });

  it('ignora l\'ordine di inserimento delle postazioni', () => {
    expect(nextAvailableNumero([{ numero: 3 }, { numero: 1 }])).toBe(2);
  });
});

describe('remainingForTipo', () => {
  const residui = { ombrellone: 2, gazebo: 0, lettino: 5, sdraia: 5 };

  it('ritorna 0 se i residui sono undefined (nessuna prenotazione collegata)', () => {
    expect(remainingForTipo(undefined, 'OMBRELLONE')).toBe(0);
  });

  it('legge il campo giusto in base al tipo', () => {
    expect(remainingForTipo(residui, 'OMBRELLONE')).toBe(2);
    expect(remainingForTipo(residui, 'GAZEBO')).toBe(0);
  });
});

describe('formatIngressiSummary', () => {
  it('mostra sempre gli interi, anche a 0', () => {
    expect(
      formatIngressiSummary({ ingressi: 0, ingressi_ridotti: 0, ingressi_bambini: 0, ingressi_gratuiti: 0 })
    ).toBe('🎟️ 0');
  });

  it('aggiunge le altre tariffe solo se > 0, nell\'ordine ridotti/bambini/gratuiti', () => {
    expect(
      formatIngressiSummary({ ingressi: 2, ingressi_ridotti: 1, ingressi_bambini: 0, ingressi_gratuiti: 3 })
    ).toBe('🎟️ 2 🌇 1 🆓 3');
  });
});
