import { Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ChevronRightIcon, Icon } from '@/components/ui/icon';

type SezioneLinkCardProps = {
  icon: string;
  title: string;
  descrizione: string;
  href: Href;
  /** Smeraldo per le azioni di creazione, sky per la navigazione. */
  tone?: 'sky' | 'emerald';
};

// Teaser cliccabile verso una pagina figlia, dentro una pagina di servizio staff. Stesso
// linguaggio visivo di ServizioStaffCard (badge con emoji + freccia), in versione compatta.
export function SezioneLinkCard({ icon, title, descrizione, href, tone = 'sky' }: Readonly<SezioneLinkCardProps>) {
  const isEmerald = tone === 'emerald';
  const contenitore = isEmerald ? 'border-emerald-200 bg-emerald-50' : 'border-sky-200 bg-sky-100';
  const testo = isEmerald ? 'text-emerald-900/70' : 'text-sky-900/70';
  const icona = isEmerald ? 'text-emerald-700' : 'text-sky-700';

  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${descrizione}`}
      className={`h-full w-full rounded-2xl border active:opacity-90 ${contenitore}`}
    >
      <HStack space="sm" className="h-full items-center p-4">
        <Box className="h-10 w-10 items-center justify-center rounded-full bg-white/70">
          <Text size="lg">{icon}</Text>
        </Box>
        <VStack className="flex-1">
          <Heading size="sm">{title}</Heading>
          <Text size="xs" className={testo}>
            {descrizione}
          </Text>
        </VStack>
        <Icon as={ChevronRightIcon} size="md" className={icona} />
      </HStack>
    </Pressable>
  );
}
