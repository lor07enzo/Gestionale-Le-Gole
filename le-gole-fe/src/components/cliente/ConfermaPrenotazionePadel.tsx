import { ConfermaLayout } from './ConfermaLayout';

// Conferma condivisa tra la prenotazione self-service (app/cliente/padel.tsx) e la riprenotazione
// dallo storico (app/cliente/storico/padel/[id].tsx).
export function ConfermaPrenotazionePadel({
  dataLabel,
  fasciaOraria,
  partecipanti,
  isDownloading,
  onScaricaBiglietto,
  onTornaHome,
  downloadError,
}: Readonly<{
  dataLabel: string;
  fasciaOraria: string;
  partecipanti: number;
  isDownloading: boolean;
  onScaricaBiglietto: () => void;
  onTornaHome: () => void;
  downloadError: string | null;
}>) {
  const giocatori = partecipanti === 1 ? 'giocatore' : 'giocatori';
  return (
    <ConfermaLayout
      titolo="Partita confermata!"
      messaggio={`La tua partita del ${dataLabel} alle ${fasciaOraria} per ${partecipanti} ${giocatori} è confermata. Ti contatteremo al numero indicato solo in caso di necessità.`}
      testoDownload="🎫 Scarica il biglietto e mostralo in campo: riporta il riepilogo della tua prenotazione, già confermata."
      etichettaDownload="Scarica biglietto (PDF)"
      isDownloading={isDownloading}
      onDownload={onScaricaBiglietto}
      downloadError={downloadError}
      onTornaHome={onTornaHome}
    />
  );
}
