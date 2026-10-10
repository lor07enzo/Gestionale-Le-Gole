import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { BackButton } from './BackButton';

// Scheletro e tipografia comuni delle pagine legali pubbliche (app/privacy.tsx,
// app/eliminazione-dati.tsx): stesso Titolare e stessa resa, così le due pagine non possono
// divergere né contraddirsi.

export const TITOLARE = {
  ragioneSociale: 'AME S.r.l.',
  nomeCommerciale: 'Osteria Le Gole',
  piva: '01271600577',
  indirizzo: 'Via Salaria SS4 km 98,865 snc, 02013 Antrodoco (RI)',
  emailPrivacy: 'osterialegole@icloud.com',
};

export function SectionHeading({ children }: Readonly<{ children: string }>) {
  return (
    <Heading size="md" className="mt-2 text-foreground">
      {children}
    </Heading>
  );
}

export function Paragraph({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Text size="sm" className="leading-6 text-muted-foreground">
      {children}
    </Text>
  );
}

export function ListItem({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Text size="sm" className="leading-6 text-muted-foreground">
      •  {children}
    </Text>
  );
}

export function Bold({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Text size="sm" className="font-semibold text-foreground">
      {children}
    </Text>
  );
}

// Rotte di primo livello (non sotto app/cliente/): non ereditano il paddingTop della safe area
// dal layout dell'Area Cliente, quindi lo riservano qui.
// `aggiornamento` è per pagina: le due pagine legali cambiano in momenti diversi, e una data
// condivisa farebbe risultare aggiornata anche quella che non è stata toccata.
export function PaginaLegale({
  titolo,
  aggiornamento,
  children,
}: Readonly<{ titolo: string; aggiornamento: string; children: ReactNode }>) {
  const insets = useSafeAreaInsets();
  return (
    <Box className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
        <VStack space="lg" className="w-full max-w-2xl self-center">
          <VStack space="xs">
            <Heading size="2xl" className="text-foreground">
              {titolo}
            </Heading>
            <Text size="xs" className="text-muted-foreground">
              Ultimo aggiornamento: {aggiornamento}
            </Text>
          </VStack>

          {children}

          <BackButton className="mt-2" fallbackHref="/cliente" />
        </VStack>
      </ScrollView>
    </Box>
  );
}
