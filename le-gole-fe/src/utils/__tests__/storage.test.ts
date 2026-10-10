// Platform.OS risolve a 'web' sotto jest-expo/web: storage.ts usa il ramo localStorage, salvo
// dove il test forza esplicitamente una piattaforma nativa.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  clearPushToken,
  clearTokens,
  getAccessToken,
  getNotificheLetteIds,
  getPushToken,
  getRefreshToken,
  saveAccessToken,
  saveNotificheLetteIds,
  savePushToken,
  saveTokens,
} from '../storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve('dal-keychain')),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('push token', () => {
  it('salva, rilegge e cancella il token dell’installazione', async () => {
    expect(await getPushToken()).toBeNull();
    await savePushToken('ExponentPushToken[abc]');
    expect(await getPushToken()).toBe('ExponentPushToken[abc]');
    await clearPushToken();
    expect(await getPushToken()).toBeNull();
  });
});

describe('su nativo usa il keychain (expo-secure-store), mai localStorage', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('legge, scrive e cancella tramite SecureStore', async () => {
    expect(await getAccessToken()).toBe('dal-keychain');
    await saveTokens('a', 'r');
    await clearTokens();

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('accessToken');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('accessToken', 'a');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', 'r');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });
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
