/**
 * Pure logic of the match screens (lane B2): week window, effective state, slot labels,
 * keyboard navigation in the lanes, score-entry helpers. Tested in __tests__/logic.test.ts.
 */
import { isDecidingSet, validateResult } from '../../../lib/results';
import type { SlotState } from '../../../lib/slots';
import { addDays, dateRange, WEEKDAY_NAMES, labelDate, parseDate, toMin } from '../../../lib/time';
import { BOOKING_TYPE_LABEL } from '../../../lib/copy';
import type { Match, MatchRequest, Period, Schedule, SetFormat, SetScore } from '../../../types';

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "2026-11-14" → "Sabato 14 novembre" */
export function longDate(date: string): string {
  const d = parseDate(date);
  const w = WEEKDAY_NAMES[d.getDay()];
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** ["Luca"] → "Luca"; ["Luca", "Marta", "Ugo"] → "Luca, Marta e Ugo" */
export function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

// ------------------------------------------------------------------ week window (ASSUMPTION P1)

export interface WeekWindow {
  from: string;
  to: string;
  days: string[];
  /** Index actually shown (clamped). */
  week: number;
  hasPrevious: boolean;
  hasNext: boolean;
  /** The match period is over (late match): the window starts from today. */
  periodOver: boolean;
}

/** Weeks offered after the end of the period (late matches) or when the match has no period. */
export const WEEKS_WITHOUT_PERIOD = 4;

/**
 * One week at a time, clipped to the match period, starting at max(today, period start).
 * Late matches (period over) or matches without a period: 7 days from today, up to 4 weeks ahead.
 */
export function weekWindow(
  period: Pick<Period, 'startsOn' | 'endsOn'> | null | undefined,
  today: string,
  week: number,
): WeekWindow {
  const open = !!period && period.endsOn >= today;
  const start = open ? (period!.startsOn > today ? period!.startsOn : today) : today;
  const end = open ? period!.endsOn : addDays(today, WEEKS_WITHOUT_PERIOD * 7 - 1);
  const totalDays = dateRange(start, end).length;
  const n = Math.max(1, Math.ceil(totalDays / 7));
  const k = Math.min(Math.max(0, Math.floor(week)), n - 1);
  const from = addDays(start, k * 7);
  const end7 = addDays(from, 6);
  const to = end7 < end ? end7 : end;
  return {
    from,
    to,
    days: dateRange(from, to),
    week: k,
    hasPrevious: k > 0,
    hasNext: k < n - 1,
    periodOver: !!period && !open,
  };
}

// ------------------------------------------------------------------ time

/** Local instant (ms) of a day and a wall-clock time. */
export function localInstant(date: string, hhmm: string): number {
  return parseDate(date).getTime() + toMin(hhmm) * 60_000;
}

/** "dom 15/11 alle 10:00" */
export function formatWhen(ms: number): string {
  const d = new Date(ms);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${labelDate(date)} alle ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "tra 20 h", "tra 35 min", "tra 3 giorni"; null if already past. */
export function timeUntil(ms: number, now: number): string | null {
  const diff = ms - now;
  if (diff <= 0) return null;
  const min = Math.ceil(diff / 60_000);
  if (min < 60) return `tra ${min} min`;
  const hours = Math.round(diff / 3_600_000);
  if (hours < 48) return `tra ${hours} h`;
  return `tra ${Math.round(diff / 86_400_000)} giorni`;
}

/** Until when a player can cancel a confirmed match from the app (decision P4 changed). */
export function cancelDeadline(schedule: Pick<Schedule, 'date' | 'start'>, hours: number): number {
  return localInstant(schedule.date, schedule.start) - hours * 3_600_000;
}

// ------------------------------------------------------------------ state machine

export type MatchStage = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';

/** A request is useless once its slot has started: the effective expiry is the earlier of the two (critique M1). */
export function effectiveExpiry(r: Pick<MatchRequest, 'expiresAt'> & Partial<Pick<MatchRequest, 'date' | 'start'>>): number {
  const exp = r.expiresAt.toMillis();
  return r.date && r.start ? Math.min(exp, localInstant(r.date, r.start)) : exp;
}

export function isLiveRequest(
  r: (Pick<MatchRequest, 'status' | 'expiresAt'> & Partial<Pick<MatchRequest, 'date' | 'start'>>) | null | undefined,
  now: number,
): boolean {
  return !!r && r.status === 'pending' && effectiveExpiry(r) > now;
}

export function acceptedCount(r: Pick<MatchRequest, 'players' | 'acceptances'>): number {
  return r.players.filter((p) => !!r.acceptances[p]).length;
}

/**
 * Effective state (brief §5). S6 = result entered and not confirmed (the page splits opponent / inserter side).
 * A `requested` match whose request is not live behaves as `unscheduled`.
 */
export function matchStage(m: Match, request: MatchRequest | null | undefined, now: number): MatchStage {
  if (!m.teamA || !m.teamB) return 'S0';
  if (m.status === 'played' || m.status === 'forfeit') return 'S8';
  if (m.status === 'disputed') return 'S7';
  if (m.result && !m.result.confirmedBy) return 'S6';
  if (m.status === 'scheduled') {
    if (m.schedule && now < localInstant(m.schedule.date, m.schedule.start)) return 'S4';
    return 'S5';
  }
  if (request && request.matchId === m.id && isLiveRequest(request, now)) {
    return acceptedCount(request) >= request.players.length ? 'S3' : 'S2';
  }
  return 'S1';
}

export function sideOf(m: Pick<Match, 'playersA' | 'playersB'>, uid: string | null | undefined): 'A' | 'B' | null {
  if (!uid) return null;
  if (m.playersA.includes(uid)) return 'A';
  if (m.playersB.includes(uid)) return 'B';
  return null;
}

/** Period over and match still open: "In ritardo" (decision H3: still bookable). */
export function isLate(m: Match, period: Pick<Period, 'endsOn'> | null | undefined, today: string): boolean {
  if (!period || period.endsOn >= today) return false;
  return (m.status === 'unscheduled' || m.status === 'requested') && !m.result;
}

// ------------------------------------------------------------------ my matches grouping

export type MatchGroup = 'your-turn' | 'unscheduled' | 'in-progress' | 'scheduled' | 'awaiting-result' | 'awaiting-teams' | 'completed';

export const MATCH_GROUPS: { id: MatchGroup; title: string }[] = [
  { id: 'your-turn', title: 'Tocca a te' },
  { id: 'unscheduled', title: 'Da programmare' },
  { id: 'in-progress', title: 'Richieste in corso' },
  { id: 'scheduled', title: 'Programmate' },
  { id: 'awaiting-result', title: 'Risultato in sospeso' },
  { id: 'awaiting-teams', title: 'In attesa delle coppie' },
  { id: 'completed', title: 'Concluse' },
];

export type TurnReason = 'accept' | 'confirm-result' | 'enter-result';

export function matchGroup(
  m: Match,
  request: MatchRequest | null | undefined,
  uid: string,
  now: number,
): { group: MatchGroup; reason?: TurnReason } {
  const stage = matchStage(m, request, now);
  switch (stage) {
    case 'S0':
      return { group: 'awaiting-teams' };
    case 'S1':
      return { group: 'unscheduled' };
    case 'S2':
      if (request && request.players.includes(uid) && !request.acceptances[uid]) return { group: 'your-turn', reason: 'accept' };
      return { group: 'in-progress' };
    case 'S3':
      return { group: 'in-progress' };
    case 'S4':
      return { group: 'scheduled' };
    case 'S5':
      return { group: 'your-turn', reason: 'enter-result' };
    case 'S6': {
      const mine = sideOf(m, uid);
      const entered = sideOf(m, m.result?.enteredBy);
      if (mine && entered && mine !== entered) return { group: 'your-turn', reason: 'confirm-result' };
      return { group: 'awaiting-result' };
    }
    case 'S7':
      return { group: 'awaiting-result' };
    case 'S8':
      return { group: 'completed' };
  }
}

// ------------------------------------------------------------------ slot labels

export function slotLabel(s: Pick<SlotState, 'color' | 'free'>, total: number): string {
  if (s.color === 'red') return 'Occupato';
  if (s.color === 'blue') return 'Richiesto';
  return `${s.free.length}/${total}`;
}

/** "lezione 15:00–16:30" */
export function describeBooking(b: { type: keyof typeof BOOKING_TYPE_LABEL; start: string; end: string; note?: string | null }): string {
  return `${BOOKING_TYPE_LABEL[b.type].toLowerCase()} ${b.start}–${b.end}`;
}

/** Slot that can be requested from the grid (decision P2: 4/4 and 3/4). */
export function isSlotUsable(s: Pick<SlotState, 'color'>): boolean {
  return s.color === 'green' || s.color === 'yellow';
}

/**
 * Accessible name of a slot block. It STARTS with the visible text ("15:30 3/4") for voice control
 * (WCAG 2.5.3), then the details: "15:30 3/4, Campo 2, Sabato 14 novembre, fino alle 17:00, manca Luca".
 */
export function slotAriaLabel(s: SlotState, courtName: string, name: (uid: string) => string): string {
  const total = s.free.length + s.missing.length;
  const base = `${s.slot.start} ${slotLabel(s, total)}, ${courtName}, ${longDate(s.slot.date)}, fino alle ${s.slot.end}`;
  if (s.color === 'red') {
    const busy = s.bookings.map(describeBooking).join(', ');
    return busy ? `${base}, ${busy}` : base;
  }
  if (s.color === 'blue') return `${base}, già chiesto per un'altra partita`;
  if (!s.missing.length) return `${base}, tutti liberi`;
  const names = nameList(s.missing.map(name));
  return `${base}, ${s.missing.length === 1 ? 'manca' : 'mancano'} ${names}`;
}

/** Off-grid start times (ASSUMPTION P6): 08:00–22:30 in `step` steps, future only. */
export function startOptions(step: number, date: string, today: string, nowMin: number): string[] {
  const out: string[] = [];
  for (let m = 8 * 60; m <= 22 * 60 + 30; m += step) {
    if (date === today && m <= nowMin) continue;
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

// ------------------------------------------------------------------ keyboard navigation in the lanes

export interface NavCell {
  key: string;
  courtId: string;
  start: string;
}

export type NavKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'PageUp' | 'PageDown' | 'Home' | 'End';

function nearest(cells: NavCell[], start: string, filter?: (c: NavCell) => boolean): NavCell | undefined {
  const t = toMin(start);
  let best: NavCell | undefined;
  for (const c of cells) {
    if (filter && !filter(c)) continue;
    if (!best || Math.abs(toMin(c.start) - t) < Math.abs(toMin(best.start) - t)) best = c;
  }
  return best;
}

/**
 * Roving focus over the days (each a list of cells in time order):
 * ↑/↓ previous/next start in the day, ←/→ the other court at the nearest time,
 * PageUp/PageDown previous/next day, Home/End first/last of the day.
 */
export function moveFocus(days: NavCell[][], key: string, navKey: NavKey, courts: string[]): string | null {
  const di = days.findIndex((d) => d.some((c) => c.key === key));
  if (di < 0) return null;
  const day = days[di];
  const i = day.findIndex((c) => c.key === key);
  const cur = day[i];
  switch (navKey) {
    case 'ArrowUp':
      return day[i - 1]?.key ?? null;
    case 'ArrowDown':
      return day[i + 1]?.key ?? null;
    case 'Home':
      return day[0].key;
    case 'End':
      return day[day.length - 1].key;
    case 'ArrowLeft':
    case 'ArrowRight': {
      const ci = courts.indexOf(cur.courtId);
      const other = courts[ci + (navKey === 'ArrowRight' ? 1 : -1)];
      if (!other) return null;
      return nearest(day, cur.start, (c) => c.courtId === other)?.key ?? null;
    }
    case 'PageUp':
    case 'PageDown': {
      const step = navKey === 'PageDown' ? 1 : -1;
      for (let d = di + step; d >= 0 && d < days.length; d += step) {
        if (!days[d].length) continue;
        return (nearest(days[d], cur.start, (c) => c.courtId === cur.courtId) ?? nearest(days[d], cur.start))!.key;
      }
      return null;
    }
  }
}

// ------------------------------------------------------------------ score entry

export interface SetValue {
  a: number | null;
  b: number | null;
}

export function maxGame(i: number, format: SetFormat): number {
  return format.superTieBreak && isDecidingSet(i, format) ? 30 : 7;
}

export function setName(i: number, format: SetFormat): string {
  return format.superTieBreak && isDecidingSet(i, format) ? 'Super tie-break' : `Set ${i + 1}`;
}

/** Rows shown: the sets needed to win, plus one more while the match is still open after complete sets. */
export function visibleRows(values: SetValue[], format: SetFormat): number {
  const max = format.setsToWin * 2 - 1;
  let wa = 0;
  let wb = 0;
  let n = format.setsToWin;
  for (let i = 0; i < max; i++) {
    const v = values[i];
    if (!v || v.a === null || v.b === null || v.a === v.b) break;
    if (v.a > v.b) wa++;
    else wb++;
    if (wa === format.setsToWin || wb === format.setsToWin) break;
    if (i + 1 >= n) n = i + 2;
  }
  return Math.min(n, max);
}

export function valuesFrom(sets: SetScore[] | null | undefined, format: SetFormat): SetValue[] {
  const max = format.setsToWin * 2 - 1;
  return Array.from({ length: max }, (_, i) => (sets?.[i] ? { a: sets[i].a, b: sets[i].b } : { a: null, b: null }));
}

export interface ResultCheck {
  /** Per-row messages (row index → text). */
  byRow: Record<number, string>;
  /** Message about the whole match (not concluded, …). */
  global?: string;
  sets: SetScore[];
  winner?: 'A' | 'B';
  setsA: number;
  setsB: number;
}

/** Live validation with validateResult: messages attached to the row they concern. */
export function checkResult(values: SetValue[], format: SetFormat): ResultCheck {
  const n = visibleRows(values, format);
  const byRow: Record<number, string> = {};
  const sets: SetScore[] = [];
  for (let i = 0; i < n; i++) {
    const v = values[i] ?? { a: null, b: null };
    const max = maxGame(i, format);
    if ((v.a !== null && v.a > max) || (v.b !== null && v.b > max)) {
      byRow[i] = `${setName(i, format)}: al massimo ${max}`;
      break;
    }
    if (v.a === null && v.b === null) break;
    if (v.a === null || v.b === null) {
      byRow[i] = `${setName(i, format)}: scrivi i game di entrambe le coppie`;
      break;
    }
    sets.push({ a: v.a, b: v.b });
  }
  const setsA = sets.filter((s) => s.a > s.b).length;
  const setsB = sets.filter((s) => s.b > s.a).length;
  if (Object.keys(byRow).length || !sets.length) return { byRow, sets, setsA, setsB };
  const outcome = validateResult(sets, format);
  if (outcome.ok) return { byRow, sets, winner: outcome.winner, setsA, setsB };
  const m = outcome.error?.match(/^Set (\d+): (.*)$/);
  if (m) {
    const i = Number(m[1]) - 1;
    const text = format.superTieBreak && isDecidingSet(i, format) ? `Super tie-break: ${m[2].replace(/^super tie-break /, '')}` : outcome.error!;
    byRow[i] = text;
    return { byRow, sets, setsA, setsB };
  }
  const global = outcome.error === 'La partita non è conclusa' ? 'La partita non è ancora conclusa' : outcome.error;
  return { byRow, global, sets, setsA, setsB };
}

// ------------------------------------------------------------------ error copy (brief §11, result §7)

const MATCH_ERRORS: Record<string, string> = {
  SLOT_TAKEN: 'Qualcuno ha appena preso questo orario. Scegline un altro.',
  MATCH_HAS_REQUEST: 'C’è già una richiesta in corso per questa partita.',
  EXPIRED: 'La richiesta è scaduta nel frattempo.',
  OFF_GRID_DISABLED: 'Gli orari fuori griglia non sono attivi in questo torneo.',
  COURT_CLOSED: 'Il campo è chiuso quel giorno.',
  IN_PAST: 'Quell’orario è già passato.',
  NOT_AUTHORIZED: 'Solo i giocatori di questa partita possono farlo.',
  ALREADY_CONFIRMED: 'Il risultato è già stato confermato.',
  BAD_STATE: 'La partita è cambiata nel frattempo: ricarico.',
  TOO_LATE: 'Manca troppo poco all’inizio per annullarla dall’app: scrivi al gestore.',
};

/**
 * Hint → copy of the match brief; `null` = use the shared mapping (errorMessage).
 * BAD_STEP depends on the tournament step; OVERLAP / INVALID_SCORE keep the server's explanation.
 */
export function errorFromHint(e: unknown, step = 30): string | null {
  const err = (e ?? {}) as { hint?: string; code?: string; message?: string };
  if (err.hint === 'BAD_STEP') return `Scegli un orario ogni ${step} minuti.`;
  if (err.hint === 'OVERLAP' || err.code === '23P01') return err.message && err.hint === 'OVERLAP' ? err.message : 'Il campo è già occupato in quell’orario.';
  if (err.code === '23505') return MATCH_ERRORS.SLOT_TAKEN;
  if (err.hint && MATCH_ERRORS[err.hint]) return MATCH_ERRORS[err.hint];
  return null;
}

/** Lanes scale cropped to the visible slots of a day (whole hours), never wider than the base scale. */
export function croppedScale(
  slots: { start: string; end: string }[],
  base: { from: number; to: number; px: number },
): { from: number; to: number; px: number } {
  if (!slots.length) return base;
  const from = Math.min(...slots.map((s) => toMin(s.start)));
  const to = Math.max(...slots.map((s) => toMin(s.end)));
  return { from: Math.max(base.from, Math.floor(from / 60) * 60), to: Math.min(base.to, Math.ceil(to / 60) * 60), px: base.px };
}
