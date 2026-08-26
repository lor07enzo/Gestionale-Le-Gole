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
import { Switch } from '@/components/ui/switch';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Icon,
} from '@/components/ui/icon';
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
// sulla riga singleton `ConfigurazioneAsporto` lato backend. Il secondo turno (sotto, opzionale —
// es. pranzo/cena) è una seconda sezione dentro la stessa card, non una card a sé: concettualmente
// è lo stesso "orario di disponibilità", solo con una seconda fascia — un solo Salva per l'intera
// configurazione evita due stati di dirty/salvataggio separati per impostazioni correlate.
function OrarioDisponibilitaCard() {
  const [apertura, setApertura] = useState('');
  const [chiusura, setChiusura] = useState('');
  // Secondo turno: `secondoTurnoAttivo` decide se i campi sotto sono mostrati/inviati, i valori
  // restano comunque in stato locale anche da disattivato (riattivarlo senza aver salvato non
  // perde quanto digitato).
  const [secondoTurnoAttivo, setSecondoTurnoAttivo] = useState(false);
  const [apertura2, setApertura2] = useState('');
  const [chiusura2, setChiusura2] = useState('');
  // Ultimi valori confermati dal backend (al caricamento o dopo un salvataggio riuscito) — il
  // confronto con i valori correnti decide se c'è davvero qualcosa da salvare.
  const [savedApertura, setSavedApertura] = useState('');
  const [savedChiusura, setSavedChiusura] = useState('');
  const [savedSecondoTurnoAttivo, setSavedSecondoTurnoAttivo] = useState(false);
  const [savedApertura2, setSavedApertura2] = useState('');
  const [savedChiusura2, setSavedChiusura2] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    getConfigurazioneAsporto()
      .then((config: ConfigurazioneAsporto) => {
        const oraApertura = formatTime(config.orario_apertura);
        const oraChiusura = formatTime(config.orario_chiusura);
        const attivo2 = Boolean(config.orario_apertura_2 && config.orario_chiusura_2);
        const oraApertura2 = config.orario_apertura_2 ? formatTime(config.orario_apertura_2) : '';
        const oraChiusura2 = config.orario_chiusura_2 ? formatTime(config.orario_chiusura_2) : '';
        setApertura(oraApertura);
        setChiusura(oraChiusura);
        setSavedApertura(oraApertura);
        setSavedChiusura(oraChiusura);
        setSecondoTurnoAttivo(attivo2);
        setSavedSecondoTurnoAttivo(attivo2);
        setApertura2(oraApertura2);
        setChiusura2(oraChiusura2);
        setSavedApertura2(oraApertura2);
        setSavedChiusura2(oraChiusura2);
      })
      .catch(() => setError("Impossibile caricare l'orario del servizio."))
      .finally(() => setIsLoading(false));
  }, []);

  const isDirty =
    apertura !== savedApertura ||
    chiusura !== savedChiusura ||
    secondoTurnoAttivo !== savedSecondoTurnoAttivo ||
    (secondoTurnoAttivo && (apertura2 !== savedApertura2 || chiusura2 !== savedChiusura2));

  const handleChangeApertura = (next: string) => {
    setApertura(formatOrarioInput(apertura, next));
    setJustSaved(false);
  };

  const handleChangeChiusura = (next: string) => {
    setChiusura(formatOrarioInput(chiusura, next));
    setJustSaved(false);
  };

  const handleChangeApertura2 = (next: string) => {
    setApertura2(formatOrarioInput(apertura2, next));
    setJustSaved(false);
  };

  const handleChangeChiusura2 = (next: string) => {
    setChiusura2(formatOrarioInput(chiusura2, next));
    setJustSaved(false);
  };

  const handleToggleSecondoTurno = (next: boolean) => {
    setSecondoTurnoAttivo(next);
    setError(null);
    setJustSaved(false);
  };

  // Riporta i campi agli ultimi valori confermati dal backend — compare solo quando c'è
  // effettivamente qualcosa da scartare (`isDirty`, sotto), stesso principio del pulsante "Salva".
  const handleCancel = () => {
    setApertura(savedApertura);
    setChiusura(savedChiusura);
    setSecondoTurnoAttivo(savedSecondoTurnoAttivo);
    setApertura2(savedApertura2);
    setChiusura2(savedChiusura2);
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

    let payloadApertura2: string | null = null;
    let payloadChiusura2: string | null = null;
    if (secondoTurnoAttivo) {
      const minutiApertura2 = parseHHMMToMinutes(apertura2);
      const minutiChiusura2 = parseHHMMToMinutes(chiusura2);
      if (minutiApertura2 === null || minutiChiusura2 === null) {
        setError('Inserisci due orari validi per il secondo turno (HH:MM).');
        return;
      }
      if (minutiApertura2 >= minutiChiusura2) {
        setError("L'orario di fine del secondo turno deve essere successivo a quello di inizio.");
        return;
      }
      if (minutiApertura2 < minutiChiusura) {
        setError('Il secondo turno deve iniziare non prima della chiusura del primo.');
        return;
      }
      payloadApertura2 = apertura2;
      payloadChiusura2 = chiusura2;
    }

    setError(null);
    setIsSaving(true);
    try {
      const updated = await updateConfigurazioneAsporto({
        orario_apertura: apertura,
        orario_chiusura: chiusura,
        orario_apertura_2: payloadApertura2,
        orario_chiusura_2: payloadChiusura2,
      });
      const oraApertura = formatTime(updated.orario_apertura);
      const oraChiusura = formatTime(updated.orario_chiusura);
      const attivo2 = Boolean(updated.orario_apertura_2 && updated.orario_chiusura_2);
      const oraApertura2 = updated.orario_apertura_2 ? formatTime(updated.orario_apertura_2) : '';
      const oraChiusura2 = updated.orario_chiusura_2 ? formatTime(updated.orario_chiusura_2) : '';
      setApertura(oraApertura);
      setChiusura(oraChiusura);
      setSavedApertura(oraApertura);
      setSavedChiusura(oraChiusura);
      setSecondoTurnoAttivo(attivo2);
      setSavedSecondoTurnoAttivo(attivo2);
      setApertura2(oraApertura2);
      setChiusura2(oraChiusura2);
      setSavedApertura2(oraApertura2);
      setSavedChiusura2(oraChiusura2);
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

          {/* Seconda sezione — secondo turno opzionale (es. pranzo/cena): il servizio può essere
              disponibile in due fasce separate nella stessa giornata invece di un unico
              intervallo continuo. Il divisore sopra e l'etichetta sotto la rendono una sezione
              distinta pur restando nella stessa card/stesso Salva del primo turno. */}
          <Box className="h-px w-full bg-sky-100" />
          <HStack space="sm" className="items-center justify-between">
            <VStack className="flex-1">
              <Text size="sm" className="font-medium">
                Secondo turno
              </Text>
              <Text size="xs" className="text-muted-foreground">
                Es. pranzo e cena, con una pausa nel mezzo — opzionale.
              </Text>
            </VStack>
            <Switch value={secondoTurnoAttivo} onValueChange={handleToggleSecondoTurno} />
          </HStack>

          {secondoTurnoAttivo ? (
            <HStack space="md" className="items-start">
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Dalle
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. 19:00"
                    keyboardType="numeric"
                    maxLength={5}
                    value={apertura2}
                    onChangeText={handleChangeApertura2}
                  />
                </Input>
              </VStack>
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Alle
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. 22:30"
                    keyboardType="numeric"
                    maxLength={5}
                    value={chiusura2}
                    onChangeText={handleChangeChiusura2}
                  />
                </Input>
              </VStack>
            </HStack>
          ) : null}

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

// Numero massimo di prodotti ordinabili complessivamente a un qualunque orario di ritiro — un
// UNICO valore globale (`ConfigurazioneAsporto.limite_prodotti_orario`), applicato automaticamente
// a ogni orario: lo staff imposta solo la quantità, non deve scegliere l'ora (su richiesta
// esplicita dell'utente, che ha corretto una prima versione per-orario proprio per questo). Se un
// cliente ne ordina 10 e un altro ne vuole altri 6 sullo stesso orario con un limite di 15, il
// secondo vede quell'orario come "non più disponibile" (sezioni 7/15 dei picker orario
// cliente/staff) — riflette quanti piatti la cucina riesce davvero a preparare in una fascia, non
// un tetto per singolo ordine/cliente. Stesso pattern "campo + Salva/Annulla" di
// `OrarioDisponibilitaCard` sopra, entrambe leggono/scrivono la stessa riga singleton.
function LimiteProdottiOrarioCard() {
  const [limite, setLimite] = useState('');
  // Ultimo valore confermato dal backend (null = nessun limite) — il confronto con `limite`
  // decide se c'è davvero qualcosa da salvare, stesso principio di `isDirty` sopra.
  const [savedLimite, setSavedLimite] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    getConfigurazioneAsporto()
      .then((config: ConfigurazioneAsporto) => {
        setSavedLimite(config.limite_prodotti_orario);
        setLimite(config.limite_prodotti_orario != null ? String(config.limite_prodotti_orario) : '');
      })
      .catch(() => setError('Impossibile caricare il limite.'))
      .finally(() => setIsLoading(false));
  }, []);

  const limiteNumero = limite.trim() === '' ? null : Number.parseInt(limite, 10);
  const isDirty = limiteNumero !== savedLimite;

  const handleChangeLimite = (next: string) => {
    // Solo cifre: un campo numerico puro, non mascherato come gli orari.
    setLimite(next.replace(/[^0-9]/g, ''));
    setJustSaved(false);
  };

  const handleCancel = () => {
    setLimite(savedLimite != null ? String(savedLimite) : '');
    setError(null);
    setJustSaved(false);
  };

  const handleSave = async () => {
    setJustSaved(false);
    if (limite.trim() !== '' && (!Number.isFinite(limiteNumero) || (limiteNumero as number) < 1)) {
      setError('Inserisci un numero valido (almeno 1), oppure lascia vuoto per nessun limite.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const updated = await updateConfigurazioneAsporto({ limite_prodotti_orario: limiteNumero });
      setSavedLimite(updated.limite_prodotti_orario);
      setLimite(updated.limite_prodotti_orario != null ? String(updated.limite_prodotti_orario) : '');
      setJustSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile salvare il limite.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
      <HStack space="xs" className="items-center">
        <Icon as={AlertCircleIcon} size="sm" className="text-sky-700" />
        <Heading size="sm">Limite prodotti per orario</Heading>
      </HStack>
      <Text size="xs" className="text-muted-foreground">
        Numero massimo di prodotti ordinabili complessivamente a ciascun orario di ritiro — si
        applica automaticamente a tutti gli orari, non solo a uno specifico. Lascia vuoto per
        nessun limite. Bevande e vini non vengono conteggiati in questo limite.
      </Text>

      {isLoading ? (
        <HStack space="sm" className="items-center py-2">
          <Spinner size="small" />
        </HStack>
      ) : (
        <>
          <VStack space="xs" className="max-w-40">
            <Text size="sm" className="font-medium">
              Max prodotti
            </Text>
            <Input>
              <InputField
                placeholder="Nessun limite"
                keyboardType="numeric"
                value={limite}
                onChangeText={handleChangeLimite}
              />
            </Input>
          </VStack>

          {error ? (
            <Text size="xs" className="text-destructive">
              {error}
            </Text>
          ) : null}
          {justSaved && !error ? (
            <Text size="xs" className="text-emerald-700">
              {limiteNumero != null ? 'Limite aggiornato.' : 'Limite rimosso.'}
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
              {isSaving ? <ButtonSpinner /> : <ButtonText>Salva limite</ButtonText>}
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
        <LimiteProdottiOrarioCard />
        <GiorniChiusuraAsportoCard />
        <Box className="h-px w-full bg-sky-200" />
        <MenuAsportoSection />
      </VStack>
    </ScrollView>
  );
}
