import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../lib/config';
import type { StandingsRow } from '../../../lib/standings';
import type { Court, Match, Period, Recurrence, Team, Tournament } from '../../../types';
import { countSlots } from '../../../lib/slots';
import {
  ageText,
  assessCapacity,
  bookingsFromRecurrences,
  bracketUpdates,
  drawGroups,
  drawWithBlock,
  exceptions,
  hoursSince,
  matchesInPeriod,
  moveInBlock,
  phaseSteps,
  planCalendar,
  planPhase,
  previewMatches,
  previousStatus,
  prng,
  sameDraw,
  tiedBlocks,
  validSection,
} from '../logic';

const team = (id: string, group: string | null = 'A', status: Team['status'] = 'approved'): Team => ({
  id,
  name: id,
  players: [],
  group,
  status,
  createdBy: '',
});
const period = (id: string, phase: string, startsOn: string, endsOn: string, round: number | null = null): Period => ({
  id,
  phase,
  round,
  startsOn,
  endsOn,
  label: id,
});
const match = (m: Partial<Match> & { id: string }): Match => ({
  phase: 'groups',
  teamA: 'a',
  teamB: 'b',
  playersA: [],
  playersB: [],
  players: [],
  status: 'unscheduled',
  ...m,
});
const row = (teamId: string, points: number, tied: boolean, extra: Partial<StandingsRow> = {}): StandingsRow => ({
  teamId,
  group: 'A',
  played: 3,
  won: 0,
  lost: 0,
  points,
  setsWon: 0,
  setsLost: 0,
  gamesWon: 0,
  gamesLost: 0,
  position: 0,
  tied,
  ...extra,
});

describe('validSection', () => {
  it('falls back to panoramica', () => {
    expect(validSection(undefined)).toBe('panoramica');
    expect(validSection('finali')).toBe('finali');
    expect(validSection('boh')).toBe('panoramica');
  });
});

describe('phases', () => {
  it('marks done, current and future steps', () => {
    expect(phaseSteps('groups').map((p) => p.step)).toEqual(['done', 'current', 'future', 'future']);
  });
  it('computes the status to reopen to', () => {
    const t: Tournament = { id: 't', name: 'T', status: 'completed', config: DEFAULT_CONFIG };
    expect(previousStatus(t, [])).toBe('registration');
    expect(previousStatus(t, [match({ id: '1' })])).toBe('groups');
    expect(previousStatus({ ...t, generatedPhases: ['gold'] }, [])).toBe('finals');
  });
});

describe('drawGroups', () => {
  it('balances the groups and is deterministic with a seed', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `s${i}`);
    const a = drawGroups(ids, 2, prng(42));
    const b = drawGroups(ids, 2, prng(42));
    expect(a).toEqual(b);
    const count = Object.values(a).reduce<Record<string, number>>((m, g) => ({ ...m, [g]: (m[g] ?? 0) + 1 }), {});
    expect(count).toEqual({ A: 5, B: 4 });
  });
});

describe('planCalendar', () => {
  const teams = [...['a1', 'a2', 'a3', 'a4'].map((id) => team(id, 'A')), ...['b1', 'b2', 'b3'].map((id) => team(id, 'B')), team('x', null), team('y', 'A', 'pending_approval')];
  const periods = [period('p2', 'groups', '2026-12-01', '2026-12-31'), period('p1', 'groups', '2026-11-01', '2026-11-30'), period('g', 'gold', '2027-01-01', '2027-01-31')];

  it('builds the generate_calendar payload with stable codes and periods in blocks', () => {
    const { matches, groups } = planCalendar(teams, periods, prng(1));
    expect(matches).toHaveLength(6 + 3);
    expect(matches[0]).toMatchObject({ code: 'gA-01-1', group_name: 'A', round: 1, position: 0, period_id: 'p1' });
    expect(new Set(matches.map((m) => m.code)).size).toBe(matches.length);
    // only approved teams with a group
    expect(matches.some((m) => [m.team_a, m.team_b].includes('x') || [m.team_a, m.team_b].includes('y'))).toBe(false);
    // every pair of group A meets once
    const pairs = matches.filter((m) => m.group_name === 'A').map((m) => [m.team_a, m.team_b].sort().join('-'));
    expect(new Set(pairs).size).toBe(6);
    expect(groups[0]).toMatchObject({ group: 'A', teams: 4, matches: 6, matchdays: 3 });
    expect(groups[0].blocks.map((b) => [b.periodId, b.from, b.to])).toEqual([
      ['p1', 1, 2],
      ['p2', 3, 3],
    ]);
    expect(matches.filter((m) => m.round === 3 && m.group_name === 'A').every((m) => m.period_id === 'p2')).toBe(true);
  });

  it('is deterministic with the same seed and works without periods', () => {
    expect(planCalendar(teams, periods, prng(7)).matches).toEqual(planCalendar(teams, periods, prng(7)).matches);
    expect(planCalendar(teams, [], prng(7)).matches.every((m) => m.period_id === null)).toBe(true);
  });
});

describe('capacity', () => {
  const court: Court = { id: 'c1', name: 'Campo 1', firstSlot: '14:00', lastSlot: '20:00', slotMinutes: 90, activeDays: [0, 1, 2, 3, 4, 5, 6], closedDates: [] };
  it('subtracts recurrences from the grid slots', () => {
    const days = ['2026-11-02', '2026-11-03']; // Monday, Tuesday
    const rec: Recurrence = { id: 'r', courtId: 'c1', weekday: 1, start: '14:00', end: '17:00', type: 'lesson', note: '', validFrom: '2026-01-01', validTo: '2026-12-31' };
    expect(countSlots([court], days)).toBe(10);
    expect(countSlots([court], days, bookingsFromRecurrences([rec], days))).toBe(8);
  });
  it('applies the O4 thresholds', () => {
    expect(assessCapacity(90, 30, 14)).toMatchObject({ ratio: 3, tone: 'ok', slotsPerWeek: 45, neededPerWeek: 15 });
    expect(assessCapacity(60, 30, 14).tone).toBe('warn');
    expect(assessCapacity(40, 30, 14).tone).toBe('danger');
    expect(assessCapacity(40, 0, 14)).toMatchObject({ ratio: null, tone: null });
  });
  it('estimates matches per period before and after the calendar', () => {
    const teams = ['a', 'b', 'c', 'd'].map((id) => team(id));
    const p1 = period('p1', 'groups', '2026-11-01', '2026-11-30');
    const p2 = period('p2', 'groups', '2026-12-01', '2026-12-31');
    expect(matchesInPeriod(p1, [p1, p2], [], teams, []) + matchesInPeriod(p2, [p1, p2], [], teams, [])).toBe(6);
    expect(matchesInPeriod(p1, [p1], [match({ id: '1', periodId: 'p1' }), match({ id: '2', periodId: 'p2' })], teams, [])).toBe(1);
    const finals = [{ name: 'Gold', spots: 6 }];
    expect(matchesInPeriod(period('g', 'gold', '2027-01-01', '2027-01-31'), [], [], [], finals)).toBe(5);
    expect(matchesInPeriod(period('g1', 'gold', '2027-01-01', '2027-01-31', 1), [], [], [], finals)).toBe(2);
    expect(matchesInPeriod(period('g2', 'gold', '2027-01-01', '2027-01-31', 2), [], [], [], finals)).toBe(2);
  });
});

describe('finals', () => {
  const periods = [period('t1', 'gold', '2027-01-01', '2027-01-10', 1), period('gx', 'gold', '2027-01-11', '2027-01-31')];
  it('builds the generate_finals payload with codes, next codes and periods per round', () => {
    const rows = planPhase('Gold', ['a', 'b', 'c', 'd'], () => undefined, periods);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ code: 'gold-t1-p0', next_code: 'gold-t2-p0', side: 'A', period_id: 't1' });
    expect(rows[1]).toMatchObject({ code: 'gold-t1-p1', side: 'B' });
    expect(rows[2]).toMatchObject({ code: 'gold-t2-p0', next_code: null, side: null, team_a: null, period_id: 'gx' });
    expect(new Set(rows.flatMap((r) => [r.team_a, r.team_b]).filter(Boolean))).toEqual(new Set(['a', 'b', 'c', 'd']));
  });
  it('turns the payload into preview matches', () => {
    const p = previewMatches('gold', planPhase('gold', ['a', 'b', 'c'], () => undefined, []));
    // bye: the best seed goes straight to the final
    expect(p.map((x) => x.id)).toEqual(['gold-t1-p1', 'gold-t2-p0']);
    expect(p[1].teamA).toBe('a');
  });
  it('computes the sync updates only for unscheduled matches', () => {
    const won = { sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }], enteredBy: 'x', confirmedBy: 'y' };
    const matches = [
      match({ id: 'i1', code: 'gold-t1-p0', phase: 'gold', round: 1, teamA: 'a', teamB: 'd', nextCode: 'i3', side: 'A', status: 'played', result: won }),
      match({ id: 'i2', code: 'gold-t1-p1', phase: 'gold', round: 1, teamA: 'b', teamB: 'c', nextCode: 'i3', side: 'B', status: 'scheduled' }),
      match({ id: 'i3', code: 'gold-t2-p0', phase: 'gold', round: 2, teamA: null, teamB: null }),
    ];
    expect(bracketUpdates(matches, DEFAULT_CONFIG.setFormat, ['gold'])).toEqual([{ code: 'gold-t2-p0', team_a: 'a', team_b: null }]);
    expect(bracketUpdates(matches, DEFAULT_CONFIG.setFormat, [])).toEqual([]);
    const alreadyDone = matches.map((m) => (m.id === 'i3' ? { ...m, teamA: 'a' } : m));
    expect(bracketUpdates(alreadyDone, DEFAULT_CONFIG.setFormat, ['gold'])).toEqual([]);
  });
});

describe('ties', () => {
  it('groups adjacent tied rows with the same totals', () => {
    const rows = [row('a', 9, false), row('b', 6, true), row('c', 6, true), row('d', 3, true), row('e', 3, true), row('f', 0, false)];
    expect(tiedBlocks(rows)).toEqual([
      ['b', 'c'],
      ['d', 'e'],
    ]);
  });
  it('moves within a block and writes the draw', () => {
    expect(moveInBlock(['b', 'c', 'd'], 'c', -1)).toEqual(['c', 'b', 'd']);
    expect(moveInBlock(['b', 'c'], 'b', -1)).toEqual(['b', 'c']);
    expect(drawWithBlock({ z: 1 }, ['c', 'b'])).toEqual({ z: 1, c: 1, b: 2 });
    expect(sameDraw({ a: 1 }, { a: 1 })).toBe(true);
    expect(sameDraw({ a: 1 }, {})).toBe(false);
  });
});

describe('exceptions', () => {
  it('sorts matches into the monitoring lists', () => {
    const periods = [period('closed', 'groups', '2026-10-01', '2026-10-20'), period('open', 'groups', '2026-10-21', '2026-11-03')];
    const matches = [
      match({ id: 'c', status: 'disputed', periodId: 'closed' }),
      match({ id: 'r', status: 'scheduled', periodId: 'closed' }),
      match({ id: 'g', status: 'played', periodId: 'closed' }),
      match({ id: 'd', status: 'scheduled', periodId: 'open', result: { sets: [{ a: 6, b: 0 }], enteredBy: 'x' } }),
      match({ id: 's', status: 'unscheduled', periodId: 'open' }),
    ];
    const e = exceptions(matches, periods, '2026-10-30');
    expect(e.disputed.map((m) => m.id)).toEqual(['c']);
    expect(e.late.map((m) => m.id)).toEqual(['r']);
    expect(e.toConfirm.map((m) => m.id)).toEqual(['d']);
    expect(e.endingSoon.map((m) => m.id)).toEqual(['s']);
  });
});

describe('result age', () => {
  it('computes hours and Italian text', () => {
    const now = Date.parse('2026-10-30T12:00:00Z');
    expect(hoursSince('2026-10-28T11:00:00Z', now)).toBe(49);
    expect(hoursSince(undefined, now)).toBeNull();
    expect(hoursSince('boh', now)).toBeNull();
    expect(ageText(0)).toBe('da meno di un’ora');
    expect(ageText(1)).toBe('da 1 ora');
    expect(ageText(5)).toBe('da 5 ore');
    expect(ageText(30)).toBe('da 1 giorno');
    expect(ageText(49)).toBe('da 2 giorni');
  });
});
