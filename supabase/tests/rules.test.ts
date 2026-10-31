/**
 * Port of every scenario of the old tests/rules.test.ts (Firestore rules) to RLS + RPC.
 */
import { describe, expect, it } from 'vitest';
import {
  acceptances,
  acceptedRequest,
  base,
  DATE,
  expectCode,
  expectHint,
  match,
  request,
  tx,
} from './helpers';

describe('users / profiles', () => {
  it('sign-up only as a player, and nobody changes their own role', () =>
    tx(async (db) => {
      const b = await base(db);
      // sign-up (auth.users trigger) always creates a plain player
      const newcomer = await db.val<string>(
        `insert into auth.users (email, raw_user_meta_data) values ('nuovo@x.it', '{"full_name":"Nuovo","roles":["admin"]}') returning id`,
      );
      expect(await db.one('select name, email, roles from public.profiles where id = $1', [newcomer])).toEqual({
        name: 'Nuovo',
        email: 'nuovo@x.it',
        roles: '{player}',
      });
      // profiles are not insertable by clients
      await expectCode(
        db.as(newcomer).q(`insert into public.profiles (id, name, roles) values (gen_random_uuid(), 'n', '{admin,player}')`),
        '42501',
      );
      // self-escalation: no column privilege on roles, set_roles is admin only
      await expectCode(db.as(b.a1).q(`update public.profiles set roles = '{admin,player}' where id = $1`, [b.a1]), '42501');
      await expectHint(db.as(b.a1).rpc('set_roles', { p_user: b.a1, p_roles: ['admin'] }), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.mgr).rpc('set_roles', { p_user: b.mgr, p_roles: ['admin'] }), 'NOT_AUTHORIZED');
      expect(await db.val('select roles from public.profiles where id = $1', [b.a1])).toBe('{player}');
      // own phone yes, someone else's no (RLS filters the row)
      expect((await db.as(b.a1).q(`update public.profiles set phone = '123' where id = $1`, [b.a1])).rowCount).toBe(1);
      expect((await db.as(b.a1).q(`update public.profiles set phone = '999' where id = $1`, [b.a2])).rowCount).toBe(0);
      // the admin changes roles through set_roles (player is always kept)
      await db.as(b.admin).rpc('set_roles', { p_user: b.a1, p_roles: ['manager'] });
      expect(await db.val('select roles from public.profiles where id = $1', [b.a1])).toBe('{manager,player}');
      // at least one admin must remain
      await expectHint(db.as(b.admin).rpc('set_roles', { p_user: b.admin, p_roles: ['player'] }), 'BAD_STATE');
    }));
});

describe('tournaments', () => {
  it('public read, writes by the organizer only (config always editable)', () =>
    tx(async (db) => {
      const b = await base(db);
      expect(await db.as('anon').rows('select name from public.tournaments where id = $1', [b.T])).toEqual([{ name: 'T' }]);
      expect((await db.as(b.a1).q(`update public.tournaments set name = 'x' where id = $1`, [b.T])).rowCount).toBe(0);
      expect((await db.as(b.org).q(`update public.tournaments set name = 'x' where id = $1`, [b.T])).rowCount).toBe(1);
      // the set format stays editable by the organizer in any status
      await db.q(`update public.tournaments set status = 'finals' where id = $1`, [b.T]);
      const cfg = { setFormat: { setsToWin: 1, superTieBreak: false } };
      expect(
        (await db.as(b.org).q(`update public.tournaments set config = config || $2::jsonb where id = $1`, [b.T, JSON.stringify(cfg)]))
          .rowCount,
      ).toBe(1);
      // status only through RPCs: no column privilege
      await expectCode(db.as(b.org).q(`update public.tournaments set status = 'completed' where id = $1`, [b.T]), '42501');
      // insert / delete: admin only
      await expectCode(db.as(b.org).q(`insert into public.tournaments (name) values ('N')`), '42501');
      expect((await db.as(b.admin).q(`insert into public.tournaments (name) values ('N')`)).rowCount).toBe(1);
    }));
});

describe('teams and invites', () => {
  it('the partner joins only with the right token', () =>
    tx(async (db) => {
      const b = await base(db);
      const T2 = await db.val<string>(`insert into public.tournaments (name) values ('Iscrizioni') returning id`);
      const { team_id: t1, token } = await db.as(b.a1).rpc('create_team', { p_tournament: T2, p_name: 'S' });
      expect(await db.as(b.a1).rpc('my_invite_token', { p_team: t1 })).toBe(token);
      expect(await db.as(b.a2).rpc('my_invite_token', { p_team: t1 })).toBeNull();
      // invites are readable only by the creator (and the organizer)
      expect(await db.as(b.a2).rows('select token from public.invites')).toEqual([]);
      expect(await db.as(b.a1).rows('select token from public.invites')).toEqual([{ token }]);
      expect(await db.as(b.org).rows('select token from public.invites')).toEqual([{ token }]);

      await expectHint(db.as(b.a2).rpc('join_team', { p_token: 'wrong' }), 'BAD_TOKEN');
      expect(await db.as(b.a2).rpc('get_invite', { p_token: token })).toMatchObject({ name: 'S', creator_name: 'a1', players: 1 });
      expect(await db.as(b.a2).rpc('join_team', { p_token: token })).toBe(t1);
      await expectHint(db.as(b.x).rpc('join_team', { p_token: token }), 'TEAM_FULL');
      await expectHint(db.as(b.a1).rpc('create_team', { p_tournament: T2, p_name: 'Altra' }), 'ALREADY_IN_TEAM');
      expect(await db.val('select status from public.teams where id = $1', [t1])).toBe('pending_approval');
      expect(await db.val('select array_agg(user_id order by position) from public.team_players where team_id = $1', [t1])).toEqual([
        b.a1,
        b.a2,
      ]);

      // the creator renames, but cannot approve
      expect((await db.as(b.a1).q(`update public.teams set name = 'S2' where id = $1`, [t1])).rowCount).toBe(1);
      await expectHint(db.as(b.a1).q(`update public.teams set status = 'approved' where id = $1`, [t1]), 'NOT_AUTHORIZED');
      expect((await db.as(b.org).q(`update public.teams set status = 'approved', group_name = 'A' where id = $1`, [t1])).rowCount).toBe(1);
      // once approved the creator cannot rename any more
      expect((await db.as(b.a1).q(`update public.teams set name = 'S3' where id = $1`, [t1])).rowCount).toBe(0);
      // registration closed
      await db.q(`update public.tournaments set status = 'groups' where id = $1`, [T2]);
      await expectHint(db.as(b.x).rpc('create_team', { p_tournament: T2, p_name: 'Tardi' }), 'REGISTRATION_CLOSED');
    }));
});

describe('requests', () => {
  it('the expiry never goes past the start of the slot', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      // slot moved to tomorrow at 10:00: the deadline (now + 48h) must be capped at that start
      await db.q(
        `update public.requests set date = ((now() at time zone 'Europe/Rome')::date + 1), start_time = '10:00' where id = $1`,
        [id],
      );
      const ok = await db.val<boolean>(
        `select expires_at <= ((date + start_time) at time zone 'Europe/Rome') from public.requests where id = $1`,
        [id],
      );
      expect(ok).toBe(true);
      // slot already started: the request is expired and job_expire_requests frees the match
      await db.q(`update public.requests set date = ((now() at time zone 'Europe/Rome')::date - 1) where id = $1`, [id]);
      await db.val('select private.job_expire_requests()');
      expect(await db.val(`select status::text from public.requests where id = $1`, [id])).toBe('expired');
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled' });
    }));

  it('only one of the 4 players creates the request, with a lock on the slot', () =>
    tx(async (db) => {
      const b = await base(db);
      const args = { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' };
      await expectHint(db.as(b.x).rpc('create_request', args), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.mgr).rpc('create_request', args), 'NOT_AUTHORIZED');
      const id = await db.as(b.a1).rpc<string>('create_request', args);
      await expectHint(db.as(b.b1).rpc('create_request', args), 'MATCH_HAS_REQUEST');
      await expectHint(db.as(b.b1).rpc('create_request', { ...args, p_match: b.P2 }), 'SLOT_TAKEN');
      expect(await match(db, b.P)).toMatchObject({ status: 'requested', request_id: id });
      // direct writes are impossible
      await expectCode(db.as(b.a1).q(`update public.requests set status = 'confirmed' where id = $1`, [id]), '42501');
      await expectCode(db.as(b.a1).q(`update public.matches set status = 'scheduled' where id = $1`, [b.P]), '42501');
    }));

  it('end time, grid and expiry are computed by the server', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      const r = await request(db, id);
      expect(r).toMatchObject({
        start_time: '18:00:00',
        end_time: '19:30:00',
        off_grid: false,
        counter_proposal: false,
        status: 'pending',
        created_by: b.a1,
      });
      const hours = await db.val<number>(`select round(extract(epoch from expires_at - now()) / 3600) from public.requests where id = $1`, [id]);
      expect(Number(hours)).toBe(48);
    }));

  it('off-grid only when the tournament allows it, with the configured step', () =>
    tx(async (db) => {
      const b = await base(db);
      const args = { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:30' };
      await expectHint(db.as(b.a1).rpc('create_request', args), 'OFF_GRID_DISABLED');
      await db.q(`update public.tournaments set config = config || '{"allowOffGrid": true, "offGridStep": 30}' where id = $1`, [b.T]);
      await expectHint(db.as(b.a1).rpc('create_request', { ...args, p_start: '18:15' }), 'BAD_STEP');
      await expectHint(db.as(b.a1).rpc('create_request', { ...args, p_start: '23:30' }), 'COURT_CLOSED');
      const id = await db.as(b.a1).rpc<string>('create_request', args);
      expect(await request(db, id)).toMatchObject({ off_grid: true, end_time: '20:00:00' });
    }));

  it('checks on past time and closed court', () =>
    tx(async (db) => {
      const b = await base(db);
      await expectHint(
        db.as(b.a1).rpc('create_request', { p_match: b.P, p_court: 'c1', p_date: '2020-01-04', p_start: '18:00' }),
        'IN_PAST',
      );
      await db.q(`update public.courts set closed_dates = $1 where id = 'c1'`, [[DATE]]);
      await expectHint(
        db.as(b.a1).rpc('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' }),
        'COURT_CLOSED',
      );
    }));

  it('a match past the end of its period can still be booked', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.q(`update public.periods set starts_on = '2020-01-01', ends_on = '2020-01-31' where id = $1`, [b.period]);
      await db.as(b.a1).rpc('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
    }));

  it('acceptances: everyone adds only their own', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      await db.as(b.b1).rpc('accept_request', { p_request: id });
      await expectHint(db.as(b.x).rpc('accept_request', { p_request: id }), 'NOT_AUTHORIZED');
      await expectCode(
        db.as(b.b1).q(`update public.request_players set accepted_at = now() where request_id = $1 and user_id = $2`, [id, b.b2]),
        '42501',
      );
      expect(await acceptances(db, id)).toEqual({ [b.a1]: true, [b.a2]: false, [b.b1]: true, [b.b2]: false });
    }));

  it('acceptances computed from the windows: a 3/4 request is allowed', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.q(
        `insert into public.availability (tournament_id, user_id, windows) values
           ($1, $2, '{"2099-11-14": ["14:00-19:30"]}'), ($1, $3, '{"2099-11-14": ["17:00-24:00", "bad"]}'),
           ($1, $4, '{"2099-11-14": ["14:00-17:00"]}')`,
        [b.T, b.a2, b.b1, b.b2],
      );
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      expect(await acceptances(db, id)).toEqual({ [b.a1]: true, [b.a2]: true, [b.b1]: true, [b.b2]: false });
      await expectHint(db.as(b.mgr).rpc('confirm_request', { p_request: id }), 'NOT_ALL_ACCEPTED');
      await db.as(b.b2).rpc('accept_request', { p_request: id });
      expect(await db.as(b.mgr).rpc('confirm_request', { p_request: id })).toEqual({ outcome: 'ok', conflicts: 0 });
    }));

  it('confirmation only by the manager, with 4 acceptances and the booking written', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await acceptedRequest(db, b);
      await expectHint(db.as(b.a1).rpc('confirm_request', { p_request: id }), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.org).rpc('confirm_request', { p_request: id }), 'NOT_AUTHORIZED');
      expect(await db.as(b.mgr).rpc('confirm_request', { p_request: id })).toEqual({ outcome: 'ok', conflicts: 0 });
      expect(await request(db, id)).toMatchObject({ status: 'confirmed', handled_by: b.mgr });
      expect(await db.one('select type, match_id, start_time, end_time from public.bookings where request_id = $1', [id])).toEqual({
        type: 'match',
        match_id: b.P,
        start_time: '18:00:00',
        end_time: '19:30:00',
      });
      expect(
        await db.as('anon').rows('select status, sched_court_id, sched_start, players from public.matches_v where id = $1', [b.P]),
      ).toEqual([{ status: 'scheduled', sched_court_id: 'c1', sched_start: '18:00:00', players: [b.a1, b.a2, b.b1, b.b2] }]);
      await expectHint(db.as(b.mgr).rpc('confirm_request', { p_request: id }), 'BAD_STATE');
    }));

  it('confirmation blocked while acceptances are missing', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      await expectHint(db.as(b.mgr).rpc('confirm_request', { p_request: id }), 'NOT_ALL_ACCEPTED');
      expect(await db.val('select count(*)::int from public.bookings')).toBe(0);
    }));

  it('a player cancels the request and the match goes back to unscheduled', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await acceptedRequest(db, b);
      await expectHint(db.as(b.x).rpc('cancel_request', { p_request: id }), 'NOT_AUTHORIZED');
      await db.as(b.b2).rpc('cancel_request', { p_request: id, p_note: 'x' });
      expect(await request(db, id)).toMatchObject({ status: 'cancelled', note: 'x' });
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled', request_id: null });
      // the freed slot can be requested again
      await db.as(b.a2).rpc('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
    }));

  it('the manager rejects', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await acceptedRequest(db, b);
      await expectHint(db.as(b.a1).rpc('reject_request', { p_request: id }), 'NOT_AUTHORIZED');
      await db.as(b.mgr).rpc('reject_request', { p_request: id, p_note: 'no' });
      expect(await request(db, id)).toMatchObject({ status: 'rejected', note: 'no', handled_by: b.mgr });
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled', request_id: null });
    }));

  it('counter-proposal by the manager: closes the old request and creates a new one', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await acceptedRequest(db, b);
      await expectHint(
        db.as(b.a1).rpc('counter_propose', { p_request: id, p_court: 'c2', p_date: DATE, p_start: '18:30' }),
        'NOT_AUTHORIZED',
      );
      const fresh = await db.as(b.mgr).rpc<string>('counter_propose', { p_request: id, p_court: 'c2', p_date: DATE, p_start: '18:30' });
      expect(await request(db, id)).toMatchObject({ status: 'rejected', handled_by: b.mgr });
      expect(await request(db, fresh)).toMatchObject({
        status: 'pending',
        counter_proposal: true,
        court_id: 'c2',
        end_time: '20:00:00',
        created_by: b.mgr,
      });
      expect(await match(db, b.P)).toMatchObject({ status: 'requested', request_id: fresh });
      // nobody accepted yet (the manager is not a player of the match)
      expect(Object.values(await acceptances(db, fresh))).toEqual([false, false, false, false]);
      await expectHint(db.as(b.a1).rpc('confirm_request', { p_request: fresh }), 'NOT_AUTHORIZED');
    }));

  it('an expired request can be overwritten (lazy expiry)', () =>
    tx(async (db) => {
      const b = await base(db);
      const old = await db.val<string>(
        `insert into public.requests (tournament_id, match_id, court_id, date, start_time, end_time, status, expires_at, created_by)
         values ($1, $2, 'c1', $3, '18:00', '19:30', 'pending', now() - interval '1 second', $4) returning id`,
        [b.T, b.P2, DATE, b.b1],
      );
      await db.q(`update public.matches set status = 'requested', request_id = $2 where id = $1`, [b.P2, old]);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      expect(await request(db, old)).toMatchObject({ status: 'expired' });
      expect(await match(db, b.P2)).toMatchObject({ status: 'unscheduled', request_id: null });
      expect(await request(db, id)).toMatchObject({ status: 'pending' });
      // accept on an expired request
      await db.q(`update public.requests set expires_at = now() - interval '1 second' where id = $1`, [id]);
      await expectHint(db.as(b.b1).rpc('accept_request', { p_request: id }), 'EXPIRED');
      // confirm on an expired request: outcome expired, no error
      expect(await db.as(b.mgr).rpc('confirm_request', { p_request: id })).toEqual({ outcome: 'expired', conflicts: 0 });
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled' });
    }));

  it('user with several roles (manager + player)', () =>
    tx(async (db) => {
      const b = await base(db);
      // the manager plays in team A instead of a2
      await db.q(`update public.team_players set user_id = $2 where team_id = $1 and user_id = $3`, [b.teamA, b.mgr, b.a2]);
      const id = await db.as(b.mgr).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      for (const u of [b.a1, b.b1, b.b2]) await db.as(u).rpc('accept_request', { p_request: id });
      expect(await db.as(b.mgr).rpc('confirm_request', { p_request: id })).toMatchObject({ outcome: 'ok' });
      // still not an organizer
      await expectHint(db.as(b.mgr).rpc('clear_result', { p_match: b.P }), 'NOT_AUTHORIZED');
      expect(await db.as(b.mgr).rows('select 1 from public.audit_log')).not.toEqual([]);
    }));
});

describe('results', () => {
  const sets = [
    { a: 6, b: 4 },
    { a: 6, b: 3 },
  ];

  it('entered by a player, confirmed only by the opponents', () =>
    tx(async (db) => {
      const b = await base(db);
      await expectHint(db.as(b.x).rpc('submit_result', { p_match: b.P, p_sets: sets }), 'NOT_AUTHORIZED');
      await db.as(b.a1).rpc('submit_result', { p_match: b.P, p_sets: sets });
      // the same pair may overwrite before confirmation
      await db.as(b.a2).rpc('submit_result', { p_match: b.P, p_sets: sets });
      // the opponent does not overwrite: confirm or contest
      await expectHint(
        db.as(b.b1).rpc('submit_result', { p_match: b.P, p_sets: [{ a: 4, b: 6 }, { a: 3, b: 6 }] }),
        'NOT_AUTHORIZED',
      );
      await expectHint(db.as(b.a1).rpc('confirm_result', { p_match: b.P }), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.x).rpc('confirm_result', { p_match: b.P }), 'NOT_AUTHORIZED');
      await db.as(b.b1).rpc('confirm_result', { p_match: b.P });
      expect(await match(db, b.P)).toMatchObject({ status: 'played', entered_by: b.a2, confirmed_by: b.b1, sets });
      // after confirmation only the organizer changes it
      await expectHint(db.as(b.a1).rpc('submit_result', { p_match: b.P, p_sets: sets }), 'ALREADY_CONFIRMED');
      await expectHint(db.as(b.b2).rpc('confirm_result', { p_match: b.P }), 'ALREADY_CONFIRMED');
      await expectHint(db.as(b.a1).rpc('clear_result', { p_match: b.P }), 'NOT_AUTHORIZED');
      await db.as(b.org).rpc('clear_result', { p_match: b.P });
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled', sets: null, entered_by: null });
    }));

  it('contested by the opponents', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.as(b.a1).rpc('submit_result', { p_match: b.P, p_sets: sets });
      await expectHint(db.as(b.a2).rpc('contest_result', { p_match: b.P, p_note: 'no' }), 'NOT_AUTHORIZED');
      await db.as(b.b2).rpc('contest_result', { p_match: b.P, p_note: 'no' });
      expect(await match(db, b.P)).toMatchObject({ status: 'disputed', disputed_by: b.b2, result_note: 'no' });
      await expectHint(db.as(b.a1).rpc('submit_result', { p_match: b.P, p_sets: sets }), 'BAD_STATE');
      // the organizer decides
      await db.as(b.org).rpc('set_official_result', { p_match: b.P, p_sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 10, b: 8 }] });
      expect(await match(db, b.P)).toMatchObject({ status: 'played', confirmed_by: b.org });
    }));

  it('invalid score, forfeit and result on a scheduled match', () =>
    tx(async (db) => {
      const b = await base(db);
      await expectHint(db.as(b.a1).rpc('submit_result', { p_match: b.P, p_sets: [{ a: 6, b: 5 }, { a: 6, b: 3 }] }), 'INVALID_SCORE');
      const id = await acceptedRequest(db, b);
      await db.as(b.mgr).rpc('confirm_request', { p_request: id });
      await db.as(b.a1).rpc('submit_result', { p_match: b.P, p_sets: sets });
      await db.as(b.b1).rpc('confirm_result', { p_match: b.P });
      expect(await match(db, b.P)).toMatchObject({ status: 'played', request_id: id });
      // a played match cannot be cancelled
      await expectHint(db.as(b.mgr).rpc('cancel_confirmed', { p_request: id }), 'BAD_STATE');
      await db.as(b.org).rpc('clear_result', { p_match: b.P });
      expect(await match(db, b.P)).toMatchObject({ status: 'scheduled', request_id: id });
      await expectHint(db.as(b.a1).rpc('assign_forfeit', { p_match: b.P, p_winner: 'B' }), 'NOT_AUTHORIZED');
      await db.as(b.org).rpc('assign_forfeit', { p_match: b.P, p_winner: 'B' });
      expect(await match(db, b.P)).toMatchObject({ status: 'forfeit', sets: [{ a: 0, b: 6 }, { a: 0, b: 6 }] });
    }));

  it('confirm_result cancels the request still pending', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      await db.as(b.a1).rpc('submit_result', { p_match: b.P, p_sets: sets });
      await db.as(b.b1).rpc('confirm_result', { p_match: b.P });
      expect(await request(db, id)).toMatchObject({ status: 'cancelled' });
      expect(await match(db, b.P)).toMatchObject({ status: 'played', request_id: null });
      // the slot is free again
      await db.as(b.a1).rpc('create_request', { p_match: b.P2, p_court: 'c1', p_date: DATE, p_start: '18:00' });
    }));
});

describe('availability and bookings', () => {
  it('availability: only the owner writes', () =>
    tx(async (db) => {
      const b = await base(db);
      const windows = JSON.stringify({ '2099-11-14': ['14:00-19:00'] });
      await db.as(b.a1).q(`insert into public.availability (tournament_id, windows) values ($1, $2)`, [b.T, windows]);
      // PostgREST-style upsert
      await db
        .as(b.a1)
        .q(
          `insert into public.availability (tournament_id, user_id, windows) values ($1, $2, $3)
           on conflict (tournament_id, user_id) do update set windows = excluded.windows`,
          [b.T, b.a1, JSON.stringify({ '2099-11-15': ['10:00-12:00'] })],
        );
      await expectCode(
        db.as(b.a2).q(`insert into public.availability (tournament_id, user_id, windows) values ($1, $2, '{}')`, [b.T, b.a1]),
        '42501',
      );
      expect((await db.as(b.a2).q(`update public.availability set windows = '{}' where user_id = $1`, [b.a1])).rowCount).toBe(0);
      expect((await db.as(b.a2).q(`delete from public.availability where user_id = $1`, [b.a1])).rowCount).toBe(0);
      expect(await db.as(b.b1).rows('select windows from public.availability where user_id = $1', [b.a1])).toEqual([
        { windows: { '2099-11-15': ['10:00-12:00'] } },
      ]);
    }));

  it('bookings and courts: manager and admin only', () =>
    tx(async (db) => {
      const b = await base(db);
      const booking = { p_court: 'c1', p_date: DATE, p_start: '10:00', p_end: '11:00', p_type: 'lesson' };
      await expectHint(db.as(b.a1).rpc('add_occupation', booking), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.org).rpc('add_occupation', booking), 'NOT_AUTHORIZED');
      const { id } = await db.as(b.mgr).rpc('add_occupation', booking);
      await expectHint(
        db.as(b.mgr).rpc('add_occupation', { ...booking, p_type: 'match', p_start: '12:00', p_end: '13:00' }),
        'BAD_STATE',
      );
      await db.as(b.admin).rpc('add_occupation', { ...booking, p_start: '11:00', p_end: '12:00' });
      await expectCode(
        db
          .as(b.mgr)
          .q(`insert into public.bookings (court_id, date, start_time, end_time, type) values ('c1', $1, '08:00', '09:00', 'external')`, [DATE]),
        '42501',
      );
      await expectHint(db.as(b.a1).rpc('remove_occupation', { p_id: id }), 'NOT_AUTHORIZED');
      await db.as(b.mgr).rpc('remove_occupation', { p_id: id });

      const court = `insert into public.courts (id, name, first_slot, last_slot, slot_minutes) values ($1, 'C', '09:00', '20:00', 90)`;
      await expectCode(db.as(b.org).q(court, ['c9']), '42501');
      await expectCode(db.as(b.a1).q(court, ['c9']), '42501');
      await db.as(b.admin).q(court, ['c9']);
      await db.as(b.mgr).q(court, ['c8']);
      expect((await db.as(b.org).q(`update public.courts set name = 'x' where id = 'c9'`)).rowCount).toBe(0);
      // recurrences: manager only
      const rec = `insert into public.recurrences (court_id, weekday, start_time, end_time, valid_from, valid_to) values ('c1', 1, '10:00', '11:00', '2099-01-01', '2099-12-31')`;
      await expectCode(db.as(b.a1).q(rec), '42501');
      await db.as(b.mgr).q(rec);
    }));
});
