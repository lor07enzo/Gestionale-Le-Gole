import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { ClienteFooter } from '../../../../src/components/cliente/ClienteFooter';
import { ConfermaPrenotazionePadel } from '../../../../src/components/cliente/ConfermaPrenotazionePadel';
import {
  DETTAGLIO_SCROLL_CONTENT,
  DettaglioErrore,
  DettaglioHeader,
  DettaglioLoading,
  Divisore,
  DownloadPdfButton,
  InfoRow,
  RiepilogoCard,
  RiprenotaButton,
  RiprenotaPanel,
  SezioneDettaglio,
} from '../../../../src/components/cliente/storico/DettaglioStoricoUI';
import { SlotPickerPadel } from '../../../../src/components/shared/SlotPickerPadel';
import { useScaricaPdf } from '../../../../src/hooks/useScaricaPdf';
import {
  createPrenotazionePadel,
  getBigliettoPadelUrl,
  getDettaglioPubblicoPadel,
  getDisponibilitaPadel,
  getProssimeChiusurePadel,
  type DisponibilitaPadel,
  type DettaglioPadelPubblico,
} from '../../../../src/services/padel';
import { extractErrorMessage } from '../../../../src/utils/errors';
import {
  calcolaTotalePadel,
  formatDurata,
  formatFasciaPartita,
  formatTotaleEuro,
  slotPadelFuturi,
} from '../../../../src/utils/padel';
import { formatPrezzo } from '../../../../src/utils/prezzi';
import { formatDateDDMMYYYY, formatDisplayDate, toISODate } from '../../../../src/utils/piscinaMappa';

// Pagina di dettaglio raggiunta da una card di app/cliente/storico/index.tsx: carica il singolo
// record per id (l'UUID funge da segreto, nessun telefono richiesto qui).

const header = <DettaglioHeader titolo="Dettaglio partita" sottotitolo="Padel" />;
const MSG_CHIUSO = "Il campo è chiuso in questa data: scegline un'altra.";

export default function DettaglioPrenotazionePadelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [prenotazione, setPrenotazione] = useState<DettaglioPadelPubblico | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const download = useScaricaPdf('Impossibile scaricare il biglietto. Riprova.');

  // Riprenota: il cliente sceglie solo data e orario, partecipanti/palline copiati dalla partita
  // originale, nessuna racchetta riportata (andrebbe ri-verificata la disponibilità).
  const [isRiprenotando, setIsRiprenotando] = useState(false);
  const [dataRiprenotazione, setDataRiprenotazione] = useState<Date | null>(null);
  const [oraRiprenotazione, setOraRiprenotazione] = useState('');
  const [disponibilitaRiprenotazione, setDisponibilitaRiprenotazione] = useState<DisponibilitaPadel | null>(null);
  const [chiusureFuture, setChiusureFuture] = useState<string[]>([]);
  const [riprenotazioneError, setRiprenotazioneError] = useState<string | null>(null);
  const [isSubmittingRiprenotazione, setIsSubmittingRiprenotazione] = useState(false);
  const [riepilogoRiprenotazione, setRiepilogoRiprenotazione] = useState<{
    dataLabel: string;
    fasciaOraria: string;
    partecipanti: number;
    prenotazioneId: string;
  } | null>(null);
  const downloadRiprenotazione = useScaricaPdf('Impossibile scaricare il biglietto. Riprova.');

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getDettaglioPubblicoPadel(id)
      .then((data) => {
        if (!cancelled) setPrenotazione(data);
      })
      .catch(() => {
        if (!cancelled) setError('Partita non trovata.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!isRiprenotando || !dataRiprenotazione) return;
    let cancelled = false;
    setDisponibilitaRiprenotazione(null);
    getDisponibilitaPadel({ data: toISODate(dataRiprenotazione) })
      .then((data) => {
        if (!cancelled) setDisponibilitaRiprenotazione(data);
      })
      .catch(() => {
        if (!cancelled) setDisponibilitaRiprenotazione(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isRiprenotando, dataRiprenotazione]);

  const handleApriRiprenota = () => {
    setIsRiprenotando(true);
    if (chiusureFuture.length === 0) {
      getProssimeChiusurePadel()
        .then(setChiusureFuture)
        .catch(() => {});
    }
  };

  const slotsRiprenotazione =
    disponibilitaRiprenotazione && dataRiprenotazione
      ? slotPadelFuturi(disponibilitaRiprenotazione.slots, dataRiprenotazione)
      : [];

  const fullByDate: Record<string, boolean> = Object.fromEntries(chiusureFuture.map((iso) => [iso, true]));

  const handleSubmitRiprenotazione = async () => {
    if (!prenotazione) return;
    if (!dataRiprenotazione) {
      setRiprenotazioneError('Scegli la data della nuova partita.');
      return;
    }
    if (!oraRiprenotazione) {
      setRiprenotazioneError("Scegli l'orario di inizio.");
      return;
    }
    if (disponibilitaRiprenotazione?.chiuso) {
      setRiprenotazioneError(MSG_CHIUSO);
      return;
    }

    setRiprenotazioneError(null);
    setIsSubmittingRiprenotazione(true);
    try {
      const nuova = await createPrenotazionePadel({
        cliente_id: prenotazione.cliente_id,
        data: toISODate(dataRiprenotazione),
        ora: oraRiprenotazione,
        partecipanti: prenotazione.partecipanti,
        palline_noleggiate: prenotazione.palline_noleggiate,
        note: prenotazione.note,
        stato: 'CONFIRMED',
      });
      setRiepilogoRiprenotazione({
        dataLabel: formatDisplayDate(dataRiprenotazione),
        fasciaOraria: formatFasciaPartita(nuova.ora, nuova.orario_fine),
        partecipanti: nuova.partecipanti,
        prenotazioneId: nuova.id,
      });
    } catch (err) {
      setRiprenotazioneError(extractErrorMessage(err, 'Impossibile completare la riprenotazione. Riprova.'));
    } finally {
      setIsSubmittingRiprenotazione(false);
    }
  };

  if (isLoading) return <DettaglioLoading />;

  if (error || !prenotazione) {
    return <DettaglioErrore header={header} messaggio={error ?? 'Partita non trovata.'} />;
  }

  if (riepilogoRiprenotazione) {
    const nuovaId = riepilogoRiprenotazione.prenotazioneId;
    return (
      <ConfermaPrenotazionePadel
        dataLabel={riepilogoRiprenotazione.dataLabel}
        fasciaOraria={riepilogoRiprenotazione.fasciaOraria}
        partecipanti={riepilogoRiprenotazione.partecipanti}
        isDownloading={downloadRiprenotazione.isDownloading}
        onScaricaBiglietto={() => downloadRiprenotazione.scarica(getBigliettoPadelUrl(nuovaId), nuovaId, 'biglietto-padel')}
        onTornaHome={() => router.replace('/cliente')}
        downloadError={downloadRiprenotazione.error}
      />
    );
  }

  const totale = calcolaTotalePadel(prenotazione, prenotazione.noleggi);

  let campoOrario: React.ReactNode = null;
  if (dataRiprenotazione && disponibilitaRiprenotazione?.chiuso) {
    campoOrario = (
      <Text size="sm" className="text-destructive">
        {MSG_CHIUSO}
      </Text>
    );
  } else if (dataRiprenotazione) {
    campoOrario = (
      <VStack space="xs">
        <Text size="sm" className="font-medium">
          Orario
        </Text>
        <SlotPickerPadel
          slots={slotsRiprenotazione}
          value={oraRiprenotazione}
          onChange={setOraRiprenotazione}
          isLoading={!disponibilitaRiprenotazione}
          emptyMessage="Nessun orario disponibile per questa data."
        />
      </VStack>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName={DETTAGLIO_SCROLL_CONTENT}>
      <VStack space="lg" className="w-full">
        {header}

        <RiepilogoCard
          titolo="Campo da padel"
          quando={`${formatDateDDMMYYYY(prenotazione.data)} · ${formatFasciaPartita(prenotazione.ora, prenotazione.orario_fine)}`}
          stato={prenotazione.stato}
          clienteNome={prenotazione.cliente_nome}
          clienteTelefono={prenotazione.cliente_telefono}
          note={prenotazione.note}
        >
          <SezioneDettaglio titolo="Partita">
            <InfoRow icon="⏱️" label="Durata" value={formatDurata(prenotazione.durata_minuti)} />
            <InfoRow
              icon="👥"
              label="Partecipanti"
              value={`${prenotazione.partecipanti} ${prenotazione.partecipanti === 1 ? 'giocatore' : 'giocatori'}`}
            />
            {prenotazione.palline_noleggiate ? (
              <InfoRow icon="🎾" label="Palline" value={`€ ${formatPrezzo(prenotazione.prezzo_palline)}`} />
            ) : null}
          </SezioneDettaglio>

          {prenotazione.noleggi.length > 0 ? (
            <SezioneDettaglio titolo="Racchette noleggiate">
              {prenotazione.noleggi.map((riga) => (
                <InfoRow
                  key={riga.id}
                  icon="🎾"
                  label={`${riga.racchetta_nome} ×${riga.quantita}`}
                  value={`€ ${formatPrezzo(riga.subtotale)}`}
                />
              ))}
            </SezioneDettaglio>
          ) : null}

          <Divisore />
          <InfoRow icon="💰" label="Totale" value={`€ ${formatTotaleEuro(totale)}`} />
        </RiepilogoCard>

        {prenotazione.stato === 'CANCELLED' ? null : (
          <DownloadPdfButton
            etichetta="Scarica biglietto (PDF)"
            isDownloading={download.isDownloading}
            onPress={() => download.scarica(getBigliettoPadelUrl(prenotazione.id), prenotazione.id, 'biglietto-padel')}
          />
        )}

        {isRiprenotando ? (
          <RiprenotaPanel
            cosa="partita"
            descrizione={`Verrà creata una nuova partita con gli stessi partecipanti${
              prenotazione.palline_noleggiate ? ' e le palline a noleggio' : ''
            }. Scegli solo la data e l'orario.`}
            data={dataRiprenotazione}
            onSelectData={(date) => {
              setDataRiprenotazione(date);
              setOraRiprenotazione('');
            }}
            fullDates={fullByDate}
            calendarCaption="I giorni evidenziati in rosa sono chiusi."
            error={riprenotazioneError}
            isSubmitting={isSubmittingRiprenotazione}
            onSubmit={handleSubmitRiprenotazione}
            onAnnulla={() => setIsRiprenotando(false)}
          >
            {campoOrario}
          </RiprenotaPanel>
        ) : (
          <RiprenotaButton etichetta="Riprenota questa partita" onPress={handleApriRiprenota} />
        )}

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
