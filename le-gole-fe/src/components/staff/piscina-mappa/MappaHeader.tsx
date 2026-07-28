import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ArrowLeftIcon, Icon } from '@/components/ui/icon';

export function MappaHeader({ nome }: Readonly<{ nome: string | undefined }>) {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">{nome ?? 'Mappa Piscina'}</Heading>
        <Text size="sm" className="text-muted-foreground">
          Postazioni ombrelloni e gazebi
        </Text>
      </VStack>
    </HStack>
  );
}
