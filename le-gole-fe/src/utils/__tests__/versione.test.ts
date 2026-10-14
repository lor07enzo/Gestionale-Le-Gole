import { confrontaVersioni, richiedeAggiornamento } from '../versione';

describe('confrontaVersioni', () => {
  it.each([
    ['1.2.0', '1.2.0', 0],
    ['1.2', '1.2.0', 0],
    ['1.2.1', '1.2.0', 1],
    ['1.2.0', '1.3.0', -1],
    ['1.10.0', '1.9.0', 1],
    ['2.0.0', '1.99.99', 1],
    [' 1.2.0 ', '1.2.0', 0],
  ])('%s contro %s → %d', (a, b, atteso) => {
    expect(confrontaVersioni(a, b)).toBe(atteso);
  });
});

describe('richiedeAggiornamento', () => {
  it('blocca solo sotto la minima', () => {
    expect(richiedeAggiornamento('1.2.0', '1.3.0')).toBe(true);
    expect(richiedeAggiornamento('1.3.0', '1.3.0')).toBe(false);
    expect(richiedeAggiornamento('1.4.0', '1.3.0')).toBe(false);
  });

  it('il default 0.0.0 non blocca mai', () => {
    expect(richiedeAggiornamento('1.0.0', '0.0.0')).toBe(false);
  });
});
