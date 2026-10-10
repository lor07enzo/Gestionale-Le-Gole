import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ConfermaLayout } from './ConfermaLayout';

// Conferma condivisa tra il checkout self-service (app/cliente/asporto/index.tsx) e il riordino
// dallo storico (app/cliente/storico/asporto/[id].tsx).
export type RigaRiepilogoOrdineAsporto = {
  id: string;
  nome: string;
  quantita: number;
  subtotale: number;
};

const euro = (valore: number) => `€${valore.toFixed(2).replace('.', ',')}`;

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
    <ConfermaLayout
      titolo="Ordine confermato!"
      messaggio={`Grazie ${nome}, il tuo ordine è confermato. Ritiro previsto alle ${orario}.`}
      testoDownload="🧾 Scarica la ricevuta e mostrala al ritiro: riporta il riepilogo del tuo ordine, già confermato."
      etichettaDownload="Scarica ricevuta (PDF)"
      isDownloading={isDownloading}
      onDownload={onScaricaRicevuta}
      downloadError={downloadError}
      onTornaHome={onTornaHome}
    >
      <Box className="w-full max-w-md self-center rounded-2xl border border-sky-200 bg-sky-100 p-5">
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
                {euro(riga.subtotale)}
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
            {euro(totale)}
          </Text>
        </HStack>
      </Box>
    </ConfermaLayout>
  );
}
