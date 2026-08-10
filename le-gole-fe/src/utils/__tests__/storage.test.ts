// Suite eseguita sotto il preset jest-expo/web (jsdom + react-native -> react-native-web,
// sezione 9 di CLAUDE.md): Platform.OS risolve già a 'web', quindi storage.ts usa il ramo
// localStorage senza bisogno di mockare esplicitamente react-native/expo-secure-store.
import {
  clearTokens,
  getAccessToken,
  getNotificheLetteIds,
  getRefreshToken,
  saveAccessToken,
  saveNotificheLetteIds,
  saveTokens,
} from '../storage';

beforeEach(() => {
  localStorage.clear();
});

describe('token storage', () => {
  it('non ritorna nulla prima di un primo salvataggio', async () => {
    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('salva e rilegge la coppia access/refresh', async () => {
    await saveTokens('access-123', 'refresh-456');
    expect(await getAccessToken()).toBe('access-123');
    expect(await getRefreshToken()).toBe('refresh-456');
  });

  it('saveAccessToken aggiorna solo il token di accesso (usato dal refresh silenzioso)', async () => {
    await saveTokens('access-vecchio', 'refresh-invariato');
    await saveAccessToken('access-nuovo');
    expect(await getAccessToken()).toBe('access-nuovo');
    expect(await getRefreshToken()).toBe('refresh-invariato');
  });

  it('clearTokens rimuove entrambi i token', async () => {
    await saveTokens('access-123', 'refresh-456');
    await clearTokens();
    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });
});

describe('notifiche lette ids', () => {
  it('ritorna un array vuoto se non è mai stato salvato nulla', async () => {
    expect(await getNotificheLetteIds()).toEqual([]);
  });

  it('salva e rilegge la lista di id', async () => {
    await saveNotificheLetteIds(['a', 'b', 'c']);
    expect(await getNotificheLetteIds()).toEqual(['a', 'b', 'c']);
  });

  it('ritorna un array vuoto se il valore salvato non è JSON valido', async () => {
    localStorage.setItem('staffNotificheLetteIds', 'non-è-json{{{');
    expect(await getNotificheLetteIds()).toEqual([]);
  });

  it('ritorna un array vuoto se il JSON salvato non è un array', async () => {
    localStorage.setItem('staffNotificheLetteIds', JSON.stringify({ a: 1 }));
    expect(await getNotificheLetteIds()).toEqual([]);
  });

  it('un salvataggio successivo sovrascrive per intero la lista precedente', async () => {
    await saveNotificheLetteIds(['a']);
    await saveNotificheLetteIds(['a', 'b']);
    expect(await getNotificheLetteIds()).toEqual(['a', 'b']);
  });
});
