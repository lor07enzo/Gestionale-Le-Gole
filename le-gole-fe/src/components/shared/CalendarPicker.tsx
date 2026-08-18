import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Icon, ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icon';
import { addDays, isSameDay, toISODate } from '../../utils/piscinaMappa';
import {
  addMonths,
  addWeeks,
  buildMonthGrid,
  buildWeekGrid,
  formatMonthLabel,
  formatWeekLabel,
  startOfMonth,
  startOfWeek,
  WEEKDAY_LABELS,
  type CalendarDay,
} from '../../utils/calendar';

type ViewMode = 'month' | 'week';

// Badge "soft" (bg-*-100 + text-*-700): uno sfondo pieno con testo bianco ha contrasto
// insufficiente per testo piccolo (sotto la soglia WCAG AA).
function badgeClassesForCount(count: number): { bg: string; text: string } {
  if (count >= 6) return { bg: 'bg-rose-100', text: 'text-rose-700' };
  if (count >= 3) return { bg: 'bg-amber-100', text: 'text-amber-700' };
  return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
}

type CalendarDayCellProps = {
  day: CalendarDay;
  selectedDate: Date;
  today: Date;
  minDay: Date | null;
  viewMode: ViewMode;
  count: number;
  isFull: boolean;
  onSelect: (date: Date) => void;
};

function CalendarDayCell({
  day: { date, inCurrentMonth },
  selectedDate,
  today,
  minDay,
  viewMode,
  count,
  isFull,
  onSelect,
}: Readonly<CalendarDayCellProps>) {
  // Un giorno "completo" non è selezionabile, stesso trattamento dei giorni prima di `minDate`.
  const disabled = !inCurrentMonth || (minDay !== null && date < minDay) || isFull;
  const isSelected = inCurrentMonth && isSameDay(date, selectedDate);
  const isToday = inCurrentMonth && isSameDay(date, today);

  let dayTextClass = 'text-sky-900';
  if (isSelected) dayTextClass = 'font-bold text-white';
  else if (!inCurrentMonth) dayTextClass = 'text-sky-900/20';
  else if (isFull) dayTextClass = 'font-semibold text-rose-400 line-through';
  else if (disabled) dayTextClass = 'text-sky-900/30';

  let dayBoxClass = '';
  if (isSelected) dayBoxClass = 'bg-sky-600';
  else if (isFull) dayBoxClass = 'bg-rose-100';
  else if (isToday) dayBoxClass = 'border-2 border-sky-400';

  const countBadge = count > 0 ? badgeClassesForCount(count) : null;

  let accessibilityLabel = toISODate(date);
  if (isFull) accessibilityLabel += ', completo';
  else if (count > 0) accessibilityLabel += `, ${count} prenotazioni`;

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onSelect(date)}
      accessibilityLabel={accessibilityLabel}
      className="flex-1 items-center py-1"
    >
      <Box
        className={`relative items-center justify-center rounded-full ${viewMode === 'week' ? 'h-11 w-11' : 'h-9 w-9'} ${dayBoxClass}`}
      >
        <Text size="sm" className={dayTextClass}>
          {date.getDate()}
        </Text>
        {/* Badge a goccia, staccato dal cerchio con un anello border-background per un effetto
            "ritagliato". Dimensioni ridotte in vista Mese, dove il cerchio del giorno è più piccolo. */}
        {countBadge ? (
          <Box
            className={`absolute items-center justify-center rounded-full border-background ${countBadge.bg} ${
              viewMode === 'week'
                ? '-right-1.5 -top-1.5 h-5 min-w-5 border-2 px-1'
                : '-right-2 -top-2 h-3.5 min-w-3.5 border px-0.5'
            }`}
          >
            <Text size="2xs" className={`text-center font-bold leading-none ${countBadge.text}`}>
              {count}
            </Text>
          </Box>
        ) : null}
      </Box>
    </Pressable>
  );
}

export type CalendarPickerProps = {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  // Giorni prima di questa data sono disabilitati. Omesso lato staff.
  minDate?: Date;
  // Mappa ISODate -> numero di prenotazioni. Presente solo lato staff: abilita anche il toggle Mese/Settimana.
  countsByDate?: Record<string, number>;
  // ISODate marcati "tutto prenotato", solo lato Area Cliente. Indipendente da countsByDate.
  fullDates?: Record<string, boolean>;
  onVisibleMonthChange?: (year: number, month: number) => void;
};

export function CalendarPicker({
  selectedDate,
  onSelect,
  minDate,
  countsByDate,
  fullDates,
  onVisibleMonthChange,
}: Readonly<CalendarPickerProps>) {
  const supportsWeekView = countsByDate !== undefined;
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selectedDate));
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => startOfWeek(selectedDate));

  useEffect(() => {
    if (!onVisibleMonthChange) return;
    if (viewMode === 'month') {
      onVisibleMonthChange(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1);
      return;
    }
    // Una settimana a cavallo di due mesi richiede i conteggi di entrambi.
    const weekEnd = addDays(visibleWeekStart, 6);
    const mesiVisibili = new Set([
      `${visibleWeekStart.getFullYear()}-${visibleWeekStart.getMonth()}`,
      `${weekEnd.getFullYear()}-${weekEnd.getMonth()}`,
    ]);
    mesiVisibili.forEach((chiave) => {
      const [anno, mese] = chiave.split('-').map(Number);
      onVisibleMonthChange(anno, mese + 1);
    });
    // Solo al cambio di vista/periodo, non ad ogni render del parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, visibleMonth, visibleWeekStart]);

  const switchToMonth = () => {
    setVisibleMonth(startOfMonth(selectedDate));
    setViewMode('month');
  };

  const switchToWeek = () => {
    setVisibleWeekStart(startOfWeek(selectedDate));
    setViewMode('week');
  };

  const cells = viewMode === 'month' ? buildMonthGrid(visibleMonth) : buildWeekGrid(visibleWeekStart);
  const today = new Date();
  const minDay = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : null;
  const weeks = Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));

  return (
    <VStack space="sm" className="w-full">
      {supportsWeekView ? (
        <HStack space="xs" className="w-full rounded-full bg-sky-50 p-1">
          <Pressable
            accessibilityLabel="Vista mensile"
            onPress={switchToMonth}
            className={`flex-1 items-center rounded-full py-1.5 ${viewMode === 'month' ? 'bg-sky-600' : ''}`}
          >
            <Text size="xs" className={`font-bold ${viewMode === 'month' ? 'text-white' : 'text-sky-700'}`}>
              Mese
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Vista settimanale"
            onPress={switchToWeek}
            className={`flex-1 items-center rounded-full py-1.5 ${viewMode === 'week' ? 'bg-sky-600' : ''}`}
          >
            <Text size="xs" className={`font-bold ${viewMode === 'week' ? 'text-white' : 'text-sky-700'}`}>
              Settimana
            </Text>
          </Pressable>
        </HStack>
      ) : null}

      <HStack className="items-center justify-between">
        <Pressable
          accessibilityLabel={viewMode === 'month' ? 'Mese precedente' : 'Settimana precedente'}
          onPress={() =>
            viewMode === 'month'
              ? setVisibleMonth((m) => addMonths(m, -1))
              : setVisibleWeekStart((w) => addWeeks(w, -1))
          }
          className="h-9 w-9 items-center justify-center rounded-full border-2 border-sky-300 bg-white active:bg-sky-50"
        >
          <Icon as={ChevronLeftIcon} size="sm" className="text-sky-900" />
        </Pressable>
        <Text size="md" className="font-bold capitalize text-sky-900">
          {viewMode === 'month' ? formatMonthLabel(visibleMonth) : formatWeekLabel(visibleWeekStart)}
        </Text>
        <Pressable
          accessibilityLabel={viewMode === 'month' ? 'Mese successivo' : 'Settimana successiva'}
          onPress={() =>
            viewMode === 'month'
              ? setVisibleMonth((m) => addMonths(m, 1))
              : setVisibleWeekStart((w) => addWeeks(w, 1))
          }
          className="h-9 w-9 items-center justify-center rounded-full border-2 border-sky-300 bg-white active:bg-sky-50"
        >
          <Icon as={ChevronRightIcon} size="sm" className="text-sky-900" />
        </Pressable>
      </HStack>

      <HStack className="w-full">
        {WEEKDAY_LABELS.map((label) => (
          <Box key={label} className="flex-1 items-center py-1">
            <Text size="2xs" className="font-semibold text-sky-900/50">
              {label}
            </Text>
          </Box>
        ))}
      </HStack>

      <VStack space="xs" className="w-full">
        {weeks.map((week) => (
          <HStack key={week[0].date.toISOString()} className="w-full">
            {week.map((day) => (
              <CalendarDayCell
                key={day.date.toISOString()}
                day={day}
                selectedDate={selectedDate}
                today={today}
                minDay={minDay}
                viewMode={viewMode}
                count={countsByDate?.[toISODate(day.date)] ?? 0}
                isFull={fullDates?.[toISODate(day.date)] ?? false}
                onSelect={onSelect}
              />
            ))}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}
