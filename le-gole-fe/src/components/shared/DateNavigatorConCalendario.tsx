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
import { CalendarPicker } from './CalendarPicker';
import { addDays, formatDisplayDate, isSameDay, toISODate } from '../../utils/piscinaMappa';

type DateNavigatorConCalendarioProps = {
  selectedDate: Date;
  onChange: (next: Date) => void;
  // Giorno più indietro/più avanti raggiungibile: omessi = nessun limite in quella direzione.
  minDate?: Date;
  maxDate?: Date;
  // Conteggi per giorno del mese/settimana visibile — chi chiama sa come recuperarli (piscina
  // per inventario, padel/asporto senza alcun filtro): stessa forma di CalendarPicker.onVisibleMonthChange.
  loadConteggi: (anno: number, mese: number) => Promise<Record<string, number>>;
  // Testo sotto il titolo del foglio calendario, specifico per dominio (es. "partite"/"prenotazioni").
  calendarCaption: string;
};

// Base condivisa dei tre navigatori data a pillola + calendario mensile/settimanale già in uso
// nel progetto (mappa piscina, area staff padel — sezione 5/16 di CLAUDE.md): estratta quando è
// comparso un terzo chiamante con esigenze quasi identiche (Storico Ordini asporto, sezione 15),
// invece di copiare per la terza volta lo stesso markup. `DateNavigatorPadel`/`DateNavigatorAsporto`
// restano wrapper sottili con la propria firma/i propri conteggi — solo il markup/la logica di
// navigazione vive qui.
export function DateNavigatorConCalendario({
  selectedDate,
  onChange,
  minDate,
  maxDate,
  loadConteggi,
  calendarCaption,
}: Readonly<DateNavigatorConCalendarioProps>) {
  const isToday = isSameDay(selectedDate, new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [conteggi, setConteggi] = useState<Record<string, number>>({});

  const puoIndietro = !minDate || toISODate(selectedDate) > toISODate(minDate);
  const puoAvanti = !maxDate || toISODate(selectedDate) < toISODate(maxDate);

  const handleVisibleMonthChange = (anno: number, mese: number) => {
    // Uniti ai conteggi già in memoria: la vista Settimana può richiedere due mesi in successione.
    loadConteggi(anno, mese)
      .then((result) => setConteggi((prev) => ({ ...prev, ...result })))
      .catch(() => {});
  };

  return (
    <>
      <HStack
        space="md"
        className="items-center justify-between rounded-2xl border border-sky-100 bg-white p-2.5 shadow-sm md:self-center md:min-w-80 md:px-10 md:py-3 lg:min-w-96 lg:px-16 lg:py-5"
      >
        <Pressable
          accessibilityLabel="Giorno precedente"
          onPress={() => puoIndietro && onChange(addDays(selectedDate, -1))}
          disabled={!puoIndietro}
          className={`h-11 w-11 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50 md:h-12 md:w-12 lg:h-14 lg:w-14 ${
            puoIndietro ? '' : 'opacity-40'
          }`}
        >
          <Icon as={ChevronLeftIcon} size="lg" className="text-sky-900" />
        </Pressable>

        <VStack className="items-center">
          <Pressable
            accessibilityLabel="Apri calendario per scegliere il giorno"
            onPress={() => setIsCalendarOpen(true)}
          >
            <HStack space="xs" className="items-center">
              <Icon as={CalendarDaysIcon} size="md" className="text-sky-700" />
              <Text size="md" className="font-bold capitalize text-sky-900 md:text-lg lg:text-2xl">
                {isToday ? 'Oggi' : formatDisplayDate(selectedDate)}
              </Text>
            </HStack>
          </Pressable>
          {!isToday ? (
            <Pressable
              accessibilityLabel="Torna a oggi"
              onPress={() => onChange(new Date())}
              className="mt-1.5 items-center rounded-full bg-sky-600 px-3 py-1 lg:px-4 lg:py-1.5"
            >
              <Text size="2xs" className="font-bold text-white lg:text-sm">
                Torna a oggi
              </Text>
            </Pressable>
          ) : null}
        </VStack>

        <Pressable
          accessibilityLabel="Giorno successivo"
          onPress={() => puoAvanti && onChange(addDays(selectedDate, 1))}
          disabled={!puoAvanti}
          className={`h-11 w-11 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50 md:h-12 md:w-12 lg:h-14 lg:w-14 ${
            puoAvanti ? '' : 'opacity-40'
          }`}
        >
          <Icon as={ChevronRightIcon} size="lg" className="text-sky-900" />
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
              {calendarCaption}
            </Text>
            <CalendarPicker
              selectedDate={selectedDate}
              onSelect={(date) => {
                onChange(date);
                setIsCalendarOpen(false);
              }}
              minDate={minDate}
              maxDate={maxDate}
              countsByDate={conteggi}
              onVisibleMonthChange={handleVisibleMonthChange}
            />
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
