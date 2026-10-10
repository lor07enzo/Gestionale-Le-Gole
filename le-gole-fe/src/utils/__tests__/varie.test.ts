import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { ZodError, z } from 'zod';
import { dateToMap, addMonths, addWeeks, buildMonthGrid, buildWeekGrid, formatMonthLabel, formatWeekLabel, startOfMonth, startOfWeek } from '../calendar';
import { chiediConferma, mostraErrore } from '../dialog';
import { extractErrorMessage } from '../errors';
import { goBackOr } from '../navigation';
import { formatPrezzo, PREZZO_ITEMS } from '../prezzi';
import { formatZodErrors } from '../zodErrors';
import { apriBigliettoPdf } from '../biglietto';
import { forgotPasswordSchema, setPasswordSchema } from '../../schemas/auth';
import { staffSchema } from '../../schemas/staff';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('extractErrorMessage', () => {
  const err = (data: unknown) => ({ response: { data } });

  it('preferisce detail', () => {
    expect(extractErrorMessage(err({ detail: 'Non autorizzato.' }), 'x')).toBe('Non autorizzato.');
  });

  it('concatena i messaggi per campo ignorando i valori non stringa', () => {
    expect(extractErrorMessage(err({ ora: ['Fuori orario.'], quantita: 'Troppi.', extra: { a: 1 } }), 'x')).toBe(
      'Fuori orario. Troppi.'
    );
  });

  it('ricade sul fallback per errori non DRF o senza messaggi', () => {
    expect(extractErrorMessage(new Error('rete'), 'fallback')).toBe('fallback');
    expect(extractErrorMessage(err({ campo: [{}] }), 'fallback')).toBe('fallback');
    expect(extractErrorMessage(err(null), 'fallback')).toBe('fallback');
    expect(extractErrorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('formatPrezzo', () => {
  it('toglie i centesimi a zero e usa la virgola italiana', () => {
    expect(formatPrezzo('8.00')).toBe('8');
    expect(formatPrezzo('4.5')).toBe('4,50');
    expect(formatPrezzo('n/d')).toBe('n/d');
  });

  it('le tariffe opzionali sono marcate hideIfZero, le risorse legate al totale', () => {
    expect(PREZZO_ITEMS.filter((item) => item.hideIfZero).map((item) => item.prezzoKey)).toEqual([
      'prezzo_ingresso_ridotto',
      'prezzo_ingresso_bambino',
    ]);
  });
});

describe('schemi zod e formatZodErrors', () => {
  const errori = (schema: z.ZodTypeAny, valore: unknown) => {
    const esito = schema.safeParse(valore);
    return esito.success ? {} : formatZodErrors(esito.error);
  };

  it('tiene solo il primo messaggio per campo', () => {
    const errore = new ZodError([
      { code: 'custom', path: ['email'], message: 'primo' },
      { code: 'custom', path: ['email'], message: 'secondo' },
      { code: 'custom', path: [], message: 'globale' },
    ]);
    expect(formatZodErrors(errore)).toEqual({ email: 'primo' });
  });

  it('password: lunghezza minima e conferma', () => {
    expect(errori(setPasswordSchema, { password: 'corta', confirmPassword: 'corta' })).toHaveProperty('password');
    expect(errori(setPasswordSchema, { password: 'abbastanza', confirmPassword: 'diversa!' })).toEqual({
      confirmPassword: 'Le password non coincidono.',
    });
    expect(errori(setPasswordSchema, { password: 'abbastanza', confirmPassword: 'abbastanza' })).toEqual({});
  });

  it('email e username staff', () => {
    expect(errori(forgotPasswordSchema, { email: 'non-una-mail' })).toHaveProperty('email');
    expect(errori(forgotPasswordSchema, { email: ' a@b.it ' })).toEqual({});
    expect(errori(staffSchema, { username: 'ab', email: 'a@b.it' })).toHaveProperty('username');
    expect(errori(staffSchema, { username: 'mario', email: 'a@b.it' })).toEqual({});
  });
});

describe('goBackOr', () => {
  it('torna indietro se c’è uno stack, altrimenti sostituisce con il fallback', () => {
    (router.canGoBack as jest.Mock).mockReturnValueOnce(true).mockReturnValueOnce(false);
    goBackOr('/cliente');
    goBackOr('/cliente');
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/cliente');
  });
});

describe('dialog cross-platform', () => {
  it('su web usa i dialog del browser', () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false);
    const onConferma = jest.fn();

    mostraErrore('Qualcosa è andato storto');
    chiediConferma('Titolo', 'Sicuro?', 'Sì', onConferma);
    chiediConferma('Titolo', 'Sicuro?', 'Sì', onConferma);

    expect(alert).toHaveBeenCalledWith('Qualcosa è andato storto');
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onConferma).toHaveBeenCalledTimes(1);
  });

  it('su nativo usa Alert.alert, con il pulsante di conferma distruttivo', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onConferma = jest.fn();

    mostraErrore('Errore di rete');
    chiediConferma('Annullare?', 'Sicuro?', 'Annulla ordine', onConferma);

    expect(alert).toHaveBeenNthCalledWith(1, 'Errore', 'Errore di rete');
    const pulsanti = alert.mock.calls[1][2] as Array<{ text: string; style: string; onPress?: () => void }>;
    expect(pulsanti.map((p) => p.style)).toEqual(['cancel', 'destructive']);
    pulsanti[1].onPress?.();
    expect(onConferma).toHaveBeenCalled();
  });
});

describe('apriBigliettoPdf', () => {
  it('su web apre l’URL in una nuova scheda', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    await apriBigliettoPdf('https://api/biglietto.pdf', 'p1');
    expect(open).toHaveBeenCalledWith('https://api/biglietto.pdf', '_blank');
  });
});

describe('calendario', () => {
  it('dateToMap marca le date ricevute dal backend', () => {
    expect(dateToMap(['2026-09-01', '2026-09-03'])).toEqual({ '2026-09-01': true, '2026-09-03': true });
    expect(dateToMap([])).toEqual({});
  });

  it('la griglia mensile parte di lunedì e copre settimane intere', () => {
    const griglia = buildMonthGrid(startOfMonth(new Date(2026, 8, 17)));
    expect(griglia.length % 7).toBe(0);
    expect(griglia[0].date.getDay()).toBe(1);
    expect(griglia.filter((g) => g.inCurrentMonth)).toHaveLength(30);
  });

  it('la settimana parte di lunedì e ha sette giorni del mese corrente', () => {
    const inizio = startOfWeek(new Date(2026, 8, 17));
    expect(inizio.getDay()).toBe(1);
    expect(buildWeekGrid(inizio)).toHaveLength(7);
    expect(addWeeks(inizio, 1).getDate()).toBe(inizio.getDate() + 7);
  });

  it('etichette di mese e settimana in italiano', () => {
    expect(formatMonthLabel(new Date(2026, 8, 1))).toMatch(/^Settembre 2026$/i);
    expect(addMonths(new Date(2026, 11, 15), 1)).toEqual(new Date(2027, 0, 1));
    expect(formatWeekLabel(new Date(2026, 8, 28))).toMatch(/28 .* 4 ott/i);
  });
});
