import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { ChevronRightIcon, ClockIcon, DownloadIcon, Icon } from '@/components/ui/icon';
import { BackButton } from '../../../src/components/cliente/BackButton';
import { ClienteFooter } from '../../../src/components/cliente/ClienteFooter';
import {
  getBigliettoUrl,
  getRicevutaUrl,
  getStoricoAsportoPerTelefono,
  getStoricoPiscinaPerTelefono,
  type PrenotazioneAsporto,
  type PrenotazionePiscina,
  type StatoPrenotazione,
} from '../../../src/services/prenotazioni';
import { apriBigliettoPdf } from '../../../src/utils/biglietto';
import {
  formatDateDDMMYYYY,
  formatIngressiSummary,
  formatTime,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
} from '../../../src/utils/piscinaMappa';
import { formatPrezzo } from '../../../src/utils/prezzi';

// Pagina raggiunta dalla ricerca sulla landing Area Cliente (StoricoPrenotazioniSearch,
// app/cliente/index.tsx) — presuppone che esista già almeno una prenotazione per il numero
// passato come query param (il controllo di esistenza è già stato fatto lì prima di navigare
// qui, sezione 7/15 di CLAUDE.md): questa pagina si limita a caricare e mostrare, senza dover
// rigestire il caso "nessun risultato" come errore bloccante — se capitasse comunque (link
// salvato, dati cambiati nel frattempo) mostra semplicemente uno stato vuoto, non un errore.
//
// Convertita da file piatto a directory (2026-08-22) per ospitare le pagine di dettaglio
// app/cliente/storico/piscina/[id].tsx e app/cliente/storico/asporto/[id].tsx — stesso schema
// già usato per app/cliente/asporto.tsx -> asporto/index.tsx (sezione 15).

function StatoBadge({ stato }: Readonly<{ stato: StatoPrenotazione }>) {
  return (
    <Box className={`rounded-full px-2.5 py-1 ${STATO_PRENOTAZIONE_BADGE[stato].bg}`}>
      <Text size="2xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[stato].text}`}>
        {STATO_PRENOTAZIONE_LABEL[stato]}
      </Text>
    </Box>
  );
}

// Le card sono cliccabili (2026-08-22, su richiesta esplicita dell'utente) — ma il pulsante di
// download deve restare un target separato: due `Pressable` sorelle, non annidate (stesso
// principio anti-`<button>`-dentro-`<button>` già documentato altrove nel progetto, es.
// NotificaCard/ProdottoRigaCliccabile) — la parte informativa apre il dettaglio, il pulsante
// sotto il divisore scarica il PDF senza mai navigare.
function PiscinaCard({ prenotazione }: Readonly<{ prenotazione: PrenotazionePiscina }>) {
  const [isDownloading, setIsDownloading] = useState(false);

  const risorse = [
    prenotazione.ombrellone > 0 ? `⛱️ ${prenotazione.ombrellone}` : null,
    prenotazione.gazebo > 0 ? `⛺ ${prenotazione.gazebo}` : null,
    prenotazione.lettino > 0 ? `🛏️ ${prenotazione.lettino}` : null,
    prenotazione.sdraia > 0 ? `🪑 ${prenotazione.sdraia}` : null,
  ]
    .filter((v): v is string => v !== null)
    .join(' ');

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await apriBigliettoPdf(getBigliettoUrl(prenotazione.id), prenotazione.id);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box className="w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <Pressable
        onPress={() => router.push(`/cliente/storico/piscina/${prenotazione.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`Vedi dettaglio prenotazione piscina del ${formatDateDDMMYYYY(prenotazione.data)}`}
        className="p-4 active:bg-sky-50"
      >
        <VStack space="sm">
          <HStack className="items-start justify-between">
            <VStack>
              <Text size="sm" className="font-semibold text-sky-900">
                {prenotazione.inventario_nome}
              </Text>
              <HStack space="xs" className="items-center">
                <Icon as={ClockIcon} size="2xs" className="text-sky-600" />
                <Text size="xs" className="text-sky-900/70">
                  {formatDateDDMMYYYY(prenotazione.data)} · {formatTime(prenotazione.ora)}
                </Text>
              </HStack>
            </VStack>
            <StatoBadge stato={prenotazione.stato} />
          </HStack>

          <Text size="xs" className="text-sky-900/80">
            {formatIngressiSummary(prenotazione)}
            {risorse ? ` ${risorse}` : ''}
          </Text>

          {prenotazione.note ? (
            <Text size="xs" className="italic text-sky-900/70">
              📝 {prenotazione.note}
            </Text>
          ) : null}

          <HStack className="items-center justify-end">
            <Text size="xs" className="font-semibold text-sky-600">
              Vedi dettaglio
            </Text>
            <Icon as={ChevronRightIcon} size="xs" className="text-sky-600" />
          </HStack>
        </VStack>
      </Pressable>

      {prenotazione.stato !== 'CANCELLED' ? (
        <Box className="border-t border-sky-100 p-3">
          <Button
            size="sm"
            variant="outline"
            className="self-start border-2 border-sky-300 bg-white"
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ButtonSpinner />
            ) : (
              <>
                <ButtonIcon as={DownloadIcon} className="text-sky-700" />
                <ButtonText className="text-sky-700">Scarica biglietto</ButtonText>
              </>
            )}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}

function AsportoCard({ ordine }: Readonly<{ ordine: PrenotazioneAsporto }>) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await apriBigliettoPdf(getRicevutaUrl(ordine.id), ordine.id, 'ricevuta');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box className="w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <Pressable
        onPress={() => router.push(`/cliente/storico/asporto/${ordine.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`Vedi dettaglio ordine asporto del ${formatDateDDMMYYYY(ordine.data)}`}
        className="p-4 active:bg-sky-50"
      >
        <VStack space="sm">
          <HStack className="items-start justify-between">
            <VStack>
              <Text size="sm" className="font-semibold text-sky-900">
                Ritiro asporto
              </Text>
              <HStack space="xs" className="items-center">
                <Icon as={ClockIcon} size="2xs" className="text-sky-600" />
                <Text size="xs" className="text-sky-900/70">
                  {formatDateDDMMYYYY(ordine.data)} · {formatTime(ordine.ora)}
                </Text>
              </HStack>
            </VStack>
            <StatoBadge stato={ordine.stato} />
          </HStack>

          <Text size="xs" className="font-semibold text-sky-900">
            Totale: €{formatPrezzo(ordine.totale)}
          </Text>

          {ordine.note ? (
            <Text size="xs" className="italic text-sky-900/70">
              📝 {ordine.note}
            </Text>
          ) : null}

          <HStack className="items-center justify-end">
            <Text size="xs" className="font-semibold text-sky-600">
              Vedi dettaglio
            </Text>
            <Icon as={ChevronRightIcon} size="xs" className="text-sky-600" />
          </HStack>
        </VStack>
      </Pressable>

      {ordine.stato !== 'CANCELLED' ? (
        <Box className="border-t border-sky-100 p-3">
          <Button
            size="sm"
            variant="outline"
            className="self-start border-2 border-sky-300 bg-white"
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ButtonSpinner />
            ) : (
              <>
                <ButtonIcon as={DownloadIcon} className="text-sky-700" />
                <ButtonText className="text-sky-700">Scarica ricevuta</ButtonText>
              </>
            )}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}

export default function StoricoPrenotazioniScreen() {
  const { telefono } = useLocalSearchParams<{ telefono: string }>();
  const [piscina, setPiscina] = useState<PrenotazionePiscina[]>([]);
  const [asporto, setAsporto] = useState<PrenotazioneAsporto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!telefono) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all([getStoricoPiscinaPerTelefono(telefono), getStoricoAsportoPerTelefono(telefono)])
      .then(([piscinaData, asportoData]) => {
        if (cancelled) return;
        setPiscina(piscinaData);
        setAsporto(asportoData);
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile caricare lo storico. Riprova più tardi.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [telefono]);

  const nomeCliente = piscina[0]?.cliente_nome ?? asporto[0]?.cliente_nome ?? null;

  if (!telefono) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
        <VStack space="lg" className="w-full">
          <Text size="sm" className="text-center text-destructive">
            Numero di telefono mancante.
          </Text>
          <BackButton fallbackHref="/cliente" />
        </VStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <VStack space="xs">
          <Heading size="xl">📖 Le mie prenotazioni</Heading>
          <Text size="sm" className="text-muted-foreground">
            {nomeCliente ? `${nomeCliente} · ` : ''}
            {telefono}
          </Text>
        </VStack>

        {isLoading ? (
          <HStack className="items-center justify-center py-10">
            <Spinner size="large" />
          </HStack>
        ) : error ? (
          <Text size="sm" className="text-center text-destructive">
            {error}
          </Text>
        ) : piscina.length === 0 && asporto.length === 0 ? (
          <VStack
            space="sm"
            className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8"
          >
            <Text size="lg">🔍</Text>
            <Text size="sm" className="text-center text-muted-foreground">
              Nessuna prenotazione trovata per questo numero di telefono.
            </Text>
          </VStack>
        ) : (
          <>
            {piscina.length > 0 ? (
              <VStack space="sm">
                <Heading size="md">🏊 Piscina</Heading>
                {piscina.map((p) => (
                  <PiscinaCard key={p.id} prenotazione={p} />
                ))}
              </VStack>
            ) : null}

            {asporto.length > 0 ? (
              <VStack space="sm">
                <Heading size="md">🥡 Asporto</Heading>
                {asporto.map((o) => (
                  <AsportoCard key={o.id} ordine={o} />
                ))}
              </VStack>
            ) : null}
          </>
        )}

        <BackButton fallbackHref="/cliente" />

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
