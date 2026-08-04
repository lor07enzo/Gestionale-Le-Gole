import { Platform } from 'react-native';

// Su web basta aprire l'URL (il browser gestisce il download via Content-Disposition). Su
// nativo scarichiamo il file e apriamo il foglio di condivisione di sistema (expo-sharing).
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
