/**
 * Pure helpers for the court manager screens (inbox, day timeline, recurrences, court settings).
 * No React, no data access: tested in logic.test.ts.
 */
import { BOOKING_TYPE_LABEL } from '../../lib/copy';
import { gridSlots, isRequestActive, type Slot } from '../../lib/slots';
import { addDays, fromMin, labelDate, overlaps, parseDate, toMin, WEEKDAY_NAMES } from '../../lib/time';
import type { Booking, BookingRow, Court, MatchRequest, Recurrence } from '../../types';

// ------------------------------------------------------------------ requests

export interface AcceptanceState {
  given: number;
  total: number;
  missing: string[];
}

/** Acceptances of a request: how many out of how many, and who is still missing. */
export function acceptanceState(r: Pick<MatchRequest, 'players' | 'acceptances'>): AcceptanceState {
  const missing = r.players.filter((g) => !r.acceptances[g]);
  return { given: r.players.length - missing.length, total: Math.max(4, r.players.length), missing };
}

export function isComplete(r: Pick<MatchRequest, 'players' | 'acceptances'>): boolean {
  const a = acceptanceState(r);
  return a.missing.length === 0 && a.given >= 4;
}

export interface Deadline {
  text: string;
  /** Less than 2 hours left. */
  urgent: boolean;
  expired: boolean;
}

/** "scade tra 5 h", "scade tra 40 min", "scade tra 2 g"; urgent under 2 hours. */
export function deadlineText(deadlineMs: number, now: number): Deadline {
  const diff = deadlineMs - now;
  if (diff <= 0) return { text: 'Scaduta', urgent: true, expired: true };
  const min = Math.ceil(diff / 60_000);
  const urgent = min < 120;
  if (min < 60) return { text: `scade tra ${min} min`, urgent, expired: false };
  const hours = Math.floor(min / 60);
  if (hours < 48) return { text: `scade tra ${hours} h`, urgent, expired: false };
  return { text: `scade tra ${Math.floor(hours / 24)} g`, urgent, expired: false };
}

/** Start of the requested slot (local club time) in ms. */
export function startMs(r: Pick<MatchRequest, 'date' | 'start'>): number {
  return parseDate(r.date).getTime() + toMin(r.start) * 60_000;
}

/** A request can never be useful after its own start: the effective deadline is the earlier of the two. */
export function effectiveDeadline(r: Pick<MatchRequest, 'expiresAt' | 'date' | 'start'>): number {
  return Math.min(r.expiresAt.toMillis(), startMs(r));
}

/** Inbox order (G1): soonest (effective) expiry first, then date and time. */
export function sortByDeadline<T extends Pick<MatchRequest, 'expiresAt' | 'date' | 'start'>>(rs: T[]): T[] {
  return [...rs].sort(
    (a, b) => effectiveDeadline(a) - effectiveDeadline(b) || a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  );
}

/** Other live pending requests on the same court, day and overlapping time ("Sovrapposta"). */
export function overlappingRequests(r: MatchRequest, all: MatchRequest[], now = Date.now()): MatchRequest[] {
  return all.filter(
    (x) =>
      x.id !== r.id &&
      x.status === 'pending' &&
      isRequestActive(x, now) &&
      x.courtId === r.courtId &&
      x.date === r.date &&
      overlaps(x.start, x.end, r.start, r.end),
  );
}

/** Bookings that would make the confirmation fail (client-side preview; the server decides). */
export function conflictingBookings<T extends Pick<BookingRow, 'courtId' | 'date' | 'start' | 'end' | 'requestId'>>(
  r: Pick<MatchRequest, 'id' | 'courtId' | 'date' | 'start' | 'end'>,
  rows: T[],
): T[] {
  return rows.filter(
    (o) => o.courtId === r.courtId && o.date === r.date && o.requestId !== r.id && overlaps(o.start, o.end, r.start, r.end),
  );
}

export function describeBooking(o: Pick<Booking, 'type' | 'start' | 'end'>): string {
  return `${BOOKING_TYPE_LABEL[o.type]} ${o.start}–${readableEnd(o.end)}`;
}

/** "24:00" stays readable; "00:00" as an end means midnight. */
export function readableEnd(end: string): string {
  return end === '00:00' ? '24:00' : end;
}

/** Why "Conferma" is disabled, or null when it can be tapped. */
export function confirmBlockReason(
  r: MatchRequest,
  conflicts: Pick<Booking, 'type' | 'start' | 'end'>[],
  name: (uid: string) => string,
  now = Date.now(),
): string | null {
  if (startMs(r) <= now) return 'L’orario richiesto è già passato: rifiutala o proponi un altro orario.';
  if (r.expiresAt.toMillis() <= now) return 'La richiesta è scaduta: non si può più confermare.';
  const a = acceptanceState(r);
  if (a.missing.length || a.given < 4) {
    const who = a.missing.map(name);
    return `Mancano accettazioni (${a.given}/4): ${who.length ? `deve accettare ${joinList(who)}` : 'mancano giocatori'}.`;
  }
  if (conflicts.length) return `Il campo è occupato: ${conflicts.map(describeBooking).join(', ')}.`;
  return null;
}

/** "A", "A e B", "A, B e C". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export interface OutcomeMessage {
  tone: 'ok' | 'warn' | 'danger';
  text: string;
}

/** Outcome of confirm_request in plain Italian. */
export function confirmMessage(
  res: { outcome: 'ok' | 'taken' | 'expired'; conflicts: number },
  r: Pick<MatchRequest, 'date' | 'start'>,
  courtName: string,
): OutcomeMessage {
  const when = `${labelDate(r.date)} ${r.start} · ${courtName}`;
  if (res.outcome === 'taken')
    return {
      tone: 'danger',
      text: `Conflitto: il campo risulta occupato (${when}). La richiesta è passata in conflitto: i giocatori devono sceglierne un altro orario.`,
    };
  if (res.outcome === 'expired') return { tone: 'warn', text: `La richiesta di ${when} è scaduta nel frattempo.` };
  const extra =
    res.conflicts > 0
      ? `; ${res.conflicts === 1 ? '1 richiesta sovrapposta è passata' : `${res.conflicts} richieste sovrapposte sono passate`} in conflitto`
      : '';
  return { tone: 'ok', text: `Confermata ${when}${extra}.` };
}

/** "Segnato." plus how many pending requests moved to conflict. */
export function conflictsMessage(prefix: string, conflicts: number): string {
  if (!conflicts) return prefix;
  return `${prefix} ${conflicts === 1 ? '1 richiesta in attesa è passata' : `${conflicts} richieste in attesa sono passate`} in conflitto.`;
}

// ------------------------------------------------------------------ counter-proposal

/**
 * Candidate days for a counter-proposal (G3): ±radius days around the requested date,
 * clipped to the match period and to today, ordered by distance (same day first).
 */
export function counterProposalDays(
  date: string,
  today: string,
  period?: { startsOn: string; endsOn: string } | null,
  radius = 3,
): string[] {
  const out: string[] = [];
  for (let d = 0; d <= radius; d++) {
    for (const g of d === 0 ? [date] : [addDays(date, -d), addDays(date, d)]) {
      if (g < today) continue;
      if (period && (g < period.startsOn || g > period.endsOn)) continue;
      out.push(g);
    }
  }
  return out;
}

export type ManagerSlotState = 'free' | 'booked' | 'requested';

/** Court-side state of a grid slot (no player availability): booked, requested by a live request, or free. */
export function managerSlotState(
  slot: Slot,
  bookings: Record<string, Booking> | undefined,
  requests: MatchRequest[],
  now = Date.now(),
): ManagerSlotState {
  if (Object.values(bookings ?? {}).some((o) => overlaps(o.start, o.end, slot.start, slot.end))) return 'booked';
  const busy = requests.some(
    (r) =>
      r.courtId === slot.courtId && r.date === slot.date && isRequestActive(r, now) && overlaps(r.start, r.end, slot.start, slot.end),
  );
  return busy ? 'requested' : 'free';
}

// ------------------------------------------------------------------ times and forms

/** Times from `from` to `to` included, every `step` minutes ("24:00" allowed as the last end). */
export function times(from: string, to: string, step = 15): string[] {
  const out: string[] = [];
  for (let m = toMin(from); m <= toMin(to); m += step) out.push(fromMin(m));
  return out;
}

export function rangeError(start: string, end: string): string | null {
  if (!start || !end) return 'Indica l’orario di inizio e di fine.';
  if (toMin(end) <= toMin(start)) return 'L’orario di fine deve venire dopo quello di inizio.';
  return null;
}

/** Start minute the day timeline opens at (G4): 13:00, or now (rounded down to the half hour) if later and today. */
export function initialMinute(isToday: boolean, nowMin: number): number {
  const base = 13 * 60;
  if (!isToday) return base;
  return Math.max(base, Math.floor(nowMin / 30) * 30 - 30);
}

// ------------------------------------------------------------------ courts

/** Starts generated by a court rule (preview while editing): "13:30 · 15:00 · …". */
export function gridStarts(first: string, last: string, slotMinutes: number): string[] {
  if (!first || !last || !(slotMinutes > 0) || toMin(last) < toMin(first)) return [];
  const out: string[] = [];
  for (let t = toMin(first); t <= toMin(last); t += slotMinutes) out.push(fromMin(t));
  return out;
}

export interface CourtErrors {
  name?: string;
  lastSlot?: string;
  slotMinutes?: string;
  activeDays?: string;
}

export function validateCourt(c: Pick<Court, 'name' | 'firstSlot' | 'lastSlot' | 'slotMinutes' | 'activeDays'>): CourtErrors {
  const e: CourtErrors = {};
  if (!c.name.trim()) e.name = 'Dai un nome al campo.';
  if (toMin(c.lastSlot) < toMin(c.firstSlot)) e.lastSlot = 'L’ultimo inizio deve venire dopo il primo.';
  else if (toMin(c.lastSlot) + c.slotMinutes > 24 * 60) e.lastSlot = 'L’ultima partita finirebbe dopo mezzanotte.';
  if (!Number.isInteger(c.slotMinutes) || c.slotMinutes < 15 || c.slotMinutes > 600) e.slotMinutes = 'La durata va da 15 a 600 minuti.';
  if (!c.activeDays.length) e.activeDays = 'Scegli almeno un giorno in cui il campo è aperto.';
  return e;
}

/**
 * Stable id for a new court from its name (`[A-Za-z0-9_-]`, unique among the existing ones).
 * The fallback 'campo' is a stored id value (unchanged to keep generated ids identical).
 */
export function newCourtId(name: string, existing: string[]): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'campo';
  let id = base;
  for (let i = 2; existing.includes(id); i++) id = `${base}-${i}`;
  return id;
}

/** Confirmed requests on a court that would no longer sit on a grid slot with the new rule (informational). */
export function confirmedOffGrid(court: Court, confirmed: MatchRequest[]): MatchRequest[] {
  return confirmed.filter(
    (r) => r.courtId === court.id && !gridSlots(court, r.date).some((s) => s.start === r.start && s.end === r.end),
  );
}

/** Sorted, unique closure dates. */
export function addDate(dates: string[], d: string): string[] {
  return [...new Set([...dates, d])].sort();
}

// ------------------------------------------------------------------ recurrences

/** "01/10" */
export function shortDate(d: string): string {
  const x = parseDate(d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`;
}

/** "ogni martedì 18:00–19:30" */
export function recurrenceWhen(r: Pick<Recurrence, 'weekday' | 'start' | 'end'>): string {
  return `ogni ${WEEKDAY_NAMES[r.weekday]} ${r.start}–${readableEnd(r.end)}`;
}

/** "Saltati: mer 18/11 (Il campo è occupato…)" — server entries are "yyyy-mm-dd: message". */
export function skippedLabel(s: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}):\s*(.*)$/.exec(s);
  if (!m) return s;
  return m[2] ? `${labelDate(m[1])} (${m[2]})` : labelDate(m[1]);
}

export function materializeMessage(res: { created: number; skipped: string[] }): OutcomeMessage {
  const created =
    res.created === 0 ? 'Nessun giorno nuovo da segnare.' : res.created === 1 ? 'Segnato 1 giorno.' : `Segnati ${res.created} giorni.`;
  if (!res.skipped.length) return { tone: 'ok', text: created };
  return { tone: 'warn', text: `${created} Saltati: ${res.skipped.map(skippedLabel).join('; ')}.` };
}

export function closeDayMessage(res: { errors: string[]; conflicts: number }, date: string): OutcomeMessage {
  const base = conflictsMessage(`Giornata di ${labelDate(date)} chiusa.`, res.conflicts);
  if (!res.errors.length) return { tone: 'ok', text: base };
  return {
    tone: 'warn',
    text: `Chiusura parziale di ${labelDate(date)}. Non chiusi: ${res.errors.join('; ')}.${res.conflicts ? ` ${conflictsMessage('', res.conflicts).trim()}` : ''}`,
  };
}
