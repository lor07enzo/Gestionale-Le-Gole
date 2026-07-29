import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const NOTIFICHE_LAST_SEEN_KEY = 'staffNotificheLastSeenAt';

// expo-secure-store non ha alcuna implementazione sul web (Keychain/Keystore non esistono nel browser):
// su web usiamo localStorage come fallback, accettabile perché lì non esiste comunque uno storage "sicuro" via JS.
function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return Promise.resolve(localStorage.getItem(key));
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_TOKEN_KEY);
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([setItem(ACCESS_TOKEN_KEY, accessToken), setItem(REFRESH_TOKEN_KEY, refreshToken)]);
}

export function saveAccessToken(accessToken: string): Promise<void> {
  return setItem(ACCESS_TOKEN_KEY, accessToken);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY)]);
}

// Timestamp ISO dell'ultima volta che lo staff ha aperto il pannello notifiche prenotazioni
// (StaffNotificationsContext) — persistito perché un refresh della pagina (frequente su web,
// il target attuale, sezione 8) non deve far ricomparire come "nuove" prenotazioni già viste.
export function getNotificheLastSeenAt(): Promise<string | null> {
  return getItem(NOTIFICHE_LAST_SEEN_KEY);
}

export function saveNotificheLastSeenAt(isoTimestamp: string): Promise<void> {
  return setItem(NOTIFICHE_LAST_SEEN_KEY, isoTimestamp);
}
