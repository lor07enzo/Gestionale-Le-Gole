import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { ArrowLeftIcon, ClockIcon, DownloadIcon, Icon, PhoneIcon } from '@/components/ui/icon';
import { goBackOr } from '../../../../src/utils/navigation';
import { ClienteFooter } from '../../../../src/components/cliente/ClienteFooter';
import {
  getBigliettoUrl,
  getDettaglioPubblicoPiscina,
  type PrenotazionePiscina,
} from '../../../../src/services/prenotazioni';
import { apriBigliettoPdf } from '../../../../src/utils/biglietto';
import {
  formatDateDDMMYYYY,
  formatTime,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
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
        if (!cancelled) setPrenotazione(data);
      })
      .catch(() => {
        if (!cancelled) setError('Prenotazione non trovata.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
