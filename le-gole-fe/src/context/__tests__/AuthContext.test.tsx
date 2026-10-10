import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));
jest.mock('../../utils/push', () => ({
  registraDispositivoPush: jest.fn(() => Promise.resolve()),
  rimuoviDispositivoPush: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../utils/storage', () => ({
  getAccessToken: jest.fn(),
  saveTokens: jest.fn(() => Promise.resolve()),
  clearTokens: jest.fn(() => Promise.resolve()),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const apiModule = require('../../services/api');
const push = require('../../utils/push');
const storage = require('../../utils/storage');
/* eslint-enable @typescript-eslint/no-require-imports */
const api = apiModule.default;

const PROFILO = { id: 'u1', username: 'mario', email: 'm@x.it', is_superuser: false, is_active: true };

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  storage.getAccessToken.mockResolvedValue(null);
  api.get.mockResolvedValue({ data: PROFILO });
  api.post.mockResolvedValue({ data: { access: 'a', refresh: 'r' } });
});

describe('AuthContext', () => {
  it('senza token salvato parte non autenticato', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('con un token salvato ripristina la sessione e registra il dispositivo push', async () => {
    storage.getAccessToken.mockResolvedValue('token');
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(PROFILO);
    expect(api.get).toHaveBeenCalledWith('/v1/users/staff/me/');
    expect(push.registraDispositivoPush).toHaveBeenCalled();
  });

  it('un token non più valido viene scartato', async () => {
    storage.getAccessToken.mockResolvedValue('token-scaduto');
    api.get.mockRejectedValue(new Error('401'));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(storage.clearTokens).toHaveBeenCalled();
  });

  it('login salva i token e carica il profilo; logout rimuove prima il dispositivo', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('mario', 'segreta');
    });
    expect(api.post).toHaveBeenCalledWith('/v1/users/login/', { username: 'mario', password: 'segreta' });
    expect(storage.saveTokens).toHaveBeenCalledWith('a', 'r');
    expect(result.current.isAuthenticated).toBe(true);

    const ordine: string[] = [];
    push.rimuoviDispositivoPush.mockImplementation(async () => ordine.push('dispositivo'));
    storage.clearTokens.mockImplementation(async () => ordine.push('token'));
    await act(async () => {
      await result.current.logout();
    });
    expect(ordine).toEqual(['dispositivo', 'token']);
    expect(result.current.user).toBeNull();
  });

  it('una sessione scaduta lato server azzera l’utente', async () => {
    storage.getAccessToken.mockResolvedValue('token');
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    const handler = apiModule.setSessionExpiredHandler.mock.calls[0][0];
    await act(async () => {
      handler();
    });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('fuori dal provider lancia un errore esplicito', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useAuth())).rejects.toThrow('AuthProvider');
  });
});
