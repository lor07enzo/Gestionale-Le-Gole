import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
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
import { ArrowLeftIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, Icon } from '@/components/ui/icon';
import { goBackOr } from '../../src/utils/navigation';
import { MenuAsportoSection } from '../../src/components/staff/MenuAsportoSection';
import {
  createGiornoChiusoAsporto,
  deleteGiornoChiusoAsporto,
  getConfigurazioneAsporto,
  listGiorniChiusiAsporto,
  updateConfigurazioneAsporto,
  type ConfigurazioneAsporto,
  type GiornoChiusoAsporto,
} from '../../src/services/menu';
import { formatOrarioInput, formatTime, parseHHMMToMinutes, toISODate } from '../../src/utils/piscinaMappa';
import { WEEKDAY_LABELS, addMonths, buildMonthGrid, formatMonthLabel, startOfMonth } from '../../src/utils/calendar';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object') {
      if ('detail' in data && typeof (data as { detail?: unknown }).detail === 'string') {
        return (data as { detail: string }).detail;
      }
      const values = Object.values(data as Record<string, unknown>).flat();
      const messages = values.filter((value): value is string => typeof value === 'string');
      if (messages.length > 0) return messages.join(' ');
    }
  }
  return fallback;
}

function AsportoHeader() {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/staff')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">Menu Asporto</Heading>
        <Text size="sm" className="text-muted-foreground">
          Catalogo prodotti e orario di disponibilità del servizio.
        </Text>
      </VStack>
    </HStack>
  );
}

// Teaser cliccabile verso la pagina dedicata "Nuovo ordine" (app/staff/asporto/ordini/nuovo.tsx)
// — collegamento diretto dalla pagina Asporto stessa, non solo raggiungibile passando prima da
// "Storico Ordini" (dove esiste comunque un secondo pulsante equivalente, sezione 15): un ordine
// walk-in è un'azione che lo staff vuole poter avviare senza un tap in più. Tono smeraldo (non
// sky come le altre card di questa pagina) per distinguerla come azione di creazione, stesso
// linguaggio già usato altrove nell'app per "+ Nuovo cliente".
function NuovoOrdineLinkCard() {
  return (
    <Pressable
      onPress={() => router.push('/staff/asporto/ordini/nuovo' as Href)}
      accessibilityRole="button"
      accessibilityLabel="Crea un nuovo ordine manuale"
      className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 active:opacity-90"
    >
      <VStack space="sm" className="p-4">
        <HStack space="sm" className="items-center">
          <Box className="h-10 w-10 items-center justify-center rounded-full bg-white/70">
            <Text size="lg">➕</Text>
          </Box>
          <VStack className="flex-1">
            <Heading size="sm">Nuovo ordine</Heading>
            <Text size="xs" className="text-emerald-900/70">
              Registra un ordine al banco o per telefono, già confermato
            </Text>
          </VStack>
          <Icon as={ChevronRightIcon} size="md" className="text-emerald-700" />
        </HStack>
      </VStack>
    </Pressable>
  );
}

// Teaser cliccabile verso la pagina dedicata "Storico Ordini" (app/staff/asporto/ordini.tsx) —
// stesso linguaggio visivo di MenuAsportoLinkCard sulla home staff (pill CTA con freccia "→"),
// qui però come card interna alla pagina asporto invece che come punto d'ingresso dalla home:
// vive accanto a orario/chiusure/catalogo, non li sostituisce.
function StoricoOrdiniLinkCard() {
  return (
    <Pressable
      onPress={() => router.push('/staff/asporto/ordini')}
      accessibilityRole="button"
      accessibilityLabel="Apri storico ordini asporto"
      className="w-full rounded-2xl border border-sky-200 bg-sky-100 active:opacity-90"
    >
      <VStack space="sm" className="p-4">
        <HStack space="sm" className="items-center">
          <Box className="h-10 w-10 items-center justify-center rounded-full bg-white/70">
            <Text size="lg">📋</Text>
          </Box>
          <VStack className="flex-1">
            <Heading size="sm">Storico Ordini</Heading>
            <Text size="xs" className="text-sky-900/70">
              Ordini di oggi modificabili/annullabili, quelli passati in sola consultazione
            </Text>
          </VStack>
          <Icon as={ChevronRightIcon} size="md" className="text-sky-700" />
        </HStack>
      </VStack>
    </Pressable>
  );
}

// Orario di inizio/fine disponibilità del servizio asporto — una sola impostazione condivisa
// (nessun concetto di "listino/inventario" per l'asporto, sezione 1 di CLAUDE.md), letta/scritta
// sulla riga singleton `ConfigurazioneAsporto` lato backend.
function OrarioDisponibilitaCard() {
  const [apertura, setApertura] = useState('');
  const [chiusura, setChiusura] = useState('');
  // Ultimi valori confermati dal backend (al caricamento o dopo un salvataggio riuscito) — il
  // confronto con apertura/chiusura correnti decide se c'è davvero qualcosa da salvare.
  const [savedApertura, setSavedApertura] = useState('');
  const [savedChiusura, setSavedChiusura] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    getConfigurazioneAsporto()
      .then((config: ConfigurazioneAsporto) => {
        const oraApertura = formatTime(config.orario_apertura);
        const oraChiusura = formatTime(config.orario_chiusura);
        setApertura(oraApertura);
        setChiusura(oraChiusura);
        setSavedApertura(oraApertura);
        setSavedChiusura(oraChiusura);
      })
      .catch(() => setError("Impossibile caricare l'orario del servizio."))
      .finally(() => setIsLoading(false));
  }, []);

  const isDirty = apertura !== savedApertura || chiusura !== savedChiusura;

  const handleChangeApertura = (next: string) => {
    setApertura(formatOrarioInput(apertura, next));
    setJustSaved(false);
  };

  const handleChangeChiusura = (next: string) => {
    setChiusura(formatOrarioInput(chiusura, next));
    setJustSaved(false);
  };

  // Riporta i campi agli ultimi valori confermati dal backend — compare solo quando c'è
  // effettivamente qualcosa da scartare (`isDirty`, sotto), stesso principio del pulsante "Salva".
  const handleCancel = () => {
    setApertura(savedApertura);
    setChiusura(savedChiusura);
    setError(null);
    setJustSaved(false);
  };

  const handleSave = async () => {
    setJustSaved(false);
    const minutiApertura = parseHHMMToMinutes(apertura);
    const minutiChiusura = parseHHMMToMinutes(chiusura);
    if (minutiApertura === null || minutiChiusura === null) {
      setError('Inserisci due orari validi (HH:MM).');
      return;
    }
    if (minutiApertura >= minutiChiusura) {
      setError("L'orario di fine deve essere successivo a quello di inizio.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const updated = await updateConfigurazioneAsporto({
        orario_apertura: apertura,
        orario_chiusura: chiusura,
      });
      const oraApertura = formatTime(updated.orario_apertura);
      const oraChiusura = formatTime(updated.orario_chiusura);
      setApertura(oraApertura);
      setChiusura(oraChiusura);
      setSavedApertura(oraApertura);
      setSavedChiusura(oraChiusura);
      setJustSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, "Impossibile salvare l'orario."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
      <HStack space="xs" className="items-center">
        <Icon as={ClockIcon} size="sm" className="text-sky-700" />
        <Heading size="sm">Orario di disponibilità del servizio</Heading>
      </HStack>
      <Text size="xs" className="text-muted-foreground">
        L'intervallo in cui il servizio asporto è disponibile.
      </Text>

      {isLoading ? (
        <HStack space="sm" className="items-center py-2">
          <Spinner size="small" />
        </HStack>
      ) : (
        <>
          <HStack space="md" className="items-start">
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium">
                Dalle
              </Text>
              <Input>
                <InputField
                  placeholder="Es. 11:00"
                  keyboardType="numeric"
                  maxLength={5}
                  value={apertura}
                  onChangeText={handleChangeApertura}
                />
              </Input>
            </VStack>
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium">
                Alle
              </Text>
              <Input>
                <InputField
                  placeholder="Es. 22:00"
                  keyboardType="numeric"
                  maxLength={5}
                  value={chiusura}
                  onChangeText={handleChangeChiusura}
                />
              </Input>
            </VStack>
          </HStack>

          {error ? (
            <Text size="xs" className="text-destructive">
              {error}
            </Text>
          ) : null}
          {justSaved && !error ? (
            <Text size="xs" className="text-emerald-700">
              Orario aggiornato.
            </Text>
          ) : null}

          <HStack space="sm" className="items-center">
            <Button
              size="sm"
              onPress={handleSave}
              disabled={isSaving || !isDirty}
              isDisabled={isSaving || !isDirty}
              className="self-start"
            >
              {isSaving ? <ButtonSpinner /> : <ButtonText>Salva orario</ButtonText>}
            </Button>
            {isDirty ? (
              <Button
                size="sm"
                variant="outline"
                onPress={handleCancel}
                disabled={isSaving}
                isDisabled={isSaving}
                className="self-start border-2 border-sky-300 bg-white"
              >
                <ButtonText className="text-sky-700">Annulla</ButtonText>
              </Button>
            ) : null}
          </HStack>
        </>
      )}
    </VStack>
  );
}

// Calendario a tocco: un giorno normale è aperto al ritiro asporto, toccarlo lo chiude (es.
// festività) — toccare di nuovo un giorno già chiuso lo riapre. Stesso principio "toggle
// immediato senza conferma" di GiornoPienoToggle.tsx (mappa piscina), qui esteso a più giorni
// non necessariamente consecutivi invece di un singolo giorno selezionato altrove nell'app.
//
// Il calendario vive dentro un Actionsheet, non inline nella pagina (2026-08-19, su richiesta
// esplicita dell'utente: "il calendario deve essere visibile solo tramite azione effettuata
// dall'utente, per prevenire click errati") — un tocco sul calendario cambia subito lo stato di
// un giorno (nessuna conferma, sopra), quindi tenerlo sempre in vista in mezzo alla pagina
// rischierebbe un tocco accidentale durante lo scroll. Stesso pattern "pulsante che apre un
// foglio" già usato per "Categorie e Allergeni" in MenuAsportoSection.tsx (sezione 15) — la card
// resta sulla pagina solo come riepilogo (quanti giorni sono già segnati) più il pulsante per
// aprire il calendario vero e proprio.
function GiorniChiusuraAsportoCard() {
  const [chiusure, setChiusure] = useState<GiornoChiusoAsporto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [busyIso, setBusyIso] = useState<string | null>(null);
  const [isCalendarioOpen, setIsCalendarioOpen] = useState(false);

  useEffect(() => {
    listGiorniChiusiAsporto()
      .then(setChiusure)
      .catch(() => setError('Impossibile caricare i giorni di chiusura.'))
      .finally(() => setIsLoading(false));
  }, []);

  const chiusuraByIso = useMemo(() => {
    const map = new Map<string, GiornoChiusoAsporto>();
    chiusure.forEach((giorno) => map.set(giorno.data, giorno));
    return map;
  }, [chiusure]);

  const oggiIso = toISODate(new Date());
  const griglia = buildMonthGrid(visibleMonth);
  const settimane = Array.from({ length: griglia.length / 7 }, (_, i) => griglia.slice(i * 7, i * 7 + 7));

  const handleToggleGiorno = async (iso: string) => {
    setError(null);
    setBusyIso(iso);
    try {
      const esistente = chiusuraByIso.get(iso);
      if (esistente) {
        await deleteGiornoChiusoAsporto(esistente.id);
        setChiusure((prev) => prev.filter((giorno) => giorno.id !== esistente.id));
      } else {
        const created = await createGiornoChiusoAsporto({ data: iso });
        setChiusure((prev) => [...prev, created]);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile aggiornare il giorno.'));
    } finally {
      setBusyIso(null);
    }
  };

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
      <HStack space="xs" className="items-center">
        <Icon as={CalendarDaysIcon} size="sm" className="text-sky-700" />
        <Heading size="sm">Giorni di chiusura</Heading>
      </HStack>
      <Text size="xs" className="text-muted-foreground">
        Segna i giorni in cui il ritiro asporto non è disponibile (es. festività). I clienti
        vengono avvisati in anticipo se il giorno successivo è chiuso.
      </Text>

      {isLoading ? (
        <HStack space="sm" className="items-center py-2">
          <Spinner size="small" />
        </HStack>
      ) : (
        <>
          <Text size="xs" className="text-sky-900/70">
            {chiusure.length > 0
              ? `${chiusure.length} giorno/i di chiusura programmati (passati inclusi).`
              : 'Nessun giorno di chiusura programmato.'}
          </Text>

          {error ? (
            <Text size="xs" className="text-destructive">
              {error}
            </Text>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            className="self-start border-2 border-sky-300 bg-white"
            onPress={() => setIsCalendarioOpen(true)}
          >
            <ButtonIcon as={CalendarDaysIcon} className="text-sky-700" />
            <ButtonText className="text-sky-700">Apri calendario</ButtonText>
          </Button>
        </>
      )}

      <Actionsheet isOpen={isCalendarioOpen} onClose={() => setIsCalendarioOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent aria-label="Giorni di chiusura asporto">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack space="md" className="w-full pb-6">
            <VStack>
              <Heading size="md">Giorni di chiusura</Heading>
              <Text size="xs" className="text-muted-foreground">
                Tocca un giorno per chiuderlo al ritiro asporto — toccalo di nuovo per riaprirlo.
              </Text>
            </VStack>

            <HStack className="items-center justify-between">
              <Pressable
                onPress={() => setVisibleMonth((prev) => addMonths(prev, -1))}
                accessibilityLabel="Mese precedente"
                className="h-8 w-8 items-center justify-center rounded-full active:bg-sky-100"
              >
                <Icon as={ChevronLeftIcon} size="sm" className="text-sky-700" />
              </Pressable>
              <Text size="sm" className="font-semibold text-sky-900">
                {formatMonthLabel(visibleMonth)}
              </Text>
              <Pressable
                onPress={() => setVisibleMonth((prev) => addMonths(prev, 1))}
                accessibilityLabel="Mese successivo"
                className="h-8 w-8 items-center justify-center rounded-full active:bg-sky-100"
              >
                <Icon as={ChevronRightIcon} size="sm" className="text-sky-700" />
              </Pressable>
            </HStack>

            <HStack className="justify-between">
              {WEEKDAY_LABELS.map((label) => (
                <Box key={label} className="w-9 items-center">
                  <Text size="2xs" className="font-medium text-muted-foreground">
                    {label}
                  </Text>
                </Box>
              ))}
            </HStack>

            <VStack space="xs">
              {settimane.map((settimana) => (
                <HStack key={toISODate(settimana[0].date)} className="justify-between">
                  {settimana.map((cell) => {
                    const iso = toISODate(cell.date);
                    const isChiuso = chiusuraByIso.has(iso);
                    const isPassato = iso < oggiIso;
                    const isBusy = busyIso === iso;
                    const disabled = !cell.inCurrentMonth || isPassato || isBusy;
                    return (
                      <Pressable
                        key={iso}
                        onPress={() => handleToggleGiorno(iso)}
                        disabled={disabled}
                        accessibilityLabel={
                          isChiuso
                            ? `${iso}, chiuso al ritiro asporto, tocca per riaprire`
                            : `${iso}, tocca per chiudere al ritiro asporto`
                        }
                        className={`h-9 w-9 items-center justify-center rounded-full ${
                          isChiuso ? 'bg-rose-100' : ''
                        } ${!cell.inCurrentMonth || isPassato ? 'opacity-30' : ''}`}
                      >
                        {isBusy ? (
                          <Spinner size="small" />
                        ) : (
                          <Text size="xs" className={isChiuso ? 'font-semibold text-rose-700' : 'text-sky-900'}>
                            {cell.date.getDate()}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </HStack>
              ))}
            </VStack>

            {error ? (
              <Text size="xs" className="text-destructive">
                {error}
              </Text>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              className="self-start border-2 border-sky-300 bg-white"
              onPress={() => setIsCalendarioOpen(false)}
            >
              <ButtonText className="text-sky-700">Chiudi</ButtonText>
            </Button>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </VStack>
  );
}

export default function AsportoScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <AsportoHeader />
        <NuovoOrdineLinkCard />
        <StoricoOrdiniLinkCard />
        <OrarioDisponibilitaCard />
        <GiorniChiusuraAsportoCard />
        <Box className="h-px w-full bg-sky-200" />
        <MenuAsportoSection />
      </VStack>
    </ScrollView>
  );
}
