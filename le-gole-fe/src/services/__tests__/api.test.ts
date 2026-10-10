import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import api, { setSessionExpiredHandler } from '../api';

jest.mock('../../utils/storage', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveTokens: jest.fn(() => Promise.resolve()),
  saveAccessToken: jest.fn(() => Promise.resolve()),
  clearTokens: jest.fn(() => Promise.resolve()),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('../../utils/storage');

// Adapter finto: niente rete, risponde in base all'header Authorization ricevuto.
type Risposta = { status: number; data?: unknown };
let rispondi: (config: InternalAxiosRequestConfig) => Risposta;
const richieste: InternalAxiosRequestConfig[] = [];

const adapter: AxiosAdapter = async (config) => {
  richieste.push(config);
  const { status, data } = rispondi(config);
  const response = { status, data, statusText: '', headers: {}, config };
  if (status >= 400) {
    throw new AxiosError('errore', String(status), config, null, response);
  }
  return response;
};

const bearer = (config: InternalAxiosRequestConfig) => config.headers.get('Authorization');

beforeAll(() => {
  api.defaults.adapter = adapter;
});

beforeEach(() => {
  jest.clearAllMocks();
  richieste.length = 0;
  storage.getAccessToken.mockResolvedValue('access-vecchio');
  storage.getRefreshToken.mockResolvedValue('refresh-1');
  // Come lo storage reale: il token appena salvato è quello che la richiesta ripetuta rilegge.
  storage.saveTokens.mockImplementation(async (access: string) => storage.getAccessToken.mockResolvedValue(access));
  storage.saveAccessToken.mockImplementation(async (access: string) => storage.getAccessToken.mockResolvedValue(access));
  setSessionExpiredHandler(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('interceptor della richiesta', () => {
  it('aggiunge il Bearer se c’è un token, altrimenti nulla', async () => {
    rispondi = () => ({ status: 200, data: 'ok' });
    await api.get('/v1/qualcosa/');
    storage.getAccessToken.mockResolvedValue(null);
    await api.get('/v1/qualcosa/');

    expect(bearer(richieste[0])).toBe('Bearer access-vecchio');
    expect(bearer(richieste[1])).toBeUndefined();
  });
});

describe('interceptor della risposta', () => {
  it('su 401 rinnova il token (rotazione del refresh inclusa) e ripete la richiesta', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'access-nuovo', refresh: 'refresh-2' } });
    rispondi = (config) => (bearer(config) === 'Bearer access-nuovo' ? { status: 200, data: 'ok' } : { status: 401 });

    const response = await api.get('/v1/protetta/');

    expect(response.data).toBe('ok');
    expect(storage.saveTokens).toHaveBeenCalledWith('access-nuovo', 'refresh-2');
    expect(richieste).toHaveLength(2);
  });

  it('senza nuovo refresh nella risposta salva solo il token di accesso', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'access-nuovo' } });
    rispondi = (config) => (bearer(config) === 'Bearer access-nuovo' ? { status: 200 } : { status: 401 });

    await api.get('/v1/protetta/');
    expect(storage.saveAccessToken).toHaveBeenCalledWith('access-nuovo');
  });

  it('se il refresh fallisce pulisce i token e avvisa l’app della sessione scaduta', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('refresh scaduto'));
    const onScaduta = jest.fn();
    setSessionExpiredHandler(onScaduta);
    rispondi = () => ({ status: 401 });

    await expect(api.get('/v1/protetta/')).rejects.toBeInstanceOf(AxiosError);
    expect(storage.clearTokens).toHaveBeenCalled();
    expect(onScaduta).toHaveBeenCalled();
  });

  it('senza refresh token salvato non tenta nemmeno il rinnovo', async () => {
    storage.getRefreshToken.mockResolvedValue(null);
    const post = jest.spyOn(axios, 'post');
    rispondi = () => ({ status: 401 });

    await expect(api.get('/v1/protetta/')).rejects.toBeInstanceOf(AxiosError);
    expect(post).not.toHaveBeenCalled();
    expect(storage.clearTokens).toHaveBeenCalled();
  });

  it('non tenta il refresh per errori diversi da 401 né per il login stesso', async () => {
    const post = jest.spyOn(axios, 'post');
    rispondi = () => ({ status: 500 });
    await expect(api.get('/v1/rotta/')).rejects.toBeInstanceOf(AxiosError);

    rispondi = () => ({ status: 401 });
    await expect(api.post('/v1/users/login/', {})).rejects.toBeInstanceOf(AxiosError);

    expect(post).not.toHaveBeenCalled();
    expect(storage.clearTokens).not.toHaveBeenCalled();
  });
});
