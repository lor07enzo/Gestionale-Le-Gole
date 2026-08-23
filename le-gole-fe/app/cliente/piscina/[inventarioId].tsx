import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import {
  Icon,
  AddIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  InfoIcon,
  LockIcon,
  PhoneIcon,
  RemoveIcon,
} from '@/components/ui/icon';
// Caricato dinamicamente per non farlo entrare nel bundle valutato su ogni pagina.
const TimePickerModal = lazy(() =>
  import('react-native-paper-dates').then((m) => ({ default: m.TimePickerModal }))
);
import { getPiscinaInventario, type PiscinaInventario } from '../../../src/services/struttura';
import {
  createOccupazione,
  createPrenotazionePiscina,
  getBigliettoUrl,
  getDisponibilitaPiscina,
  getGiorniPieniMese,
  type DisponibilitaPiscina,
} from '../../../src/services/prenotazioni';
import { createCliente } from '../../../src/services/clienti';
import { ClienteFooter } from '../../../src/components/cliente/ClienteFooter';
import { BackButton } from '../../../src/components/cliente/BackButton';
import { CalendarPicker } from '../../../src/components/shared/CalendarPicker';
import { DisponibilitaCards, type DisponibilitaCardItem } from '../../../src/components/shared/DisponibilitaCards';
import { PiscinaMappaSelettore, type PiscinaSelezione } from '../../../src/components/cliente/PiscinaMappaSelettore';
import {
  addDays,
  formatDisplayDate,
  isSameDay,
  minutesToHHMM,
  nowHHMM,
  parseHHMMToMinutes,
  toISODate,
  validateOrarioIngressoIntero,
  validateOrarioIngressoRidotto,
} from '../../../src/utils/piscinaMappa';
import { formatPrezzo } from '../../../src/utils/prezzi';
import { apriBigliettoPdf } from '../../../src/utils/biglietto';

type FormState = {
  nome: string;
  telefono: string;
  note: string;
  orario: string;
  ingressi: string;
  ingressiRidotti: string;
  ingressiBambini: string;
  ingressiGratuiti: string;
  lettino: string;
  sdraia: string;
};

// Ombrellone/gazebo sono derivati dalla selezione sulla mappa, non campi numerici.
const RISORSE_KEYS = ['lettino', 'sdraia'] as const;

function defaultOrario(inventario: PiscinaInventario, selectedDate: Date): string {
  const apertura = inventario.orario_apertura.slice(0, 5);
  const chiusura = inventario.orario_chiusura.slice(0, 5);
  if (!isSameDay(selectedDate, new Date())) return apertura;

  const now = nowHHMM();
  const nowMinutes = parseHHMMToMinutes(now)!;
  const aperturaMinutes = parseHHMMToMinutes(apertura)!;
  const chiusuraMinutes = parseHHMMToMinutes(chiusura)!;
  if (nowMinutes < aperturaMinutes) return apertura;
  if (nowMinutes > chiusuraMinutes) return chiusura;
  return now;
}

function validateOrario(value: string, inventario: PiscinaInventario, selectedDate: Date): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "L'orario è obbligatorio.";
  const minutes = parseHHMMToMinutes(trimmed);
  if (minutes === null) return 'Inserisci un orario valido (HH:MM).';

  const apertura = inventario.orario_apertura.slice(0, 5);
  const chiusura = inventario.orario_chiusura.slice(0, 5);
  if (minutes < parseHHMMToMinutes(apertura)! || minutes > parseHHMMToMinutes(chiusura)!) {
    return `La piscina è aperta dalle ${apertura} alle ${chiusura}.`;
  }
  if (isSameDay(selectedDate, new Date()) && minutes < parseHHMMToMinutes(nowHHMM())!) {
    return "L'orario non può essere nel passato.";
  }
  return null;
}

// Distribuisce un totale tra le `n` postazioni scelte il più equamente possibile, resto alle prime.
function distribuisciSuPostazioni(totale: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totale / n);
  const resto = totale % n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

function extractErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: unknown } })?.response?.data;
  if (detail && typeof detail === 'object') {
    const message = Object.values(detail as Record<string, unknown>).flat().join(' ');
    if (message) return message;
  }
  return fallback;
}

function DateNav({
  inventarioId,
  selectedDate,
  onChange,
}: Readonly<{ inventarioId: string; selectedDate: Date; onChange: (date: Date) => void }>) {
  const isToday = isSameDay(selectedDate, new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [fullByDate, setFullByDate] = useState<Record<string, boolean>>({});

  const handleVisibleMonthChange = (anno: number, mese: number) => {
    getGiorniPieniMese({ inventario: inventarioId, anno, mese })
      .then((date) => {
        const patch: Record<string, boolean> = {};
        date.forEach((iso) => {
          patch[iso] = true;
        });
        setFullByDate((prev) => ({ ...prev, ...patch }));
      })
      .catch(() => {});
  };

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

        <Pressable
          accessibilityLabel="Apri calendario per scegliere il giorno"
          onPress={() => setIsCalendarOpen(true)}
        >
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
              I giorni evidenziati in rosa sono già al completo.
            </Text>
            <CalendarPicker
              selectedDate={selectedDate}
              onSelect={(date) => {
                onChange(date);
                setIsCalendarOpen(false);
              }}
              minDate={new Date()}
              fullDates={fullByDate}
              onVisibleMonthChange={handleVisibleMonthChange}
            />
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}

// Pulsanti "－"/quantità/"＋" invece di un campo numerico da tastiera.
function RisorsaField({
  icon,
  label,
  value,
  onChangeText,
  prezzo,
  gratis,
  residuo,
}: Readonly<{
  icon: string;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  // Omesso solo per l'ingresso gratuito (sotto l'età minima bambini): niente prezzo da mostrare.
  prezzo?: string;
  gratis?: boolean;
  residuo?: number;
}>) {
  const quantita = Number.parseInt(value, 10) || 0;
  const maxRaggiunto = typeof residuo === 'number' && quantita >= residuo;

  return (
    <HStack space="sm" className="items-center">
      <Text size="md">{icon}</Text>
      <VStack className="flex-1">
        <Text size="sm" className="font-medium">
          {label}
        </Text>
        <Text size="2xs" className="text-muted-foreground">
          {gratis ? 'Gratis' : `€${formatPrezzo(prezzo ?? '0')}`}{' '}
          {typeof residuo === 'number' ? `· Residui: ${residuo}` : null}
        </Text>
      </VStack>
      <HStack space="xs" className="items-center">
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-full border-2 border-sky-300 bg-white"
          onPress={() => onChangeText(String(Math.max(0, quantita - 1)))}
          disabled={quantita <= 0}
          accessibilityLabel={`Diminuisci ${label}`}
        >
          <ButtonIcon as={RemoveIcon} className="text-sky-900" />
        </Button>
        <Text size="md" className="w-6 text-center font-bold text-sky-900">
          {quantita}
        </Text>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-full border-2 border-sky-300 bg-white"
          onPress={() => onChangeText(String(quantita + 1))}
          disabled={maxRaggiunto}
          accessibilityLabel={`Aumenta ${label}`}
        >
          <ButtonIcon as={AddIcon} className="text-sky-900" />
        </Button>
      </HStack>
    </HStack>
  );
}

export default function ClientePiscinaBookingScreen() {
  const { inventarioId } = useLocalSearchParams<{ inventarioId: string }>();

  const [inventario, setInventario] = useState<PiscinaInventario | null>(null);
  const [isLoadingInventario, setIsLoadingInventario] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [disponibilita, setDisponibilita] = useState<DisponibilitaPiscina | null>(null);

  const [form, setForm] = useState<FormState>({
    nome: '',
    telefono: '',
    note: '',
    orario: '',
    ingressi: '1',
    ingressiRidotti: '0',
    ingressiBambini: '0',
    ingressiGratuiti: '0',
    lettino: '0',
    sdraia: '0',
  });
  const [selezionePostazioni, setSelezionePostazioni] = useState<PiscinaSelezione>({
    ombrellone: 0,
    gazebo: 0,
    ids: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prenotazioneInviata, setPrenotazioneInviata] = useState(false);
  const [prenotazioneId, setPrenotazioneId] = useState<string | null>(null);
  const [isDownloadingBiglietto, setIsDownloadingBiglietto] = useState(false);
  const [isInfoPrezzoOpen, setIsInfoPrezzoOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  const setField = <K extends keyof FormState>(key: K) => (value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!inventarioId) return;
    getPiscinaInventario(inventarioId)
      .then((item) => {
        setInventario(item);
        setForm((prev) => ({ ...prev, orario: defaultOrario(item, selectedDate) }));
      })
      .catch(() => setLoadError('Impossibile trovare questa piscina.'))
      .finally(() => setIsLoadingInventario(false));
    // Solo al primo caricamento, non ad ogni cambio data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventarioId]);

  useEffect(() => {
    if (!inventarioId) return;
    getDisponibilitaPiscina({ inventario: inventarioId, data: toISODate(selectedDate) })
      .then(setDisponibilita)
      .catch(() => setDisponibilita(null));
  }, [inventarioId, selectedDate]);

  const totale = useMemo(() => {
    if (!inventario) return 0;
    const ingressi = Number.parseInt(form.ingressi, 10) || 0;
    const ingressiRidotti = Number.parseInt(form.ingressiRidotti, 10) || 0;
    const ingressiBambini = Number.parseInt(form.ingressiBambini, 10) || 0;
    let somma =
      ingressi * (Number.parseFloat(inventario.prezzo_ingresso) || 0) +
      ingressiRidotti * (Number.parseFloat(inventario.prezzo_ingresso_ridotto) || 0) +
      ingressiBambini * (Number.parseFloat(inventario.prezzo_ingresso_bambino) || 0);
    for (const key of RISORSE_KEYS) {
      const quantitaRisorsa = Number.parseInt(form[key], 10) || 0;
      const prezzoRisorsa = Number.parseFloat(inventario[`prezzo_${key}` as keyof PiscinaInventario] as string);
      somma += quantitaRisorsa * (Number.isNaN(prezzoRisorsa) ? 0 : prezzoRisorsa);
    }
    somma += selezionePostazioni.ombrellone * (Number.parseFloat(inventario.prezzo_ombrellone) || 0);
    somma += selezionePostazioni.gazebo * (Number.parseFloat(inventario.prezzo_gazebo) || 0);
    return somma;
  }, [inventario, form, selezionePostazioni]);

  const orarioMinutiCorrenti = parseHHMMToMinutes(form.orario);

  const mostraMappaPostazioni = Boolean(
    inventario && (inventario.totale_ombrelloni > 0 || inventario.totale_gazebi > 0)
  );
  const residuiPostazioni: DisponibilitaCardItem[] = [];
  if (inventario?.totale_ombrelloni) {
    residuiPostazioni.push({
      key: 'ombrellone',
      icon: '⛱️',
      label: 'Ombrelloni',
      residui: disponibilita?.ombrellone ?? inventario.totale_ombrelloni,
      totale: inventario.totale_ombrelloni,
    });
  }
  if (inventario?.totale_gazebi) {
    residuiPostazioni.push({
      key: 'gazebo',
      icon: '⛺',
      label: 'Gazebi',
      residui: disponibilita?.gazebo ?? inventario.totale_gazebi,
      totale: inventario.totale_gazebi,
    });
  }

  const handleSubmit = async () => {
    if (!inventario || !inventarioId) return;

    if (!form.nome.trim() || !form.telefono.trim()) {
      setError('Inserisci nome e telefono.');
      return;
    }
    const orarioError = validateOrario(form.orario, inventario, selectedDate);
    if (orarioError) {
      setError(orarioError);
      return;
    }
    const ingressi = Number.parseInt(form.ingressi, 10) || 0;
    const ingressiRidotti = Number.parseInt(form.ingressiRidotti, 10) || 0;
    const ingressiBambini = Number.parseInt(form.ingressiBambini, 10) || 0;
    const ingressiGratuiti = Number.parseInt(form.ingressiGratuiti, 10) || 0;
    if (ingressi + ingressiRidotti + ingressiBambini + ingressiGratuiti < 1) {
      setError('Seleziona almeno un ingresso.');
      return;
    }
    const ridottoError = validateOrarioIngressoRidotto(
      form.orario,
      ingressiRidotti,
      inventario.orario_inizio_ridotto
    );
    if (ridottoError) {
      setError(ridottoError);
      return;
    }
    if (Number.parseFloat(inventario.prezzo_ingresso_ridotto) > 0) {
      const interoError = validateOrarioIngressoIntero(form.orario, ingressi, inventario.orario_inizio_ridotto);
      if (interoError) {
        setError(interoError);
        return;
      }
    }
    const risorseDaValidare: Array<{ key: 'ombrellone' | 'gazebo' | 'lettino' | 'sdraia'; quantita: number }> = [
      { key: 'ombrellone', quantita: selezionePostazioni.ombrellone },
      { key: 'gazebo', quantita: selezionePostazioni.gazebo },
      ...RISORSE_KEYS.map((key) => ({ key, quantita: Number.parseInt(form[key], 10) || 0 })),
    ];
    for (const { key, quantita } of risorseDaValidare) {
      const residuo = disponibilita?.[key] ?? Infinity;
      if (quantita > residuo) {
        setError(`Disponibilità insufficiente: residuano solo ${residuo} ${key}.`);
        return;
      }
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const cliente = await createCliente({
        nome: form.nome.trim(),
        telefono: form.telefono.trim(),
      });
      const prenotazione = await createPrenotazionePiscina({
        cliente_id: cliente.id,
        data: toISODate(selectedDate),
        ora: form.orario.trim(),
        stato: 'CONFIRMED',
        inventario: inventarioId,
        note: form.note.trim(),
        ingressi,
        ingressi_ridotti: ingressiRidotti,
        ingressi_bambini: ingressiBambini,
        ingressi_gratuiti: ingressiGratuiti,
        ombrellone: selezionePostazioni.ombrellone,
        gazebo: selezionePostazioni.gazebo,
        lettino: Number.parseInt(form.lettino, 10) || 0,
        sdraia: Number.parseInt(form.sdraia, 10) || 0,
      });

      if (selezionePostazioni.ids.length > 0) {
        const lettiniPerPostazione = distribuisciSuPostazioni(
          Number.parseInt(form.lettino, 10) || 0,
          selezionePostazioni.ids.length
        );
        const sdraiePerPostazione = distribuisciSuPostazioni(
          Number.parseInt(form.sdraia, 10) || 0,
          selezionePostazioni.ids.length
        );
        // Best-effort: se una postazione non fosse più libera, l'assegnazione fallisce
        // silenziosamente e la prenotazione resta comunque valida (lo staff la assegnerà a mano).
        await Promise.allSettled(
          selezionePostazioni.ids.map((postazioneId, index) =>
            createOccupazione({
              postazione: postazioneId,
              data: toISODate(selectedDate),
              prenotazione: prenotazione.id,
              cliente_nome: form.nome.trim(),
              numero_lettini: lettiniPerPostazione[index] ?? 0,
              numero_sdraie: sdraiePerPostazione[index] ?? 0,
              orario_arrivo_previsto: form.orario.trim(),
              arrivato: false,
            })
          )
        );
      }

      setPrenotazioneId(prenotazione.id);
      setPrenotazioneInviata(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile inviare la richiesta. Controlla i dati inseriti.'));
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleScaricaBiglietto = async () => {
    if (!prenotazioneId) return;
    setIsDownloadingBiglietto(true);
    try {
      await apriBigliettoPdf(getBigliettoUrl(prenotazioneId), prenotazioneId);
    } catch {
      setError('Impossibile scaricare il biglietto. Riprova.');
    } finally {
      setIsDownloadingBiglietto(false);
    }
  };

  if (isLoadingInventario) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  if (loadError || !inventario) {
    return (
      <Box className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text size="sm" className="text-center text-destructive">
          {loadError ?? 'Piscina non trovata.'}
        </Text>
        <BackButton className="self-center" fallbackHref="/cliente/piscina" />
      </Box>
    );
  }

  if (prenotazioneInviata) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
        <VStack space="lg" className="w-full items-center">
          <Box className="w-full max-w-md items-center rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
            <Text size="3xl">✅</Text>
            <Heading size="lg" className="mt-2 text-center text-emerald-900">
              Prenotazione confermata!
            </Heading>
            <Text size="sm" className="mt-2 text-center text-emerald-800">
              La tua prenotazione per {inventario.nome} del{' '}
              {formatDisplayDate(selectedDate)} alle {form.orario} è confermata. Ti contatteremo
              al numero indicato solo in caso di necessità.
            </Text>
          </Box>

          <Box className="w-full max-w-md rounded-2xl border border-sky-200 bg-sky-100 p-5">
            <Text size="sm" className="text-center text-sky-900">
              🎫 Scarica il biglietto e mostralo in biglietteria: riporta il riepilogo della tua
              prenotazione, già confermata.
            </Text>
            <Button className="mt-3" onPress={handleScaricaBiglietto} disabled={isDownloadingBiglietto}>
              {isDownloadingBiglietto ? <ButtonSpinner /> : <ButtonText>Scarica biglietto (PDF)</ButtonText>}
            </Button>
            {error ? (
              <Text size="xs" className="mt-2 text-center text-destructive">
                {error}
              </Text>
            ) : null}
          </Box>

          <Button variant="outline" className="border-2 border-sky-300 bg-white" onPress={() => router.replace('/cliente')}>
            <ButtonText>Torna alla home</ButtonText>
          </Button>
          <ClienteFooter />
        </VStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <VStack space="xs">
          <Heading size="xl">{inventario.nome}</Heading>
          <Text size="sm" className="text-muted-foreground">
            {inventario.orario_apertura.slice(0, 5)} - {inventario.orario_chiusura.slice(0, 5)} · Scegli data,
            orario e cosa vuoi prenotare.
          </Text>
        </VStack>

        <DateNav inventarioId={inventarioId} selectedDate={selectedDate} onChange={setSelectedDate} />

        {disponibilita?.pieno ? (
          <Box className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <HStack space="sm" className="items-start">
              <Icon as={LockIcon} size="md" className="mt-0.5 text-rose-700" />
              <VStack className="flex-1">
                <Heading size="sm" className="text-rose-900">
                  Giorno al completo
                </Heading>
                <Text size="sm" className="mt-1 text-rose-800">
                  Per {formatDisplayDate(selectedDate)} non è possibile effettuare nuove
                  prenotazioni online. Prova a scegliere un altro giorno, oppure contatta
                  direttamente la struttura.
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
                  <InputField placeholder="Es. Mario Rossi" value={form.nome} onChangeText={setField('nome')} />
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
                    value={form.telefono}
                    onChangeText={setField('telefono')}
                  />
                </Input>
                <Text size="2xs" className="text-sky-900/60">
                  📌 Usa sempre lo stesso numero: ci aiuta a riconoscerti e a ritrovare le tue
                  preferenze, ed è anche quello con cui potrai ritrovare le tue prenotazioni in
                  "Le mie prenotazioni", dalla home.
                </Text>
              </VStack>

              <VStack space="xs">
                <HStack space="xs" className="items-center">
                  <Text size="sm">📝</Text>
                  <Text size="sm" className="font-medium">
                    Note
                  </Text>
                  <Text size="xs" className="text-muted-foreground">
                    (opzionale)
                  </Text>
                </HStack>
                <Input>
                  <InputField
                    placeholder="Es. allergie, richieste particolari..."
                    value={form.note}
                    onChangeText={setField('note')}
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <HStack space="xs" className="items-center">
                  <Icon as={ClockIcon} size="sm" className="text-sky-700" />
                  <Text size="sm" className="font-medium">
                    Orario di arrivo previsto
                  </Text>
                  <Text size="xs" className="text-destructive">
                    *
                  </Text>
                </HStack>
                <Pressable
                  onPress={() => setIsTimePickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Scegli l'orario di arrivo dall'orologio"
                  className="min-h-9 w-full flex-row items-center justify-between rounded-md border border-border bg-transparent px-3 py-2"
                >
                  <Text size="sm" className={form.orario ? 'font-semibold text-sky-900' : 'text-muted-foreground'}>
                    {form.orario || `Es. ${inventario.orario_apertura.slice(0, 5)}`}
                  </Text>
                  <Icon as={ClockIcon} size="sm" className="text-sky-700" />
                </Pressable>
                <Text size="2xs" className="text-sky-900/60">
                  Orario di apertura: {inventario.orario_apertura.slice(0, 5)} -{' '}
                  {inventario.orario_chiusura.slice(0, 5)}
                </Text>
              </VStack>
            </VStack>

            <Suspense fallback={null}>
              <TimePickerModal
                visible={isTimePickerOpen}
                onDismiss={() => setIsTimePickerOpen(false)}
                onConfirm={({ hours, minutes }) => {
                  setIsTimePickerOpen(false);
                  setField('orario')(minutesToHHMM(hours * 60 + minutes));
                }}
                hours={orarioMinutiCorrenti !== null ? Math.floor(orarioMinutiCorrenti / 60) : undefined}
                minutes={orarioMinutiCorrenti !== null ? orarioMinutiCorrenti % 60 : undefined}
                use24HourClock
                locale="it"
                label="Orario di arrivo previsto"
                cancelLabel="Annulla"
                confirmLabel="OK"
                animationType="fade"
              />
            </Suspense>

            <VStack space="md" className="w-full rounded-2xl border border-sky-200 bg-sky-100 p-5">
              <Heading size="sm">Cosa vuoi prenotare</Heading>
              <RisorsaField
                icon="🎟️"
                label="Ingressi"
                value={form.ingressi}
                onChangeText={setField('ingressi')}
                prezzo={inventario.prezzo_ingresso}
              />
              {Number.parseFloat(inventario.prezzo_ingresso_ridotto) > 0 ? (
                <RisorsaField
                  icon="🌇"
                  label={`Ingressi ridotti (dalle ${inventario.orario_inizio_ridotto.slice(0, 5)})`}
                  value={form.ingressiRidotti}
                  onChangeText={setField('ingressiRidotti')}
                  prezzo={inventario.prezzo_ingresso_ridotto}
                />
              ) : null}
              {Number.parseFloat(inventario.prezzo_ingresso_bambino) > 0 ? (
                <RisorsaField
                  icon="🧒"
                  label={`Ingressi bambini (${inventario.eta_minima_bambino}-${inventario.eta_massima_bambino} anni)`}
                  value={form.ingressiBambini}
                  onChangeText={setField('ingressiBambini')}
                  prezzo={inventario.prezzo_ingresso_bambino}
                />
              ) : null}
              {Number.parseFloat(inventario.prezzo_ingresso_bambino) > 0 ? (
                <RisorsaField
                  icon="🆓"
                  label={`Ingressi gratuiti (sotto ${inventario.eta_minima_bambino} anni)`}
                  value={form.ingressiGratuiti}
                  onChangeText={setField('ingressiGratuiti')}
                  gratis
                />
              ) : null}
              {inventario.totale_lettini > 0 ? (
                <RisorsaField
                  icon="🛏️"
                  label="Lettini"
                  value={form.lettino}
                  onChangeText={setField('lettino')}
                  prezzo={inventario.prezzo_lettino}
                  residuo={disponibilita?.lettino}
                />
              ) : null}
              {inventario.totale_sdraie > 0 ? (
                <RisorsaField
                  icon="🪑"
                  label="Sdraie"
                  value={form.sdraia}
                  onChangeText={setField('sdraia')}
                  prezzo={inventario.prezzo_sdraia}
                  residuo={disponibilita?.sdraia}
                />
              ) : null}

              <Box className="rounded-xl bg-white/60 px-3 py-2">
                <HStack className="items-center justify-between">
                  <HStack space="xs" className="items-center">
                    <Text size="sm" className="font-medium text-sky-900">
                      Totale stimato
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Informazioni sul prezzo dell'ingresso"
                      accessibilityState={{ expanded: isInfoPrezzoOpen }}
                      onPress={() => setIsInfoPrezzoOpen((prev) => !prev)}
                      className="h-6 w-6 items-center justify-center rounded-full active:bg-sky-200"
                    >
                      <Icon as={InfoIcon} size="sm" className="text-sky-700" />
                    </Pressable>
                  </HStack>
                  <Text size="md" className="font-bold text-sky-900">
                    €{totale.toFixed(2).replace('.', ',')}
                  </Text>
                </HStack>
                {isInfoPrezzoOpen ? (
                  <Text size="xs" className="mt-2 text-sky-900/70">
                    Il prezzo dell'ingresso potrebbe variare in base all'orario di arrivo e alla
                    presenza di bambini: il totale qui sopra è solo una stima.
                  </Text>
                ) : null}
              </Box>
            </VStack>

            {mostraMappaPostazioni ? (
              <VStack space="md" className="w-full rounded-2xl border border-sky-200 bg-sky-100 p-5">
                <VStack space="xs">
                  <Heading size="sm">Scegli la tua postazione</Heading>
                  <Text size="xs" className="text-sky-900/70">
                    Tocca una postazione libera sulla mappa per selezionarla, tocca di nuovo per
                    deselezionarla. Trascina per spostarti e pizzica con due dita (o usa i pulsanti)
                    per ingrandire.
                  </Text>
                  <Text size="xs" className="text-sky-900/70">
                    💡 Per stare comodi, ti consigliamo al massimo 3 lettini/sdraie complessivi per
                    ogni ombrellone o gazebo prenotato.
                  </Text>
                </VStack>

                {residuiPostazioni.length > 0 ? (
                  <DisponibilitaCards items={residuiPostazioni} title="Disponibilità residua" />
                ) : null}

                <PiscinaMappaSelettore
                  inventarioId={inventarioId}
                  selectedDate={selectedDate}
                  selectedIds={new Set(selezionePostazioni.ids)}
                  onSelectionChange={setSelezionePostazioni}
                />

                <Text size="sm" className="text-center font-medium text-sky-900">
                  {selezionePostazioni.ombrellone === 0 && selezionePostazioni.gazebo === 0
                    ? 'Nessuna postazione selezionata (solo ingresso)'
                    : [
                        selezionePostazioni.ombrellone > 0 ? `⛱️ ${selezionePostazioni.ombrellone}` : null,
                        selezionePostazioni.gazebo > 0 ? `⛺ ${selezionePostazioni.gazebo}` : null,
                      ]
                        .filter(Boolean)
                        .join('   ')}
                </Text>
              </VStack>
            ) : null}

            {error ? (
              <Text size="sm" className="text-center text-destructive">
                {error}
              </Text>
            ) : null}

            <Button onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ButtonSpinner /> : <ButtonText>Prenota ora</ButtonText>}
            </Button>
            <Text size="2xs" className="text-center text-muted-foreground">
              La prenotazione viene confermata subito, senza attese.
            </Text>
          </>
        )}

        <BackButton fallbackHref="/cliente/piscina" />

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
