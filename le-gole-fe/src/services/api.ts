import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearTokens, getAccessToken, getRefreshToken, saveAccessToken, saveTokens } from '../utils/storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

const LOGIN_PATH = '/v1/users/login/';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Registrato dall'AuthContext: avvisa l'app quando il refresh token non è più valido
// (es. scaduto dopo 60 giorni) cosicché lo stato utente venga ripulito.
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Le richieste 401 concorrenti condividono la stessa promise di refresh,
// così viene effettuata una sola chiamata di refresh anche in caso di più richieste in parallelo.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post(`${API_BASE_URL}${LOGIN_PATH}refresh/`, {
      refresh: refreshToken,
    });
    const { access, refresh } = response.data as { access: string; refresh?: string };

    // ROTATE_REFRESH_TOKENS è attivo lato backend: ogni refresh restituisce un nuovo refresh token da salvare.
    if (refresh) {
      await saveTokens(access, refresh);
    } else {
      await saveAccessToken(access);
    }
    return access;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    const isAuthEndpoint = originalRequest?.url?.includes(LOGIN_PATH) ?? false;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newAccessToken = await refreshPromise;

    if (!newAccessToken) {
      await clearTokens();
      onSessionExpired?.();
      return Promise.reject(error);
    }

    originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
    return api(originalRequest);
  }
);

export default api;
