import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView } from 'react-native';
import type { ViewStyle } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { AddIcon, ChevronRightIcon, Icon } from '@/components/ui/icon';
import { StaffPageHeader } from '../../../src/components/staff/StaffPageHeader';
import { DateNavBar } from '../../../src/components/shared/DateNavBar';
import { DisponibilitaGiornoPadel } from '../../../src/components/staff/padel/DisponibilitaGiornoPadel';
import {
  getDisponibilitaPadel,
  listPrenotazioniPadel,
  type DisponibilitaPadel,
  type PrenotazionePadel,
} from '../../../src/services/padel';
import {
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  toISODate,
} from '../../../src/utils/piscinaMappa';
import { formatFasciaPartita } from '../../../src/utils/padel';
import { formatPrezzo } from '../../../src/utils/prezzi';

// Solo web: riserva sempre lo spazio della scrollbar verticale, così il padding destro dello
// ScrollView non si assottiglia rispetto al sinistro quando il contenuto trabocca.
const scrollViewStyle =
  Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as unknown as ViewStyle) : undefined;

// Riga ridotta ai dati che servono per riconoscere una partita: orario, cliente, totale, stato.
// Ogni dettaglio e ogni azione vivono nella pagina di dettaglio che questa riga apre.
function PartitaRow({ prenotazione }: Readonly<{ prenotazione: PrenotazionePadel }>) {
  const badge = STATO_PRENOTAZIONE_BADGE[prenotazione.stato];

  return (
    <Pressable
      onPress={() => router.push(`/staff/padel/prenotazioni/${prenotazione.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Apri la partita di ${prenotazione.cliente_nome}`}
      className="min-h-11 w-full rounded-2xl border border-sky-100 bg-white p-4 shadow-sm active:bg-sky-50"
    >
      <HStack space="sm" className="items-center justify-between">
        <VStack space="xs" className="flex-1">
          <Text size="sm" className="font-bold text-sky-900">
            {formatFasciaPartita(prenotazione.ora, prenotazione.orario_fine)}
          </Text>
          <Text size="xs" className="text-sky-900/70">
            {prenotazione.cliente_nome} · {prenotazione.partecipanti} giocatori · €{' '}
            {formatPrezzo(prenotazione.totale)}
          </Text>
        </VStack>
        <HStack space="sm" className="items-center">
          <Box className={`rounded-full px-2.5 py-1 ${badge.bg}`}>
            <Text size="2xs" className={`font-bold ${badge.text}`}>
              {STATO_PRENOTAZIONE_LABEL[prenotazione.stato]}
            </Text>
          </Box>
          <Icon as={ChevronRightIcon} size="sm" className="text-sky-400" />
        </HStack>
      </HStack>
    </Pressable>
  );
}

export default function PrenotazioniPadelScreen() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [partite, setPartite] = useState<PrenotazionePadel[]>([]);
  const [disponibilita, setDisponibilita] = useState<DisponibilitaPadel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const data = toISODate(selectedDate);

    // allSettled: la griglia degli orari è un di più, il suo fallimento non deve nascondere anche
    // l'elenco delle partite (e viceversa).
    Promise.allSettled([listPrenotazioniPadel({ data }), getDisponibilitaPadel({ data })])
      .then(([partiteResult, disponibilitaResult]) => {
        if (cancelled) return;
        if (partiteResult.status === 'fulfilled') {
          setPartite([...partiteResult.value].sort((a, b) => a.ora.localeCompare(b.ora)));
        } else {
          setPartite([]);
          setError('Impossibile caricare le partite del giorno.');
        }
        setDisponibilita(disponibilitaResult.status === 'fulfilled' ? disponibilitaResult.value : null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-6 md:px-8 md:py-10"
      style={scrollViewStyle}
    >
      <VStack space="lg" className="w-full">
        <StaffPageHeader
          title="Prenotazioni padel"
          subtitle="Partite del giorno selezionato. Tocca una partita per il dettaglio."
          fallbackHref="/staff/padel"
        />

        {/* Nessun limite sulle date: una partita si prenota con giorni di anticipo, quindi lo
            staff deve poter guardare avanti oltre a consultare lo storico. */}
        <DateNavBar selectedDate={selectedDate} onChange={setSelectedDate} />

        <Pressable
          onPress={() => router.push('/staff/padel/prenotazioni/nuova' as Href)}
          accessibilityRole="button"
          accessibilityLabel="Registra una nuova partita"
          className="min-h-11 w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-sky-300 bg-white py-3 shadow-sm active:bg-sky-50"
        >
          <Icon as={AddIcon} size="sm" className="text-sky-700" />
          <Text size="sm" className="font-bold text-sky-700">
            Nuova partita
          </Text>
        </Pressable>

        <DisponibilitaGiornoPadel disponibilita={disponibilita} isLoading={isLoading} />

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
              <Heading size="md">Partite del giorno</Heading>
              <Text size="xs" className="text-muted-foreground">
                {partite.length} {partite.length === 1 ? 'partita' : 'partite'}
              </Text>
            </HStack>

            {partite.length === 0 ? (
              <VStack
                space="sm"
                className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8"
              >
                <Text size="2xl">🎾</Text>
                <Text size="sm" className="text-center text-muted-foreground">
                  Nessuna partita prenotata per questo giorno.
                </Text>
              </VStack>
            ) : (
              partite.map((partita) => <PartitaRow key={partita.id} prenotazione={partita} />)
            )}
          </VStack>
        )}
      </VStack>
    </ScrollView>
  );
}
