import { useState } from 'react';
import { Pressable } from 'react-native';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, Icon } from '@/components/ui/icon';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { getConteggiPrenotazioniPiscina } from '../../../services/prenotazioni';
import { addDays, formatDisplayDate, isSameDay } from '../../../utils/piscinaMappa';
import { CalendarPicker } from '../../shared/CalendarPicker';

export function DateNavigator() {
  const { inventarioId, selectedDate, setSelectedDate } = usePiscinaMappaData();
  const isToday = isSameDay(selectedDate, new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [conteggi, setConteggi] = useState<Record<string, number>>({});

  const handleVisibleMonthChange = (anno: number, mese: number) => {
    // Uniti ai conteggi già in memoria: la vista Settimana può richiedere due mesi in successione.
    getConteggiPrenotazioniPiscina({ inventario: inventarioId, anno, mese })
      .then((result) => setConteggi((prev) => ({ ...prev, ...result })))
      .catch(() => {});
  };

  return (
    <>
      <HStack
        space="sm"
        className="items-center justify-between rounded-2xl border border-sky-100 bg-white p-2.5 shadow-sm"
      >
        <Pressable
          accessibilityLabel="Giorno precedente"
          onPress={() => setSelectedDate((d) => addDays(d, -1))}
          className="h-10 w-10 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50"
        >
          <Icon as={ChevronLeftIcon} size="md" className="text-sky-900" />
        </Pressable>

        <VStack className="items-center">
          <Pressable
            accessibilityLabel="Apri calendario per scegliere il giorno"
            onPress={() => setIsCalendarOpen(true)}
          >
            <HStack space="xs" className="items-center">
              <Icon as={CalendarDaysIcon} size="sm" className="text-sky-700" />
              <Text size="md" className="font-bold capitalize text-sky-900">
                {isToday ? 'Oggi' : formatDisplayDate(selectedDate)}
              </Text>
            </HStack>
          </Pressable>
          {!isToday ? (
            <Pressable
              accessibilityLabel="Torna a oggi"
              onPress={() => setSelectedDate(new Date())}
              className="mt-1.5 items-center rounded-full bg-sky-600 px-3 py-1"
            >
              <Text size="2xs" className="font-bold text-white">
                Torna a oggi
              </Text>
            </Pressable>
          ) : null}
        </VStack>

        <Pressable
          accessibilityLabel="Giorno successivo"
          onPress={() => setSelectedDate((d) => addDays(d, 1))}
          className="h-10 w-10 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50"
        >
          <Icon as={ChevronRightIcon} size="md" className="text-sky-900" />
        </Pressable>
      </HStack>

      <Actionsheet isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent aria-label="Scegli il giorno">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack space="md" className="w-full pb-6 pt-1">
            <Heading size="sm">Scegli il giorno</Heading>
            <Text size="xs" className="text-muted-foreground">
              Il numero su ogni giorno indica quante prenotazioni ci sono già, anche nel passato.
            </Text>
            <CalendarPicker
              selectedDate={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setIsCalendarOpen(false);
              }}
              countsByDate={conteggi}
              onVisibleMonthChange={handleVisibleMonthChange}
            />
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
