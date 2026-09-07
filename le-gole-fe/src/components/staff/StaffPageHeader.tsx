import { Pressable } from 'react-native';
import type { Href } from 'expo-router';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ArrowLeftIcon, Icon } from '@/components/ui/icon';
import { goBackOr } from '../../utils/navigation';

type StaffPageHeaderProps = {
  title: string;
  subtitle?: string;
  fallbackHref: Href;
  /** Slot opzionale a destra del titolo (azione primaria della pagina). */
  right?: React.ReactNode;
};

// Header condiviso delle pagine staff di secondo livello: freccia indietro + titolo + sottotitolo.
// Lo stesso blocco era ripetuto identico in MappaHeader/AsportoHeader/ClientiHeader; qui è uno solo,
// con in più uno slot `right` per l'azione primaria (usato dalle pagine che ne hanno una).
export function StaffPageHeader({ title, subtitle, fallbackHref, right }: Readonly<StaffPageHeaderProps>) {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr(fallbackHref)}
        accessibilityLabel="Torna indietro"
        accessibilityRole="button"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300 md:h-12 md:w-12"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl" className="md:text-2xl">
          {title}
        </Heading>
        {subtitle ? (
          <Text size="sm" className="text-muted-foreground">
            {subtitle}
          </Text>
        ) : null}
      </VStack>
      {right}
    </HStack>
  );
}
