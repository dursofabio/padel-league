import type { Booking, Court, MatchRequest, Windows } from '../types';
import { addMin, covers, dateKey, overlaps, parseWindow, timeKey, toMin, weekday } from './time';

export interface Slot {
  courtId: string;
  date: string;
  start: string;
  end: string;
}

/** Deterministic request id: acts as a lock on the slot. */
export function requestId(courtId: string, date: string, start: string): string {
  return `${courtId}_${dateKey(date)}_${timeKey(start)}`;
}

/** Key of a court's bookings on a day (see `bookingsByCourtDay` in src/data/adapters). */
export function courtDayId(courtId: string, date: string): string {
  return `${courtId}_${dateKey(date)}`;
}

export function courtOpen(court: Court, date: string): boolean {
  return court.activeDays.includes(weekday(date)) && !(court.closedDates ?? []).includes(date);
}

/** Slots are not stored: they are generated from the court's rule. `lastSlot` is the last start time. */
export function gridSlots(court: Court, date: string): Slot[] {
  if (!courtOpen(court, date)) return [];
  const out: Slot[] = [];
  for (let t = toMin(court.firstSlot); t <= toMin(court.lastSlot); t += court.slotMinutes) {
    const start = addMin('00:00', t);
    out.push({ courtId: court.id, date, start, end: addMin(start, court.slotMinutes) });
  }
  return out;
}

export function isGridSlot(court: Court, date: string, start: string): boolean {
  return gridSlots(court, date).some((s) => s.start === start);
}

export function overlappingBookings(
  items: Record<string, Booking> | undefined,
  start: string,
  end: string,
): [string, Booking][] {
  return Object.entries(items ?? {}).filter(([, b]) => overlaps(b.start, b.end, start, end));
}

export function windowsCover(windows: Windows | undefined, date: string, start: string, end: string): boolean {
  return (windows?.[date] ?? []).some((w) => {
    const [a, b] = parseWindow(w);
    return covers(a, b, start, end);
  });
}

/** An "active" request holds the slot: pending and not expired, or confirmed. */
export function isRequestActive(r: Pick<MatchRequest, 'status' | 'expiresAt'>, now = Date.now()): boolean {
  if (r.status === 'confirmed') return true;
  if (r.status !== 'pending') return false;
  return !r.expiresAt || r.expiresAt.toMillis() > now;
}

export type SlotColor = 'green' | 'yellow' | 'grey' | 'red' | 'blue';

export interface SlotState {
  slot: Slot;
  color: SlotColor;
  /** Players whose windows cover the slot. */
  free: string[];
  /** Players whose windows don't cover the slot. */
  missing: string[];
  bookings: Booking[];
  request?: MatchRequest;
}

/**
 * Cross-check (§7.1): court free, no overlapping active request,
 * and every player with a window that covers the whole slot.
 */
export function classifySlot(
  slot: Slot,
  players: string[],
  availability: Record<string, Windows | undefined>,
  bookings: Record<string, Booking> | undefined,
  requests: MatchRequest[],
  now = Date.now(),
): SlotState {
  const busy = overlappingBookings(bookings, slot.start, slot.end).map(([, b]) => b);
  const free = players.filter((p) => windowsCover(availability[p], slot.date, slot.start, slot.end));
  const missing = players.filter((p) => !free.includes(p));
  const request = requests.find(
    (r) =>
      r.courtId === slot.courtId &&
      r.date === slot.date &&
      isRequestActive(r, now) &&
      overlaps(r.start, r.end, slot.start, slot.end),
  );
  let color: SlotColor;
  if (busy.length) color = 'red';
  else if (request) color = 'blue';
  else if (missing.length === 0) color = 'green';
  else if (missing.length === 1) color = 'yellow';
  else color = 'grey';
  return { slot, color, free, missing, bookings: busy, request };
}

/** Grid slots made unusable by an interval (impact of an off-grid request). */
export function impactedSlots(court: Court, date: string, start: string, end: string): Slot[] {
  return gridSlots(court, date).filter((s) => overlaps(s.start, s.end, start, end) && !(s.start === start && s.end === end));
}

export interface OffGridCheck {
  blocking: Booking[];
  overlappingRequests: MatchRequest[];
  outsideHours: boolean;
}

export function checkOffGrid(
  court: Court,
  date: string,
  start: string,
  bookings: Record<string, Booking> | undefined,
  requests: MatchRequest[],
  now = Date.now(),
): OffGridCheck {
  const end = addMin(start, court.slotMinutes);
  return {
    blocking: overlappingBookings(bookings, start, end).map(([, b]) => b),
    overlappingRequests: requests.filter(
      (r) =>
        r.courtId === court.id &&
        r.date === date &&
        r.status === 'pending' &&
        isRequestActive(r, now) &&
        overlaps(r.start, r.end, start, end),
    ),
    outsideHours: !courtOpen(court, date) || toMin(end) > 24 * 60,
  };
}

/**
 * Counter-proposal: the free grid slot closest to the requested one,
 * searching the candidate days (in order of proximity) on every court.
 */
export function nearestFreeSlot(
  origin: Slot,
  courts: Court[],
  days: string[],
  bookingsByCourtDay: Record<string, Record<string, Booking> | undefined>,
  requests: MatchRequest[],
  now = Date.now(),
): Slot | null {
  const distance = (s: Slot) => Math.abs(dayDiff(s.date, origin.date)) * 24 * 60 + Math.abs(toMin(s.start) - toMin(origin.start));
  const candidates: Slot[] = [];
  for (const date of days) {
    for (const court of courts) {
      for (const s of gridSlots(court, date)) {
        if (s.courtId === origin.courtId && s.date === origin.date && s.start === origin.start) continue;
        const bk = bookingsByCourtDay[courtDayId(court.id, date)];
        if (overlappingBookings(bk, s.start, s.end).length) continue;
        const busy = requests.some(
          (r) => r.courtId === s.courtId && r.date === s.date && isRequestActive(r, now) && overlaps(r.start, r.end, s.start, s.end),
        );
        if (busy) continue;
        candidates.push(s);
      }
    }
  }
  candidates.sort((a, b) => distance(a) - distance(b));
  return candidates[0] ?? null;
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}

/** Capacity (§5.3): grid slots available in the period, net of the known bookings. */
export function countSlots(
  courts: Court[],
  days: string[],
  bookingsByCourtDay: Record<string, Record<string, Booking> | undefined> = {},
): number {
  let n = 0;
  for (const date of days)
    for (const court of courts)
      for (const s of gridSlots(court, date))
        if (!overlappingBookings(bookingsByCourtDay[courtDayId(court.id, date)], s.start, s.end).length) n++;
  return n;
}
