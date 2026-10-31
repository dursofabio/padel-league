/**
 * Court timeline: EXCLUDE, confirmations vs overlaps, bookings, close_day,
 * recurrences, player cancellation of a confirmed match.
 */
import { describe, expect, it } from 'vitest';
import { acceptedRequest, base, DATE, expectCode, expectHint, match, pool, request, setWindows, tx } from './helpers';

describe('EXCLUDE on bookings', () => {
  it('adjacent intervals ok, overlapping ones rejected (23P01)', () =>
    tx(async (db) => {
      const ins = (start: string, end: string, court = 'c1') =>
        db.q(`insert into public.bookings (court_id, date, start_time, end_time, type) values ($1, $2, $3, $4, 'external')`, [
          court,
          DATE,
          start,
          end,
        ]);
      await ins('16:00', '17:00');
      await ins('17:00', '18:00');
      await ins('15:00', '16:00');
      await ins('16:30', '17:30', 'c2');
      await expectCode(ins('16:30', '17:30'), '23P01');
      // up to midnight
      await ins('22:00', '24:00');
      await expectCode(ins('23:00', '23:30'), '23P01');
    }));
});

describe('overlapping confirmations', () => {
  it('two overlapping requests: one confirmed, the other in conflict', () =>
    tx(async (db) => {
      const b = await base(db, { allowOffGrid: true, offGridStep: 30 });
      await setWindows(db, b.T, [b.a1, b.a2, b.b1, b.b2], DATE, '00:00-24:00');
      // grid 18:00–19:30 and off-grid 18:30–20:00 can both be pending
      const r1 = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      const r2 = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P2, p_court: 'c1', p_date: DATE, p_start: '18:30' });
      expect(await db.as(b.mgr).rpc('confirm_request', { p_request: r1 })).toEqual({ outcome: 'ok', conflicts: 1 });
      expect(await request(db, r2)).toMatchObject({ status: 'conflict', handled_by: b.mgr });
      expect(await match(db, b.P2)).toMatchObject({ status: 'unscheduled', request_id: null });
      // a late second confirmation does not raise
      expect(await db.as(b.mgr).rpc('confirm_request', { p_request: r2 })).toEqual({ outcome: 'taken', conflicts: 0 });
      expect(await db.val(`select count(*)::int from public.bookings where court_id = 'c1'`)).toBe(1);
    }));

  it('a booking appeared meanwhile: outcome taken and request in conflict', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await acceptedRequest(db, b);
      // written behind the RPCs' back, so the request is still 'pending'
      await db.q(
        `insert into public.bookings (court_id, date, start_time, end_time, type) values ('c1', $1, '19:00', '20:00', 'external')`,
        [DATE],
      );
      expect(await db.as(b.mgr).rpc('confirm_request', { p_request: id })).toEqual({ outcome: 'taken', conflicts: 0 });
      expect(await request(db, id)).toMatchObject({ status: 'conflict' });
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled', request_id: null });
    }));

  it('concurrent confirmations from two connections', async () => {
    // committed fixtures (two connections must see them), removed at the end
    const setup = await pool.connect();
    let b: Awaited<ReturnType<typeof base>> | undefined;
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      await setup.query('begin');
      const { Db } = await import('./helpers');
      const db = new Db(setup);
      b = await base(db, { allowOffGrid: true, offGridStep: 30 });
      await setWindows(db, b.T, [b.a1, b.a2, b.b1, b.b2], DATE, '00:00-24:00');
      const r1 = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      const r2 = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P2, p_court: 'c1', p_date: DATE, p_start: '18:30' });
      await setup.query('commit');

      const confirm = async (c: typeof c1, id: string) => {
        await c.query('begin');
        await c.query('set local role authenticated');
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: b!.mgr, role: 'authenticated' })]);
        return (await c.query('select public.confirm_request($1) as r', [id])).rows[0].r;
      };
      // c1 holds the court/day lock until it commits; c2 waits for it
      const e1 = await confirm(c1, r1);
      const p2 = confirm(c2, r2);
      await new Promise((r) => setTimeout(r, 300));
      const waiting = await setup.query(
        `select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query like '%confirm_request%'`,
      );
      expect(waiting.rows[0].n).toBe(1);
      await c1.query('commit');
      const e2 = await p2;
      await c2.query('commit');
      expect(e1).toEqual({ outcome: 'ok', conflicts: 1 });
      expect(e2).toEqual({ outcome: 'taken', conflicts: 0 });
      const statuses = await setup.query(
        'select status, count(*)::int as n from public.requests where tournament_id = $1 group by status order by status',
        [b.T],
      );
      expect(statuses.rows).toEqual([
        { status: 'confirmed', n: 1 },
        { status: 'conflict', n: 1 },
      ]);
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      await setup.query('rollback').catch(() => {});
      if (b) {
        const users = [b.admin, b.org, b.mgr, b.a1, b.a2, b.b1, b.b2, b.x];
        await setup.query('delete from public.tournaments where id = $1', [b.T]);
        await setup.query('delete from public.audit_log where actor_id = any($1::uuid[]) or actor_id is null', [users]);
        await setup.query('delete from auth.users where id = any($1::uuid[])', [users]);
      }
      c1.release();
      c2.release();
      setup.release();
    }
  });
});

describe('bookings', () => {
  it('overlapping add_occupation: OVERLAP; over a pending request: conflict', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      const res = await db.as(b.mgr).rpc('add_occupation', {
        p_court: 'c1',
        p_date: DATE,
        p_start: '19:00',
        p_end: '20:00',
        p_type: 'lesson',
        p_note: 'Scuola',
      });
      expect(res.conflicts).toBe(1);
      expect(await request(db, id)).toMatchObject({ status: 'conflict' });
      // the note is user-facing: it names the booking type in Italian
      expect((await request(db, id)).note).toContain('lezione');
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled', request_id: null });
      const err = await expectHint(
        db.as(b.mgr).rpc('add_occupation', { p_court: 'c1', p_date: DATE, p_start: '19:30', p_end: '21:00', p_type: 'external' }),
        'OVERLAP',
      );
      expect(err.message).toContain('Scuola');
      // and requests cannot be made over a booking
      await expectHint(
        db.as(b.a1).rpc('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' }),
        'OVERLAP',
      );
      // the match booking can only be cancelled from the request
      const r = await acceptedRequest(db, b, { start: '16:30' });
      await db.as(b.mgr).rpc('confirm_request', { p_request: r });
      const bookingId = await db.val<string>('select id from public.bookings where request_id = $1', [r]);
      await expectHint(db.as(b.mgr).rpc('remove_occupation', { p_id: bookingId }), 'BAD_STATE');
    }));

  it('close_day: closes every court and reports errors and conflicts', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
      await db
        .as(b.mgr)
        .rpc('add_occupation', { p_court: 'c2', p_date: DATE, p_start: '10:00', p_end: '11:00', p_type: 'lesson' });
      await expectHint(db.as(b.a1).rpc('close_day', { p_date: DATE, p_note: 'Torneo sociale' }), 'NOT_AUTHORIZED');
      const res = await db.as(b.mgr).rpc('close_day', { p_date: DATE, p_note: 'Torneo sociale' });
      expect(res.conflicts).toBe(1);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toMatch(/^Campo 2: /);
      expect(await db.q(`select court_id, start_time, end_time from public.bookings where type = 'closure'`)).toEqual([
        { court_id: 'c1', start_time: '00:00:00', end_time: '24:00:00' },
      ]);
      expect(await request(db, id)).toMatchObject({ status: 'conflict' });
    }));

  it('materialize_recurrence is idempotent and skips busy days', () =>
    tx(async (db) => {
      const b = await base(db);
      const dow = await db.val<number>(`select extract(dow from private.today() + 3)::int`);
      const rec = await db.val<string>(
        `insert into public.recurrences (court_id, weekday, start_time, end_time, type, note, valid_from, valid_to)
         values ('c1', $1, '10:00', '11:00', 'lesson', 'Corso', private.today(), private.today() + 20) returning id`,
        [dow],
      );
      // one of the three days is already busy
      await db.q(
        `insert into public.bookings (court_id, date, start_time, end_time, type) values ('c1', private.today() + 10, '10:30', '12:00', 'external')`,
      );
      await expectHint(db.as(b.a1).rpc('materialize_recurrence', { p_recurrence: rec, p_days: 30 }), 'NOT_AUTHORIZED');
      const r1 = await db.as(b.mgr).rpc('materialize_recurrence', { p_recurrence: rec, p_days: 30 });
      expect(r1.created).toBe(2);
      expect(r1.skipped).toHaveLength(1);
      const r2 = await db.as(b.mgr).rpc('materialize_recurrence', { p_recurrence: rec, p_days: 30 });
      expect(r2.created).toBe(0);
      expect(await db.val(`select count(*)::int from public.bookings where recurrence_id = $1`, [rec])).toBe(2);
      // the hourly job is idempotent too
      expect(await db.val('select private.job_recurrences(28)')).toBe(0);
    }));
});

describe('cancelling a confirmed match', () => {
  it('the manager cancels: court free, match unscheduled', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await acceptedRequest(db, b);
      await db.as(b.mgr).rpc('confirm_request', { p_request: id });
      await expectHint(db.as(b.a1).rpc('cancel_confirmed', { p_request: id }), 'NOT_AUTHORIZED');
      await db.as(b.mgr).rpc('cancel_confirmed', { p_request: id, p_note: 'pioggia' });
      expect(await request(db, id)).toMatchObject({ status: 'cancelled', note: 'pioggia' });
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled', request_id: null });
      expect(await db.val('select count(*)::int from public.bookings')).toBe(0);
    }));

  it('a player cancels in time; the manager sees it in the audit log', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await acceptedRequest(db, b);
      await db.as(b.mgr).rpc('confirm_request', { p_request: id });
      await expectHint(db.as(b.x).rpc('player_cancel_confirmed', { p_request: id }), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.mgr).rpc('player_cancel_confirmed', { p_request: id }), 'NOT_AUTHORIZED');
      await db.as(b.b2).rpc('player_cancel_confirmed', { p_request: id, p_note: 'infortunio' });
      expect(await request(db, id)).toMatchObject({ status: 'cancelled', note: 'infortunio', handled_by: b.b2 });
      expect(await match(db, b.P)).toMatchObject({ status: 'unscheduled', request_id: null });
      expect(await db.val('select count(*)::int from public.bookings')).toBe(0);
      const log = await db.as(b.mgr).rows('select actor_id, action from public.audit_log where target = $1', [id]);
      expect(
        log.some((l) => l.actor_id === b.b2 && l.action.includes('player cancels') && l.action.includes('infortunio')),
      ).toBe(true);
      expect(await db.as(b.a1).rows('select 1 from public.audit_log')).toEqual([]);
      await expectHint(db.as(b.b2).rpc('player_cancel_confirmed', { p_request: id }), 'BAD_STATE');
      // the slot is bookable again
      await db.as(b.a1).rpc('create_request', { p_match: b.P, p_court: 'c1', p_date: DATE, p_start: '18:00' });
    }));

  it('too late: TOO_LATE within playerCancelHours (default 24)', () =>
    tx(async (db) => {
      const b = await base(db);
      // confirmed match starting in ~3 hours (Europe/Rome wall clock), written as a fixture
      const { date, start_time: start, end_time: end } = await db.one(
        `select t::date as date, t::time as start_time,
                case when t::time >= '23:00' then '24:00'::time else (t + interval '30 minutes')::time end as end_time
         from (select date_trunc('minute', private.local_now() + interval '3 hours') as t) x`,
      );
      const id = await db.val<string>(
        `insert into public.requests (tournament_id, match_id, court_id, date, start_time, end_time, status, expires_at, created_by)
         values ($1, $2, 'c1', $3, $4, $5, 'confirmed', now() + interval '1 day', $6) returning id`,
        [b.T, b.P, date, start, end, b.a1],
      );
      await db.q(
        `insert into public.bookings (court_id, date, start_time, end_time, type, match_id, request_id, tournament_id)
         values ('c1', $1, $2, $3, 'match', $4, $5, $6)`,
        [date, start, end, b.P, id, b.T],
      );
      await db.q(`update public.matches set status = 'scheduled', request_id = $2 where id = $1`, [b.P, id]);
      const hours = await db.val<number>(
        `select extract(epoch from (($1::date + $2::time) at time zone 'Europe/Rome') - now()) / 3600`,
        [date, start],
      );
      expect(Number(hours)).toBeLessThan(24);
      await expectHint(db.as(b.a1).rpc('player_cancel_confirmed', { p_request: id }), 'TOO_LATE');
      expect(await request(db, id)).toMatchObject({ status: 'confirmed' });
      // the organizer shortens the window: now it is in time
      await db.q(`update public.tournaments set config = config || '{"playerCancelHours": 1}' where id = $1`, [b.T]);
      await db.as(b.a1).rpc('player_cancel_confirmed', { p_request: id });
      expect(await request(db, id)).toMatchObject({ status: 'cancelled' });
      // without the key the default (24) applies
      expect(await db.val(`select private.config_default() ->> 'playerCancelHours'`)).toBe('24');
    }));
});
