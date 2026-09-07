import { Linking, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { ChevronRightIcon, Icon, PhoneIcon } from '@/components/ui/icon';

type ClienteInfoCardProps = {
  nome: string;
  telefono: string;
  clienteId: string;
};

// Anagrafica del cliente in cima a una pagina di dettaglio prenotazione: il numero è tappabile
// per chiamare, con la pillola "Chiama" a rendere esplicita l'azione, più un link alla scheda
// cliente completa (che porta l'intero storico su tutti i servizi).
export function ClienteInfoCard({ nome, telefono, clienteId }: Readonly<ClienteInfoCardProps>) {
  return (
    <VStack space="sm" className="w-full">
      <Pressable
        onPress={() => Linking.openURL(`tel:${telefono}`).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={`Chiama ${telefono}`}
        className="active:opacity-80"
      >
        <Box className="w-full rounded-xl border-2 border-sky-200 bg-white p-4 shadow-sm">
          <HStack className="items-center justify-between">
            <VStack className="flex-1">
              <Text size="md" className="font-semibold text-sky-900">
                {nome}
              </Text>
              <HStack space="xs" className="items-center">
                <Icon as={PhoneIcon} size="xs" className="text-sky-600" />
                <Text size="sm" className="text-sky-700">
                  {telefono}
                </Text>
              </HStack>
            </VStack>
            <HStack space="xs" className="items-center rounded-full bg-sky-500/15 px-3 py-1.5">
              <Text size="xs" className="font-bold text-sky-700">
                Chiama
              </Text>
              <Icon as={ChevronRightIcon} size="xs" className="text-sky-700" />
            </HStack>
          </HStack>
        </Box>
      </Pressable>

      <Pressable
        onPress={() => router.push(`/staff/clienti/${clienteId}`)}
        accessibilityRole="button"
        accessibilityLabel="Vedi scheda cliente completa"
        className="min-h-11 w-full justify-center rounded-xl border border-sky-100 bg-white px-4 py-3 active:bg-sky-50"
      >
        <HStack className="items-center justify-between">
          <Text size="sm" className="font-medium text-sky-700">
            Vedi scheda cliente completa
          </Text>
          <Icon as={ChevronRightIcon} size="sm" className="text-sky-400" />
        </HStack>
      </Pressable>
    </VStack>
  );
}
