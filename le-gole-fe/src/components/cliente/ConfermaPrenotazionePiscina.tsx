import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { ClienteFooter } from './ClienteFooter';

// Schermata di conferma condivisa tra il flusso di prenotazione self-service
// (app/cliente/piscina/[inventarioId].tsx) e la riprenotazione dallo storico
// (app/cliente/storico/piscina/[id].tsx, sezione 7 di CLAUDE.md, 2026-09-03) — stessa identica
// "pagina di conferma già esistente" richiesta esplicitamente dall'utente per entrambi i flussi,
// non due rese separate che rischierebbero di divergere nel tempo. Stesso principio/stessa forma
// di ConfermaOrdineAsporto (asporto), estratta con lo stesso motivo quando il riordino asporto ha
// avuto bisogno della stessa identica conferma del checkout.
export function ConfermaPrenotazionePiscina({
  nomeInventario,
  dataLabel,
  orario,
  isDownloading,
  onScaricaBiglietto,
  onTornaHome,
  downloadError,
}: Readonly<{
  nomeInventario: string;
  dataLabel: string;
  orario: string;
  isDownloading: boolean;
  onScaricaBiglietto: () => void;
  onTornaHome: () => void;
  downloadError: string | null;
}>) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full items-center">
        <Box className="w-full max-w-md items-center rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
          <Text size="3xl">✅</Text>
          <Heading size="lg" className="mt-2 text-center text-emerald-900">
            Prenotazione confermata!
          </Heading>
          <Text size="sm" className="mt-2 text-center text-emerald-800">
            La tua prenotazione per {nomeInventario} del {dataLabel} alle {orario} è confermata. Ti
            contatteremo al numero indicato solo in caso di necessità.
          </Text>
        </Box>

        <Box className="w-full max-w-md rounded-2xl border border-sky-200 bg-sky-100 p-5">
          <Text size="sm" className="text-center text-sky-900">
            🎫 Scarica il biglietto e mostralo in biglietteria: riporta il riepilogo della tua
            prenotazione, già confermata.
          </Text>
          <Button className="mt-3" onPress={onScaricaBiglietto} disabled={isDownloading}>
            {isDownloading ? <ButtonSpinner /> : <ButtonText>Scarica biglietto (PDF)</ButtonText>}
          </Button>
          {downloadError ? (
            <Text size="xs" className="mt-2 text-center text-destructive">
              {downloadError}
            </Text>
          ) : null}
        </Box>

        <Button variant="outline" className="border-2 border-sky-300 bg-white" onPress={onTornaHome}>
          <ButtonText>Torna alla home</ButtonText>
        </Button>
        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
