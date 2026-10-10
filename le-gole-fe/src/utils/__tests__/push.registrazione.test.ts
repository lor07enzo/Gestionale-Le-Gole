import { Platform } from 'react-native';

// Registrazione/rimozione del dispositivo: tutto è best effort, quindi i casi che contano sono
// quelli in cui qualcosa va storto e la funzione NON deve lanciare né bloccare il login/logout.

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));
let mockIsDevice = true;
jest.mock('expo-device', () => ({
  __esModule: true,
  get isDevice() {
    return mockIsDevice;
  },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'progetto-1' } } }, easConfig: null },
}));
jest.mock('../../services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../storage', () => ({
  getPushToken: jest.fn(),
  savePushToken: jest.fn(() => Promise.resolve()),
  clearPushToken: jest.fn(() => Promise.resolve()),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const Notifications = require('expo-notifications');
const api = require('../../services/api').default;
const storage = require('../storage');
/* eslint-enable @typescript-eslint/no-require-imports */

import {
  ascoltaTapNotifica,
  configuraNotificheInPrimoPiano,
  registraDispositivoPush,
  rimuoviDispositivoPush,
} from '../push';

function impostaPiattaforma(os: string) {
  jest.replaceProperty(Platform, 'OS', os as typeof Platform.OS);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDevice = true;
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  api.post.mockResolvedValue({ data: {} });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('registraDispositivoPush', () => {
  it('su Android crea il canale, registra il token sul backend e lo salva', async () => {
    impostaPiattaforma('android');
    await registraDispositivoPush();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('prenotazioni', expect.any(Object));
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'progetto-1' });
    expect(api.post).toHaveBeenCalledWith('/v1/users/dispositivi/', {
      token: 'ExponentPushToken[abc]',
      piattaforma: 'android',
    });
    expect(storage.savePushToken).toHaveBeenCalledWith('ExponentPushToken[abc]');
  });

  it('non fa nulla su web né su un emulatore', async () => {
    impostaPiattaforma('web');
    await registraDispositivoPush();
    impostaPiattaforma('ios');
    mockIsDevice = false;
    await registraDispositivoPush();

    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('chiede il permesso se non già concesso, e si ferma se viene negato', async () => {
    impostaPiattaforma('ios');
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await registraDispositivoPush();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('non lancia se il backend rifiuta la registrazione', async () => {
    impostaPiattaforma('ios');
    api.post.mockRejectedValue(new Error('rete'));

    await expect(registraDispositivoPush()).resolves.toBeUndefined();
    expect(storage.savePushToken).not.toHaveBeenCalled();
  });
});

describe('rimuoviDispositivoPush', () => {
  it('comunica al backend il token salvato e poi lo cancella', async () => {
    impostaPiattaforma('android');
    storage.getPushToken.mockResolvedValue('ExponentPushToken[abc]');

    await rimuoviDispositivoPush();

    expect(api.post).toHaveBeenCalledWith('/v1/users/dispositivi/rimuovi/', { token: 'ExponentPushToken[abc]' });
    expect(storage.clearPushToken).toHaveBeenCalled();
  });

  it('cancella comunque il token locale anche se il backend fallisce', async () => {
    impostaPiattaforma('android');
    storage.getPushToken.mockResolvedValue('ExponentPushToken[abc]');
    api.post.mockRejectedValue(new Error('401'));

    await expect(rimuoviDispositivoPush()).resolves.toBeUndefined();
    expect(storage.clearPushToken).toHaveBeenCalled();
  });

  it('senza token salvato non chiama il backend; su web non fa nulla', async () => {
    impostaPiattaforma('android');
    storage.getPushToken.mockResolvedValue(null);
    await rimuoviDispositivoPush();
    impostaPiattaforma('web');
    await rimuoviDispositivoPush();

    expect(api.post).not.toHaveBeenCalled();
    expect(storage.clearPushToken).toHaveBeenCalledTimes(1);
  });
});

describe('ascoltaTapNotifica', () => {
  const rispostaPer = (data: object) => ({ notification: { request: { content: { data } } } });

  it('naviga sia per la notifica che ha avviato l’app sia per i tap successivi', async () => {
    const remove = jest.fn();
    let listener: (r: unknown) => void = () => {};
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(
      rispostaPer({ categoria: 'ASPORTO', prenotazioneId: 'o1' })
    );
    Notifications.addNotificationResponseReceivedListener.mockImplementation((cb: (r: unknown) => void) => {
      listener = cb;
      return { remove };
    });
    const vaiA = jest.fn();

    const smonta = ascoltaTapNotifica(vaiA);
    await Promise.resolve();
    await Promise.resolve();
    listener(rispostaPer({ categoria: 'PADEL', prenotazioneId: 'g1' }));
    listener(rispostaPer({ categoria: 'SCONOSCIUTA', prenotazioneId: 'x' }));
    smonta();

    expect(vaiA.mock.calls).toEqual([['/staff/asporto/ordini/o1'], ['/staff/padel/prenotazioni/g1']]);
    expect(remove).toHaveBeenCalled();
  });

  it('ignora la notifica di avvio se il listener è già stato smontato', async () => {
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(
      rispostaPer({ categoria: 'ASPORTO', prenotazioneId: 'o1' })
    );
    Notifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
    const vaiA = jest.fn();

    ascoltaTapNotifica(vaiA)();
    await Promise.resolve();
    await Promise.resolve();

    expect(vaiA).not.toHaveBeenCalled();
  });
});

it('configuraNotificheInPrimoPiano mostra banner e suono anche ad app aperta', async () => {
  configuraNotificheInPrimoPiano();
  const handler = Notifications.setNotificationHandler.mock.calls[0][0];
  await expect(handler.handleNotification()).resolves.toMatchObject({ shouldShowBanner: true, shouldPlaySound: true });
});

describe('Expo Go su Android (push remoti rimossi da SDK 53)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Constants = require('expo-constants').default;

  beforeEach(() => {
    impostaPiattaforma('android');
    Constants.executionEnvironment = 'storeClient';
  });
  afterEach(() => {
    delete Constants.executionEnvironment;
  });

  it('non tocca expo-notifications e non lancia', async () => {
    configuraNotificheInPrimoPiano();
    const smonta = ascoltaTapNotifica(jest.fn());
    await registraDispositivoPush();
    smonta();

    expect(Notifications.setNotificationHandler).not.toHaveBeenCalled();
    expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
