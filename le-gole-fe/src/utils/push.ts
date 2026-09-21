import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import api from '../services/api';
import { clearPushToken, getPushToken, savePushToken } from './storage';

/**
 * Notifiche push di sistema per lo staff.
 *
 * Perché servono: il pannello notifiche in-app (sezione 11 di CLAUDE.md) è un polling ogni 20
 * secondi che vive solo mentre l'app è in primo piano — in background il timer JS viene sospeso e
 * a telefono bloccato non arriva nulla. Finché il rilascio era solo web non era un difetto.
 *
 * Tutto qui dentro è **best effort**: una registrazione fallita non deve mai impedire il login né
 * mostrare un errore: lo staff resta con il polling in-app di sempre, che continua a funzionare.
 */

// Deve combaciare con users/push.py (CANALE_ANDROID): su Android 8+ una notifica che punta a un
// canale inesistente viene scartata dal sistema senza alcun errore visibile.
const CANALE_ANDROID = 'prenotazioni';

export type DatiNotifica = {
  categoria?: string;
  prenotazioneId?: string;
  inventarioId?: string;
  data?: string;
};

/**
 * Con l'app già aperta il sistema non mostrerebbe nulla di default: qui si chiede di mostrare
 * comunque banner e suono, così una prenotazione che arriva mentre lo staff sta usando l'app non
 * passa inosservata (il badge del pannello in-app si aggiorna solo al polling successivo).
 */
export function configuraNotificheInPrimoPiano(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Rotta da aprire quando lo staff tocca una notifica. Funzione pura e separata dal resto proprio
 * per poter essere testata: è l'unico pezzo con una logica che può sbagliarsi in silenzio.
 *
 * `null` quando i dati non bastano a costruire una destinazione sensata — meglio restare dove si
 * è che mandare lo staff su una schermata di errore.
 */
export function percorsoDaNotifica(dati: DatiNotifica | undefined | null): string | null {
  if (!dati?.prenotazioneId) return null;

  switch (dati.categoria) {
    case 'PISCINA':
      // La mappa piscina è per (inventario, giorno): senza entrambi non saprebbe cosa mostrare.
      if (!dati.inventarioId || !dati.data) return null;
      return `/staff/piscina/${dati.inventarioId}?data=${dati.data}`;
    case 'ASPORTO':
      return `/staff/asporto/ordini/${dati.prenotazioneId}`;
    case 'PADEL':
      return `/staff/padel/prenotazioni/${dati.prenotazioneId}`;
    default:
      return null;
  }
}

/**
 * Chiede il permesso, ricava il token Expo e lo registra sul backend.
 *
 * Non fa nulla su web (i push del browser richiedono una configurazione VAPID che questo progetto
 * non ha) né su un emulatore, dove non esiste un token reale da ottenere.
 */
export async function registraDispositivoPush(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANALE_ANDROID, {
        name: 'Prenotazioni',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const permesso = await richiediPermesso();
    if (!permesso) return;

    // projectId è obbligatorio per getExpoPushTokenAsync da SDK 49: senza, Expo non sa a quale
    // progetto associare il token.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await api.post('/v1/users/dispositivi/', {
      token,
      piattaforma: Platform.OS,
    });
    await savePushToken(token);
  } catch {
    // Permesso negato, servizi Google mancanti, rete assente: lo staff resta col polling in-app.
  }
}

async function richiediPermesso(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;

  // Su Android il prompt si può mostrare una volta sola: se l'utente ha già negato, richiedere
  // non riapre nulla e si limita a restituire lo stesso esito.
  const richiesta = await Notifications.requestPermissionsAsync();
  return richiesta.status === 'granted';
}

/**
 * Da chiamare al logout **prima** di scartare i token JWT: senza autenticazione il backend
 * rifiuterebbe la richiesta e il dispositivo continuerebbe a ricevere notifiche di un account con
 * cui non è più connesso.
 */
export async function rimuoviDispositivoPush(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const token = await getPushToken();
    if (!token) return;

    await api.post('/v1/users/dispositivi/rimuovi/', { token });
  } catch {
    // Rete assente o sessione già scaduta: il token resta registrato lato backend finché non
    // verrà riassegnato al prossimo login su questo stesso dispositivo (upsert per token).
  } finally {
    await clearPushToken();
  }
}

/**
 * Registra il gestore del tap su una notifica e restituisce la funzione per smontarlo.
 *
 * `getLastNotificationResponseAsync` copre il caso dell'app **chiusa**: lì il tap è ciò che l'ha
 * avviata, quindi il listener non esisteva ancora quando l'evento è stato emesso.
 */
export function ascoltaTapNotifica(vaiA: (percorso: string) => void): () => void {
  let attivo = true;

  Notifications.getLastNotificationResponseAsync()
    .then((risposta) => {
      if (!attivo || !risposta) return;
      const percorso = percorsoDaNotifica(risposta.notification.request.content.data as DatiNotifica);
      if (percorso) vaiA(percorso);
    })
    .catch(() => {
      // Nessuna notifica di avvio da gestire.
    });

  const sottoscrizione = Notifications.addNotificationResponseReceivedListener((risposta) => {
    const percorso = percorsoDaNotifica(risposta.notification.request.content.data as DatiNotifica);
    if (percorso) vaiA(percorso);
  });

  return () => {
    attivo = false;
    sottoscrizione.remove();
  };
}
