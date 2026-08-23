import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

// Teaser cliccabile per la home staff: la gestione vera e propria (categorie, allergeni,
// catalogo prodotti, orario del servizio) vive nella pagina dedicata `/staff/asporto`, per
// lasciare la home libera — stesso principio di "Gestisci mappa postazioni →" su
// PiscinaInventarioCard (PiscinaInventarioSection.tsx), di cui questa card riusa lo stesso
// linguaggio visivo (pill CTA `bg-sky-500/15` con freccia "→").
export function MenuAsportoLinkCard() {
  return (
    <VStack space="md" className="w-full">
      <VStack>
        <Heading size="md">Menu Asporto</Heading>
        <Text size="xs" className="text-muted-foreground">
          Tocca per gestire catalogo e orario di disponibilità del servizio.
        </Text>
      </VStack>

      <Pressable
        onPress={() => router.push('/staff/asporto')}
        accessibilityRole="button"
        accessibilityLabel="Apri gestione menu asporto"
        className="w-full rounded-2xl border border-sky-200 bg-sky-100 active:opacity-90"
      >
        <VStack space="sm" className="p-5">
          <HStack space="sm" className="items-center">
            <Box className="h-10 w-10 items-center justify-center rounded-full bg-white/70">
              <Text size="lg">🥡</Text>
            </Box>
            <VStack className="flex-1">
              <Heading size="md">Catalogo e ordini</Heading>
              <Text size="xs" className="text-sky-900/70">
                Categorie, prodotti, allergeni e orario di ritiro
              </Text>
            </VStack>
          </HStack>

          <HStack className="items-center justify-between rounded-xl bg-sky-500/15 px-3 py-2">
            <Text size="xs" className="text-sky-900/70">
              Gestione completa
            </Text>
            <HStack space="xs" className="items-center">
              <Text size="xs" className="font-semibold text-sky-700">
                Apri menu asporto
              </Text>
              <Text size="sm" className="font-semibold text-sky-700">
                →
              </Text>
            </HStack>
          </HStack>
        </VStack>
      </Pressable>
    </VStack>
  );
}
