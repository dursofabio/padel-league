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
if (!url) throw new Error('DATABASE_URL mancante: usa `npm run test:db`');

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
    return (await this.client.query(sql, params)).rows;
  }

  async one(sql: string, params: unknown[] = []): Promise<Row> {
    const rows = await this.q(sql, params);
    if (rows.length !== 1) throw new Error(`attesa 1 riga, trovate ${rows.length}: ${sql}`);
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

  /** Calls an RPC with named arguments: rpc('create_request', { p_partita: id, … }). */
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
    throw new Error(`atteso un errore per ${this.who}`);
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
  if (!err) throw new Error(`atteso errore ${hint}, nessun errore`);
  if (err.code !== 'P0001' || err.hint !== hint)
    throw new Error(`atteso ${hint}, ottenuto ${err.code}/${err.hint}: ${err.message}`);
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
  if (!err) throw new Error(`atteso errore ${code}, nessun errore`);
  if (err.code !== code) throw new Error(`atteso ${code}, ottenuto ${err.code}: ${err.message}`);
  return err;
}

// ------------------------------------------------------------------ fixtures

export const DATA = '2099-11-14';

export async function creaUtente(db: Db, nome: string, roles: string[] = ['giocatore']): Promise<string> {
  const id = await db.val<string>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id`,
    [`${nome}@x.it`, nome],
  );
  if (roles.join() !== 'giocatore') await db.q('update public.profiles set roles = $2 where id = $1', [id, roles]);
  return id;
}

export interface Base {
  admin: string;
  org: string;
  gest: string;
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  x: string;
  T: string;
  sA: string;
  sB: string;
  P: string;
  /** a second group match between the same teams */
  P2: string;
  periodo: string;
}

/**
 * Same world as the old tests/rules.test.ts: admin, org, gest, players a1 a2 (team A),
 * b1 b2 (team B), outsider x; tournament T in "gironi" with off-grid disabled; match P.
 */
export async function base(db: Db, config: Record<string, unknown> = { consentiFuoriGriglia: false }): Promise<Base> {
  const admin = await creaUtente(db, 'admin', ['admin', 'giocatore']);
  const org = await creaUtente(db, 'org', ['organizzatore', 'giocatore']);
  const gest = await creaUtente(db, 'gest', ['gestore', 'giocatore']);
  const [a1, a2, b1, b2, x] = await Promise.all(['a1', 'a2', 'b1', 'b2', 'x'].map((n) => creaUtente(db, n)));
  const T = await db.val<string>(
    `insert into public.tornei (nome, stato, config) values ('T', 'gironi', private.config_default() || $1::jsonb) returning id`,
    [JSON.stringify(config)],
  );
  const periodo = await db.val<string>(
    `insert into public.periodi (torneo_id, inizio, fine, etichetta) values ($1, '2099-11-01', '2099-11-30', 'P1') returning id`,
    [T],
  );
  const squadra = async (nome: string, g1: string, g2: string) => {
    const s = await db.val<string>(
      `insert into public.squadre (torneo_id, nome, girone, stato, creato_da) values ($1, $2, 'A', 'approvata', $3) returning id`,
      [T, nome, g1],
    );
    await db.q(
      `insert into public.squadra_giocatori (squadra_id, torneo_id, user_id, ordine) values ($1, $2, $3, 1), ($1, $2, $4, 2)`,
      [s, T, g1, g2],
    );
    return s;
  };
  const sA = await squadra('sA', a1, a2);
  const sB = await squadra('sB', b1, b2);
  const partita = (codice: string) =>
    db.val<string>(
      `insert into public.partite (torneo_id, codice, fase, girone, turno, squadra_a, squadra_b, periodo_id)
       values ($1, $2, 'gironi', 'A', 1, $3, $4, $5) returning id`,
      [T, codice, sA, sB, periodo],
    );
  const P = await partita('gA-01-1');
  const P2 = await partita('gA-02-1');
  return { admin, org, gest, a1, a2, b1, b2, x, T, sA, sB, P, P2, periodo };
}

/** Availability for some players on a day. */
export async function fasce(db: Db, T: string, users: string[], data: string, ...fasce: string[]) {
  for (const u of users)
    await db.q(
      `insert into public.disponibilita (torneo_id, user_id, fasce) values ($1, $2, jsonb_build_object($3::text, $4::jsonb))
       on conflict (torneo_id, user_id) do update set fasce = excluded.fasce`,
      [T, u, data, JSON.stringify(fasce)],
    );
}

export async function richiesta(db: Db, id: string): Promise<Row> {
  return db.one('select * from public.richieste where id = $1', [id]);
}

export async function partita(db: Db, id: string): Promise<Row> {
  return db.one('select * from public.partite where id = $1', [id]);
}

export async function accettazioni(db: Db, richiestaId: string): Promise<Record<string, boolean>> {
  const rows = await db.q('select user_id, accettata_at is not null as ok from public.richiesta_giocatori where richiesta_id = $1', [
    richiestaId,
  ]);
  return Object.fromEntries(rows.map((r) => [r.user_id, r.ok]));
}

/** Creates a request (as a1) and has all 4 players accept it. */
export async function richiestaCompleta(
  db: Db,
  b: Base,
  opts: { partita?: string; campo?: string; data?: string; inizio?: string } = {},
): Promise<string> {
  const id = await db.as(b.a1).rpc<string>('create_request', {
    p_partita: opts.partita ?? b.P,
    p_campo: opts.campo ?? 'c1',
    p_data: opts.data ?? DATA,
    p_inizio: opts.inizio ?? '18:00',
  });
  for (const u of [b.a2, b.b1, b.b2]) await db.as(u).rpc('accept_request', { p_richiesta: id });
  return id;
}
