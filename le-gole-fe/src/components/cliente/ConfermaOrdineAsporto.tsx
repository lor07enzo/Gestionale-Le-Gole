import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { ClienteFooter } from './ClienteFooter';

// Schermata di conferma condivisa tra il checkout self-service (app/cliente/asporto/index.tsx) e
// il riordino dallo storico (app/cliente/storico/asporto/[id].tsx, sezione 15 di CLAUDE.md,
// 2026-08-23) — stessa identica "pagina di conferma" richiesta esplicitamente dall'utente per
// entrambi i flussi, non due rese separate che rischierebbero di divergere nel tempo.
export type RigaRiepilogoOrdineAsporto = {
  id: string;
  nome: string;
  quantita: number;
  subtotale: number;
};

export function ConfermaOrdineAsporto({
  nome,
  orario,
  righe,
  totale,
  isDownloading,
  onScaricaRicevuta,
  onTornaHome,
  downloadError,
}: Readonly<{
  nome: string;
  orario: string;
  righe: RigaRiepilogoOrdineAsporto[];
  totale: number;
  isDownloading: boolean;
  onScaricaRicevuta: () => void;
  onTornaHome: () => void;
  downloadError: string | null;
}>) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full items-center">
        <Box className="w-full max-w-md items-center rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
          <Text size="3xl">✅</Text>
          <Heading size="lg" className="mt-2 text-center text-emerald-900">
            Ordine confermato!
          </Heading>
          <Text size="sm" className="mt-2 text-center text-emerald-800">
            Grazie {nome}, il tuo ordine è confermato. Ritiro previsto alle {orario}.
          </Text>
        </Box>

        <Box className="w-full max-w-md rounded-2xl border border-sky-200 bg-sky-100 p-5">
          <Heading size="sm" className="mb-2">
            Riepilogo
          </Heading>
          <VStack space="xs">
            {righe.map((riga) => (
              <HStack key={riga.id} className="items-center justify-between">
                <Text size="sm" className="flex-1 text-sky-900">
                  {riga.quantita}x {riga.nome}
                </Text>
                <Text size="sm" className="font-medium text-sky-900">
                  €{riga.subtotale.toFixed(2).replace('.', ',')}
                </Text>
              </HStack>
            ))}
          </VStack>
          <Box className="my-3 h-px bg-sky-200" />
          <HStack className="items-center justify-between">
            <Text size="sm" className="font-semibold text-sky-900">
              Totale
            </Text>
            <Text size="md" className="font-bold text-sky-900">
              €{totale.toFixed(2).replace('.', ',')}
            </Text>
          </HStack>
        </Box>

        <Box className="w-full max-w-md rounded-2xl border border-sky-200 bg-sky-100 p-5">
          <Text size="sm" className="text-center text-sky-900">
            🧾 Scarica la ricevuta e mostrala al ritiro: riporta il riepilogo del tuo ordine, già
            confermato.
          </Text>
          <Button className="mt-3" onPress={onScaricaRicevuta} disabled={isDownloading}>
            {isDownloading ? <ButtonSpinner /> : <ButtonText>Scarica ricevuta (PDF)</ButtonText>}
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
