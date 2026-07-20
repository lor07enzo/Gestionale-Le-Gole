import { Pressable } from 'react-native';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { addDays, formatDisplayDate, isSameDay } from '../../../utils/piscinaMappa';

export function DateNavigator() {
  const { selectedDate, setSelectedDate } = usePiscinaMappaData();

  return (
    <HStack space="sm" className="items-center justify-between rounded-xl bg-sky-100 p-2">
      <Button
        size="sm"
        variant="outline"
        className="border-2 border-sky-300 bg-white shadow-sm"
        onPress={() => setSelectedDate((d) => addDays(d, -1))}
      >
        <ButtonText className="text-base font-bold text-sky-900">◀</ButtonText>
      </Button>
      <Pressable onPress={() => setSelectedDate(new Date())}>
        <VStack className="items-center">
          <Text size="sm" className="font-semibold text-sky-900">
            {formatDisplayDate(selectedDate)}
          </Text>
          {!isSameDay(selectedDate, new Date()) ? (
            <Text size="2xs" className="font-semibold text-sky-700 underline">
              Torna a oggi
            </Text>
          ) : null}
        </VStack>
      </Pressable>
      <Button
        size="sm"
        variant="outline"
        className="border-2 border-sky-300 bg-white shadow-sm"
        onPress={() => setSelectedDate((d) => addDays(d, 1))}
      >
        <ButtonText className="text-base font-bold text-sky-900">▶</ButtonText>
      </Button>
    </HStack>
  );
}
