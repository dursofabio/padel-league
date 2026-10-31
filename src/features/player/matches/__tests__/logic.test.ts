import { describe, expect, it } from 'vitest';
import { instant } from '../../../../data/adapters';
import type { SlotState } from '../../../../lib/slots';
import type { Match, MatchRequest } from '../../../../types';
import {
  slotAriaLabel,
  checkResult,
  longDate,
  nameList,
  slotLabel,
  matchStage,
  weekWindow,
  matchGroup,
  isLate,
  localInstant,
  cancelDeadline,
  moveFocus,
  startOptions,
  visibleRows,
  timeUntil,
  valuesFrom,
  type NavCell,
} from '../logic';

const F = { setsToWin: 2, superTieBreak: true };

describe('weekWindow', () => {
  const period = { startsOn: '2026-11-02', endsOn: '2026-11-22' };

  it('starts at the period start when it is in the future', () => {
    const f = weekWindow(period, '2026-10-30', 0);
    expect([f.from, f.to]).toEqual(['2026-11-02', '2026-11-08']);
    expect(f.hasPrevious).toBe(false);
    expect(f.hasNext).toBe(true);
    expect(f.periodOver).toBe(false);
  });

  it('starts today inside the period and clips the last week to the period end', () => {
    const f0 = weekWindow(period, '2026-11-10', 0);
    expect(f0.from).toBe('2026-11-10');
    const f1 = weekWindow(period, '2026-11-10', 1);
    expect([f1.from, f1.to]).toEqual(['2026-11-17', '2026-11-22']);
    expect(f1.days).toHaveLength(6);
    expect(f1.hasNext).toBe(false);
    expect(f1.hasPrevious).toBe(true);
  });

  it('clamps an out-of-range week index', () => {
    expect(weekWindow(period, '2026-11-10', 9).week).toBe(1);
    expect(weekWindow(period, '2026-11-10', -3).week).toBe(0);
  });

  it('late match: next 7 days from today, flagged', () => {
    const f = weekWindow(period, '2026-11-25', 0);
    expect([f.from, f.to]).toEqual(['2026-11-25', '2026-12-01']);
    expect(f.periodOver).toBe(true);
    expect(f.hasNext).toBe(true);
    expect(weekWindow(period, '2026-11-25', 3).hasNext).toBe(false);
  });

  it('no period: from today, not flagged as late', () => {
    const f = weekWindow(null, '2026-11-25', 0);
    expect(f.from).toBe('2026-11-25');
    expect(f.periodOver).toBe(false);
  });
});

describe('labels', () => {
  it('formats long dates and name lists', () => {
    expect(longDate('2026-11-14')).toBe('Sabato 14 novembre');
    expect(nameList(['Luca'])).toBe('Luca');
    expect(nameList(['Luca', 'Marta', 'Ugo'])).toBe('Luca, Marta e Ugo');
  });

  const slot = { courtId: 'c2', date: '2026-11-14', start: '15:30', end: '17:00' };
  const name = (u: string) => ({ u1: 'Marco', u2: 'Luca', u3: 'Marta', u4: 'Ugo' })[u] ?? u;

  it('builds the full aria-label of a slot', () => {
    const s: SlotState = { slot, color: 'yellow', free: ['u1', 'u3', 'u4'], missing: ['u2'], bookings: [] };
    expect(slotAriaLabel(s, 'Campo 2', name)).toBe('15:30 3/4, Campo 2, Sabato 14 novembre, fino alle 17:00, manca Luca');
    expect(slotLabel(s, 4)).toBe('3/4');
    const g: SlotState = { ...s, color: 'grey', free: ['u1', 'u4'], missing: ['u2', 'u3'] };
    expect(slotAriaLabel(g, 'Campo 2', name)).toBe('15:30 2/4, Campo 2, Sabato 14 novembre, fino alle 17:00, mancano Luca e Marta');
    const v: SlotState = { ...s, color: 'green', free: ['u1', 'u2', 'u3', 'u4'], missing: [] };
    expect(slotAriaLabel(v, 'Campo 2', name)).toMatch(/^15:30 4\/4, .*tutti liberi$/);
  });

  it('describes occupied and requested slots', () => {
    const r: SlotState = {
      slot,
      color: 'red',
      free: [],
      missing: [],
      bookings: [{ type: 'lesson', start: '15:00', end: '16:30' }],
    };
    expect(slotAriaLabel(r, 'Campo 2', name)).toMatch(/^15:30 Occupato, Campo 2, .*, lezione 15:00–16:30$/);
    expect(slotLabel(r, 4)).toBe('Occupato');
    expect(slotAriaLabel({ ...r, color: 'blue', bookings: [] }, 'Campo 2', name)).toMatch(/^15:30 Richiesto, .*già chiesto/);
  });
});

describe('time helpers', () => {
  it('relative time', () => {
    const now = 0;
    expect(timeUntil(20 * 3_600_000, now)).toBe('tra 20 h');
    expect(timeUntil(35 * 60_000, now)).toBe('tra 35 min');
    expect(timeUntil(72 * 3_600_000, now)).toBe('tra 3 giorni');
    expect(timeUntil(-1, now)).toBeNull();
  });

  it('player cancel deadline', () => {
    expect(localInstant('2026-11-14', '15:30') - cancelDeadline({ date: '2026-11-14', start: '15:30' }, 24)).toBe(24 * 3_600_000);
  });

  it('off-grid starts', () => {
    const all = startOptions(30, '2026-11-14', '2026-11-13', 0);
    expect(all[0]).toBe('08:00');
    expect(all[all.length - 1]).toBe('22:30');
    expect(all).toHaveLength(30);
    expect(startOptions(15, '2026-11-14', '2026-11-14', 20 * 60)[0]).toBe('20:15');
  });
});

const base: Match = {
  id: 'p1',
  phase: 'groups',
  teamA: 'sa',
  teamB: 'sb',
  playersA: ['u1', 'u2'],
  playersB: ['u3', 'u4'],
  players: ['u1', 'u2', 'u3', 'u4'],
  status: 'unscheduled',
};
const NOW = Date.parse('2026-11-10T12:00:00');
function request(acc: string[], expiresAt = NOW + 3_600_000, status: MatchRequest['status'] = 'pending'): MatchRequest {
  return {
    id: 'r1',
    tournamentId: 't',
    matchId: 'p1',
    courtId: 'c1',
    date: '2026-11-14',
    start: '15:00',
    end: '16:30',
    offGrid: false,
    players: base.players,
    acceptances: Object.fromEntries(base.players.map((p) => [p, acc.includes(p) ? instant('2026-11-10T10:00:00Z') : null])),
    status,
    expiresAt: { toMillis: () => expiresAt },
    createdBy: 'u1',
  };
}

describe('matchStage and matchGroup', () => {
  it('derives every state', () => {
    expect(matchStage({ ...base, teamB: null }, null, NOW)).toBe('S0');
    expect(matchStage(base, null, NOW)).toBe('S1');
    expect(matchStage({ ...base, status: 'requested' }, request(['u1']), NOW)).toBe('S2');
    expect(matchStage({ ...base, status: 'requested' }, request(base.players), NOW)).toBe('S3');
    // expired request behaves as "unscheduled"
    expect(matchStage({ ...base, status: 'requested' }, request(['u1'], NOW - 1), NOW)).toBe('S1');
    const schedule = { courtId: 'c1', date: '2026-11-14', start: '15:00', end: '16:30' };
    expect(matchStage({ ...base, status: 'scheduled', schedule }, null, NOW)).toBe('S4');
    expect(matchStage({ ...base, status: 'scheduled', schedule }, null, Date.parse('2026-11-14T16:00:00'))).toBe('S5');
    const result = { sets: [{ a: 6, b: 4 }, { a: 6, b: 3 }], enteredBy: 'u1' };
    expect(matchStage({ ...base, result }, null, NOW)).toBe('S6');
    expect(matchStage({ ...base, status: 'disputed', result }, null, NOW)).toBe('S7');
    expect(matchStage({ ...base, status: 'played', result: { ...result, confirmedBy: 'u3' } }, null, NOW)).toBe('S8');
  });

  it('groups my matches, pending acceptances on top', () => {
    const p = { ...base, status: 'requested' as const };
    expect(matchGroup(p, request(['u1']), 'u2', NOW)).toEqual({ group: 'your-turn', reason: 'accept' });
    expect(matchGroup(p, request(['u1']), 'u1', NOW).group).toBe('in-progress');
    const result = { sets: [{ a: 6, b: 4 }, { a: 6, b: 3 }], enteredBy: 'u1' };
    expect(matchGroup({ ...base, result }, null, 'u3', NOW)).toEqual({ group: 'your-turn', reason: 'confirm-result' });
    expect(matchGroup({ ...base, result }, null, 'u2', NOW).group).toBe('awaiting-result');
  });

  it('late only for open matches after the period', () => {
    expect(isLate(base, { endsOn: '2026-11-09' }, '2026-11-10')).toBe(true);
    expect(isLate(base, { endsOn: '2026-11-10' }, '2026-11-10')).toBe(false);
    expect(isLate({ ...base, status: 'scheduled' }, { endsOn: '2026-11-09' }, '2026-11-10')).toBe(false);
  });
});

describe('moveFocus', () => {
  const g = (d: string, ...xs: [string, string][]): NavCell[] => xs.map(([c, t]) => ({ key: `${d}|${c}|${t}`, courtId: c, start: t }));
  const days = [
    g('1', ['c1', '13:30'], ['c2', '14:00'], ['c1', '15:00'], ['c2', '15:30']),
    [],
    g('3', ['c2', '14:00'], ['c2', '15:30']),
  ];
  const courts = ['c1', 'c2'];
  it('moves in time, across courts and days', () => {
    expect(moveFocus(days, '1|c1|13:30', 'ArrowDown', courts)).toBe('1|c2|14:00');
    expect(moveFocus(days, '1|c1|13:30', 'ArrowUp', courts)).toBeNull();
    expect(moveFocus(days, '1|c1|15:00', 'ArrowRight', courts)).toBe('1|c2|15:30');
    expect(moveFocus(days, '1|c1|13:30', 'ArrowRight', courts)).toBe('1|c2|14:00');
    expect(moveFocus(days, '1|c2|15:30', 'ArrowLeft', courts)).toBe('1|c1|15:00');
    expect(moveFocus(days, '1|c2|15:30', 'ArrowRight', courts)).toBeNull();
    expect(moveFocus(days, '1|c2|15:30', 'PageDown', courts)).toBe('3|c2|15:30');
    expect(moveFocus(days, '3|c2|14:00', 'PageUp', courts)).toBe('1|c2|14:00');
    expect(moveFocus(days, '1|c2|14:00', 'End', courts)).toBe('1|c2|15:30');
    expect(moveFocus(days, '1|c2|14:00', 'Home', courts)).toBe('1|c1|13:30');
  });
});

describe('score entry', () => {
  const v = (...s: [number | null, number | null][]) => s.map(([a, b]) => ({ a, b }));

  it('shows the decisive row only when the sets are split', () => {
    expect(visibleRows(v(), F)).toBe(2);
    expect(visibleRows(v([6, 4], [6, 3]), F)).toBe(2);
    expect(visibleRows(v([6, 4], [3, 6]), F)).toBe(3);
    expect(visibleRows(v(), { setsToWin: 1, superTieBreak: false })).toBe(1);
    expect(valuesFrom([{ a: 6, b: 4 }], F)).toHaveLength(3);
  });

  it('validates live and attaches messages to rows', () => {
    expect(checkResult(v([6, 4], [3, 6], [10, 7]), F)).toMatchObject({ winner: 'A', setsA: 2, setsB: 1, byRow: {} });
    expect(checkResult(v([6, 5]), F).byRow[0]).toMatch(/^Set 1: punteggio non valido/);
    expect(checkResult(v([6, 4], [3, 6], [10, 9]), F).byRow[2]).toMatch(/^Super tie-break:/);
    expect(checkResult(v([6, null]), F).byRow[0]).toMatch(/entrambe/);
    expect(checkResult(v([8, 6]), F).byRow[0]).toBe('Set 1: al massimo 7');
    expect(checkResult(v([6, 4]), F).global).toBe('La partita non è ancora conclusa');
    const empty = checkResult(v(), F);
    expect(empty.byRow).toEqual({});
    expect(empty.global).toBeUndefined();
    expect(empty.winner).toBeUndefined();
  });
});

describe('errorFromHint', () => {
  it('maps hints to the match copy', async () => {
    const { errorFromHint } = await import('../logic');
    expect(errorFromHint({ hint: 'SLOT_TAKEN' })).toMatch(/appena preso/);
    expect(errorFromHint({ code: '23505' })).toMatch(/appena preso/);
    expect(errorFromHint({ hint: 'BAD_STEP' }, 15)).toBe('Scegli un orario ogni 15 minuti.');
    expect(errorFromHint({ hint: 'OVERLAP', message: 'Il campo è occupato: lezione 15:00–16:30' })).toBe('Il campo è occupato: lezione 15:00–16:30');
    expect(errorFromHint({ hint: 'NOT_FOUND' })).toBeNull();
  });
});

describe('expiry capped at the slot start (critique M1)', () => {
  it('a request is not live once its slot has started', async () => {
    const { effectiveExpiry, isLiveRequest, isSlotUsable } = await import('../logic');
    const r = { status: 'pending' as const, expiresAt: { toMillis: () => Date.parse('2026-11-16T10:00:00') }, date: '2026-11-14', start: '15:00' };
    expect(effectiveExpiry(r)).toBe(Date.parse('2026-11-14T15:00:00'));
    expect(isLiveRequest(r, Date.parse('2026-11-14T14:59:00'))).toBe(true);
    expect(isLiveRequest(r, Date.parse('2026-11-14T15:00:00'))).toBe(false);
    expect(isSlotUsable({ color: 'yellow' })).toBe(true);
    expect(isSlotUsable({ color: 'grey' })).toBe(false);
  });
});

describe('croppedScale', () => {
  it('crops the lanes to whole hours around the shown slots', async () => {
    const { croppedScale } = await import('../logic');
    const base = { from: 13 * 60, to: 23 * 60, px: 0.8 };
    expect(croppedScale([{ start: '18:30', end: '20:00' }, { start: '19:00', end: '20:30' }], base)).toEqual({ from: 18 * 60, to: 21 * 60, px: 0.8 });
    expect(croppedScale([], base)).toBe(base);
  });
});
