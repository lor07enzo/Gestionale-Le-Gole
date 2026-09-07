import { Pressable } from 'react-native';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { ChevronLeftIcon, ChevronRightIcon, Icon } from '@/components/ui/icon';
import { addDays, formatDisplayDate, isSameDay, toISODate } from '../../utils/piscinaMappa';

type DateNavBarProps = {
  selectedDate: Date;
  onChange: (next: Date) => void;
  /** Giorno più indietro raggiungibile: omesso = nessun limite. */
  minDate?: Date;
  /** Giorno più avanti raggiungibile: omesso = nessun limite. */
  maxDate?: Date;
};

// Navigatore ±1 giorno con scorciatoia "Torna a oggi". I limiti sono opzionali perché servizi
// diversi ne hanno bisogno in direzioni opposte: gli ordini asporto non guardano mai avanti (si
// ritirano in giornata), le partite di padel si prenotano invece con giorni di anticipo.
export function DateNavBar({ selectedDate, onChange, minDate, maxDate }: Readonly<DateNavBarProps>) {
  const isToday = isSameDay(selectedDate, new Date());
  const iso = toISODate(selectedDate);
  const puoIndietro = !minDate || iso > toISODate(minDate);
  const puoAvanti = !maxDate || iso < toISODate(maxDate);

  return (
    <HStack
      space="sm"
      className="items-center justify-between rounded-2xl border border-sky-100 bg-white p-2.5 shadow-sm md:self-center md:px-10"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Giorno precedente"
        onPress={() => puoIndietro && onChange(addDays(selectedDate, -1))}
        disabled={!puoIndietro}
        className={`h-11 w-11 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50 md:h-12 md:w-12 ${
          puoIndietro ? '' : 'opacity-40'
        }`}
      >
        <Icon as={ChevronLeftIcon} size="md" className="text-sky-900" />
      </Pressable>

      <VStack className="items-center px-2">
        <Text size="md" className="font-bold capitalize text-sky-900">
          {isToday ? 'Oggi' : formatDisplayDate(selectedDate)}
        </Text>
        {!isToday ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Torna a oggi"
            onPress={() => onChange(new Date())}
            className="mt-1.5 items-center rounded-full bg-sky-600 px-3 py-1"
          >
            <Text size="2xs" className="font-bold text-white">
              Torna a oggi
            </Text>
          </Pressable>
        ) : null}
      </VStack>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Giorno successivo"
        onPress={() => puoAvanti && onChange(addDays(selectedDate, 1))}
        disabled={!puoAvanti}
        className={`h-11 w-11 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50 md:h-12 md:w-12 ${
          puoAvanti ? '' : 'opacity-40'
        }`}
      >
        <Icon as={ChevronRightIcon} size="md" className="text-sky-900" />
      </Pressable>
    </HStack>
  );
}
