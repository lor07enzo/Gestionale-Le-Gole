import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeftIcon, Icon, PhoneIcon } from '@/components/ui/icon';
import { getCliente, type Cliente } from '../../../src/services/clienti';
import { listPrenotazioniPiscinaByCliente, type PrenotazionePiscina } from '../../../src/services/prenotazioni';
import { goBackOr } from '../../../src/utils/navigation';
import {
  formatDateDDMMYYYY,
  formatIngressiSummary,
  formatTime,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
} from '../../../src/utils/piscinaMappa';

function ClienteDetailHeader({ nome }: Readonly<{ nome: string | undefined }>) {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/staff/clienti')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">{nome ?? 'Scheda cliente'}</Heading>
        <Text size="sm" className="text-muted-foreground">
          Anagrafica e storico prenotazioni
        </Text>
      </VStack>
    </HStack>
  );
}

function PrenotazioneRow({ prenotazione: p }: Readonly<{ prenotazione: PrenotazionePiscina }>) {
  return (
    <Box className="w-full rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <VStack space="xs">
        <HStack space="xs" className="flex-wrap items-center justify-between">
          <Text size="sm" className="font-semibold text-sky-900">
            {formatDateDDMMYYYY(p.data)} · {formatTime(p.ora) || '—'}
          </Text>
          <Box className={`rounded-full px-2.5 py-1 ${STATO_PRENOTAZIONE_BADGE[p.stato].bg}`}>
            <Text size="2xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[p.stato].text}`}>
              {STATO_PRENOTAZIONE_LABEL[p.stato]}
            </Text>
          </Box>
        </HStack>
        {p.note ? (
          <Text size="xs" className="italic text-sky-900/70">
            📝 {p.note}
          </Text>
        ) : null}
        <Text size="xs" className="text-sky-900/70">
          {formatIngressiSummary(p)}{' '}
          {p.ombrellone > 0 ? `⛱️ ${p.ombrellone} ` : ''}
          {p.gazebo > 0 ? `⛺ ${p.gazebo} ` : ''}
          {p.lettino > 0 ? `🛏️ ${p.lettino} ` : ''}
          {p.sdraia > 0 ? `🪑 ${p.sdraia}` : ''}
        </Text>
      </VStack>
    </Box>
  );
}

export default function ClienteDetailScreen() {
  const { clienteId } = useLocalSearchParams<{ clienteId: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [prenotazioni, setPrenotazioni] = useState<PrenotazionePiscina[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clienteId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([getCliente(clienteId), listPrenotazioniPiscinaByCliente(clienteId)])
      .then(([clienteData, prenotazioniData]) => {
        if (cancelled) return;
        setCliente(clienteData);
        // Storico più recente per primo: confronto lessicografico su "YYYY-MM-DD"/"HH:MM:SS",
        // valido perché entrambi i formati sono ordinabili come stringa.
        setPrenotazioni(
          [...prenotazioniData].sort((a, b) => {
            if (a.data !== b.data) return b.data.localeCompare(a.data);
            return b.ora.localeCompare(a.ora);
          })
        );
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile caricare la scheda cliente. Riprova.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  if (!clienteId || isLoading) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <ClienteDetailHeader nome={cliente?.nome} />

        {error ? (
          <Text size="sm" className="text-center text-destructive">
            {error}
          </Text>
        ) : null}

        {cliente ? (
          <Box className="w-full rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
            <Pressable
              onPress={() => Linking.openURL(`tel:${cliente.telefono}`).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel={`Chiama ${cliente.telefono}`}
            >
              <HStack space="xs" className="items-center">
                <Icon as={PhoneIcon} size="sm" className="text-sky-600" />
                <Text size="md" className="font-medium text-sky-700">
                  {cliente.telefono}
                </Text>
              </HStack>
            </Pressable>
          </Box>
        ) : null}

        <VStack space="sm" className="w-full">
          <HStack className="items-center justify-between">
            <Heading size="md">Storico prenotazioni</Heading>
            <Text size="xs" className="text-muted-foreground">
              {prenotazioni.length} {prenotazioni.length === 1 ? 'prenotazione' : 'prenotazioni'}
            </Text>
          </HStack>

          {prenotazioni.length === 0 ? (
            <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
              <Text size="lg">📭</Text>
              <Text size="sm" className="text-center text-muted-foreground">
                Nessuna prenotazione registrata per questo cliente.
              </Text>
            </VStack>
          ) : (
            prenotazioni.map((p) => <PrenotazioneRow key={p.id} prenotazione={p} />)
          )}
        </VStack>
      </VStack>
    </ScrollView>
  );
}
