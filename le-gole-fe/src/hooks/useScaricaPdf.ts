import { useCallback, useState } from 'react';
import { apriBigliettoPdf } from '../utils/biglietto';

// Stato di un pulsante "Scarica biglietto/ricevuta (PDF)": spinner durante il download e un
// messaggio d'errore se fallisce. Lo stesso blocco try/finally era ripetuto in ogni pagina che
// offre un PDF (conferme self-service e dettagli dello storico).
export function useScaricaPdf(messaggioErrore = 'Impossibile scaricare il documento. Riprova.') {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scarica = useCallback(
    async (url: string, prenotazioneId: string, filePrefix?: string) => {
      setIsDownloading(true);
      setError(null);
      try {
        await apriBigliettoPdf(url, prenotazioneId, filePrefix);
      } catch {
        setError(messaggioErrore);
      } finally {
        setIsDownloading(false);
      }
    },
    [messaggioErrore],
  );

  return { isDownloading, error, scarica };
}
