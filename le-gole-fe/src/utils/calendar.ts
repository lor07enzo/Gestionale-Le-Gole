import { addDays } from './piscinaMappa';

export type CalendarDay = { date: Date; inCurrentMonth: boolean };

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function formatMonthLabel(date: Date): string {
  const label = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Griglia di settimane complete (lunedì come primo giorno) che copre l'intero mese, includendo
// i giorni di riempimento del mese precedente/successivo necessari a completare la prima e
// l'ultima settimana (marcati `inCurrentMonth: false`, non selezionabili).
export function buildMonthGrid(monthStart: Date): CalendarDay[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = lunedì
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarDay[] = [];
  for (let i = firstWeekday; i > 0; i--) {
    cells.push({ date: addDays(new Date(year, month, 1), -i), inCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), inCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: addDays(cells[cells.length - 1].date, 1), inCurrentMonth: false });
  }
  return cells;
}

export function startOfWeek(date: Date): Date {
  const weekday = (date.getDay() + 6) % 7; // 0 = lunedì
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -weekday);
}

export function addWeeks(date: Date, delta: number): Date {
  return addDays(date, delta * 7);
}

// Riga di 7 giorni (lunedì-domenica) a partire da weekStart. `inCurrentMonth: true` su tutte le
// celle: a differenza della griglia mensile qui non esistono giorni di riempimento da disabilitare,
// la settimana è sempre "piena" di giorni selezionabili.
export function buildWeekGrid(weekStart: Date): CalendarDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    date: addDays(weekStart, i),
    inCurrentMonth: true,
  }));
}

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth =
    weekStart.getMonth() === weekEnd.getMonth() && weekStart.getFullYear() === weekEnd.getFullYear();
  const startLabel = weekStart.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
  });
  const endLabel = weekEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}
