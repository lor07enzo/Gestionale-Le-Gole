import { ConfermaLayout } from './ConfermaLayout';

// Conferma condivisa tra il flusso di prenotazione self-service
// (app/cliente/piscina/[inventarioId].tsx) e la riprenotazione dallo storico
// (app/cliente/storico/piscina/[id].tsx).
export function ConfermaPrenotazionePiscina({
  nomeInventario,
  dataLabel,
  orario,
  isDownloading,
  onScaricaBiglietto,
  onTornaHome,
  downloadError,
}: Readonly<{
  nomeInventario: string;
  dataLabel: string;
  orario: string;
  isDownloading: boolean;
  onScaricaBiglietto: () => void;
  onTornaHome: () => void;
  downloadError: string | null;
}>) {
  return (
    <ConfermaLayout
      titolo="Prenotazione confermata!"
      messaggio={`La tua prenotazione per ${nomeInventario} del ${dataLabel} alle ${orario} è confermata. Ti contatteremo al numero indicato solo in caso di necessità.`}
      testoDownload="🎫 Scarica il biglietto e mostralo in biglietteria: riporta il riepilogo della tua prenotazione, già confermata."
      etichettaDownload="Scarica biglietto (PDF)"
      isDownloading={isDownloading}
      onDownload={onScaricaBiglietto}
      downloadError={downloadError}
      onTornaHome={onTornaHome}
    />
  );
}
