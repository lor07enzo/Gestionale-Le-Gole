import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import type { ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Icon, LockIcon } from '@/components/ui/icon';
import { ClienteFooter } from '../../src/components/cliente/ClienteFooter';
import { BackButton } from '../../src/components/cliente/BackButton';
import { ConfermaPrenotazionePadel } from '../../src/components/cliente/ConfermaPrenotazionePadel';
import { DateNavCliente } from '../../src/components/cliente/DateNavCliente';
import { DatiClienteCard } from '../../src/components/cliente/DatiClienteCard';
import { SlotPickerPadel } from '../../src/components/shared/SlotPickerPadel';
import { StepperQuantita } from '../../src/components/shared/StepperQuantita';
import { RacchetteNoleggioPicker } from '../../src/components/shared/RacchetteNoleggioPicker';
import { useScaricaPdf } from '../../src/hooks/useScaricaPdf';
import { createCliente } from '../../src/services/clienti';
import {
  createPrenotazionePadelConNoleggi,
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
  formatDisplayDate,
  isSameDay,
  minutesToHHMM,
  nowHHMM,
  parseHHMMToMinutes,
  toISODate,
} from '../../src/utils/piscinaMappa';
import {
  formatDurata,
  formatTotaleEuro,
  ricalibraRacchette,
  slotPadelFuturi,
  totaleRacchetteScelte,
  totaleStimatoPadel,
} from '../../src/utils/padel';
import { dateToMap } from '../../src/utils/calendar';
import { formatPrezzo } from '../../src/utils/prezzi';
import { extractErrorMessage } from '../../src/utils/errors';

// Solo web: riserva sempre lo spazio della scrollbar verticale, così il padding destro dello
// ScrollView non si assottiglia rispetto al sinistro quando il contenuto trabocca.
const scrollViewStyle = Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as unknown as ViewStyle) : undefined;

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
  const download = useScaricaPdf('Impossibile scaricare il biglietto. Riprova.');

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

  useEffect(() => {
    setRacchetteQty((prev) => ricalibraRacchette(prev, partecipanti));
  }, [partecipanti]);

  const fullByDate = useMemo(() => dateToMap(chiusureFuture), [chiusureFuture]);
  const slotsVisibili = useMemo(
    () => (disponibilita ? slotPadelFuturi(disponibilita.slots, selectedDate) : []),
    [disponibilita, selectedDate]
  );

  const maxPartecipanti = configurazione?.max_partecipanti ?? 4;
  const totaleRacchetteSelezionate = totaleRacchetteScelte(racchetteQty);
  const totaleStimato = configurazione ? totaleStimatoPadel(configurazione, palline, racchette, racchetteQty) : 0;

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
      const partita = await createPrenotazionePadelConNoleggi(
        {
          cliente_id: cliente.id,
          data: toISODate(selectedDate),
          ora,
          partecipanti,
          palline_noleggiate: palline,
          note: note.trim(),
          stato: 'CONFIRMED',
        },
        racchetteQty
      );

      setPrenotazioneId(partita.id);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile completare la prenotazione. Riprova.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScaricaBiglietto = () => {
    if (prenotazioneId) download.scarica(getBigliettoPadelUrl(prenotazioneId), prenotazioneId, 'biglietto-padel');
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
        isDownloading={download.isDownloading}
        onScaricaBiglietto={handleScaricaBiglietto}
        onTornaHome={() => router.replace('/cliente')}
        downloadError={download.error}
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

        <DateNavCliente
          selectedDate={selectedDate}
          onChange={setSelectedDate}
          fullDates={fullByDate}
          calendarCaption="I giorni evidenziati in rosa sono chiusi."
        />

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
            <DatiClienteCard
              nome={nome}
              telefono={telefono}
              note={note}
              onChangeNome={setNome}
              onChangeTelefono={setTelefono}
              onChangeNote={setNote}
            />

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
                  <StepperQuantita
                    value={partecipanti}
                    onChange={setPartecipanti}
                    min={1}
                    max={maxPartecipanti}
                    etichetta="partecipanti"
                  />
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
                <RacchetteNoleggioPicker
                  racchette={racchette}
                  quantita={racchetteQty}
                  partecipanti={partecipanti}
                  onChange={(id, next) => setRacchetteQty((prev) => ({ ...prev, [id]: next }))}
                />
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
