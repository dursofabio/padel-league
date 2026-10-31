/** Helpers for "hh:mm" times and "yyyy-mm-dd" dates (always in the club's local time). */

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMin(hhmm: string, delta: number): string {
  return fromMin(toMin(hhmm) + delta);
}

/** Half-open intervals [a0, a1) and [b0, b1): they touch without overlapping when a1 == b0. */
export function overlaps(a0: string, a1: string, b0: string, b1: string): boolean {
  return toMin(a0) < toMin(b1) && toMin(b0) < toMin(a1);
}

export function covers(outer0: string, outer1: string, in0: string, in1: string): boolean {
  return toMin(outer0) <= toMin(in0) && toMin(in1) <= toMin(outer1);
}

export function parseWindow(w: string): [string, string] {
  const [a, b] = w.split('-');
  return [a, b];
}

export function formatWindow(a: string, b: string): string {
  return `${a}-${b}`;
}

/** "2026-11-14" -> "20261114" */
export function dateKey(date: string): string {
  return date.replaceAll('-', '');
}

/** "18:00" -> "1800" */
export function timeKey(hhmm: string): string {
  return hhmm.replace(':', '');
}

export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today(): string {
  return formatDate(new Date());
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function weekday(date: string): number {
  return parseDate(date).getDay();
}

/** All dates from `from` to `to`, inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const SHORT_DAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
/** Italian weekday names (UI copy), indexed 0 = Sunday. */
export const WEEKDAY_NAMES = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

/** "2026-11-14" -> "sab 14/11" */
export function labelDate(date: string): string {
  const d = parseDate(date);
  return `${SHORT_DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Short Italian weekday name (UI copy), 0 = Sunday. */
export function shortWeekday(n: number): string {
  return SHORT_DAYS[n];
}
