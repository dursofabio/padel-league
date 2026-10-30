/**
 * Court timeline: EXCLUDE, confirmations vs overlaps, occupations, close_day,
 * recurrences, player cancellation of a confirmed match.
 */
import { describe, expect, it } from 'vitest';
import { base, DATA, expectCode, expectHint, fasce, partita, pool, richiesta, richiestaCompleta, tx } from './helpers';

describe('EXCLUDE sulle occupazioni', () => {
  it('intervalli adiacenti ok, sovrapposti rifiutati (23P01)', () =>
    tx(async (db) => {
      const ins = (ini: string, fine: string, campo = 'c1') =>
        db.q(`insert into public.occupazioni (campo_id, data, inizio, fine, tipo) values ($1, $2, $3, $4, 'esterno')`, [campo, DATA, ini, fine]);
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

describe('conferme sovrapposte', () => {
  it('due richieste sovrapposte: una confermata, l\'altra in conflitto', () =>
    tx(async (db) => {
      const b = await base(db, { consentiFuoriGriglia: true, passoFuoriGriglia: 30 });
      await fasce(db, b.T, [b.a1, b.a2, b.b1, b.b2], DATA, '00:00-24:00');
      // grid 18:00–19:30 and off-grid 18:30–20:00 can both be pending
      const r1 = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      const r2 = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P2, p_campo: 'c1', p_data: DATA, p_inizio: '18:30' });
      expect(await db.as(b.gest).rpc('confirm_request', { p_richiesta: r1 })).toEqual({ esito: 'ok', conflitti: 1 });
      expect(await richiesta(db, r2)).toMatchObject({ stato: 'conflitto', gestito_da: b.gest });
      expect(await partita(db, b.P2)).toMatchObject({ stato: 'da programmare', richiesta_id: null });
      // a late second confirmation does not raise
      expect(await db.as(b.gest).rpc('confirm_request', { p_richiesta: r2 })).toEqual({ esito: 'occupato', conflitti: 0 });
      expect(await db.val(`select count(*)::int from public.occupazioni where campo_id = 'c1'`)).toBe(1);
    }));

  it('occupazione comparsa nel frattempo: esito occupato e richiesta in conflitto', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await richiestaCompleta(db, b);
      // written behind the RPCs' back, so the request is still 'attesa'
      await db.q(`insert into public.occupazioni (campo_id, data, inizio, fine, tipo) values ('c1', $1, '19:00', '20:00', 'esterno')`, [DATA]);
      expect(await db.as(b.gest).rpc('confirm_request', { p_richiesta: id })).toEqual({ esito: 'occupato', conflitti: 0 });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'conflitto' });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'da programmare', richiesta_id: null });
    }));

  it('conferme concorrenti da due connessioni', async () => {
    // committed fixtures (two connections must see them), removed at the end
    const setup = await pool.connect();
    let b: Awaited<ReturnType<typeof base>> | undefined;
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      await setup.query('begin');
      const { Db } = await import('./helpers');
      const db = new Db(setup);
      b = await base(db, { consentiFuoriGriglia: true, passoFuoriGriglia: 30 });
      await fasce(db, b.T, [b.a1, b.a2, b.b1, b.b2], DATA, '00:00-24:00');
      const r1 = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      const r2 = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P2, p_campo: 'c1', p_data: DATA, p_inizio: '18:30' });
      await setup.query('commit');

      const conferma = async (c: typeof c1, id: string) => {
        await c.query('begin');
        await c.query('set local role authenticated');
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: b!.gest, role: 'authenticated' })]);
        return (await c.query('select public.confirm_request($1) as r', [id])).rows[0].r;
      };
      // c1 holds the court/day lock until it commits; c2 waits for it
      const e1 = await conferma(c1, r1);
      const p2 = conferma(c2, r2);
      await new Promise((r) => setTimeout(r, 300));
      const waiting = await setup.query(
        `select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query like '%confirm_request%'`,
      );
      expect(waiting.rows[0].n).toBe(1);
      await c1.query('commit');
      const e2 = await p2;
      await c2.query('commit');
      expect(e1).toEqual({ esito: 'ok', conflitti: 1 });
      expect(e2).toEqual({ esito: 'occupato', conflitti: 0 });
      const stati = await setup.query('select stato, count(*)::int as n from public.richieste where torneo_id = $1 group by stato order by stato', [b.T]);
      expect(stati.rows).toEqual([
        { stato: 'confermata', n: 1 },
        { stato: 'conflitto', n: 1 },
      ]);
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      await setup.query('rollback').catch(() => {});
      if (b) {
        const users = [b.admin, b.org, b.gest, b.a1, b.a2, b.b1, b.b2, b.x];
        await setup.query('delete from public.tornei where id = $1', [b.T]);
        await setup.query('delete from public.log where chi = any($1::uuid[]) or chi is null', [users]);
        await setup.query('delete from auth.users where id = any($1::uuid[])', [users]);
      }
      c1.release();
      c2.release();
      setup.release();
    }
  });
});

describe('occupazioni', () => {
  it('add_occupation sovrapposta: OVERLAP; sopra una richiesta in attesa: conflitto', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      const res = await db.as(b.gest).rpc('add_occupation', {
        p_campo: 'c1', p_data: DATA, p_inizio: '19:00', p_fine: '20:00', p_tipo: 'lezione', p_nota: 'Scuola',
      });
      expect(res.conflitti).toBe(1);
      expect(await richiesta(db, id)).toMatchObject({ stato: 'conflitto' });
      expect((await richiesta(db, id)).nota).toContain('lezione');
      expect(await partita(db, b.P)).toMatchObject({ stato: 'da programmare', richiesta_id: null });
      const err = await expectHint(
        db.as(b.gest).rpc('add_occupation', { p_campo: 'c1', p_data: DATA, p_inizio: '19:30', p_fine: '21:00', p_tipo: 'esterno' }),
        'OVERLAP',
      );
      expect(err.message).toContain('Scuola');
      // and requests cannot be made over an occupation
      await expectHint(
        db.as(b.a1).rpc('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' }),
        'OVERLAP',
      );
      // the championship occupation can only be cancelled from the request
      const r = await richiestaCompleta(db, b, { inizio: '16:30' });
      await db.as(b.gest).rpc('confirm_request', { p_richiesta: r });
      const occ = await db.val<string>('select id from public.occupazioni where richiesta_id = $1', [r]);
      await expectHint(db.as(b.gest).rpc('remove_occupation', { p_id: occ }), 'BAD_STATE');
    }));

  it('close_day: chiude tutti i campi e riporta errori e conflitti', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      await db.as(b.gest).rpc('add_occupation', { p_campo: 'c2', p_data: DATA, p_inizio: '10:00', p_fine: '11:00', p_tipo: 'lezione' });
      await expectHint(db.as(b.a1).rpc('close_day', { p_data: DATA, p_nota: 'Torneo sociale' }), 'NOT_AUTHORIZED');
      const res = await db.as(b.gest).rpc('close_day', { p_data: DATA, p_nota: 'Torneo sociale' });
      expect(res.conflitti).toBe(1);
      expect(res.errori).toHaveLength(1);
      expect(res.errori[0]).toMatch(/^Campo 2: /);
      expect(await db.q(`select campo_id, inizio, fine from public.occupazioni where tipo = 'chiusura'`)).toEqual([
        { campo_id: 'c1', inizio: '00:00:00', fine: '24:00:00' },
      ]);
      expect(await richiesta(db, id)).toMatchObject({ stato: 'conflitto' });
    }));

  it('materialize_recurrence è idempotente e salta i giorni occupati', () =>
    tx(async (db) => {
      const b = await base(db);
      const dow = await db.val<number>(`select extract(dow from private.oggi() + 3)::int`);
      const ric = await db.val<string>(
        `insert into public.ricorrenze (campo_id, giorno_settimana, inizio, fine, tipo, nota, dal, al)
         values ('c1', $1, '10:00', '11:00', 'lezione', 'Corso', private.oggi(), private.oggi() + 20) returning id`,
        [dow],
      );
      // one of the three days is already busy
      await db.q(`insert into public.occupazioni (campo_id, data, inizio, fine, tipo) values ('c1', private.oggi() + 10, '10:30', '12:00', 'esterno')`);
      await expectHint(db.as(b.a1).rpc('materialize_recurrence', { p_ricorrenza: ric, p_giorni: 30 }), 'NOT_AUTHORIZED');
      const r1 = await db.as(b.gest).rpc('materialize_recurrence', { p_ricorrenza: ric, p_giorni: 30 });
      expect(r1.creati).toBe(2);
      expect(r1.saltati).toHaveLength(1);
      const r2 = await db.as(b.gest).rpc('materialize_recurrence', { p_ricorrenza: ric, p_giorni: 30 });
      expect(r2.creati).toBe(0);
      expect(await db.val(`select count(*)::int from public.occupazioni where ricorrenza_id = $1`, [ric])).toBe(2);
      // the hourly job is idempotent too
      expect(await db.val('select private.job_ricorrenze(28)')).toBe(0);
    }));
});

describe('annullamento di una partita confermata', () => {
  it('il gestore annulla: campo libero, partita da programmare', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await richiestaCompleta(db, b);
      await db.as(b.gest).rpc('confirm_request', { p_richiesta: id });
      await expectHint(db.as(b.a1).rpc('cancel_confirmed', { p_richiesta: id }), 'NOT_AUTHORIZED');
      await db.as(b.gest).rpc('cancel_confirmed', { p_richiesta: id, p_nota: 'pioggia' });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'annullata', nota: 'pioggia' });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'da programmare', richiesta_id: null });
      expect(await db.val('select count(*)::int from public.occupazioni')).toBe(0);
    }));

  it('il giocatore annulla in tempo; il gestore lo vede nel log', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await richiestaCompleta(db, b);
      await db.as(b.gest).rpc('confirm_request', { p_richiesta: id });
      await expectHint(db.as(b.x).rpc('player_cancel_confirmed', { p_richiesta: id }), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.gest).rpc('player_cancel_confirmed', { p_richiesta: id }), 'NOT_AUTHORIZED');
      await db.as(b.b2).rpc('player_cancel_confirmed', { p_richiesta: id, p_nota: 'infortunio' });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'annullata', nota: 'infortunio', gestito_da: b.b2 });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'da programmare', richiesta_id: null });
      expect(await db.val('select count(*)::int from public.occupazioni')).toBe(0);
      const log = await db.as(b.gest).rows('select chi, cosa from public.log where riferimento = $1', [id]);
      expect(log.some((l) => l.chi === b.b2 && l.cosa.includes('giocatore annulla') && l.cosa.includes('infortunio'))).toBe(true);
      expect(await db.as(b.a1).rows('select 1 from public.log')).toEqual([]);
      await expectHint(db.as(b.b2).rpc('player_cancel_confirmed', { p_richiesta: id }), 'BAD_STATE');
      // the slot is bookable again
      await db.as(b.a1).rpc('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
    }));

  it('troppo tardi: TOO_LATE entro annullamentoGiocatoreOre (default 24)', () =>
    tx(async (db) => {
      const b = await base(db);
      // confirmed match starting in ~3 hours (Europe/Rome wall clock), written as a fixture
      const { data, inizio, fine } = await db.one(
        `select t::date as data, t::time as inizio,
                case when t::time >= '23:00' then '24:00'::time else (t + interval '30 minutes')::time end as fine
         from (select date_trunc('minute', private.ora_locale() + interval '3 hours') as t) x`,
      );
      const id = await db.val<string>(
        `insert into public.richieste (torneo_id, partita_id, campo_id, data, inizio, fine, stato, scadenza, creato_da)
         values ($1, $2, 'c1', $3, $4, $5, 'confermata', now() + interval '1 day', $6) returning id`,
        [b.T, b.P, data, inizio, fine, b.a1],
      );
      await db.q(
        `insert into public.occupazioni (campo_id, data, inizio, fine, tipo, partita_id, richiesta_id, torneo_id)
         values ('c1', $1, $2, $3, 'campionato', $4, $5, $6)`,
        [data, inizio, fine, b.P, id, b.T],
      );
      await db.q(`update public.partite set stato = 'programmata', richiesta_id = $2 where id = $1`, [b.P, id]);
      const ore = await db.val<number>(
        `select extract(epoch from (($1::date + $2::time) at time zone 'Europe/Rome') - now()) / 3600`,
        [data, inizio],
      );
      expect(Number(ore)).toBeLessThan(24);
      await expectHint(db.as(b.a1).rpc('player_cancel_confirmed', { p_richiesta: id }), 'TOO_LATE');
      expect(await richiesta(db, id)).toMatchObject({ stato: 'confermata' });
      // the organiser shortens the window: now it is in time
      await db.q(`update public.tornei set config = config || '{"annullamentoGiocatoreOre": 1}' where id = $1`, [b.T]);
      await db.as(b.a1).rpc('player_cancel_confirmed', { p_richiesta: id });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'annullata' });
      // without the key the default (24) applies
      expect(await db.val(`select private.config_default() ->> 'annullamentoGiocatoreOre'`)).toBe('24');
    }));
});
