import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { formatDisplayDate } from '../../../utils/piscinaMappa';

export function DisponibilitaRow() {
  const { disponibilita, selectedDate } = usePiscinaMappaData();

  if (!disponibilita) return null;

  return (
    <VStack space="xs">
      <Heading size="sm">Disponibilità per {formatDisplayDate(selectedDate)}</Heading>
      <HStack space="sm" className="flex-wrap">
        {disponibilita.map((item) => {
          const esaurito = item.residui <= 0;
          const scarso = !esaurito && item.totale > 0 && item.residui <= item.totale * 0.2;
          const tone = esaurito
            ? 'border-rose-300 bg-rose-50'
            : scarso
              ? 'border-amber-300 bg-amber-50'
              : 'border-emerald-200 bg-emerald-50';
          const textTone = esaurito ? 'text-rose-700' : scarso ? 'text-amber-700' : 'text-emerald-700';
          return (
            <VStack
              key={item.key}
              className={`min-w-22.5 flex-1 items-center rounded-xl border-2 px-2 py-3 ${tone}`}
            >
              <Text size="lg">{item.icon}</Text>
              <Text size="md" className={`font-bold ${textTone}`}>
                {item.residui}
                <Text size="xs" className={textTone}>
                  {' '}
                  / {item.totale}
                </Text>
              </Text>
              <Text size="2xs" className="text-sky-900/60">
                {item.label} liberi
              </Text>
            </VStack>
          );
        })}
      </HStack>
    </VStack>
  );
}
