/**
 * Availability windows: pure logic of the editor (merge, removal, copy to the same weekday,
 * presets, validation). A window is the string "hh:mm-hh:mm"; `Windows` = date -> sorted list without overlaps.
 */
import type { Match, Period, TournamentConfig, Windows } from '../types';
import { addDays, formatWindow, fromMin, parseWindow, toMin, weekday } from './time';

/** Fixed presets (ASSUMPTION D1). `name` is UI copy. */
export const WINDOW_PRESETS: { name: string; from: string; to: string }[] = [
  { name: 'Pausa pranzo', from: '12:00', to: '15:00' },
  { name: 'Pomeriggio', from: '14:00', to: '18:30' },
  { name: 'Sera', from: '18:00', to: '23:00' },
  { name: 'Tutto il giorno', from: '08:00', to: '23:00' },
];

/** Bounds of the selectable day (ASSUMPTION D2). */
export const DAY_START = '08:00';
export const DAY_END = '24:00';

/** Step of the time selects: 15' only if the tournament allows off-grid with step 15, otherwise 30'. */
export function timeStep(config: Pick<TournamentConfig, 'allowOffGrid' | 'offGridStep'> | undefined): 15 | 30 {
  return config?.allowOffGrid && config.offGridStep === 15 ? 15 : 30;
}

/** Selectable times from 08:00 to 24:00 inclusive, at the given step. */
export function selectableTimes(step: number): string[] {
  const out: string[] = [];
  for (let m = toMin(DAY_START); m <= toMin(DAY_END); m += step) out.push(fromMin(m));
  return out;
}

/** Italian error message, or null if the window is valid. */
export function validateWindow(from: string, to: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) return 'Scegli l’orario di inizio e di fine.';
  if (toMin(to) <= toMin(from)) return 'L’orario di fine deve venire dopo quello di inizio.';
  if (toMin(from) < toMin(DAY_START) || toMin(to) > toMin(DAY_END)) return 'Scegli un orario tra le 08:00 e le 24:00.';
  return null;
}

function toIntervals(list: string[]): [number, number][] {
  return list.map(parseWindow).map(([x, y]) => [toMin(x), toMin(y)] as [number, number]);
}

function merge(intervals: [number, number][]): [number, number][] {
  const sorted = [...intervals].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const out: [number, number][] = [];
  for (const [x, y] of sorted) {
    const last = out[out.length - 1];
    // overlapping or adjacent windows (18:00-20:00 + 20:00-22:00) become a single one
    if (last && x <= last[1]) last[1] = Math.max(last[1], y);
    else out.push([x, y]);
  }
  return out;
}

/** Sorts and merges overlapping or adjacent windows. */
export function normalizeWindows(list: string[]): string[] {
  return merge(toIntervals(list)).map(([x, y]) => formatWindow(fromMin(x), fromMin(y)));
}

/** Adds a window, merging the overlapping or adjacent ones. */
export function addWindow(list: string[], from: string, to: string): string[] {
  return normalizeWindows([...list, formatWindow(from, to)]);
}

/**
 * Like `addWindow`, but also says whether the new window merged with others:
 * `mergedInto` is the resulting window that contains it ("18:00-23:00"), null if it stayed on its own.
 */
export function addWindowWithOutcome(list: string[], from: string, to: string): { list: string[]; mergedInto: string | null } {
  const next = addWindow(list, from, to);
  const container = next.find((w) => {
    const [x, y] = parseWindow(w);
    return toMin(x) <= toMin(from) && toMin(to) <= toMin(y);
  });
  const mergedInto = container && container !== formatWindow(from, to) ? container : null;
  return { list: next, mergedInto };
}

export function removeWindow(list: string[], window: string): string[] {
  return list.filter((w) => w !== window);
}

/** Immutable copy of `windows` with the day set (empty day = key removed). */
export function setDay(windows: Windows, date: string, list: string[]): Windows {
  const n = { ...windows };
  if (list.length) n[date] = [...list];
  else delete n[date];
  return n;
}

/**
 * Copies the windows of `date` onto every other day with the same weekday among `days`
 * (the visible days of the period), replacing the existing ones (ASSUMPTION D4).
 */
export function copyToSameWeekday(windows: Windows, date: string, days: string[]): { windows: Windows; days: string[] } {
  const list = windows[date] ?? [];
  const wd = weekday(date);
  const targets = days.filter((d) => d !== date && weekday(d) === wd);
  let out = windows;
  for (const d of targets) out = setDay(out, d, list);
  return { windows: out, days: targets };
}

/** Only dates from `today` on: past ones no longer matter for the cross-check. */
export function futureOnly(windows: Windows, today: string): Windows {
  return Object.fromEntries(Object.entries(windows).filter(([d, l]) => d >= today && l.length > 0));
}

/** Dates on which two window maps differ (empty days and missing keys are equivalent). */
export function changedDays(a: Windows, b: Windows): string[] {
  const dates = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...dates]
    .filter((d) => {
      const x = normalizeWindows(a[d] ?? []);
      const y = normalizeWindows(b[d] ?? []);
      return x.length !== y.length || x.some((w, i) => w !== y[i]);
    })
    .sort();
}

export function windowsEqual(a: Windows, b: Windows): boolean {
  return changedDays(a, b).length === 0;
}

/** "14:00-19:00" -> "14:00–19:00" (typographic dash for reading). */
export function windowLabel(w: string): string {
  const [x, y] = parseWindow(w);
  return `${x}–${y}`;
}

/** Periods still open (not ended before today), by start date. */
export function openPeriods(periods: Period[], today: string): Period[] {
  return periods.filter((p) => p.endsOn >= today).sort((p, q) => p.startsOn.localeCompare(q.startsOn));
}

/**
 * Default period: the first open one containing one of my matches to schedule, otherwise the first open one.
 */
export function defaultPeriod(open: Period[], matches: Match[], uid: string | undefined): Period | undefined {
  const mine = new Set(
    matches.filter((m) => uid && m.players.includes(uid) && m.status === 'unscheduled' && m.periodId).map((m) => m.periodId!),
  );
  return open.find((p) => mine.has(p.id)) ?? open[0];
}

/** Days of the period to show: from today (or from the start, if in the future) to the end. */
export function periodDays(period: Pick<Period, 'startsOn' | 'endsOn'>, today: string): string[] {
  const out: string[] = [];
  for (let d = period.startsOn > today ? period.startsOn : today; d <= period.endsOn; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Groups consecutive dates into Monday–Sunday weeks: each week has 7 slots (null outside the period). */
export function weeks(days: string[]): (string | null)[][] {
  if (!days.length) return [];
  const present = new Set(days);
  const first = days[0];
  const monday = addDays(first, -((weekday(first) + 6) % 7));
  const last = days[days.length - 1];
  const out: (string | null)[][] = [];
  for (let s = monday; s <= last; s = addDays(s, 7)) {
    out.push(Array.from({ length: 7 }, (_, i) => addDays(s, i)).map((d) => (present.has(d) ? d : null)));
  }
  return out;
}

/** Percentage position of a time on the 08–24 day (for the timeline). */
export function dayPercent(hhmm: string): number {
  const start = toMin(DAY_START);
  const end = toMin(DAY_END);
  const m = Math.min(Math.max(toMin(hhmm), start), end);
  return ((m - start) / (end - start)) * 100;
}

/**
 * Quick fill: adds (merging) the window to every day of `days` that falls on the chosen weekdays
 * (0 = Sunday … 6 = Saturday). Also returns the days touched.
 */
export function addToWeekdays(
  windows: Windows,
  days: string[],
  weekdays: number[],
  from: string,
  to: string,
): { windows: Windows; days: string[] } {
  const chosen = new Set(weekdays);
  const touched = days.filter((d) => chosen.has(weekday(d)));
  let out = windows;
  for (const d of touched) out = setDay(out, d, addWindow(out[d] ?? [], from, to));
  return { windows: out, days: touched };
}
