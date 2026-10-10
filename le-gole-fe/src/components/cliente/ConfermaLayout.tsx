import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { ClienteFooter } from './ClienteFooter';

type ConfermaLayoutProps = {
  titolo: string;
  messaggio: React.ReactNode;
  /** Riquadro opzionale tra la conferma e il download (es. il riepilogo righe dell'asporto). */
  children?: React.ReactNode;
  testoDownload: string;
  etichettaDownload: string;
  isDownloading: boolean;
  onDownload: () => void;
  downloadError: string | null;
  onTornaHome: () => void;
};

// Scheletro comune delle schermate di conferma self-service (piscina, asporto, padel): riquadro
// verde di conferma, documento PDF da scaricare, "Torna alla home" e footer. Ogni servizio ne
// fornisce solo i testi, così le tre rese non possono divergere nel tempo.
//
// Le card sono centrate una per una con `self-center`, non con `items-center` sul VStack: il
// footer full-bleed conta sul proprio allineamento a sinistra per annullare l'offset `left-1/2`.
export function ConfermaLayout({
  titolo,
  messaggio,
  children,
  testoDownload,
  etichettaDownload,
  isDownloading,
  onDownload,
  downloadError,
  onTornaHome,
}: Readonly<ConfermaLayoutProps>) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <Box className="w-full max-w-md items-center self-center rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
          <Text size="3xl">✅</Text>
          <Heading size="lg" className="mt-2 text-center text-emerald-900">
            {titolo}
          </Heading>
          <Text size="sm" className="mt-2 text-center text-emerald-800">
            {messaggio}
          </Text>
        </Box>

        {children}

        <Box className="w-full max-w-md self-center rounded-2xl border border-sky-200 bg-sky-100 p-5">
          <Text size="sm" className="text-center text-sky-900">
            {testoDownload}
          </Text>
          <Button className="mt-3" onPress={onDownload} disabled={isDownloading}>
            {isDownloading ? <ButtonSpinner /> : <ButtonText>{etichettaDownload}</ButtonText>}
          </Button>
          {downloadError ? (
            <Text size="xs" className="mt-2 text-center text-destructive">
              {downloadError}
            </Text>
          ) : null}
        </Box>

        <Button
          variant="outline"
          className="self-center border-2 border-sky-300 bg-white"
          onPress={onTornaHome}
        >
          <ButtonText>Torna alla home</ButtonText>
        </Button>
        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
