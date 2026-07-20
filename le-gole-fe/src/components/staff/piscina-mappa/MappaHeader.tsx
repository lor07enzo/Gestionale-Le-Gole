import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

export function MappaHeader({ nome }: Readonly<{ nome: string | undefined }>) {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Torna indietro"
        className="h-9 w-9 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm"
      >
        <Text size="md" className="font-bold text-sky-900">
          ←
        </Text>
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
