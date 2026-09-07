import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  DownloadIcon,
  Icon,
  PhoneIcon,
  RepeatIcon,
} from '@/components/ui/icon';
import { goBackOr } from '../../../../src/utils/navigation';
import { ClienteFooter } from '../../../../src/components/cliente/ClienteFooter';
import { ConfermaPrenotazionePadel } from '../../../../src/components/cliente/ConfermaPrenotazionePadel';
import { CalendarPicker } from '../../../../src/components/shared/CalendarPicker';
import { SlotPickerPadel } from '../../../../src/components/shared/SlotPickerPadel';
import {
  createPrenotazionePadel,
  getBigliettoPadelUrl,
  getDettaglioPubblicoPadel,
  getDisponibilitaPadel,
  getProssimeChiusurePadel,
  type DisponibilitaPadel,
  type PrenotazionePadel,
} from '../../../../src/services/padel';
import { apriBigliettoPdf } from '../../../../src/utils/biglietto';
import { extractErrorMessage } from '../../../../src/utils/errors';
import { calcolaTotalePadel, formatDurata, formatFasciaPartita, formatTotaleEuro } from '../../../../src/utils/padel';
import { formatPrezzo } from '../../../../src/utils/prezzi';
import {
  formatDateDDMMYYYY,
  formatDisplayDate,
  isSameDay,
  minutesToHHMM,
  nowHHMM,
  parseHHMMToMinutes,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  toISODate,
} from '../../../../src/utils/piscinaMappa';

// Pagina di dettaglio raggiunta da una card di app/cliente/storico/index.tsx — stesso identico
// principio di storico/piscina/[id].tsx: carica il singolo record per id (l'UUID funge da
// segreto, nessun telefono richiesto qui).

function DettaglioHeader() {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/cliente')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">Dettaglio partita</Heading>
        <Text size="sm" className="text-muted-foreground">
          Padel
        </Text>
      </VStack>
    </HStack>
  );
}

// Nessuna riga con bordo `last:` — stesso motivo già documentato in storico/piscina/[id].tsx.
function InfoRow({ icon, label, value }: Readonly<{ icon: string; label: string; value: string | number }>) {
  return (
    <HStack className="items-center justify-between py-1">
      <Text size="sm" className="text-sky-900/70">
        {icon} {label}
      </Text>
      <Text size="sm" className="font-semibold text-sky-900">
        {value}
      </Text>
    </HStack>
  );
}

export default function DettaglioPrenotazionePadelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [prenotazione, setPrenotazione] = useState<PrenotazionePadel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Riprenota — stesso identico principio di storico/piscina/[id].tsx: il cliente sceglie solo
  // data e orario, partecipanti/palline copiati dalla partita originale, nessuna racchetta
  // riportata (nessuna verifica di disponibilità da rifare, coerente con "solo data e orario").
  const [isRiprenotando, setIsRiprenotando] = useState(false);
  const [dataRiprenotazione, setDataRiprenotazione] = useState<Date | null>(null);
  const [oraRiprenotazione, setOraRiprenotazione] = useState('');
  const [disponibilitaRiprenotazione, setDisponibilitaRiprenotazione] = useState<DisponibilitaPadel | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [chiusureFuture, setChiusureFuture] = useState<string[]>([]);
  const [riprenotazioneError, setRiprenotazioneError] = useState<string | null>(null);
  const [isSubmittingRiprenotazione, setIsSubmittingRiprenotazione] = useState(false);

  const [riepilogoRiprenotazione, setRiepilogoRiprenotazione] = useState<{
    dataLabel: string;
    fasciaOraria: string;
    partecipanti: number;
    prenotazioneId: string;
  } | null>(null);
  const [isDownloadingRiprenotazione, setIsDownloadingRiprenotazione] = useState(false);
  const [downloadRiprenotazioneError, setDownloadRiprenotazioneError] = useState<string | null>(null);

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
        if (cancelled) return;
        setPrenotazione(data);
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

  const slotsRiprenotazione = (() => {
    if (!disponibilitaRiprenotazione || !dataRiprenotazione) return [];
    if (!isSameDay(dataRiprenotazione, new Date())) return disponibilitaRiprenotazione.slots;
    const nowMinuti = parseHHMMToMinutes(nowHHMM())!;
    return disponibilitaRiprenotazione.slots.filter((slot) => parseHHMMToMinutes(slot.ora)! >= nowMinuti);
  })();

  const fullByDate: Record<string, boolean> = {};
  chiusureFuture.forEach((iso) => {
    fullByDate[iso] = true;
  });

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
      setRiprenotazioneError('Il campo è chiuso in questa data: scegline un\'altra.');
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

  const handleScaricaBigliettoRiprenotazione = async () => {
    if (!riepilogoRiprenotazione) return;
    setIsDownloadingRiprenotazione(true);
    try {
      await apriBigliettoPdf(
        getBigliettoPadelUrl(riepilogoRiprenotazione.prenotazioneId),
        riepilogoRiprenotazione.prenotazioneId,
        'biglietto-padel'
      );
    } catch {
      setDownloadRiprenotazioneError('Impossibile scaricare il biglietto. Riprova.');
    } finally {
      setIsDownloadingRiprenotazione(false);
    }
  };

  const handleDownload = async () => {
    if (!prenotazione) return;
    setIsDownloading(true);
    try {
      await apriBigliettoPdf(getBigliettoPadelUrl(prenotazione.id), prenotazione.id, 'biglietto-padel');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error || !prenotazione) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
        <VStack space="lg" className="w-full">
          <DettaglioHeader />
          <Text size="sm" className="text-center text-destructive">
            {error ?? 'Partita non trovata.'}
          </Text>
        </VStack>
      </ScrollView>
    );
  }

  if (riepilogoRiprenotazione) {
    return (
      <ConfermaPrenotazionePadel
        dataLabel={riepilogoRiprenotazione.dataLabel}
        fasciaOraria={riepilogoRiprenotazione.fasciaOraria}
        partecipanti={riepilogoRiprenotazione.partecipanti}
        isDownloading={isDownloadingRiprenotazione}
        onScaricaBiglietto={handleScaricaBigliettoRiprenotazione}
        onTornaHome={() => router.replace('/cliente')}
        downloadError={downloadRiprenotazioneError}
      />
    );
  }

  const totale = calcolaTotalePadel(prenotazione, prenotazione.noleggi);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <DettaglioHeader />

        <Box className="w-full rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
          <VStack space="md">
            <HStack className="items-start justify-between">
              <VStack>
                <Text size="lg" className="font-bold text-sky-900">
                  Campo da padel
                </Text>
                <HStack space="xs" className="items-center">
                  <Icon as={ClockIcon} size="xs" className="text-sky-600" />
                  <Text size="sm" className="text-sky-900/70">
                    {formatDateDDMMYYYY(prenotazione.data)} ·{' '}
                    {formatFasciaPartita(prenotazione.ora, prenotazione.orario_fine)}
                  </Text>
                </HStack>
              </VStack>
              <Box className={`rounded-full px-3 py-1.5 ${STATO_PRENOTAZIONE_BADGE[prenotazione.stato].bg}`}>
                <Text size="xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[prenotazione.stato].text}`}>
                  {STATO_PRENOTAZIONE_LABEL[prenotazione.stato]}
                </Text>
              </Box>
            </HStack>

            <Box className="h-px w-full bg-sky-100" />

            <VStack space="xs">
              <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                Cliente
              </Text>
              <InfoRow icon="👤" label="Nome" value={prenotazione.cliente_nome} />
              <HStack className="items-center justify-between py-1">
                <HStack space="xs" className="items-center">
                  <Icon as={PhoneIcon} size="2xs" className="text-sky-600" />
                  <Text size="sm" className="text-sky-900/70">
                    Telefono
                  </Text>
                </HStack>
                <Text size="sm" className="font-semibold text-sky-900">
                  {prenotazione.cliente_telefono}
                </Text>
              </HStack>
            </VStack>

            <VStack space="xs">
              <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                Partita
              </Text>
              <InfoRow icon="⏱️" label="Durata" value={formatDurata(prenotazione.durata_minuti)} />
              <InfoRow
                icon="👥"
                label="Partecipanti"
                value={`${prenotazione.partecipanti} ${prenotazione.partecipanti === 1 ? 'giocatore' : 'giocatori'}`}
              />
              {prenotazione.palline_noleggiate ? (
                <InfoRow icon="🎾" label="Palline" value={`€ ${formatPrezzo(prenotazione.prezzo_palline)}`} />
              ) : null}
            </VStack>

            {prenotazione.noleggi.length > 0 ? (
              <VStack space="xs">
                <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                  Racchette noleggiate
                </Text>
                {prenotazione.noleggi.map((riga) => (
                  <InfoRow
                    key={riga.id}
                    icon="🎾"
                    label={`${riga.racchetta_nome} ×${riga.quantita}`}
                    value={`€ ${formatPrezzo(riga.subtotale)}`}
                  />
                ))}
              </VStack>
            ) : null}

            <Box className="h-px w-full bg-sky-100" />
            <InfoRow icon="💰" label="Totale" value={`€ ${formatTotaleEuro(totale)}`} />

            {prenotazione.note ? (
              <VStack space="xs">
                <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                  Note
                </Text>
                <Text size="sm" className="italic text-sky-900/80">
                  📝 {prenotazione.note}
                </Text>
              </VStack>
            ) : null}
          </VStack>
        </Box>

        {prenotazione.stato !== 'CANCELLED' ? (
          <Button onPress={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <ButtonSpinner />
            ) : (
              <>
                <ButtonIcon as={DownloadIcon} />
                <ButtonText>Scarica biglietto (PDF)</ButtonText>
              </>
            )}
          </Button>
        ) : null}

        {/* Riprenota — stessi partecipanti/palline della partita originale, il cliente sceglie
            solo data e orario. Nessuna racchetta riportata: andrebbe ri-verificata la
            disponibilità, coerente con "solo data e orario" già scelto per la piscina. */}
        {!isRiprenotando ? (
          <Button variant="outline" className="border-2 border-emerald-300 bg-emerald-50" onPress={handleApriRiprenota}>
            <ButtonIcon as={RepeatIcon} className="text-emerald-700" />
            <ButtonText className="text-emerald-700">Riprenota questa partita</ButtonText>
          </Button>
        ) : (
          <Box className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <VStack space="sm">
              <Heading size="sm">🔁 Riprenota</Heading>
              <Text size="xs" className="text-emerald-900/70">
                Verrà creata una nuova partita con gli stessi partecipanti
                {prenotazione.palline_noleggiate ? ' e le palline a noleggio' : ''}. Scegli solo la
                data e l'orario.
              </Text>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Data
                </Text>
                <Pressable
                  onPress={() => setIsCalendarOpen(true)}
                  accessibilityLabel="Scegli la data della nuova partita"
                  className="rounded-xl border-2 border-emerald-300 bg-white px-3 py-2.5"
                >
                  <HStack space="xs" className="items-center">
                    <Icon as={CalendarDaysIcon} size="sm" className="text-emerald-700" />
                    <Text size="sm" className="font-medium text-emerald-900">
                      {dataRiprenotazione ? formatDisplayDate(dataRiprenotazione) : 'Scegli la data'}
                    </Text>
                  </HStack>
                </Pressable>
              </VStack>

              {dataRiprenotazione ? (
                disponibilitaRiprenotazione?.chiuso ? (
                  <Text size="sm" className="text-destructive">
                    Il campo è chiuso in questa data: scegline un'altra.
                  </Text>
                ) : (
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
                )
              ) : null}

              {riprenotazioneError ? (
                <Text size="sm" className="text-center text-destructive">
                  {riprenotazioneError}
                </Text>
              ) : null}

              <Button
                onPress={handleSubmitRiprenotazione}
                disabled={isSubmittingRiprenotazione}
                isDisabled={isSubmittingRiprenotazione}
              >
                {isSubmittingRiprenotazione ? <ButtonSpinner /> : <ButtonText>Conferma riprenotazione</ButtonText>}
              </Button>
              <Button variant="link" onPress={() => setIsRiprenotando(false)} disabled={isSubmittingRiprenotazione}>
                <ButtonText>Annulla</ButtonText>
              </Button>
            </VStack>
          </Box>
        )}

        <Actionsheet isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)}>
          <ActionsheetBackdrop />
          <ActionsheetContent aria-label="Scegli il giorno per la nuova partita">
            <ActionsheetDragIndicatorWrapper>
              <ActionsheetDragIndicator />
            </ActionsheetDragIndicatorWrapper>
            <VStack space="md" className="w-full pb-6 pt-1">
              <Heading size="sm">Scegli il giorno</Heading>
              <Text size="xs" className="text-muted-foreground">
                I giorni evidenziati in rosa sono chiusi.
              </Text>
              <CalendarPicker
                selectedDate={dataRiprenotazione ?? new Date()}
                onSelect={(date) => {
                  setDataRiprenotazione(date);
                  setOraRiprenotazione('');
                  setIsCalendarOpen(false);
                }}
                minDate={new Date()}
                fullDates={fullByDate}
              />
            </VStack>
          </ActionsheetContent>
        </Actionsheet>

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
