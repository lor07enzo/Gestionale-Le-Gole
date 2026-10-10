import { useState } from 'react';
import { Pressable } from 'react-native';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, Icon } from '@/components/ui/icon';
import { CalendarioSheet } from '../shared/CalendarioSheet';
import { addDays, formatDisplayDate, isSameDay } from '../../utils/piscinaMappa';

type DateNavClienteProps = {
  selectedDate: Date;
  onChange: (date: Date) => void;
  /** Giorni non prenotabili (pieni o chiusi), evidenziati in rosa e non selezionabili. */
  fullDates: Record<string, boolean>;
  calendarCaption: string;
  onVisibleMonthChange?: (anno: number, mese: number) => void;
};

// Navigatore data dei flussi di prenotazione self-service (piscina, padel): ◀ / data / ▶ con il
// calendario a tocco. Mai nel passato: la freccia indietro si ferma a oggi e il calendario
// disabilita i giorni precedenti.
export function DateNavCliente({
  selectedDate,
  onChange,
  fullDates,
  calendarCaption,
  onVisibleMonthChange,
}: Readonly<DateNavClienteProps>) {
  const isToday = isSameDay(selectedDate, new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <>
      <HStack space="sm" className="items-center justify-between rounded-2xl border border-sky-100 bg-white p-2.5 shadow-sm">
        <Pressable
          accessibilityLabel="Giorno precedente"
          disabled={isToday}
          onPress={() => onChange(addDays(selectedDate, -1))}
          className={`h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm ${
            isToday ? 'border-sky-100 bg-sky-50' : 'border-sky-300 bg-white active:bg-sky-50'
          }`}
        >
          <Icon as={ChevronLeftIcon} size="md" className={isToday ? 'text-sky-300' : 'text-sky-900'} />
        </Pressable>

        <Pressable accessibilityLabel="Apri calendario per scegliere il giorno" onPress={() => setIsCalendarOpen(true)}>
          <HStack space="xs" className="items-center">
            <Icon as={CalendarDaysIcon} size="sm" className="text-sky-700" />
            <Text size="md" className="font-bold capitalize text-sky-900">
              {isToday ? 'Oggi' : formatDisplayDate(selectedDate)}
            </Text>
          </HStack>
        </Pressable>

        <Pressable
          accessibilityLabel="Giorno successivo"
          onPress={() => onChange(addDays(selectedDate, 1))}
          className="h-10 w-10 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50"
        >
          <Icon as={ChevronRightIcon} size="md" className="text-sky-900" />
        </Pressable>
      </HStack>

      <CalendarioSheet
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={selectedDate}
        onSelect={onChange}
        caption={calendarCaption}
        minDate={new Date()}
        fullDates={fullDates}
        onVisibleMonthChange={onVisibleMonthChange}
      />
    </>
  );
}
