import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import {
  AddIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClockIcon,
  Icon,
  RepeatIcon,
} from '@/components/ui/icon';
import { goBackOr } from '../../../src/utils/navigation';
import { listPrenotazioniAsporto, type PrenotazioneAsporto } from '../../../src/services/prenotazioni';
import {
  formatTime,
  isSameDay,
  minutesToHHMM,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  toISODate,
} from '../../../src/utils/piscinaMappa';
import {
  FINESTRA_ADESSO_MINUTI,
  formatAttesaRitiro,
  minutiAlRitiro,
  prossimoRitiro,
  raggruppaOrdiniDelGiorno,
} from '../../../src/utils/ordiniAsporto';
import { formatPrezzo } from '../../../src/utils/prezzi';
import { DateNavigatorAsporto } from '../../../src/components/staff/asporto/DateNavigatorAsporto';

// Ogni minuto: aggiorna l'ora di riferimento dei gruppi (senza, la divisione "adesso / più tardi"
// resterebbe congelata al momento in cui la pagina è stata aperta) e rilegge in silenzio gli ordini,
// così durante il servizio un nuovo ordine self-service compare da sé, senza uscire e rientrare.
const TICK_MS = 60000;

function OrdiniHeader() {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/staff/asporto')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">Storico Ordini</Heading>
        <Text size="sm" className="text-muted-foreground">
          Tocca un ordine per vedere il dettaglio completo, modificarlo o annullarlo — i giorni
          passati restano di sola consultazione.
        </Text>
      </VStack>
    </HStack>
  );
}

// Riga ridotta ai soli dati utili per riconoscere un ordine a colpo d'occhio (cliente, orario di
// ritiro, totale, stato) — niente righe prodotto/note/pulsanti azione inline: l'intera card è un
// `Pressable` che apre `app/staff/asporto/ordini/[ordineId].tsx`, dove vive ogni dettaglio e ogni
// azione (Modifica/Annulla/Conferma). Il totale viene letto direttamente da
// `PrenotazioneAsporto.totale` (già calcolato server-side, sezione 1).
//
// `attesa`/`evidenziato` sono valorizzati solo per gli ordini della finestra "Adesso": altrove
// l'orario assoluto basta, e mettere in risalto tutto equivale a non mettere in risalto niente.
function OrdineCompactRow({
  ordine,
  attesa,
  evidenziato,
}: Readonly<{ ordine: PrenotazioneAsporto; attesa?: string | null; evidenziato?: boolean }>) {
  const cornice = evidenziato
    ? 'border-2 border-amber-300 bg-amber-50 active:bg-amber-100'
    : 'border border-sky-100 bg-white active:bg-sky-50';

  return (
    <Pressable
      onPress={() => router.push(`/staff/asporto/ordini/${ordine.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Apri dettaglio ordine di ${ordine.cliente_nome}${attesa ? `, ritiro ${attesa}` : ''}`}
      className={`w-full rounded-2xl p-4 shadow-sm ${cornice}`}
    >
      <HStack space="sm" className="items-center justify-between">
        <VStack space="xs" className="flex-1">
          <Text size="sm" className="font-semibold text-sky-900">
            {ordine.cliente_nome}
          </Text>
          <HStack space="xs" className="flex-wrap items-center">
            <Icon as={ClockIcon} size="2xs" className="text-sky-600" />
            <Text size="xs" className="text-sky-900/70">
              Ritiro {formatTime(ordine.ora) || '—'} · €{formatPrezzo(ordine.totale)}
            </Text>
            {attesa ? (
              <Box className="rounded-full bg-amber-200 px-2 py-0.5">
                <Text size="2xs" className="font-bold text-amber-900">
                  {attesa}
                </Text>
              </Box>
            ) : null}
          </HStack>
        </VStack>
        <HStack space="sm" className="items-center">
          <Box className={`rounded-full px-2.5 py-1 ${STATO_PRENOTAZIONE_BADGE[ordine.stato].bg}`}>
            <Text size="2xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[ordine.stato].text}`}>
              {STATO_PRENOTAZIONE_LABEL[ordine.stato]}
            </Text>
          </Box>
          <Icon as={ChevronRightIcon} size="sm" className="text-sky-400" />
        </HStack>
      </HStack>
    </Pressable>
  );
}

// Le due domande a cui lo staff deve poter rispondere senza leggere nulla: quanti ordini restano e
// a che ora è il prossimo. L'ora dell'ultimo aggiornamento è lì perché la lista si ricarica da sé:
// se la rete cade, quell'orario smette di avanzare ed è il segnale che i dati sono fermi.
function RiepilogoOggi({
  inArrivo,
  prossimo,
  aggiornatoAlle,
  isRefreshing,
  onRefresh,
}: Readonly<{
  inArrivo: number;
  prossimo: PrenotazioneAsporto | null;
  aggiornatoAlle: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}>) {
  return (
    <Box className="w-full rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-sm">
      <HStack space="md" className="items-center justify-between">
        <VStack>
          <Text size="3xl" className="font-extrabold text-sky-900">
            {inArrivo}
          </Text>
          <Text size="xs" className="text-muted-foreground">
            {inArrivo === 1 ? 'ordine in arrivo' : 'ordini in arrivo'}
          </Text>
        </VStack>
        <VStack className="items-end">
          <Text size="xs" className="text-muted-foreground">
            Prossimo ritiro
          </Text>
          <Text size="2xl" className="font-extrabold text-sky-900">
            {prossimo ? formatTime(prossimo.ora) : '—'}
          </Text>
          {prossimo ? (
            <Text size="2xs" className="text-sky-900/70">
              {prossimo.cliente_nome}
            </Text>
          ) : null}
        </VStack>
      </HStack>

      <Box className="my-3 h-px w-full bg-sky-100" />

      <Pressable
        onPress={onRefresh}
        disabled={isRefreshing}
        accessibilityRole="button"
        accessibilityLabel="Aggiorna gli ordini del giorno"
        className="min-h-11 w-full flex-row items-center justify-center gap-2 rounded-xl active:bg-sky-50"
      >
        <Icon as={RepeatIcon} size="2xs" className="text-sky-600" />
        <Text size="2xs" className="text-muted-foreground">
          {isRefreshing ? 'Aggiornamento…' : `Aggiornato alle ${aggiornatoAlle ?? '—'} · tocca per aggiornare`}
        </Text>
      </Pressable>
    </Box>
  );
}

function SezioneOrdini({
  titolo,
  sottotitolo,
  count,
  tone,
  children,
}: Readonly<{
  titolo: string;
  sottotitolo?: string;
  count: number;
  tone: 'amber' | 'sky';
  children: React.ReactNode;
}>) {
  const badgeBg = tone === 'amber' ? 'bg-amber-200' : 'bg-sky-100';
  const badgeText = tone === 'amber' ? 'text-amber-900' : 'text-sky-700';
  return (
    <VStack space="sm" className="w-full">
      <HStack space="xs" className="flex-wrap items-center">
        <Text size="md" className="font-bold text-sky-900">
          {titolo}
        </Text>
        <Box className={`rounded-full px-2 py-0.5 ${badgeBg}`}>
          <Text size="xs" className={`font-bold ${badgeText}`}>
            {count}
          </Text>
        </Box>
        {sottotitolo ? (
          <Text size="2xs" className="text-muted-foreground">
            {sottotitolo}
          </Text>
        ) : null}
      </HStack>
      {children}
    </VStack>
  );
}

// Gruppo richiuso di default: né un orario già passato né un ordine annullato richiedono un'azione,
// quindi non devono occupare spazio sopra a ciò che invece la richiede — restano comunque a un solo
// tocco di distanza per una consultazione.
function GruppoRichiuso({
  titolo,
  count,
  children,
}: Readonly<{ titolo: string; count: number; children: React.ReactNode }>) {
  const [aperto, setAperto] = useState(false);
  return (
    <VStack space="sm" className="w-full">
      <Pressable
        onPress={() => setAperto((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`${aperto ? 'Nascondi' : 'Mostra'} ${titolo} (${count})`}
        className="min-h-11 w-full flex-row items-center justify-between rounded-2xl border border-sky-100 bg-white px-4 py-3 active:bg-sky-50"
      >
        <HStack space="xs" className="items-center">
          <Text size="sm" className="font-semibold text-sky-900/70">
            {titolo}
          </Text>
          <Box className="rounded-full bg-slate-100 px-2 py-0.5">
            <Text size="xs" className="font-bold text-slate-600">
              {count}
            </Text>
          </Box>
        </HStack>
        <Icon as={aperto ? ChevronUpIcon : ChevronDownIcon} size="sm" className="text-sky-400" />
      </Pressable>
      {aperto ? children : null}
    </VStack>
  );
}

function StatoVuoto() {
  return (
    <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
      <Text size="lg">🥡</Text>
      <Text size="sm" className="text-center text-muted-foreground">
        Nessun ordine asporto per questo giorno.
      </Text>
    </VStack>
  );
}

export default function OrdiniAsportoScreen() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [ordini, setOrdini] = useState<PrenotazioneAsporto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimoAggiornamento, setUltimoAggiornamento] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  const isToday = isSameDay(selectedDate, now);
  const nowMinuti = now.getHours() * 60 + now.getMinutes();

  // Backstop, non solo il pulsante ▶ disabilitato in `DateNavigatorAsporto`: mai fidarsi solo del
  // `disabled` lato UI, stesso principio seguito ovunque nel progetto (es. isPastDate sulla mappa piscina).
  const handleChangeDate = (next: Date) => {
    if (toISODate(next) > toISODate(new Date())) return;
    setSelectedDate(next);
  };

  // Contatore di richiesta invece del solito flag `cancelled` locale all'effect: qui il caricamento
  // parte da tre punti diversi (cambio data, tick, tocco manuale), quindi serve scartare la risposta
  // di una richiesta superata da una più recente, non solo quella di un effect smontato.
  const richiestaRef = useRef(0);

  const caricaOrdini = useCallback(
    (opts?: { silenzioso?: boolean }) => {
      const silenzioso = opts?.silenzioso ?? false;
      const richiesta = ++richiestaRef.current;
      if (silenzioso) setIsRefreshing(true);
      else setIsLoading(true);

      listPrenotazioniAsporto({ data: toISODate(selectedDate) })
        .then((list) => {
          if (richiesta !== richiestaRef.current) return;
          setOrdini([...list].sort((a, b) => a.ora.localeCompare(b.ora)));
          setUltimoAggiornamento(new Date());
          setError(null);
        })
        .catch(() => {
          if (richiesta !== richiestaRef.current) return;
          // Un aggiornamento in background fallito non sostituisce con un errore rosso una lista
          // ancora buona: resta visibile quella già caricata, ed è l'ora di "Aggiornato alle" che
          // smette di avanzare a segnalare che i dati sono fermi.
          if (!silenzioso) setError('Impossibile caricare gli ordini del giorno.');
        })
        .finally(() => {
          if (richiesta !== richiestaRef.current) return;
          if (silenzioso) setIsRefreshing(false);
          else setIsLoading(false);
        });
    },
    [selectedDate],
  );

  useEffect(() => {
    caricaOrdini();
  }, [caricaOrdini]);

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => {
      setNow(new Date());
      caricaOrdini({ silenzioso: true });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isToday, caricaOrdini]);

  const gruppi = useMemo(() => raggruppaOrdiniDelGiorno(ordini, nowMinuti), [ordini, nowMinuti]);
  const prossimo = useMemo(() => prossimoRitiro(ordini, nowMinuti), [ordini, nowMinuti]);
  const inArrivo = gruppi.adesso.length + gruppi.piuTardi.length;

  const righeAdesso = gruppi.adesso.map((o) => {
    const diff = minutiAlRitiro(o.ora, nowMinuti);
    return (
      <OrdineCompactRow
        key={o.id}
        ordine={o}
        attesa={diff === null ? null : formatAttesaRitiro(diff)}
        evidenziato
      />
    );
  });

  let contenuto: React.ReactNode;
  if (isLoading) {
    contenuto = (
      <HStack className="items-center justify-center py-10">
        <Spinner size="large" />
      </HStack>
    );
  } else if (ordini.length === 0) {
    contenuto = <StatoVuoto />;
  } else if (isToday) {
    // Vista "durante il servizio": in cima ciò che serve adesso, il resto richiuso.
    contenuto = (
      <VStack space="lg" className="w-full">
        <RiepilogoOggi
          inArrivo={inArrivo}
          prossimo={prossimo}
          aggiornatoAlle={
            ultimoAggiornamento
              ? minutesToHHMM(ultimoAggiornamento.getHours() * 60 + ultimoAggiornamento.getMinutes())
              : null
          }
          isRefreshing={isRefreshing}
          onRefresh={() => caricaOrdini({ silenzioso: true })}
        />

        {gruppi.adesso.length > 0 ? (
          <SezioneOrdini
            titolo="Adesso"
            sottotitolo={`entro ${FINESTRA_ADESSO_MINUTI} minuti`}
            count={gruppi.adesso.length}
            tone="amber"
          >
            {righeAdesso}
          </SezioneOrdini>
        ) : null}

        {gruppi.piuTardi.length > 0 ? (
          <SezioneOrdini titolo="Più tardi" count={gruppi.piuTardi.length} tone="sky">
            {gruppi.piuTardi.map((o) => (
              <OrdineCompactRow key={o.id} ordine={o} />
            ))}
          </SezioneOrdini>
        ) : null}

        {gruppi.passati.length > 0 ? (
          <GruppoRichiuso titolo="Orario già passato" count={gruppi.passati.length}>
            {gruppi.passati.map((o) => (
              <OrdineCompactRow key={o.id} ordine={o} />
            ))}
          </GruppoRichiuso>
        ) : null}

        {gruppi.annullati.length > 0 ? (
          <GruppoRichiuso titolo="Annullati" count={gruppi.annullati.length}>
            {gruppi.annullati.map((o) => (
              <OrdineCompactRow key={o.id} ordine={o} />
            ))}
          </GruppoRichiuso>
        ) : null}
      </VStack>
    );
  } else {
    // Giorno passato: nessun "adesso" a cui ancorare i gruppi, resta la lista cronologica.
    contenuto = (
      <VStack space="sm" className="w-full">
        <HStack className="items-center justify-between">
          <Heading size="md">Ordini del giorno</Heading>
          <Text size="xs" className="text-muted-foreground">
            {ordini.length} {ordini.length === 1 ? 'ordine' : 'ordini'}
          </Text>
        </HStack>
        {ordini.map((o) => (
          <OrdineCompactRow key={o.id} ordine={o} />
        ))}
      </VStack>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <OrdiniHeader />

        <DateNavigatorAsporto selectedDate={selectedDate} onChange={handleChangeDate} />

        <Pressable
          onPress={() => router.push('/staff/asporto/ordini/nuovo' as Href)}
          accessibilityRole="button"
          accessibilityLabel="Crea un nuovo ordine manuale"
          className="w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-sky-300 bg-white py-3 shadow-sm active:bg-sky-50"
        >
          <Icon as={AddIcon} size="sm" className="text-sky-700" />
          <Text size="sm" className="font-bold text-sky-700">
            Nuovo ordine
          </Text>
        </Pressable>

        {error ? (
          <Text size="sm" className="text-center text-destructive">
            {error}
          </Text>
        ) : null}

        {contenuto}
      </VStack>
    </ScrollView>
  );
}
