import { Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ChevronRightIcon, Icon } from '@/components/ui/icon';

type ServizioStaffCardProps = {
  icon: string;
  title: string;
  descrizione: string;
  /** Riga di stato letta dal backend (es. "2 listini · 1 attivo"). `null` finché non è nota. */
  stat?: string | null;
  ctaLabel: string;
  /** Assente = servizio non ancora sviluppato: card spenta, badge "In arrivo", nessuna navigazione. */
  href?: Href;
};

// Card d'ingresso a un servizio, usata dalla dashboard staff (app/staff/index.tsx).
// Riusa il linguaggio visivo già collaudato di PiscinaInventarioCard
// (badge circolare con emoji + pill CTA `bg-sky-500/15` con freccia), qui però come tessera
// di una griglia ad altezza uniforme: il contenuto cresce e la CTA resta ancorata in fondo.
export function ServizioStaffCard({ icon, title, descrizione, stat, ctaLabel, href }: Readonly<ServizioStaffCardProps>) {
  if (!href) {
    return (
      <Box className="h-full w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <VStack space="sm" className="h-full">
          <HStack space="sm" className="items-center">
            <Box className="h-11 w-11 items-center justify-center rounded-full bg-white">
              <Text size="lg">{icon}</Text>
            </Box>
            <VStack className="flex-1">
              <Heading size="md" className="text-muted-foreground">
                {title}
              </Heading>
              <Text size="xs" className="text-muted-foreground">
                {descrizione}
              </Text>
            </VStack>
          </HStack>

          <Box className="flex-1" />

          <HStack className="items-center justify-center rounded-xl bg-amber-100 px-3 py-2">
            <Text size="xs" className="font-semibold text-amber-700">
              In arrivo
            </Text>
          </HStack>
        </VStack>
      </Box>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${ctaLabel}`}
      className="h-full w-full rounded-2xl border border-sky-200 bg-sky-100 shadow-sm active:opacity-90"
    >
      <VStack space="sm" className="h-full p-5">
        <HStack space="sm" className="items-center">
          <Box className="h-11 w-11 items-center justify-center rounded-full bg-white/70">
            <Text size="lg">{icon}</Text>
          </Box>
          <VStack className="flex-1">
            <Heading size="md">{title}</Heading>
            <Text size="xs" className="text-sky-900/70">
              {descrizione}
            </Text>
          </VStack>
        </HStack>

        {/* Spinge la CTA in fondo, così tessere con testi di lunghezza diversa restano allineate. */}
        <Box className="flex-1" />

        {stat ? (
          <Box className="rounded-xl bg-white/60 px-3 py-2">
            <Text size="xs" className="font-medium text-sky-900">
              {stat}
            </Text>
          </Box>
        ) : null}

        <HStack className="items-center justify-between rounded-xl bg-sky-500/15 px-3 py-2">
          <Text size="xs" className="font-semibold text-sky-700">
            {ctaLabel}
          </Text>
          <Icon as={ChevronRightIcon} size="sm" className="text-sky-700" />
        </HStack>
      </VStack>
    </Pressable>
  );
}
