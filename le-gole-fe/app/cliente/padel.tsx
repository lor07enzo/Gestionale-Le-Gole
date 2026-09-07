import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView } from 'react-native';
import type { ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import {
  AddIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Icon,
  LockIcon,
  PhoneIcon,
  RemoveIcon,
} from '@/components/ui/icon';
import { ClienteFooter } from '../../src/components/cliente/ClienteFooter';
import { BackButton } from '../../src/components/cliente/BackButton';
import { ConfermaPrenotazionePadel } from '../../src/components/cliente/ConfermaPrenotazionePadel';
import { CalendarPicker } from '../../src/components/shared/CalendarPicker';
import { SlotPickerPadel } from '../../src/components/shared/SlotPickerPadel';
import { createCliente } from '../../src/services/clienti';
import {
  createNoleggioRacchetta,
  createPrenotazionePadel,
  getBigliettoPadelUrl,
  getConfigurazionePadel,
  getDisponibilitaPadel,
  getProssimeChiusurePadel,
  listRacchettePadel,
  type ConfigurazionePadel,
  type DisponibilitaPadel,
  type RacchettaPadel,
} from '../../src/services/padel';
import {
  addDays,
  formatDisplayDate,
  isSameDay,
  minutesToHHMM,
  nowHHMM,
  parseHHMMToMinutes,
  toISODate,
} from '../../src/utils/piscinaMappa';
import { formatDurata, formatTotaleEuro } from '../../src/utils/padel';
import { formatPrezzo } from '../../src/utils/prezzi';
import { apriBigliettoPdf } from '../../src/utils/biglietto';
import { extractErrorMessage } from '../../src/utils/errors';

// Solo web: riserva sempre lo spazio della scrollbar verticale, così il padding destro dello
// ScrollView non si assottiglia rispetto al sinistro quando il contenuto trabocca.
const scrollViewStyle = Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as unknown as ViewStyle) : undefined;

function DateNav({
  selectedDate,
  onChange,
  fullDates,
}: Readonly<{ selectedDate: Date; onChange: (date: Date) => void; fullDates: Record<string, boolean> }>) {
  const isToday = isSameDay(selectedDate, new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <>
      <HStack space="sm" className="items-center justify-between rounded-2xl border border-sky-100 bg-white p-2.5 shadow-sm">
        <Pressable
          accessibilityLabel="Giorno precedente"
          disabled={isToday}
          onPress={() => onChange(addDays(selectedDate, -1))}
          className={`h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm ${
            isToday ? 'border-sky-100 bg-sky-50' : 'border-sky-300 bg-white active:bg-sky-50'
          }`}
        >
          <Icon as={ChevronLeftIcon} size="md" className={isToday ? 'text-sky-300' : 'text-sky-900'} />
        </Pressable>

        <Pressable accessibilityLabel="Apri calendario per scegliere il giorno" onPress={() => setIsCalendarOpen(true)}>
          <HStack space="xs" className="items-center">
            <Icon as={CalendarDaysIcon} size="sm" className="text-sky-700" />
            <Text size="md" className="font-bold capitalize text-sky-900">
              {isToday ? 'Oggi' : formatDisplayDate(selectedDate)}
            </Text>
          </HStack>
        </Pressable>

        <Pressable
          accessibilityLabel="Giorno successivo"
          onPress={() => onChange(addDays(selectedDate, 1))}
          className="h-10 w-10 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50"
        >
          <Icon as={ChevronRightIcon} size="md" className="text-sky-900" />
        </Pressable>
      </HStack>

      <Actionsheet isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent aria-label="Scegli il giorno">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack space="md" className="w-full pb-6 pt-1">
            <Heading size="sm">Scegli il giorno</Heading>
            <Text size="xs" className="text-muted-foreground">
              I giorni evidenziati in rosa sono chiusi.
            </Text>
            <CalendarPicker
              selectedDate={selectedDate}
              onSelect={(date) => {
                onChange(date);
                setIsCalendarOpen(false);
              }}
              minDate={new Date()}
              fullDates={fullDates}
            />
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}

function RacchettaStepperRow({
  racchetta,
  value,
  max,
  onChange,
}: Readonly<{ racchetta: RacchettaPadel; value: number; max: number; onChange: (next: number) => void }>) {
  return (
    <HStack space="sm" className="items-center">
      <Text size="md">🎾</Text>
      <VStack className="flex-1">
        <Text size="sm" className="font-medium">
          {racchetta.nome}
        </Text>
        <Text size="2xs" className="text-muted-foreground">
          €{formatPrezzo(racchetta.prezzo_noleggio)} a partita
        </Text>
      </VStack>
      <HStack space="xs" className="items-center">
        <Button
          size="icon"
          variant="outline"
          className="h-11 w-11 rounded-full border-2 border-sky-300 bg-white md:h-12 md:w-12"
          onPress={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          accessibilityLabel={`Diminuisci ${racchetta.nome}`}
        >
          <ButtonIcon as={RemoveIcon} className="text-sky-900" />
        </Button>
        <Text size="md" className="w-8 text-center font-bold text-sky-900">
          {value}
        </Text>
        <Button
          size="icon"
          variant="outline"
          className="h-11 w-11 rounded-full border-2 border-sky-300 bg-white md:h-12 md:w-12"
          onPress={() => onChange(value + 1)}
          disabled={value >= max}
          accessibilityLabel={`Aumenta ${racchetta.nome}`}
        >
          <ButtonIcon as={AddIcon} className="text-sky-900" />
        </Button>
      </HStack>
    </HStack>
  );
}

export default function ClientePadelBookingScreen() {
  const [configurazione, setConfigurazione] = useState<ConfigurazionePadel | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [racchette, setRacchette] = useState<RacchettaPadel[]>([]);
  const [chiusureFuture, setChiusureFuture] = useState<string[]>([]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [disponibilita, setDisponibilita] = useState<DisponibilitaPadel | null>(null);

  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [note, setNote] = useState('');
  const [ora, setOra] = useState('');
  const [partecipanti, setPartecipanti] = useState(2);
  const [palline, setPalline] = useState(false);
  const [racchetteQty, setRacchetteQty] = useState<Record<string, number>>({});

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prenotazioneId, setPrenotazioneId] = useState<string | null>(null);
  const [isDownloadingBiglietto, setIsDownloadingBiglietto] = useState(false);

  useEffect(() => {
    Promise.all([getConfigurazionePadel(), listRacchettePadel({ disponibile: true }), getProssimeChiusurePadel()])
      .then(([config, catalogo, chiusure]) => {
        setConfigurazione(config);
        setRacchette(catalogo);
        setChiusureFuture(chiusure);
        setPartecipanti((prev) => Math.min(prev, config.max_partecipanti));
      })
      .catch(() => setLoadError('Impossibile caricare la configurazione del campo.'))
      .finally(() => setIsLoadingConfig(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDisponibilitaPadel({ data: toISODate(selectedDate) })
      .then((data) => {
        if (!cancelled) setDisponibilita(data);
      })
      .catch(() => {
        if (!cancelled) setDisponibilita(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // Cambiare giorno azzera l'orario scelto: uno slot libero in una data può essere occupato in
  // un'altra.
  useEffect(() => {
    setOra('');
  }, [selectedDate]);

  // Un partecipante in meno può riportare il totale racchette già scelte sopra il nuovo tetto.
  useEffect(() => {
    setRacchetteQty((prev) => {
      let totale = Object.values(prev).reduce((somma, qty) => somma + qty, 0);
      if (totale <= partecipanti) return prev;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        while (totale > partecipanti && next[id] > 0) {
          next[id] -= 1;
          totale -= 1;
        }
        if (totale <= partecipanti) break;
      }
      return next;
    });
  }, [partecipanti]);

  const fullByDate = useMemo(() => {
    const map: Record<string, boolean> = {};
    chiusureFuture.forEach((iso) => {
      map[iso] = true;
    });
    return map;
  }, [chiusureFuture]);

  // Il backend non filtra gli orari già passati (nessun concetto di anticipo minimo per il
  // padel): un orario oggi alle 10:00 resterebbe "disponibile" anche alle 15:00. Nascosto qui
  // invece che mostrato disabilitato, per non dover introdurre una terza etichetta ("passato")
  // accanto a "occupato" nel picker condiviso con lo staff.
  const slotsVisibili = useMemo(() => {
    if (!disponibilita) return [];
    if (!isSameDay(selectedDate, new Date())) return disponibilita.slots;
    const nowMinuti = parseHHMMToMinutes(nowHHMM())!;
    return disponibilita.slots.filter((slot) => parseHHMMToMinutes(slot.ora)! >= nowMinuti);
  }, [disponibilita, selectedDate]);

  const maxPartecipanti = configurazione?.max_partecipanti ?? 4;
  const totaleRacchetteSelezionate = Object.values(racchetteQty).reduce((somma, qty) => somma + qty, 0);

  const totaleStimato = useMemo(() => {
    if (!configurazione) return 0;
    let somma = Number.parseFloat(configurazione.prezzo_partita) || 0;
    if (palline) somma += Number.parseFloat(configurazione.prezzo_noleggio_palline) || 0;
    racchette.forEach((racchetta) => {
      const qty = racchetteQty[racchetta.id] ?? 0;
      if (qty > 0) somma += qty * (Number.parseFloat(racchetta.prezzo_noleggio) || 0);
    });
    return somma;
  }, [configurazione, palline, racchette, racchetteQty]);

  const handleSubmit = async () => {
    if (!configurazione) return;
    if (!nome.trim() || !telefono.trim()) {
      setError('Inserisci nome e telefono.');
      return;
    }
    if (!ora) {
      setError("Scegli l'orario di inizio della partita.");
      return;
    }
    if (isSameDay(selectedDate, new Date()) && parseHHMMToMinutes(ora)! < parseHHMMToMinutes(nowHHMM())!) {
      setError("L'orario scelto è già passato: scegline un altro.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const cliente = await createCliente({ nome: nome.trim(), telefono: telefono.trim() });
      const partita = await createPrenotazionePadel({
        cliente_id: cliente.id,
        data: toISODate(selectedDate),
        ora,
        partecipanti,
        palline_noleggiate: palline,
        note: note.trim(),
        stato: 'CONFIRMED',
      });

      const righeRacchette = Object.entries(racchetteQty).filter(([, qty]) => qty > 0);
      if (righeRacchette.length > 0) {
        // Promise.all, non allSettled: un noleggio fallito silenziosamente lascerebbe il cliente
        // convinto di aver noleggiato una racchetta che invece non risulta da nessuna parte —
        // stesso principio già seguito per le righe di un ordine asporto.
        await Promise.all(
          righeRacchette.map(([racchettaId, quantita]) =>
            createNoleggioRacchetta({ prenotazione: partita.id, racchetta: racchettaId, quantita })
          )
        );
      }

      setPrenotazioneId(partita.id);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile completare la prenotazione. Riprova.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScaricaBiglietto = async () => {
    if (!prenotazioneId) return;
    setIsDownloadingBiglietto(true);
    try {
      await apriBigliettoPdf(getBigliettoPadelUrl(prenotazioneId), prenotazioneId, 'biglietto-padel');
    } catch {
      setError('Impossibile scaricare il biglietto. Riprova.');
    } finally {
      setIsDownloadingBiglietto(false);
    }
  };

  if (isLoadingConfig) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  if (loadError || !configurazione) {
    return (
      <Box className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text size="sm" className="text-center text-destructive">
          {loadError ?? 'Impossibile trovare il campo da padel.'}
        </Text>
        <BackButton className="self-center" fallbackHref="/cliente" />
      </Box>
    );
  }

  if (prenotazioneId) {
    const oraFine = minutesToHHMM(parseHHMMToMinutes(ora)! + configurazione.durata_partita_minuti);
    return (
      <ConfermaPrenotazionePadel
        dataLabel={formatDisplayDate(selectedDate)}
        fasciaOraria={`${ora} - ${oraFine}`}
        partecipanti={partecipanti}
        isDownloading={isDownloadingBiglietto}
        onScaricaBiglietto={handleScaricaBiglietto}
        onTornaHome={() => router.replace('/cliente')}
        downloadError={error}
      />
    );
  }

  if (!configurazione.attivo) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10" style={scrollViewStyle}>
        <VStack space="lg" className="w-full items-center">
          <Box className="w-full max-w-md items-center rounded-3xl border border-rose-200 bg-rose-50 p-8">
            <Icon as={LockIcon} size="xl" className="text-rose-700" />
            <Heading size="lg" className="mt-2 text-center text-rose-900">
              Prenotazioni online non disponibili
            </Heading>
            <Text size="sm" className="mt-2 text-center text-rose-800">
              Il campo da padel non è al momento prenotabile online. Contatta direttamente la
              struttura per informazioni.
            </Text>
          </Box>
          <BackButton fallbackHref="/cliente" />
          <ClienteFooter />
        </VStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10" style={scrollViewStyle}>
      <VStack space="lg" className="w-full">
        <VStack space="xs">
          <Heading size="xl">🎾 Campo da padel</Heading>
          <Text size="sm" className="text-muted-foreground">
            Partite da {formatDurata(configurazione.durata_partita_minuti)} · Scegli data, orario e
            cosa vuoi prenotare.
          </Text>
        </VStack>

        <DateNav selectedDate={selectedDate} onChange={setSelectedDate} fullDates={fullByDate} />

        {disponibilita?.chiuso ? (
          <Box className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <HStack space="sm" className="items-start">
              <Icon as={LockIcon} size="md" className="mt-0.5 text-rose-700" />
              <VStack className="flex-1">
                <Heading size="sm" className="text-rose-900">
                  Campo chiuso in questa data
                </Heading>
                <Text size="sm" className="mt-1 text-rose-800">
                  Per {formatDisplayDate(selectedDate)} il campo non è prenotabile online. Prova a
                  scegliere un altro giorno.
                </Text>
              </VStack>
            </HStack>
          </Box>
        ) : (
          <>
            <VStack space="md" className="w-full rounded-2xl border border-sky-200 bg-sky-100 p-5">
              <Heading size="sm">I tuoi dati</Heading>

              <VStack space="xs">
                <HStack space="xs" className="items-center">
                  <Text size="sm">👤</Text>
                  <Text size="sm" className="font-medium">
                    Nome e cognome
                  </Text>
                  <Text size="xs" className="text-destructive">
                    *
                  </Text>
                </HStack>
                <Input>
                  <InputField placeholder="Es. Mario Rossi" value={nome} onChangeText={setNome} />
                </Input>
              </VStack>

              <VStack space="xs">
                <HStack space="xs" className="items-center">
                  <Icon as={PhoneIcon} size="sm" className="text-sky-700" />
                  <Text size="sm" className="font-medium">
                    Telefono
                  </Text>
                  <Text size="xs" className="text-destructive">
                    *
                  </Text>
                </HStack>
                <Input>
                  <InputField
                    keyboardType="phone-pad"
                    placeholder="Es. 333 1234567"
                    value={telefono}
                    onChangeText={setTelefono}
                  />
                </Input>
                <Text size="2xs" className="text-sky-900/60">
                  📌 Usa sempre lo stesso numero: ti aiuta a ritrovare prenotazioni e preferenze.
                </Text>
              </VStack>

              <VStack space="xs">
                <HStack space="xs" className="items-center">
                  <Text size="sm">📝</Text>
                  <Text size="sm" className="font-medium">
                    Note (opzionale)
                  </Text>
                </HStack>
                <Input>
                  <InputField placeholder="Es. richieste particolari..." value={note} onChangeText={setNote} />
                </Input>
              </VStack>
            </VStack>

            <VStack space="md" className="w-full rounded-2xl border border-sky-200 bg-sky-100 p-5">
              <Heading size="sm">La tua partita</Heading>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Orario di inizio
                </Text>
                <SlotPickerPadel
                  slots={slotsVisibili}
                  value={ora}
                  onChange={setOra}
                  isLoading={!disponibilita}
                  emptyMessage="Nessun orario disponibile per questa data."
                />
                <Text size="2xs" className="text-sky-900/60">
                  Ogni partita dura {formatDurata(configurazione.durata_partita_minuti)}.
                </Text>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Partecipanti
                </Text>
                <HStack space="sm" className="items-center">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 rounded-full border-2 border-sky-300 bg-white md:h-12 md:w-12"
                    onPress={() => setPartecipanti((prev) => Math.max(1, prev - 1))}
                    disabled={partecipanti <= 1}
                    accessibilityLabel="Diminuisci partecipanti"
                  >
                    <ButtonIcon as={RemoveIcon} className="text-sky-900" />
                  </Button>
                  <Text size="md" className="w-8 text-center font-bold text-sky-900">
                    {partecipanti}
                  </Text>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 rounded-full border-2 border-sky-300 bg-white md:h-12 md:w-12"
                    onPress={() => setPartecipanti((prev) => Math.min(maxPartecipanti, prev + 1))}
                    disabled={partecipanti >= maxPartecipanti}
                    accessibilityLabel="Aumenta partecipanti"
                  >
                    <ButtonIcon as={AddIcon} className="text-sky-900" />
                  </Button>
                  <Text size="2xs" className="text-muted-foreground">
                    max {maxPartecipanti}
                  </Text>
                </HStack>
              </VStack>

              <HStack space="sm" className="items-center justify-between rounded-xl bg-white/60 px-3 py-2">
                <VStack className="flex-1">
                  <Text size="sm" className="font-medium">
                    Palline a noleggio
                  </Text>
                  <Text size="2xs" className="text-muted-foreground">
                    €{formatPrezzo(configurazione.prezzo_noleggio_palline)} a partita
                  </Text>
                </VStack>
                <Switch value={palline} onValueChange={setPalline} accessibilityLabel="Palline a noleggio" />
              </HStack>
            </VStack>

            {racchette.length > 0 ? (
              <VStack space="md" className="w-full rounded-2xl border border-sky-200 bg-sky-100 p-5">
                <VStack space="xs">
                  <Heading size="sm">Racchette a noleggio</Heading>
                  <Text size="xs" className="text-sky-900/70">
                    Al massimo una racchetta per partecipante ({totaleRacchetteSelezionate}/{partecipanti}).
                  </Text>
                </VStack>
                {racchette.map((racchetta) => {
                  const valore = racchetteQty[racchetta.id] ?? 0;
                  const residuoPartecipanti = partecipanti - (totaleRacchetteSelezionate - valore);
                  const max = Math.max(0, Math.min(racchetta.quantita_disponibile, residuoPartecipanti));
                  return (
                    <RacchettaStepperRow
                      key={racchetta.id}
                      racchetta={racchetta}
                      value={valore}
                      max={max}
                      onChange={(next) => setRacchetteQty((prev) => ({ ...prev, [racchetta.id]: next }))}
                    />
                  );
                })}
              </VStack>
            ) : null}

            <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-sky-100 p-5">
              <HStack className="items-center justify-between">
                <Text size="sm" className="font-medium text-sky-900">
                  Totale stimato
                </Text>
                <Text size="md" className="font-bold text-sky-900">
                  €{formatTotaleEuro(totaleStimato)}
                </Text>
              </HStack>
            </VStack>

            {error ? (
              <Text size="sm" className="text-center text-destructive">
                {error}
              </Text>
            ) : null}

            <Button onPress={handleSubmit} disabled={isSubmitting} isDisabled={isSubmitting}>
              {isSubmitting ? <ButtonSpinner /> : <ButtonText>Prenota ora</ButtonText>}
            </Button>
            <Text size="2xs" className="text-center text-muted-foreground">
              La prenotazione viene confermata subito, senza attese.
            </Text>
          </>
        )}

        <BackButton fallbackHref="/cliente" />

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
