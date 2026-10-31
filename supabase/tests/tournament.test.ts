/**
 * Tournament: schedule, final phases, status transitions; score validation; jobs;
 * anon / service_role boundaries.
 */
import { describe, expect, it } from 'vitest';
import { base, createUser, DATE, expectCode, expectHint, match, request, tx, type Db } from './helpers';

const S = (...xs: [number, number][]) => xs.map(([a, b]) => ({ a, b }));

async function registrationTournament(db: Db, n = 3) {
  const T = await db.val<string>(`insert into public.tournaments (name) values ('Iscr') returning id`);
  const teams: string[] = [];
  for (let i = 1; i <= n; i++) {
    const p1 = await createUser(db, `g${i}a`);
    const p2 = await createUser(db, `g${i}b`);
    const t = await db.val<string>(
      `insert into public.teams (tournament_id, name, group_name, status, created_by) values ($1, $2, 'A', 'approved', $3) returning id`,
      [T, `S${i}`, p1],
    );
    await db.q(`insert into public.team_players (team_id, tournament_id, user_id, position) values ($1, $2, $3, 1), ($1, $2, $4, 2)`, [
      t,
      T,
      p1,
      p2,
    ]);
    teams.push(t);
  }
  return { T, teams };
}

describe('validate_result (port of src/lib/results.ts)', () => {
  const f = { setsToWin: 2, superTieBreak: true };
  const cases: [ReturnType<typeof S>, typeof f, boolean, string?][] = [
    [S([6, 4], [6, 3]), f, true, 'A'],
    [S([6, 4], [3, 6], [8, 10]), f, true, 'B'],
    [S([6, 4], [3, 6], [12, 10]), f, true, 'A'],
    [S([6, 5], [6, 3]), f, false],
    [S([6, 4]), f, false],
    [S([6, 4], [6, 3], [6, 0]), f, false],
    [S([6, 4], [3, 6], [10, 9]), f, false],
    [S([6, 4], [3, 6], [7, 5]), { setsToWin: 2, superTieBreak: false }, true, 'A'],
    [S([7, 6], [7, 5]), f, true, 'A'],
    [S([6, 6], [6, 3]), f, false],
    [S([6, 4], [3, 6], [13, 10]), f, false],
    [S(), f, false],
    [S([6, 4], [6, 3], [6, 2]), { setsToWin: 3, superTieBreak: false }, true, 'A'],
  ];
  it.each(cases)('%j %j → %s', (sets, format, ok, winner) =>
    tx(async (db) => {
      const r = await db.val('select private.validate_result($1::jsonb, $2::jsonb)', [JSON.stringify(sets), JSON.stringify(format)]);
      expect(r.ok).toBe(ok);
      if (ok) expect(r.winner).toBe(winner);
      else expect(typeof r.error).toBe('string');
    }),
  );

  it('non-integer or negative values', () =>
    tx(async (db) => {
      for (const sets of ['[{"a":6.5,"b":4},{"a":6,"b":3}]', '[{"a":-6,"b":4}]', '[{"a":"6","b":4}]', '{}', 'null']) {
        expect((await db.val('select private.validate_result($1::jsonb, $2::jsonb)', [sets, '{}'])).ok).toBe(false);
      }
    }));
});

describe('schedule and final phases', () => {
  it('generate_calendar rejects an incomplete round robin', () =>
    tx(async (db) => {
      const b = await base(db);
      const {
        T,
        teams: [t1, t2, t3],
      } = await registrationTournament(db);
      const m = (code: string, a: string, c: string) => ({
        code,
        group_name: 'A',
        round: 1,
        position: 1,
        team_a: a,
        team_b: c,
        period_id: null,
      });
      const two = [m('gA-1', t1, t2), m('gA-2', t1, t3)];
      await expectHint(db.as(b.a1).rpc('generate_calendar', { p_tournament: T, p_matches: two }), 'NOT_AUTHORIZED');
      const err = await expectHint(db.as(b.org).rpc('generate_calendar', { p_tournament: T, p_matches: two }), 'BAD_CALENDAR');
      expect(err.message).toContain('incompleto');
      await expectHint(
        db.as(b.org).rpc('generate_calendar', { p_tournament: T, p_matches: [...two, m('gA-3', t2, t1)] }),
        'BAD_CALENDAR',
      );
      await expectHint(
        db.as(b.org).rpc('generate_calendar', { p_tournament: T, p_matches: [...two, m('gA-2', t2, t3)] }),
        'BAD_CALENDAR',
      );
      expect(await db.as(b.org).rpc('generate_calendar', { p_tournament: T, p_matches: [...two, m('gA-3', t2, t3)] })).toBe(3);
      expect(await db.val('select status from public.tournaments where id = $1', [T])).toBe('groups');
      await expectHint(
        db.as(b.org).rpc('generate_calendar', { p_tournament: T, p_matches: [m('gA-9', t2, t3)] }),
        'CALENDAR_EXISTS',
      );
      // finals: one match, then the phase exists
      const fin = [
        { code: 'gold-F', round: 1, position: 1, next_code: null, side: null, team_a: t1, team_b: t2, period_id: null },
      ];
      expect(await db.as(b.org).rpc('generate_finals', { p_tournament: T, p_phase: 'Gold', p_matches: fin })).toBe(1);
      expect(await db.one('select status, generated_phases from public.tournaments where id = $1', [T])).toEqual({
        status: 'finals',
        generated_phases: ['gold'],
      });
      await expectHint(db.as(b.org).rpc('generate_finals', { p_tournament: T, p_phase: 'gold', p_matches: fin }), 'PHASE_EXISTS');
      await expectHint(
        db.as(b.org).rpc('generate_finals', {
          p_tournament: T,
          p_phase: 'silver',
          p_matches: [{ ...fin[0], code: 'silver-F', team_a: t1, team_b: t1 }],
        }),
        'BAD_BRACKET',
      );
      // sync_bracket only touches unplayed final matches
      expect(
        await db.as(b.org).rpc('sync_bracket', { p_tournament: T, p_updates: [{ code: 'gold-F', team_a: t3, team_b: t2 }] }),
      ).toBe(1);
      await expectHint(
        db.as(b.org).rpc('sync_bracket', { p_tournament: T, p_updates: [{ code: 'gA-1', team_a: t3, team_b: t2 }] }),
        'BAD_BRACKET',
      );
    }));

  it('set_tournament_state: allowed and forbidden transitions', () =>
    tx(async (db) => {
      const b = await base(db);
      const {
        T,
        teams: [t1, t2],
      } = await registrationTournament(db, 2);
      const st = (status: string) => db.as(b.org).rpc('set_tournament_state', { p_tournament: T, p_status: status });
      const status = () => db.val('select status from public.tournaments where id = $1', [T]);
      await expectHint(db.as(b.a1).rpc('set_tournament_state', { p_tournament: T, p_status: 'completed' }), 'NOT_AUTHORIZED');
      await expectHint(st('groups'), 'BAD_STATE');
      await expectHint(st('finals'), 'BAD_STATE');
      await st('completed');
      await expectHint(st('groups'), 'BAD_STATE');
      await st('registration');
      expect(await status()).toBe('registration');
      // without group matches, groups -> registration is allowed
      await db.q(`update public.tournaments set status = 'groups' where id = $1`, [T]);
      await st('registration');
      await db.as(b.org).rpc('generate_calendar', {
        p_tournament: T,
        p_matches: [{ code: 'gA-1', group_name: 'A', round: 1, position: 1, team_a: t1, team_b: t2, period_id: null }],
      });
      await expectHint(st('registration'), 'BAD_STATE');
      await expectHint(st('finals'), 'BAD_STATE');
      await st('completed');
      await expectHint(st('registration'), 'BAD_STATE');
      await st('groups');
      expect(await status()).toBe('groups');
      await st('groups'); // no-op
      await db.as(b.org).rpc('generate_finals', {
        p_tournament: T,
        p_phase: 'gold',
        p_matches: [{ code: 'gold-F', round: 1, position: 1, next_code: null, side: null, team_a: t1, team_b: t2, period_id: null }],
      });
      await expectHint(st('groups'), 'BAD_STATE');
      await st('completed');
      await expectHint(st('groups'), 'BAD_STATE');
      await st('finals');
      expect(await status()).toBe('finals');
      // calendar generation outside registration
      await expectHint(
        db.as(b.org).rpc('generate_calendar', { p_tournament: b.T, p_matches: [{ code: 'z', group_name: 'A' }] }),
        'CALENDAR_EXISTS',
      );
    }));
});

describe('scheduled jobs', () => {
  it('job_expire_requests: expired requests, match freed, audit log', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      expect(await db.val('select private.job_expire_requests()')).toBe(0);
      await db.q(`update public.requests set expires_at = now() - interval '1 minute' where id = $1`, [id]);
      expect(await db.val('select private.job_expire_requests()')).toBe(1);
      expect(await request(db, id)).toMatchObject({ status: 'expired' });
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled', request_id: null });
      expect(
        await db.val(`select count(*)::int from public.audit_log where action = 'request expired' and target = $1`, [id]),
      ).toBe(1);
      // jobs are not callable by clients
      await expectCode(db.as(b.admin).q('select private.job_expire_requests()'), '42501');
    }));

  it('job_unplayed: reports once per period', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.q(`update public.periods set starts_on = '2020-01-01', ends_on = '2020-01-31' where id = $1`, [b.period]);
      expect(await db.val('select private.job_unplayed()')).toBe(2);
      expect(await db.val('select private.job_unplayed()')).toBe(0);
    }));

  it('service_role updates roles (seed, server-side admin)', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.as('service_role').q(`update public.profiles set roles = '{manager,player}' where id = $1`, [b.a1]);
      expect(await db.val(`select roles::text from public.profiles where id = $1`, [b.a1])).toBe('{manager,player}');
    }));

  it('reminder_emails for service_role only', () =>
    tx(async (db) => {
      const b = await base(db);
      await expectCode(db.as(b.admin).rpc('reminder_emails'), '42501');
      await expectCode(db.as('anon').rpc('reminder_emails'), '42501');
      const mail = await db.as('service_role').rpc<{ email: string; name: string; lines: string[] }[]>('reminder_emails');
      const a1 = mail.find((p) => p.email === 'a1@x.it');
      expect(a1?.lines.some((l) => l.includes('disponibilità'))).toBe(true);
      expect(mail.find((p) => p.email === 'x@x.it')).toBeUndefined();
      // pending request expiring soon: who must still accept
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      await db.q(`update public.requests set expires_at = now() + interval '2 hours' where id = $1`, [id]);
      const mail2 = await db.as('service_role').rpc<{ email: string; lines: string[] }[]>('reminder_emails');
      expect(mail2.find((p) => p.email === 'b1@x.it')?.lines.some((l) => l.includes('accettala'))).toBe(true);
      expect(mail2.find((p) => p.email === 'a1@x.it')?.lines.some((l) => l.includes('accettala'))).toBe(false);
    }));
});

describe('anon and privileges', () => {
  it('anon runs no RPC and cannot read requests, bookings, profiles', () =>
    tx(async (db) => {
      const b = await base(db);
      const anon = db.as('anon');
      for (const t of ['requests', 'request_players', 'bookings', 'profiles', 'availability', 'audit_log', 'invites', 'recurrences'])
        await expectCode(anon.q(`select * from public.${t}`), '42501');
      await expectCode(anon.rpc('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' }), '42501');
      await expectCode(anon.rpc('get_invite', { p_token: 'x' }), '42501');
      await expectCode(anon.rpc('confirm_request', { p_request: b.P }), '42501');
      await expectCode(anon.q('select private.has_role($1)', ['admin']), '42501');
      // the public read paths
      expect((await anon.rows('select name from public.public_players where id = $1', [b.a1]))[0].name).toBe('a1');
      expect(await anon.rows('select players_a from public.matches_v where id = $1', [b.P])).toEqual([{ players_a: [b.a1, b.a2] }]);
      expect((await anon.rows('select * from public.courts')).length).toBe(2);
      expect((await anon.rows('select * from public.teams where tournament_id = $1', [b.T])).length).toBe(2);
      // no anonymous writes anywhere
      await expectCode(anon.q(`update public.tournaments set name = 'x'`), '42501');
      await expectCode(anon.q(`insert into public.availability (tournament_id, user_id) values ($1, $2)`, [b.T, b.a1]), '42501');
    }));

  it('no public RPC executable by anon or PUBLIC', () =>
    tx(async (db) => {
      const leak = await db.q(`
        select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private')
          and (has_function_privilege('anon', p.oid, 'execute')
               or (p.proname = 'reminder_emails' and has_function_privilege('authenticated', p.oid, 'execute')))`);
      expect(leak).toEqual([]);
      const definer = await db.q(`
        select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and not p.prosecdef and p.prokind = 'f'`);
      expect(definer).toEqual([]);
    }));
});
