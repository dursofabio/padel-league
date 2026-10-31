/**
 * Helpers for the database tests (`npm run test:db`).
 *
 * Every test runs inside BEGIN … ROLLBACK on its own connection. Fixtures are
 * written as the superuser; `db.as(user)` runs statements as `authenticated`
 * (or `anon` / `service_role`) with the JWT claims PostgREST would set.
 */
import pg from 'pg';
import { afterAll } from 'vitest';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL missing: use `npm run test:db`');

// dates stay 'YYYY-MM-DD' strings, as PostgREST returns them
pg.types.setTypeParser(1082, (v: string) => v);

export const pool = new pg.Pool({ connectionString: url, max: 6 });
afterAll(async () => {
  await pool.end();
});

export type Row = Record<string, any>;

export interface PgErr {
  code?: string;
  hint?: string;
  message: string;
}

export type Who = string | 'anon' | 'service_role';

let sp = 0;

export class Db {
  constructor(readonly client: pg.PoolClient) {}

  /** Query as the superuser (fixtures, checks). */
  async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    const name = `sp${++sp}`;
    await this.client.query(`savepoint ${name}`);
    try {
      const r = await this.client.query(sql, params);
      await this.client.query(`release savepoint ${name}`);
      return r.rows;
    } catch (e) {
      await this.client.query(`rollback to savepoint ${name}`);
      await this.client.query(`release savepoint ${name}`);
      throw e;
    }
  }

  async one(sql: string, params: unknown[] = []): Promise<Row> {
    const rows = await this.q(sql, params);
    if (rows.length !== 1) throw new Error(`expected 1 row, got ${rows.length}: ${sql}`);
    return rows[0];
  }

  async val<T = any>(sql: string, params: unknown[] = []): Promise<T> {
    const r = await this.one(sql, params);
    return Object.values(r)[0] as T;
  }

  /** Acts as a user id (authenticated), 'anon' or 'service_role'. */
  as(who: Who): Actor {
    return new Actor(this, who);
  }
}

export class Actor {
  constructor(
    private readonly db: Db,
    readonly who: Who,
  ) {}

  private async enter() {
    const c = this.db.client;
    if (this.who === 'anon') {
      await c.query('set local role anon');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
    } else if (this.who === 'service_role') {
      await c.query('set local role service_role');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
    } else {
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: this.who, role: 'authenticated', aud: 'authenticated' }),
      ]);
    }
  }

  private async leave() {
    await this.db.client.query('reset role');
    await this.db.client.query(`select set_config('request.jwt.claims', '', true)`);
  }

  /** Runs a statement as this actor; errors are re-thrown (the transaction stays usable). */
  async q(sql: string, params: unknown[] = []): Promise<pg.QueryResult> {
    const c = this.db.client;
    const name = `sp${++sp}`;
    await c.query(`savepoint ${name}`);
    await this.enter();
    try {
      const r = await c.query(sql, params);
      await this.leave();
      await c.query(`release savepoint ${name}`);
      return r;
    } catch (e) {
      // rolling back to the savepoint also undoes `set local role`
      await c.query(`rollback to savepoint ${name}`);
      await c.query(`release savepoint ${name}`);
      throw e;
    }
  }

  async rows(sql: string, params: unknown[] = []): Promise<Row[]> {
    return (await this.q(sql, params)).rows;
  }

  /** Calls an RPC with named arguments: rpc('create_request', { p_match: id, … }). */
  async rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const keys = Object.keys(args);
    const list = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    const vals = keys.map((k) => {
      const v = args[k];
      return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : Array.isArray(v) && typeof v[0] === 'object' ? JSON.stringify(v) : v;
    });
    const r = await this.q(`select public.${fn}(${list}) as r`, vals);
    return r.rows[0].r as T;
  }

  /** Expects the statement/RPC to fail; returns the error. */
  async fails(p: () => Promise<unknown>): Promise<PgErr> {
    try {
      await p();
    } catch (e) {
      return e as PgErr;
    }
    throw new Error(`expected an error for ${this.who}`);
  }
}

/** Runs `fn` in a transaction that is always rolled back. */
export async function tx(fn: (db: Db) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await fn(new Db(client));
  } finally {
    await client.query('rollback').catch(() => {});
    client.release();
  }
}

/** Expects a P0001 contract error with the given hint. */
export async function expectHint(p: Promise<unknown>, hint: string): Promise<PgErr> {
  let err: PgErr | undefined;
  try {
    await p;
  } catch (e) {
    err = e as PgErr;
  }
  if (!err) throw new Error(`expected error ${hint}, got none`);
  if (err.code !== 'P0001' || err.hint !== hint)
    throw new Error(`expected ${hint}, got ${err.code}/${err.hint}: ${err.message}`);
  return err;
}

/** Expects a Postgres error with the given SQLSTATE (42501, 23P01, …). */
export async function expectCode(p: Promise<unknown>, code: string): Promise<PgErr> {
  let err: PgErr | undefined;
  try {
    await p;
  } catch (e) {
    err = e as PgErr;
  }
  if (!err) throw new Error(`expected error ${code}, got none`);
  if (err.code !== code) throw new Error(`expected ${code}, got ${err.code}: ${err.message}`);
  return err;
}

// ------------------------------------------------------------------ fixtures

export const DATE = '2099-11-14';

export async function createUser(db: Db, name: string, roles: string[] = ['player']): Promise<string> {
  const id = await db.val<string>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id`,
    [`${name}@x.it`, name],
  );
  if (roles.join() !== 'player') await db.q('update public.profiles set roles = $2 where id = $1', [id, roles]);
  return id;
}

export interface Base {
  admin: string;
  org: string;
  mgr: string;
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  x: string;
  T: string;
  teamA: string;
  teamB: string;
  P: string;
  /** a second group match between the same teams */
  P2: string;
  period: string;
}

/**
 * Same world as the old tests/rules.test.ts: admin, org, mgr (court manager), players a1 a2 (team A),
 * b1 b2 (team B), outsider x; tournament T in "groups" with off-grid disabled; match P.
 */
export async function base(db: Db, config: Record<string, unknown> = { allowOffGrid: false }): Promise<Base> {
  const admin = await createUser(db, 'admin', ['admin', 'player']);
  const org = await createUser(db, 'org', ['organizer', 'player']);
  const mgr = await createUser(db, 'mgr', ['manager', 'player']);
  const a1 = await createUser(db, 'a1');
  const a2 = await createUser(db, 'a2');
  const b1 = await createUser(db, 'b1');
  const b2 = await createUser(db, 'b2');
  const x = await createUser(db, 'x');
  const T = await db.val<string>(
    `insert into public.tournaments (name, status, config) values ('T', 'groups', private.config_default() || $1::jsonb) returning id`,
    [JSON.stringify(config)],
  );
  const period = await db.val<string>(
    `insert into public.periods (tournament_id, starts_on, ends_on, label) values ($1, '2099-11-01', '2099-11-30', 'P1') returning id`,
    [T],
  );
  const team = async (name: string, p1: string, p2: string) => {
    const t = await db.val<string>(
      `insert into public.teams (tournament_id, name, group_name, status, created_by) values ($1, $2, 'A', 'approved', $3) returning id`,
      [T, name, p1],
    );
    await db.q(
      `insert into public.team_players (team_id, tournament_id, user_id, position) values ($1, $2, $3, 1), ($1, $2, $4, 2)`,
      [t, T, p1, p2],
    );
    return t;
  };
  const teamA = await team('teamA', a1, a2);
  const teamB = await team('teamB', b1, b2);
  const groupMatch = (code: string) =>
    db.val<string>(
      `insert into public.matches (tournament_id, code, phase, group_name, round, team_a, team_b, period_id)
       values ($1, $2, 'groups', 'A', 1, $3, $4, $5) returning id`,
      [T, code, teamA, teamB, period],
    );
  const P = await groupMatch('gA-01-1');
  const P2 = await groupMatch('gA-02-1');
  return { admin, org, mgr, a1, a2, b1, b2, x, T, teamA, teamB, P, P2, period };
}

/** Availability windows for some players on a day. */
export async function setWindows(db: Db, T: string, users: string[], date: string, ...windows: string[]) {
  for (const u of users)
    await db.q(
      `insert into public.availability (tournament_id, user_id, windows) values ($1, $2, jsonb_build_object($3::text, $4::jsonb))
       on conflict (tournament_id, user_id) do update set windows = excluded.windows`,
      [T, u, date, JSON.stringify(windows)],
    );
}

export async function request(db: Db, id: string): Promise<Row> {
  return db.one('select * from public.requests where id = $1', [id]);
}

export async function match(db: Db, id: string): Promise<Row> {
  return db.one('select * from public.matches where id = $1', [id]);
}

export async function acceptances(db: Db, requestId: string): Promise<Record<string, boolean>> {
  const rows = await db.q('select user_id, accepted_at is not null as ok from public.request_players where request_id = $1', [
    requestId,
  ]);
  return Object.fromEntries(rows.map((r) => [r.user_id, r.ok]));
}

/** Creates a request (as a1) and has all 4 players accept it. */
export async function acceptedRequest(
  db: Db,
  b: Base,
  opts: { match?: string; court?: string; date?: string; start?: string } = {},
): Promise<string> {
  const id = await db.as(b.a1).rpc<string>('create_request', {
    p_match: opts.match ?? b.P,
    p_court: opts.court ?? 'c1',
    p_date: opts.date ?? DATE,
    p_start: opts.start ?? '18:00',
  });
  for (const u of [b.a2, b.b1, b.b2]) await db.as(u).rpc('accept_request', { p_request: id });
  return id;
}
