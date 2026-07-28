import { Platform } from 'react-native';

// Apre/scarica il biglietto PDF della prenotazione piscina (GET .../scarica_biglietto/,
// pubblico via UUID — vedi getBigliettoUrl in services/prenotazioni.ts). Su web il browser
// gestisce da solo il download grazie all'header Content-Disposition: attachment restituito dal
// backend, quindi basta aprire l'URL. Su nativo (iOS/Android) non esiste un "download del
// browser": scarichiamo il file in una directory temporanea con expo-file-system e apriamo il
// foglio di condivisione di sistema (expo-sharing), da cui l'utente può salvarlo o aprirlo con
// un'app PDF.
export async function apriBigliettoPdf(url: string, prenotazioneId: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
    return;
  }

  const [{ File, Paths }, Sharing] = await Promise.all([
    import('expo-file-system'),
    import('expo-sharing'),
  ]);

  const destinazione = new File(Paths.cache, `biglietto_${prenotazioneId}.pdf`);
  const file = await File.downloadFileAsync(url, destinazione, { idempotent: true });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }
}
