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
import { CalendarPicker } from './CalendarPicker';

type CalendarioSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  /** Chiamata con il giorno scelto; il foglio si chiude da sé subito dopo. */
  onSelect: (date: Date) => void;
  caption: string;
  ariaLabel?: string;
  minDate?: Date;
  maxDate?: Date;
  fullDates?: Record<string, boolean>;
  countsByDate?: Record<string, number>;
  onVisibleMonthChange?: (anno: number, mese: number) => void;
};

// Foglio "Scegli il giorno" con il calendario mensile: stesso guscio per tutti i selettori di data
// dell'app (mappa piscina, padel, storico ordini, prenotazioni e riprenotazioni cliente).
// `aria-label` esplicito: il rilevamento automatico del titolo di react-aria va in race con
// l'animazione di apertura del foglio.
export function CalendarioSheet({
  isOpen,
  onClose,
  selectedDate,
  onSelect,
  caption,
  ariaLabel = 'Scegli il giorno',
  minDate,
  maxDate,
  fullDates,
  countsByDate,
  onVisibleMonthChange,
}: Readonly<CalendarioSheetProps>) {
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent aria-label={ariaLabel}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack space="md" className="w-full pb-6 pt-1">
          <Heading size="sm">Scegli il giorno</Heading>
          <Text size="xs" className="text-muted-foreground">
            {caption}
          </Text>
          <CalendarPicker
            selectedDate={selectedDate}
            onSelect={(date) => {
              onSelect(date);
              onClose();
            }}
            minDate={minDate}
            maxDate={maxDate}
            fullDates={fullDates}
            countsByDate={countsByDate}
            onVisibleMonthChange={onVisibleMonthChange}
          />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
