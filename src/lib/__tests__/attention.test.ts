import { describe, expect, it } from 'vitest';
import { countByRole, deriveAttention, describeDeadline, romeInstant, type AttentionInput, type AttentionMatch, type AttentionRequest } from '../attention';
import { DEFAULT_CONFIG } from '../config';
import type { Period, Team, Tournament } from '../../types';

// Thursday 12 Nov 2026, 10:00 in Rome (CET, UTC+1)
const NOW = Date.parse('2026-11-12T09:00:00Z');
const TODAY = '2026-11-12';
const ME = 'u1';
const ms = (s: string) => ({ toMillis: () => Date.parse(s) });

const tournament: Tournament = { id: 't', name: 'T', status: 'groups', config: DEFAULT_CONFIG, generatedPhases: [] };
const P1: Period = { id: 'p1', phase: 'groups', startsOn: '2026-11-01', endsOn: '2026-11-30', label: 'Periodo 1' };
const POLD: Period = { id: 'p0', phase: 'groups', startsOn: '2026-10-01', endsOn: '2026-11-08', label: 'Periodo 0' };
const PSHORT: Period = { id: 'p2', phase: 'groups', startsOn: '2026-11-01', endsOn: '2026-11-16', label: 'Periodo 2' };

const teams: Team[] = [
  { id: 'sa', name: 'Rossi/Bianchi', players: [ME, 'u2'], group: 'A', status: 'approved', createdBy: ME },
  { id: 'sb', name: 'Verdi/Neri', players: ['u3', 'u4'], group: 'A', status: 'approved', createdBy: 'u3' },
];

function match(over: Partial<AttentionMatch> = {}): AttentionMatch {
  return {
    id: 'm1', code: 'gA-01-1', phase: 'groups', group: 'A', round: 1, teamA: 'sa', teamB: 'sb',
    playersA: [ME, 'u2'], playersB: ['u3', 'u4'], players: [ME, 'u2', 'u3', 'u4'], periodId: 'p1',
    status: 'unscheduled', requestId: null, schedule: null, result: null, ...over,
  };
}

function request(over: Partial<AttentionRequest> = {}, acc: Record<string, boolean> = {}): AttentionRequest {
  const players = [ME, 'u2', 'u3', 'u4'];
  return {
    id: 'r1', tournamentId: 't', matchId: 'm1', courtId: 'c1', date: '2026-11-14', start: '15:30', end: '17:00',
    offGrid: false, counterProposal: false, players,
    acceptances: Object.fromEntries(players.map((p) => [p, acc[p] ? ms('2026-11-11T10:00:00Z') : null])),
    status: 'pending', expiresAt: ms('2026-11-14T09:00:00Z'), createdBy: 'u3', createdAt: '2026-11-12T08:00:00Z', ...over,
  };
}

function input(over: Partial<AttentionInput> = {}): AttentionInput {
  return {
    now: NOW, today: TODAY, uid: ME, roles: ['player'], tournament, periods: [P1, POLD, PSHORT], teams,
    matches: [], requests: [], myWindows: { '2026-11-20': ['18:00-21:00'] }, ...over,
  };
}

const kinds = (i: AttentionInput) => deriveAttention(i).map((x) => x.kind);

describe('deriveAttention', () => {
  it('empty input → []', () => {
    expect(deriveAttention(input({ tournament: null, periods: [], teams: [], myWindows: null }))).toEqual([]);
  });

  it('accept-request: live request, my acceptance missing', () => {
    const r = request({}, { u3: true });
    const [it] = deriveAttention(input({ matches: [match({ status: 'requested', requestId: 'r1' })], requests: [r] }));
    expect(it).toMatchObject({ kind: 'accept-request', priority: 1, action: { type: 'inline', rpc: 'accept_request', id: 'r1' } });
    expect(it.missing).toEqual([ME, 'u2', 'u4']);
    expect(it.deadline).toBe('2026-11-14T09:00:00.000Z');
  });

  it('request-in-progress: I accepted, others missing (2) or 4/4 waiting for the court (3)', () => {
    const p = match({ status: 'requested', requestId: 'r1' });
    const partial = deriveAttention(input({ matches: [p], requests: [request({}, { [ME]: true, u3: true })] }));
    expect(partial).toHaveLength(1);
    expect(partial[0]).toMatchObject({ kind: 'request-in-progress', priority: 2, missing: ['u2', 'u4'] });
    const complete = deriveAttention(input({ matches: [p], requests: [request({}, { [ME]: true, u2: true, u3: true, u4: true })] }));
    expect(complete[0]).toMatchObject({ kind: 'request-in-progress', priority: 3 });
    expect(complete[0].missing).toBeUndefined();
  });

  it('lazy expiry: pending past expiresAt → schedule-match with reason expired', () => {
    const r = request({ expiresAt: ms('2026-11-12T08:00:00Z') }, { u3: true });
    const [it] = deriveAttention(input({ matches: [match({ status: 'requested', requestId: 'r1' })], requests: [r] }));
    expect(it).toMatchObject({ kind: 'schedule-match', reason: 'expired' });
  });

  it('schedule-match: reason from the latest request only', () => {
    const old = request({ id: 'r0', status: 'rejected', createdAt: '2026-11-01T08:00:00Z' });
    const recent = request({ id: 'r2', status: 'cancelled', createdAt: '2026-11-10T08:00:00Z' });
    const [it] = deriveAttention(input({ matches: [match()], requests: [old, recent] }));
    expect(it.reason).toBe('cancelled');
    const [onlyOld] = deriveAttention(input({ matches: [match()], requests: [old] }));
    expect(onlyOld.reason).toBe('rejected');
  });

  it('schedule-match priority by period: 2 far, 1 within 7 days, 0 ended (late)', () => {
    expect(deriveAttention(input({ matches: [match()] }))[0]).toMatchObject({ kind: 'schedule-match', priority: 2 });
    expect(deriveAttention(input({ matches: [match({ periodId: 'p2' })], myWindows: { '2026-11-13': ['18:00-21:00'] } }))[0]).toMatchObject({
      priority: 1,
    });
    const [late] = deriveAttention(input({ matches: [match({ periodId: 'p0' })] }));
    expect(late).toMatchObject({ kind: 'schedule-match', priority: 0, reason: 'late' });
  });

  it('schedule-match needs both pairs and 4 players; not for others’ matches', () => {
    expect(kinds(input({ matches: [match({ teamB: null, playersB: [] })] }))).toEqual([]);
    expect(kinds(input({ matches: [match({ playersA: ['x', 'y'] , players: ['x', 'y', 'u3', 'u4'] })] }))).toEqual([]);
  });

  it('confirm-result only when the result was entered by the other side', () => {
    const res = (by: string) => ({ sets: [{ a: 6, b: 4 }, { a: 6, b: 3 }], enteredBy: by, confirmedBy: null });
    const theirs = deriveAttention(input({ matches: [match({ status: 'scheduled', result: res('u3') })] }));
    expect(theirs[0]).toMatchObject({ kind: 'confirm-result', priority: 1, action: { type: 'inline', rpc: 'confirm_result', id: 'm1' } });
    const own = deriveAttention(input({ matches: [match({ status: 'scheduled', result: res('u2') })] }));
    expect(own[0]).toMatchObject({ kind: 'awaiting-opponents-confirmation', priority: 3 });
    expect(kinds(input({ matches: [match({ status: 'disputed', result: { ...res('u3'), disputedBy: ME } })] }))).toEqual([]);
    expect(kinds(input({ matches: [match({ status: 'played', result: { ...res('u3'), confirmedBy: ME } })] }))).toEqual([]);
  });

  it('enter-result after the scheduled end, not before', () => {
    const sched = (date: string) => ({ courtId: 'c1', date, start: '15:30', end: '17:00' });
    const [it] = deriveAttention(input({ matches: [match({ status: 'scheduled', schedule: sched('2026-11-10') })] }));
    expect(it).toMatchObject({ kind: 'enter-result', action: { type: 'navigate', to: '/t/t/partite/m1#risultato' } });
    // 09:00–10:30 today in Rome is still being played at 10:00 → not yet
    const inProgress = match({ status: 'scheduled', schedule: { courtId: 'c1', date: TODAY, start: '09:00', end: '10:30' } });
    expect(kinds(input({ matches: [inProgress] }))).toEqual([]);
  });

  it('upcoming-match within 72 h only', () => {
    const sched = (date: string) => ({ courtId: 'c1', date, start: '15:30', end: '17:00' });
    expect(deriveAttention(input({ matches: [match({ status: 'scheduled', schedule: sched('2026-11-14') })] }))[0]).toMatchObject({
      kind: 'upcoming-match', priority: 3,
    });
    expect(kinds(input({ matches: [match({ status: 'scheduled', schedule: sched('2026-11-20') })] }))).toEqual([]);
  });

  it('set-availability: no future dates in the open period; ignores past dates', () => {
    const only = (f: AttentionInput['myWindows']) => kinds(input({ matches: [match()], myWindows: f }));
    expect(only(null)).toContain('set-availability');
    expect(only({ '2026-11-05': ['18:00-21:00'] })).toContain('set-availability'); // past date
    expect(only({ '2026-12-05': ['18:00-21:00'] })).toContain('set-availability'); // outside the period
    expect(only({ '2026-11-18': [] })).toContain('set-availability'); // empty day
    expect(only({ '2026-11-18': ['18:00-21:00'] })).not.toContain('set-availability');
    // no item without matches to schedule
    expect(kinds(input({ matches: [], myWindows: null }))).toEqual([]);
  });

  it('set-availability for a period far ahead is not urgent and stays below a result to confirm', () => {
    const PFUTURE: Period = { id: 'p3', phase: 'groups', startsOn: '2026-12-01', endsOn: '2026-12-20', label: 'Periodo 3' };
    const PNEAR: Period = { id: 'p4', phase: 'groups', startsOn: '2026-11-18', endsOn: '2026-11-30', label: 'Periodo 4' };
    const items = deriveAttention(
      input({
        periods: [P1, PFUTURE, PNEAR],
        myWindows: null,
        matches: [
          match({ id: 'm1', status: 'scheduled', result: { sets: [{ a: 6, b: 3 }, { a: 6, b: 4 }], enteredBy: 'u3', confirmedBy: null } }),
          match({ id: 'm2', periodId: 'p3' }),
          match({ id: 'm3', periodId: 'p4' }),
        ],
      }),
    );
    expect(items.find((x) => x.id === 'set-availability:p3')).toMatchObject({ priority: 2 });
    expect(items.find((x) => x.id === 'set-availability:p4')).toMatchObject({ priority: 1 });
    const pos = (id: string) => items.findIndex((x) => x.id === id);
    expect(pos('confirm-result:m1')).toBeGreaterThanOrEqual(0);
    expect(pos('confirm-result:m1')).toBeLessThan(pos('set-availability:p3'));
  });

  it('complete-team and team-awaiting-approval', () => {
    const mine: Team[] = [{ id: 's1', name: 'X', players: [ME], status: 'awaiting_partner', createdBy: ME }];
    expect(deriveAttention(input({ teams: mine }))[0]).toMatchObject({ kind: 'complete-team', priority: 1 });
    expect(kinds(input({ teams: [{ ...mine[0], createdBy: 'other' }] }))).toEqual([]);
    expect(deriveAttention(input({ teams: [{ ...mine[0], players: [ME, 'u2'], status: 'pending_approval' }] }))[0]).toMatchObject({
      kind: 'team-awaiting-approval', priority: 3,
    });
  });

  it('one item per match: accept-request wins over confirm-result', () => {
    const p = match({ status: 'requested', requestId: 'r1', result: { sets: [{ a: 6, b: 4 }], enteredBy: 'u3' } });
    const out = deriveAttention(input({ matches: [p], requests: [request({}, { u3: true })], myWindows: { '2026-11-20': ['x'] } }));
    expect(out.map((x) => x.kind)).toEqual(['accept-request']);
  });

  it('manager: confirm-request at 4/4 (inline on grid, navigate off grid) and matches-today', () => {
    const everyone = { [ME]: true, u2: true, u3: true, u4: true };
    const base = { roles: ['manager'] as AttentionInput['roles'], uid: 'g1', tournament: null };
    const [inl] = deriveAttention(input({ ...base, requests: [request({}, everyone)] }));
    expect(inl).toMatchObject({ kind: 'confirm-request', role: 'manager', action: { type: 'inline', rpc: 'confirm_request' } });
    const [fg] = deriveAttention(input({ ...base, requests: [request({ offGrid: true }, everyone)] }));
    expect(fg.action).toEqual({ type: 'navigate', to: '/campo?r=r1' });
    expect(kinds(input({ ...base, requests: [request({}, { u2: true })] }))).toEqual([]);
    const today = deriveAttention(input({ ...base, requests: [request({ id: 'a', status: 'confirmed', date: TODAY }), request({ id: 'b', status: 'confirmed', date: TODAY })] }));
    expect(today[0]).toMatchObject({ kind: 'matches-today', count: 2, action: { to: '/campo/giorno/2026-11-12' } });
  });

  it('admin without manager/organizer roles gets no manager or organizer items', () => {
    const everyone = { [ME]: true, u2: true, u3: true, u4: true };
    const out = deriveAttention(
      input({ uid: 'adm', roles: ['admin'], requests: [request({}, everyone)], matches: [match({ status: 'disputed' })],
        teams: [{ id: 'x', name: 'X', players: ['a', 'b'], status: 'pending_approval', createdBy: 'a' }] }),
    );
    expect(out).toEqual([]);
  });

  it('organizer items', () => {
    const res = { sets: [{ a: 6, b: 4 }], enteredBy: 'u3', confirmedBy: null };
    const org = input({
      uid: 'org', roles: ['organizer'],
      teams: [...teams, { id: 'sx', name: 'Nuovi', players: ['a', 'b'], status: 'pending_approval', createdBy: 'a' }],
      matches: [
        match({ id: 'c', status: 'disputed' }),
        match({ id: 'late', periodId: 'p0' }),
        match({ id: 'soon', periodId: 'p2' }),
        match({ id: 'far', periodId: 'p1' }),
        match({ id: 'old', status: 'scheduled', result: res, updatedAt: '2026-11-09T09:00:00Z' }),
        match({ id: 'fresh', status: 'scheduled', result: res, updatedAt: '2026-11-12T08:00:00Z' }),
      ],
    });
    const out = deriveAttention(org);
    const by = Object.fromEntries(out.map((x) => [x.id, x]));
    expect(by['disputed-result:c']).toMatchObject({ priority: 1 });
    expect(by['approve-team:sx']).toMatchObject({ action: { type: 'inline', rpc: 'approve_team', id: 'sx' } });
    expect(by['late-matches:p0']).toMatchObject({ count: 1, action: { to: '/t/t/organizza/monitoraggio?periodo=p0' } });
    expect(by['period-ending:p2']).toMatchObject({ count: 1, priority: 2 });
    expect(by['period-ending:p1']).toBeUndefined(); // ends in 18 days
    expect(by['unconfirmed-results:t']).toMatchObject({ count: 1 });
    expect(by['tournament-step:approve-teams']).toMatchObject({ step: 'approve-teams', count: 1, action: { to: '/t/t/organizza/squadre' } });
    expect(out.every((x) => x.role === 'organizer')).toBe(true);
  });

  it('24 h promotion to Urgente', () => {
    const r = request({ expiresAt: ms('2026-11-13T08:00:00Z') }, { u3: true }); // 23 h left
    expect(deriveAttention(input({ matches: [match({ status: 'requested', requestId: 'r1' })], requests: [r] }))[0]).toMatchObject({
      kind: 'accept-request', priority: 0,
    });
    // 'Per sapere' items are never promoted
    const everyone = { [ME]: true, u2: true, u3: true, u4: true };
    const r4 = request({ expiresAt: ms('2026-11-12T12:00:00Z') }, everyone);
    expect(deriveAttention(input({ matches: [match({ status: 'requested', requestId: 'r1' })], requests: [r4] }))[0].priority).toBe(3);
  });

  it('multi-role merge: sorted by priority, deadline, kind order, id; deterministic', () => {
    const everyone = { [ME]: true, u2: true, u3: true, u4: true };
    const mgr = request({ id: 'rg', matchId: 'm9', expiresAt: ms('2026-11-15T09:00:00Z') }, everyone);
    const mine = request({ id: 'r1', expiresAt: ms('2026-11-16T09:00:00Z') }, { u3: true });
    const i = input({
      roles: ['player', 'manager', 'organizer'],
      matches: [match({ status: 'requested', requestId: 'r1' }), match({ id: 'm2', status: 'disputed', playersA: ['x', 'y'], playersB: ['w', 'z'] })],
      requests: [mine, mgr],
    });
    const out = deriveAttention(i);
    expect(out.map((x) => x.id)).toEqual([
      'confirm-request:rg', // priority 1, deadline 15/11
      'accept-request:r1', // priority 1, deadline 16/11
      'disputed-result:m2', // priority 1, no deadline
    ]);
    expect(deriveAttention(i)).toEqual(out);
    expect(countByRole(out)).toEqual({ player: 1, manager: 1, organizer: 1 });
  });
});

describe('describeDeadline', () => {
  const at = (date: string, hhmm: string) => new Date(romeInstant(date, hhmm)).toISOString();
  it('speaks in words', () => {
    expect(describeDeadline(at(TODAY, '10:45'), NOW)).toBe('scade tra 45 min');
    expect(describeDeadline(at(TODAY, '15:10'), NOW)).toBe('scade tra 5 h');
    expect(describeDeadline(at('2026-11-13', '18:30'), NOW)).toBe('scade domani alle 18:30');
    expect(describeDeadline(at('2026-11-14', '23:59'), NOW)).toBe('entro sab 14/11');
    expect(describeDeadline(at('2026-11-10', '23:59'), NOW)).toBe('in ritardo dal 10/11');
  });
  it('romeInstant handles CET and CEST', () => {
    expect(new Date(romeInstant('2026-11-14', '15:30')).toISOString()).toBe('2026-11-14T14:30:00.000Z');
    expect(new Date(romeInstant('2026-07-14', '15:30')).toISOString()).toBe('2026-07-14T13:30:00.000Z');
  });
});
