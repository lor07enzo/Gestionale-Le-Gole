import { useEffect, useState } from 'react';
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
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Icon,
} from '@/components/ui/icon';
import { goBackOr } from '../../../src/utils/navigation';
import { listPrenotazioniAsporto, type PrenotazioneAsporto } from '../../../src/services/prenotazioni';
import {
  addDays,
  formatDisplayDate,
  formatTime,
  isSameDay,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  toISODate,
} from '../../../src/utils/piscinaMappa';
import { formatPrezzo } from '../../../src/utils/prezzi';

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

// Stesso linguaggio visivo di DateNavigator.tsx (mappa piscina), qui autonomo — nessun context
// da cui ereditare selectedDate/conteggi: l'asporto non ha un'azione "conteggi per mese" propria
// (nessuno storico serve mostrarla, gli ordini di un giorno sono già in vista qui) e la data non
// è condivisa con nessun'altra pagina.
function DateNav({
  selectedDate,
  onChange,
}: Readonly<{ selectedDate: Date; onChange: (next: Date) => void }>) {
  const isToday = isSameDay(selectedDate, new Date());
  return (
    <HStack
      space="sm"
      className="items-center justify-between rounded-2xl border border-sky-100 bg-white p-2.5 shadow-sm"
    >
      <Pressable
        accessibilityLabel="Giorno precedente"
        onPress={() => onChange(addDays(selectedDate, -1))}
        className="h-10 w-10 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50"
      >
        <Icon as={ChevronLeftIcon} size="md" className="text-sky-900" />
      </Pressable>

      <VStack className="items-center">
        <Text size="md" className="font-bold capitalize text-sky-900">
          {isToday ? 'Oggi' : formatDisplayDate(selectedDate)}
        </Text>
        {!isToday ? (
          <Pressable
            accessibilityLabel="Torna a oggi"
            onPress={() => onChange(new Date())}
            className="mt-1.5 items-center rounded-full bg-sky-600 px-3 py-1"
          >
            <Text size="2xs" className="font-bold text-white">
              Torna a oggi
            </Text>
          </Pressable>
        ) : null}
      </VStack>

      <Pressable
        accessibilityLabel="Giorno successivo"
        onPress={() => !isToday && onChange(addDays(selectedDate, 1))}
        disabled={isToday}
        className={`h-10 w-10 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50 ${
          isToday ? 'opacity-40' : ''
        }`}
      >
        <Icon as={ChevronRightIcon} size="md" className="text-sky-900" />
      </Pressable>
    </HStack>
  );
}

// Riga ridotta ai soli dati utili per riconoscere un ordine a colpo d'occhio (cliente, orario di
// ritiro, totale, stato) — niente più righe prodotto/note/pulsanti azione inline: l'intera card è
// un `Pressable` che apre `app/staff/asporto/ordini/[ordineId].tsx`, dove vive ogni dettaglio e
// ogni azione (Modifica/Annulla/Conferma). Il totale viene letto direttamente da
// `PrenotazioneAsporto.totale` (già calcolato server-side, sezione 1) — non serve più caricare le
// `VoceOrdine` di ogni ordine solo per mostrare questa lista, a differenza di prima.
function OrdineCompactRow({ ordine }: Readonly<{ ordine: PrenotazioneAsporto }>) {
  return (
    <Pressable
      onPress={() => router.push(`/staff/asporto/ordini/${ordine.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Apri dettaglio ordine di ${ordine.cliente_nome}`}
      className="w-full rounded-2xl border border-sky-100 bg-white p-4 shadow-sm active:bg-sky-50"
    >
      <HStack space="sm" className="items-center justify-between">
        <VStack space="xs" className="flex-1">
          <Text size="sm" className="font-semibold text-sky-900">
            {ordine.cliente_nome}
          </Text>
          <HStack space="xs" className="items-center">
            <Icon as={ClockIcon} size="2xs" className="text-sky-600" />
            <Text size="xs" className="text-sky-900/70">
              Ritiro {formatTime(ordine.ora) || '—'} · €{formatPrezzo(ordine.totale)}
            </Text>
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

export default function OrdiniAsportoScreen() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [ordini, setOrdini] = useState<PrenotazioneAsporto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Backstop, non solo il pulsante ▶ disabilitato in `DateNav`: mai fidarsi solo del `disabled`
  // lato UI, stesso principio seguito ovunque nel progetto (es. isPastDate sulla mappa piscina).
  const handleChangeDate = (next: Date) => {
    if (toISODate(next) > toISODate(new Date())) return;
    setSelectedDate(next);
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listPrenotazioniAsporto({ data: toISODate(selectedDate) })
      .then((list) => {
        if (cancelled) return;
        setOrdini([...list].sort((a, b) => a.ora.localeCompare(b.ora)));
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile caricare gli ordini del giorno.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <OrdiniHeader />

        <DateNav selectedDate={selectedDate} onChange={handleChangeDate} />

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

        {isLoading ? (
          <HStack className="items-center justify-center py-10">
            <Spinner size="large" />
          </HStack>
        ) : (
          <VStack space="sm" className="w-full">
            <HStack className="items-center justify-between">
              <Heading size="md">Ordini del giorno</Heading>
              <Text size="xs" className="text-muted-foreground">
                {ordini.length} {ordini.length === 1 ? 'ordine' : 'ordini'}
              </Text>
            </HStack>

            {ordini.length === 0 ? (
              <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
                <Text size="lg">🥡</Text>
                <Text size="sm" className="text-center text-muted-foreground">
                  Nessun ordine asporto per questo giorno.
                </Text>
              </VStack>
            ) : (
              ordini.map((o) => <OrdineCompactRow key={o.id} ordine={o} />)
            )}
          </VStack>
        )}
      </VStack>
    </ScrollView>
  );
}
