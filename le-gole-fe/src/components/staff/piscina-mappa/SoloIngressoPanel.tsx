import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';

export function SoloIngressoPanel() {
  const { soloIngresso } = usePiscinaMappaData();

  return (
    <VStack space="xs">
      <Heading size="sm">Solo ingresso</Heading>
      {soloIngresso.length === 0 ? (
        <Text size="sm" className="text-muted-foreground">
          Nessun cliente con il solo ingresso per questa data.
        </Text>
      ) : (
        <VStack space="xs">
          {soloIngresso.map((p) => (
            <HStack key={p.id} className="items-center justify-between rounded-lg bg-white/60 px-3 py-2">
              <Text size="sm" className="text-sky-900">
                {p.cliente_nome}
              </Text>
              <Text size="xs" className="text-sky-900/70">
                {p.ingressi} ingress{p.ingressi === 1 ? 'o' : 'i'}
              </Text>
            </HStack>
          ))}
        </VStack>
      )}
    </VStack>
  );
}
