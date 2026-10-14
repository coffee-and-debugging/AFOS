import type { DateRange } from '../api/client';

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

export const RANGE_LABEL: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
  custom: 'Custom',
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** yyyy-mm-dd in local time, for <input type="date"> */
export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Local-midnight boundaries as ISO instants; `to` is exclusive. */
export function presetRange(preset: Exclude<RangePreset, 'custom'>, now = new Date()): DateRange {
  const today = startOfDay(now);
  const r = (from: Date, to: Date) => ({ from: from.toISOString(), to: to.toISOString() });
  switch (preset) {
    case 'today': return r(today, addDays(today, 1));
    case 'yesterday': return r(addDays(today, -1), today);
    case '7d': return r(addDays(today, -6), addDays(today, 1));
    case '30d': return r(addDays(today, -29), addDays(today, 1));
    case 'month': return r(new Date(today.getFullYear(), today.getMonth(), 1), addDays(today, 1));
  }
}

/** Inclusive local dates from date inputs → exclusive ISO range. */
export function customRange(fromDate: string, toDate: string): DateRange {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  return { from: new Date(fy, fm - 1, fd).toISOString(), to: new Date(ty, tm - 1, td + 1).toISOString() };
}
