import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
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
import { ConfermaPrenotazionePiscina } from '../../../../src/components/cliente/ConfermaPrenotazionePiscina';
import { CalendarPicker } from '../../../../src/components/shared/CalendarPicker';
import {
  createPrenotazionePiscina,
  getBigliettoUrl,
  getDettaglioPubblicoPiscina,
  getDisponibilitaPiscina,
  getGiorniPieniMese,
  type PrenotazionePiscina,
} from '../../../../src/services/prenotazioni';
import { getPiscinaInventario, type PiscinaInventario } from '../../../../src/services/struttura';
import { apriBigliettoPdf } from '../../../../src/utils/biglietto';
import { extractErrorMessage } from '../../../../src/utils/errors';
import {
  formatDateDDMMYYYY,
  formatDisplayDate,
  formatOrarioInput,
  formatTime,
  isSameDay,
  nowHHMM,
  parseHHMMToMinutes,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  toISODate,
  validateOrarioIngressoIntero,
  validateOrarioIngressoRidotto,
} from '../../../../src/utils/piscinaMappa';

// Pagina di dettaglio raggiunta da una card di app/cliente/storico/index.tsx — carica il singolo
// record per id (nessun telefono richiesto, l'UUID funge da segreto, stesso principio già usato
// dal biglietto/dalla ricevuta PDF, sezione 2/15 di CLAUDE.md).

const RISORSE_ROWS: Array<{
  key: 'ingressi' | 'ingressi_ridotti' | 'ingressi_bambini' | 'ingressi_gratuiti' | 'ombrellone' | 'gazebo' | 'lettino' | 'sdraia';
  icon: string;
  label: string;
}> = [
  { key: 'ingressi', icon: '🎟️', label: 'Ingressi interi' },
  { key: 'ingressi_ridotti', icon: '🌇', label: 'Ingressi ridotti' },
  { key: 'ingressi_bambini', icon: '🧒', label: 'Ingressi bambini' },
  { key: 'ingressi_gratuiti', icon: '🆓', label: 'Ingressi gratuiti' },
  { key: 'ombrellone', icon: '⛱️', label: 'Ombrelloni' },
  { key: 'gazebo', icon: '⛺', label: 'Gazebi' },
  { key: 'lettino', icon: '🛏️', label: 'Lettini' },
  { key: 'sdraia', icon: '🪑', label: 'Sdraie' },
];

// Stesso identico controllo (apertura/chiusura + non nel passato se oggi) già usato dal form di
// prenotazione originale (app/cliente/piscina/[inventarioId].tsx, funzione locale `validateOrario`)
// — duplicato qui apposta (principio "copia diretta" già seguito altrove nel progetto per due soli
// chiamanti, sezione 7/15 di CLAUDE.md) invece di condividerlo, dato che i due form vivono in due
// alberi di componenti distinti.
function validateOrarioRiprenotazione(value: string, inventario: PiscinaInventario, data: Date): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "L'orario è obbligatorio.";
  const minutes = parseHHMMToMinutes(trimmed);
  if (minutes === null) return 'Inserisci un orario valido (HH:MM).';

  const apertura = inventario.orario_apertura.slice(0, 5);
  const chiusura = inventario.orario_chiusura.slice(0, 5);
  if (minutes < parseHHMMToMinutes(apertura)! || minutes > parseHHMMToMinutes(chiusura)!) {
    return `La piscina è aperta dalle ${apertura} alle ${chiusura}.`;
  }
  if (isSameDay(data, new Date()) && minutes < parseHHMMToMinutes(nowHHMM())!) {
    return "L'orario non può essere nel passato.";
  }
  return null;
}

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
        <Heading size="xl">Dettaglio prenotazione</Heading>
        <Text size="sm" className="text-muted-foreground">
          Piscina
        </Text>
      </VStack>
    </HStack>
  );
}

// Nessuna riga con bordo condizionale "solo se non è l'ultima" tramite la variante Tailwind
// `last:` — mai usata altrove nel progetto (NativeWind v5/react-native-css è ancora alpha, nessun
// precedente verificato di supporto), le righe restano quindi semplici senza divisori propri: la
// separazione visiva tra gruppi arriva dai titoli di sezione sopra ciascun blocco.
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

export default function DettaglioPrenotazionePiscinaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [prenotazione, setPrenotazione] = useState<PrenotazionePiscina | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Inventario della prenotazione originale — caricato in un secondo momento (dopo il dettaglio,
  // di cui conosciamo l'id solo a quel punto), solo per validare orario/soglia ridotto pomeridiano
  // della riprenotazione (sotto). Un suo eventuale fallimento non fa fallire l'intera pagina (il
  // dettaglio è già caricato con successo): la riprenotazione ricade su una validazione minima.
  const [inventario, setInventario] = useState<PiscinaInventario | null>(null);

  // Riprenotazione — su richiesta esplicita dell'utente (2026-09-03): stesse risorse della
  // prenotazione originale (ingressi/ombrellone/gazebo/lettino/sdraia/note), il cliente sceglie
  // solo data e orario, nessuna riselezione di postazioni sulla mappa (nasce "Da assegnare" per lo
  // staff come una prenotazione normale senza postazioni scelte).
  const [isRiprenotando, setIsRiprenotando] = useState(false);
  const [dataRiprenotazione, setDataRiprenotazione] = useState<Date | null>(null);
  const [oraRiprenotazione, setOraRiprenotazione] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [fullByDate, setFullByDate] = useState<Record<string, boolean>>({});
  const [riprenotazioneError, setRiprenotazioneError] = useState<string | null>(null);
  const [isSubmittingRiprenotazione, setIsSubmittingRiprenotazione] = useState(false);

  // Riepilogo della riprenotazione appena completata — quando valorizzato, la pagina mostra la
  // stessa schermata di conferma del flusso di prenotazione self-service (`ConfermaPrenotazionePiscina`,
  // condivisa con app/cliente/piscina/[inventarioId].tsx) invece di navigare al dettaglio della
  // nuova prenotazione, su richiesta esplicita dell'utente (2026-09-03).
  const [riepilogoRiprenotazione, setRiepilogoRiprenotazione] = useState<{
    nomeInventario: string;
    dataLabel: string;
    orario: string;
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
    getDettaglioPubblicoPiscina(id)
      .then((data) => {
        if (cancelled) return;
        setPrenotazione(data);
        setIsLoading(false);
        getPiscinaInventario(data.inventario)
          .then((inv) => {
            if (!cancelled) setInventario(inv);
          })
          .catch(() => {});
      })
      .catch(() => {
        if (!cancelled) {
          setError('Prenotazione non trovata.');
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleVisibleMonthChange = (anno: number, mese: number) => {
    if (!prenotazione) return;
    getGiorniPieniMese({ inventario: prenotazione.inventario, anno, mese })
      .then((date) => {
        const patch: Record<string, boolean> = {};
        date.forEach((iso) => {
          patch[iso] = true;
        });
        setFullByDate((prev) => ({ ...prev, ...patch }));
      })
      .catch(() => {});
  };

  const handleSubmitRiprenotazione = async () => {
    if (!prenotazione) return;
    if (!dataRiprenotazione) {
      setRiprenotazioneError('Scegli la data della nuova prenotazione.');
      return;
    }
    const orario = oraRiprenotazione.trim();
    if (inventario) {
      const erroreOrario = validateOrarioRiprenotazione(orario, inventario, dataRiprenotazione);
      if (erroreOrario) {
        setRiprenotazioneError(erroreOrario);
        return;
      }
      const erroreRidotto = validateOrarioIngressoRidotto(
        orario,
        prenotazione.ingressi_ridotti,
        inventario.orario_inizio_ridotto
      );
      if (erroreRidotto) {
        setRiprenotazioneError(erroreRidotto);
        return;
      }
      if (Number.parseFloat(inventario.prezzo_ingresso_ridotto) > 0) {
        const erroreIntero = validateOrarioIngressoIntero(orario, prenotazione.ingressi, inventario.orario_inizio_ridotto);
        if (erroreIntero) {
          setRiprenotazioneError(erroreIntero);
          return;
        }
      }
    } else if (parseHHMMToMinutes(orario) === null) {
      // Fallback minimo se l'inventario non è ancora stato caricato: il backend rivalida comunque
      // apertura/chiusura e soglia ridotto pomeridiano (PrenotazionePiscinaSerializer.validate()).
      setRiprenotazioneError('Inserisci un orario valido (HH:MM).');
      return;
    }

    setRiprenotazioneError(null);
    setIsSubmittingRiprenotazione(true);
    try {
      const dataISO = toISODate(dataRiprenotazione);
      const disponibilita = await getDisponibilitaPiscina({ inventario: prenotazione.inventario, data: dataISO });
      if (disponibilita.pieno) {
        setRiprenotazioneError('Il giorno scelto è già al completo: scegline un altro.');
        return;
      }
      const nuova = await createPrenotazionePiscina({
        cliente_id: prenotazione.cliente_id,
        data: dataISO,
        ora: orario,
        stato: 'CONFIRMED',
        inventario: prenotazione.inventario,
        ingressi: prenotazione.ingressi,
        ingressi_ridotti: prenotazione.ingressi_ridotti,
        ingressi_bambini: prenotazione.ingressi_bambini,
        ingressi_gratuiti: prenotazione.ingressi_gratuiti,
        ombrellone: prenotazione.ombrellone,
        gazebo: prenotazione.gazebo,
        lettino: prenotazione.lettino,
        sdraia: prenotazione.sdraia,
        note: prenotazione.note,
      });
      setRiepilogoRiprenotazione({
        nomeInventario: prenotazione.inventario_nome,
        dataLabel: formatDisplayDate(dataRiprenotazione),
        orario,
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
      await apriBigliettoPdf(getBigliettoUrl(riepilogoRiprenotazione.prenotazioneId), riepilogoRiprenotazione.prenotazioneId);
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
      await apriBigliettoPdf(getBigliettoUrl(prenotazione.id), prenotazione.id);
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
            {error ?? 'Prenotazione non trovata.'}
          </Text>
        </VStack>
      </ScrollView>
    );
  }

  if (riepilogoRiprenotazione) {
    return (
      <ConfermaPrenotazionePiscina
        nomeInventario={riepilogoRiprenotazione.nomeInventario}
        dataLabel={riepilogoRiprenotazione.dataLabel}
        orario={riepilogoRiprenotazione.orario}
        isDownloading={isDownloadingRiprenotazione}
        onScaricaBiglietto={handleScaricaBigliettoRiprenotazione}
        onTornaHome={() => router.replace('/cliente')}
        downloadError={downloadRiprenotazioneError}
      />
    );
  }

  const risorse = RISORSE_ROWS.filter((row) => prenotazione[row.key] > 0);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <DettaglioHeader />

        <Box className="w-full rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
          <VStack space="md">
            <HStack className="items-start justify-between">
              <VStack>
                <Text size="lg" className="font-bold text-sky-900">
                  {prenotazione.inventario_nome}
                </Text>
                <HStack space="xs" className="items-center">
                  <Icon as={ClockIcon} size="xs" className="text-sky-600" />
                  <Text size="sm" className="text-sky-900/70">
                    {formatDateDDMMYYYY(prenotazione.data)} · {formatTime(prenotazione.ora)}
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

            {risorse.length > 0 ? (
              <VStack space="xs">
                <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                  Risorse prenotate
                </Text>
                {risorse.map((row) => (
                  <InfoRow key={row.key} icon={row.icon} label={row.label} value={prenotazione[row.key]} />
                ))}
              </VStack>
            ) : null}

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

        {/* Riprenota — stessa risorse della prenotazione originale, il cliente sceglie solo data e
            orario (su richiesta esplicita dell'utente). */}
        {!isRiprenotando ? (
          <Button
            variant="outline"
            className="border-2 border-emerald-300 bg-emerald-50"
            onPress={() => setIsRiprenotando(true)}
          >
            <ButtonIcon as={RepeatIcon} className="text-emerald-700" />
            <ButtonText className="text-emerald-700">Riprenota questa prenotazione</ButtonText>
          </Button>
        ) : (
          <Box className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <VStack space="sm">
              <Heading size="sm">🔁 Riprenota</Heading>
              <Text size="xs" className="text-emerald-900/70">
                Verrà creata una nuova prenotazione con le stesse risorse di questa (ingressi,
                ombrellone/gazebo, lettini/sdraie). Scegli solo la data e l'orario.
              </Text>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Data
                </Text>
                <Pressable
                  onPress={() => setIsCalendarOpen(true)}
                  accessibilityLabel="Scegli la data della nuova prenotazione"
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

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Orario
                </Text>
                <Input className="border-2 border-emerald-300 bg-white">
                  <InputField
                    value={oraRiprenotazione}
                    onChangeText={(text) => setOraRiprenotazione(formatOrarioInput(oraRiprenotazione, text))}
                    placeholder="Es. 15:30"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </Input>
                {inventario ? (
                  <Text size="2xs" className="text-emerald-900/70">
                    La piscina è aperta dalle {inventario.orario_apertura.slice(0, 5)} alle{' '}
                    {inventario.orario_chiusura.slice(0, 5)}.
                  </Text>
                ) : null}
              </VStack>

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
          <ActionsheetContent aria-label="Scegli il giorno per la nuova prenotazione">
            <ActionsheetDragIndicatorWrapper>
              <ActionsheetDragIndicator />
            </ActionsheetDragIndicatorWrapper>
            <VStack space="md" className="w-full pb-6 pt-1">
              <Heading size="sm">Scegli il giorno</Heading>
              <Text size="xs" className="text-muted-foreground">
                I giorni evidenziati in rosa sono già al completo.
              </Text>
              <CalendarPicker
                selectedDate={dataRiprenotazione ?? new Date()}
                onSelect={(date) => {
                  setDataRiprenotazione(date);
                  setIsCalendarOpen(false);
                }}
                minDate={new Date()}
                fullDates={fullByDate}
                onVisibleMonthChange={handleVisibleMonthChange}
              />
            </VStack>
          </ActionsheetContent>
        </Actionsheet>

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
