/**
 * Pure helpers of the organizer area: capacity, group draw, calendar and finals payloads,
 * bracket sync, tie blocks, tournament phases. No React, no I/O: tested in __tests__/logic.test.ts.
 */
import type { CalendarMatchInput, FinalsMatchInput } from '../../data/mutations';
import { berger, matchdayToPeriod } from '../../lib/berger';
import { deriveBracket, generateBracket, nextPow2 } from '../../lib/bracket';
import { courtDayId } from '../../lib/slots';
import type { StandingsRow } from '../../lib/standings';
import { hasOfficialResult } from '../../lib/results';
import { addDays, dateRange, weekday } from '../../lib/time';
import type { Booking, Match, Period, Recurrence, SetFormat, Team, Tiebreaker, Tournament, TournamentStatus } from '../../types';

// ------------------------------------------------------------------ sections

/** Organizer sections; ids are the URL segments (/t/:tid/organizza/:section), so they stay Italian. */
export const SECTIONS = [
  { id: 'panoramica', label: 'Panoramica' },
  { id: 'configurazione', label: 'Configurazione' },
  { id: 'periodi', label: 'Periodi' },
  { id: 'squadre', label: 'Squadre' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'monitoraggio', label: 'Monitoraggio' },
  { id: 'finali', label: 'Fasi finali' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export function validSection(s: string | undefined): SectionId {
  return (SECTIONS.find((x) => x.id === s)?.id ?? 'panoramica') as SectionId;
}

// ------------------------------------------------------------------ labels

export const TIEBREAKER_LABEL: Record<Tiebreaker, string> = {
  points: 'Punti',
  headToHead: 'Scontro diretto',
  setDiff: 'Differenza set',
  gameDiff: 'Differenza game',
  setsWon: 'Set vinti',
  gamesWon: 'Game vinti',
  draw: 'Sorteggio',
};

export const ALL_TIEBREAKERS = Object.keys(TIEBREAKER_LABEL) as Tiebreaker[];

/** Italian label of a phase value: "Gironi" for the group phase, otherwise the capitalised name. */
export function phaseLabel(phase: string): string {
  if (phase === 'groups') return 'Gironi';
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

export function groupLetters(n: number): string[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => String.fromCharCode(65 + i));
}

/** "3ª" */
export function ordinal(n: number): string {
  return `${n}ª`;
}

// ------------------------------------------------------------------ tournament phases

export const TOURNAMENT_PHASES: { status: TournamentStatus; label: string }[] = [
  { status: 'registration', label: 'Iscrizioni' },
  { status: 'groups', label: 'Gironi' },
  { status: 'finals', label: 'Fasi finali' },
  { status: 'completed', label: 'Concluso' },
];

export type StepState = 'done' | 'current' | 'future';

export function phaseSteps(status: TournamentStatus): { status: TournamentStatus; label: string; step: StepState }[] {
  const idx = TOURNAMENT_PHASES.findIndex((f) => f.status === status);
  return TOURNAMENT_PHASES.map((f, i) => ({ ...f, step: i < idx ? 'done' : i === idx ? 'current' : 'future' }));
}

/** Status a completed tournament returns to with "Riapri" (same rule as set_tournament_state). */
export function previousStatus(tournament: Tournament, matches: Match[]): TournamentStatus {
  if ((tournament.generatedPhases ?? []).length) return 'finals';
  if (matches.some((m) => m.phase === 'groups')) return 'groups';
  return 'registration';
}

// ------------------------------------------------------------------ deterministic shuffle

/** Small seeded PRNG (mulberry32): the preview and the generated data come from the same draw. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ------------------------------------------------------------------ groups

/** Random draw of the approved teams into n groups (A, B, …), sizes differing by at most one. */
export function drawGroups(ids: string[], n: number, rand: () => number = Math.random): Record<string, string> {
  const letters = groupLetters(Math.max(1, n));
  const out: Record<string, string> = {};
  shuffle(ids, rand).forEach((id, i) => (out[id] = letters[i % letters.length]));
  return out;
}

/** Approved teams per group (only approved ones play). */
export function teamsByGroup(teams: Team[]): Map<string, Team[]> {
  const m = new Map<string, Team[]>();
  for (const t of teams)
    if (t.status === 'approved' && t.group) m.set(t.group, [...(m.get(t.group) ?? []), t]);
  return new Map([...m.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

// ------------------------------------------------------------------ calendar

/** Row of the generate_calendar payload. */
export type CalendarRow = CalendarMatchInput;

export interface GroupSummary {
  group: string;
  teams: number;
  matches: number;
  matchdays: number;
  /** Consecutive matchday blocks per period. */
  blocks: { periodId: string | null; label: string; from: number; to: number }[];
}

export function groupPeriods(periods: Period[]): Period[] {
  return periods.filter((p) => p.phase === 'groups').sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Group-phase calendar (Berger) for the approved teams with a group: payload of generate_calendar
 * (docs/api-contract.md) plus a summary for the preview. Codes are "gA-01-1" (group, matchday, match).
 * Matchdays go to the group periods in consecutive blocks.
 */
export function planCalendar(
  teams: Team[],
  periods: Period[],
  rand: () => number = Math.random,
): { matches: CalendarRow[]; groups: GroupSummary[] } {
  const per = groupPeriods(periods);
  const matches: CalendarRow[] = [];
  const summary: GroupSummary[] = [];
  for (const [group, list] of teamsByGroup(teams)) {
    // random order: the calendar does not depend on the registration order
    const cal = berger(shuffle(list.map((t) => t.id), rand));
    const matchdays = Math.max(0, ...cal.map((c) => c.matchday));
    const toPer = matchdayToPeriod(matchdays, per.length);
    const counter = new Map<number, number>();
    for (const c of cal) {
      const i = counter.get(c.matchday) ?? 0;
      counter.set(c.matchday, i + 1);
      matches.push({
        code: `g${group}-${pad2(c.matchday)}-${i + 1}`,
        group_name: group,
        round: c.matchday,
        position: i,
        team_a: c.home,
        team_b: c.away,
        period_id: per.length ? per[toPer(c.matchday)].id : null,
      });
    }
    const blocks: GroupSummary['blocks'] = [];
    for (let g = 1; g <= matchdays; g++) {
      const p = per.length ? per[toPer(g)] : null;
      const last = blocks[blocks.length - 1];
      if (last && last.periodId === (p?.id ?? null)) last.to = g;
      else blocks.push({ periodId: p?.id ?? null, label: p?.label ?? 'senza periodo', from: g, to: g });
    }
    summary.push({ group, teams: list.length, matches: cal.length, matchdays, blocks });
  }
  return { matches, groups: summary };
}

// ------------------------------------------------------------------ capacity

/** Recurring bookings as "virtual" bookings, to estimate capacity without materialising days. */
export function bookingsFromRecurrences(recurrences: Recurrence[], days: string[]): Record<string, Record<string, Booking>> {
  const out: Record<string, Record<string, Booking>> = {};
  for (const r of recurrences)
    for (const d of days)
      if (d >= r.validFrom && d <= r.validTo && weekday(d) === r.weekday)
        (out[courtDayId(r.courtId, d)] ??= {})[r.id] = { start: r.start, end: r.end, type: r.type };
  return out;
}

/**
 * Matches a period must hold: the assigned ones once the calendar exists, otherwise an estimate
 * (Berger distribution across the group periods; for a final phase, the bracket size per round).
 */
export function matchesInPeriod(period: Period, periods: Period[], matches: Match[], teams: Team[], finals: { name: string; spots: number }[]): number {
  const assigned = matches.filter((m) => m.periodId === period.id).length;
  if (assigned || matches.some((m) => m.phase === period.phase.toLowerCase())) return assigned;
  if (period.phase === 'groups') {
    const per = groupPeriods(periods);
    const idx = per.findIndex((p) => p.id === period.id);
    let n = 0;
    for (const list of teamsByGroup(teams).values()) {
      const cal = berger(list.map((t) => t.id));
      const matchdays = Math.max(0, ...cal.map((c) => c.matchday));
      const toPer = matchdayToPeriod(matchdays, per.length);
      n += cal.filter((c) => toPer(c.matchday) === idx).length;
    }
    return n;
  }
  const phase = finals.find((f) => f.name.toLowerCase() === period.phase.toLowerCase());
  if (!phase || phase.spots < 2) return 0;
  const size = nextPow2(phase.spots);
  if (period.round) return Math.max(0, size / 2 ** period.round - (period.round === 1 ? size - phase.spots : 0));
  return phase.spots - 1;
}

export type CapacityTone = 'ok' | 'warn' | 'danger';

export interface Capacity {
  days: number;
  slots: number;
  matches: number;
  /** Slots per match; null when there is nothing to play. */
  ratio: number | null;
  tone: CapacityTone | null;
  slotsPerWeek: number;
  neededPerWeek: number;
}

/** Thresholds (ASSUNZIONE O4): ≥ 3 slots per match good, 1.5–3 tight, < 1.5 insufficient. */
export function assessCapacity(slots: number, matches: number, days: number): Capacity {
  const weeks = Math.max(1, days / 7);
  const ratio = matches > 0 ? slots / matches : null;
  const tone: CapacityTone | null = ratio === null ? null : ratio >= 3 ? 'ok' : ratio >= 1.5 ? 'warn' : 'danger';
  return {
    days,
    slots,
    matches,
    ratio,
    tone,
    slotsPerWeek: Math.floor(slots / weeks),
    neededPerWeek: Math.ceil(matches / weeks),
  };
}

/** Every date of a period (empty when the range is inverted). */
export function periodDates(p: Pick<Period, 'startsOn' | 'endsOn'>): string[] {
  return p.endsOn >= p.startsOn ? dateRange(p.startsOn, p.endsOn) : [];
}

/** "2,1" */
export function formatRatio(r: number): string {
  return r.toFixed(1).replace('.', ',');
}

// ------------------------------------------------------------------ finals

/** Row of the generate_finals payload. */
export type FinalsRow = FinalsMatchInput;

/**
 * Payload of generate_finals for one phase: codes are the generateBracket ids ("gold-t1-p0"),
 * next match by code, and the period of the round (or the phase period without a round).
 */
export function planPhase(
  phase: string,
  seeds: string[],
  groupOf: (id: string) => string | undefined,
  periods: Period[],
): FinalsRow[] {
  const f = phase.toLowerCase();
  const phasePeriods = periods.filter((p) => p.phase.toLowerCase() === f);
  return generateBracket(f, seeds, groupOf).map((m) => ({
    code: m.id,
    round: m.round,
    position: m.position,
    next_code: m.nextCode,
    side: m.side,
    team_a: m.teamA,
    team_b: m.teamB,
    period_id: (phasePeriods.find((p) => p.round === m.round) ?? phasePeriods.find((p) => !p.round))?.id ?? null,
  }));
}

/** Preview rows of a bracket as matches, for the shared Bracket component. */
export function previewMatches(phase: string, rows: FinalsRow[]): Match[] {
  return rows.map((r) => ({
    id: r.code,
    code: r.code,
    phase,
    group: null,
    round: r.round,
    position: r.position,
    nextCode: r.next_code,
    side: r.side,
    teamA: r.team_a,
    teamB: r.team_b,
    playersA: [],
    playersB: [],
    players: [],
    periodId: r.period_id,
    status: 'unscheduled',
  }));
}

/**
 * sync_bracket updates: generated-phase matches still unscheduled whose pairs, derived from
 * the official results, differ from the stored ones.
 */
export function bracketUpdates(
  matches: Match[],
  format: SetFormat,
  generatedPhases: string[],
): { code: string; team_a: string | null; team_b: string | null }[] {
  const finals = matches.filter((m) => generatedPhases.includes(m.phase));
  const derived = deriveBracket(finals, format);
  const out: { code: string; team_a: string | null; team_b: string | null }[] = [];
  for (const m of finals) {
    const d = derived.get(m.id);
    if (!d || !m.code || m.status !== 'unscheduled') continue;
    if (d.teamA === m.teamA && d.teamB === m.teamB) continue;
    out.push({ code: m.code, team_a: d.teamA, team_b: d.teamB });
  }
  return out;
}

// ------------------------------------------------------------------ ties

/**
 * Blocks of teams tied after the whole tie-break chain (computed without any draw),
 * as lists of team ids in standing order. Adjacent tied rows with the same totals form one block.
 */
export function tiedBlocks(rows: StandingsRow[]): string[][] {
  const key = (r: StandingsRow) =>
    [r.points, r.setsWon - r.setsLost, r.gamesWon - r.gamesLost, r.setsWon, r.gamesWon, r.played].join('|');
  const out: string[][] = [];
  let current: StandingsRow[] = [];
  const close = () => {
    if (current.length > 1) out.push(current.map((r) => r.teamId));
    current = [];
  };
  for (const r of rows) {
    if (!r.tied) {
      close();
      continue;
    }
    if (current.length && key(current[0]) !== key(r)) close();
    current.push(r);
  }
  close();
  return out;
}

/** Moves one team within its tied block; returns the new block order. */
export function moveInBlock(block: string[], id: string, dir: -1 | 1): string[] {
  const i = block.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= block.length) return block;
  const out = [...block];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Writes a block order into the draw map (lower = better), keeping the other entries. */
export function drawWithBlock(draw: Record<string, number>, block: string[]): Record<string, number> {
  const out = { ...draw };
  block.forEach((id, i) => (out[id] = i + 1));
  return out;
}

export function sameDraw(a: Record<string, number> = {}, b: Record<string, number> = {}): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

// ------------------------------------------------------------------ monitoring

export interface Exceptions {
  disputed: Match[];
  late: Match[];
  toConfirm: Match[];
  endingSoon: Match[];
}

const closed = (m: Match) => m.status === 'played' || m.status === 'forfeit';

/**
 * Exceptions for the organizer: disputes; late matches (period ended, not played);
 * results entered and not confirmed; matches still to schedule whose period ends within `daysAhead` days.
 */
export function exceptions(matches: Match[], periods: Period[], today: string, daysAhead = 7): Exceptions {
  const per = new Map(periods.map((p) => [p.id, p]));
  const limit = addDays(today, daysAhead);
  const end = (m: Match) => (m.periodId ? per.get(m.periodId)?.endsOn : undefined);
  return {
    disputed: matches.filter((m) => m.status === 'disputed'),
    late: matches.filter((m) => {
      const e = end(m);
      return !closed(m) && m.status !== 'disputed' && !!e && e < today;
    }),
    toConfirm: matches.filter((m) => !!m.result && !hasOfficialResult(m) && m.status !== 'disputed'),
    endingSoon: matches.filter((m) => {
      const e = end(m);
      return m.status === 'unscheduled' && !!e && e >= today && e <= limit && !!m.teamA && !!m.teamB;
    }),
  };
}

export function countResults(matches: Match[]): number {
  return matches.filter((m) => !!m.result?.sets?.length).length;
}

/** ASSUNZIONE H6: an unconfirmed result needs the organizer after 48 hours. */
export const RESULT_REMINDER_HOURS = 48;

/** Whole hours elapsed since an ISO instant; null if unknown. */
export function hoursSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / 3_600_000));
}

/** Italian age text: "da meno di un'ora", "da 5 ore", "da 1 giorno", "da 3 giorni". */
export function ageText(hours: number): string {
  if (hours < 1) return 'da meno di un’ora';
  if (hours < 24) return `da ${hours} ${hours === 1 ? 'ora' : 'ore'}`;
  const d = Math.floor(hours / 24);
  return `da ${d} ${d === 1 ? 'giorno' : 'giorni'}`;
}
