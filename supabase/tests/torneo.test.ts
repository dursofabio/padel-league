/**
 * Tournament: calendar, final phases, state transitions; score validation; jobs;
 * anon / service_role boundaries.
 */
import { describe, expect, it } from 'vitest';
import { base, creaUtente, DATA, expectCode, expectHint, partita, richiesta, tx, type Db } from './helpers';

const S = (...xs: [number, number][]) => xs.map(([a, b]) => ({ a, b }));

async function torneoIscrizioni(db: Db, org: string, n = 3) {
  const T = await db.val<string>(`insert into public.tornei (nome) values ('Iscr') returning id`);
  const squadre: string[] = [];
  for (let i = 1; i <= n; i++) {
    const g1 = await creaUtente(db, `g${i}a`);
    const g2 = await creaUtente(db, `g${i}b`);
    const s = await db.val<string>(
      `insert into public.squadre (torneo_id, nome, girone, stato, creato_da) values ($1, $2, 'A', 'approvata', $3) returning id`,
      [T, `S${i}`, g1],
    );
    await db.q(`insert into public.squadra_giocatori (squadra_id, torneo_id, user_id, ordine) values ($1, $2, $3, 1), ($1, $2, $4, 2)`, [
      s,
      T,
      g1,
      g2,
    ]);
    squadre.push(s);
  }
  void org;
  return { T, squadre };
}

describe('valida_risultato (porting di src/lib/results.ts)', () => {
  const f = { setPerVincere: 2, superTieBreak: true };
  const cases: [ReturnType<typeof S>, typeof f, boolean, string?][] = [
    [S([6, 4], [6, 3]), f, true, 'A'],
    [S([6, 4], [3, 6], [8, 10]), f, true, 'B'],
    [S([6, 4], [3, 6], [12, 10]), f, true, 'A'],
    [S([6, 5], [6, 3]), f, false],
    [S([6, 4]), f, false],
    [S([6, 4], [6, 3], [6, 0]), f, false],
    [S([6, 4], [3, 6], [10, 9]), f, false],
    [S([6, 4], [3, 6], [7, 5]), { setPerVincere: 2, superTieBreak: false }, true, 'A'],
    [S([7, 6], [7, 5]), f, true, 'A'],
    [S([6, 6], [6, 3]), f, false],
    [S([6, 4], [3, 6], [13, 10]), f, false],
    [S(), f, false],
    [S([6, 4], [6, 3], [6, 2]), { setPerVincere: 3, superTieBreak: false }, true, 'A'],
  ];
  it.each(cases)('%j %j → %s', (set, formato, ok, vincitore) =>
    tx(async (db) => {
      const r = await db.val('select private.valida_risultato($1::jsonb, $2::jsonb)', [JSON.stringify(set), JSON.stringify(formato)]);
      expect(r.ok).toBe(ok);
      if (ok) expect(r.vincitore).toBe(vincitore);
      else expect(typeof r.errore).toBe('string');
    }),
  );

  it('valori non interi o negativi', () =>
    tx(async (db) => {
      for (const set of ['[{"a":6.5,"b":4},{"a":6,"b":3}]', '[{"a":-6,"b":4}]', '[{"a":"6","b":4}]', '{}', 'null']) {
        expect((await db.val('select private.valida_risultato($1::jsonb, $2::jsonb)', [set, '{}'])).ok).toBe(false);
      }
    }));
});

describe('calendario e fasi finali', () => {
  it('generate_calendar rifiuta un girone all\'italiana incompleto', () =>
    tx(async (db) => {
      const b = await base(db);
      const { T, squadre: [s1, s2, s3] } = await torneoIscrizioni(db, b.org);
      const m = (codice: string, a: string, c: string) => ({ codice, girone: 'A', turno: 1, posizione: 1, squadra_a: a, squadra_b: c, periodo_id: null });
      const due = [m('gA-1', s1, s2), m('gA-2', s1, s3)];
      await expectHint(db.as(b.a1).rpc('generate_calendar', { p_torneo: T, p_partite: due }), 'NOT_AUTHORIZED');
      const err = await expectHint(db.as(b.org).rpc('generate_calendar', { p_torneo: T, p_partite: due }), 'BAD_CALENDAR');
      expect(err.message).toContain('incompleto');
      await expectHint(
        db.as(b.org).rpc('generate_calendar', { p_torneo: T, p_partite: [...due, m('gA-3', s2, s1)] }),
        'BAD_CALENDAR',
      );
      await expectHint(
        db.as(b.org).rpc('generate_calendar', { p_torneo: T, p_partite: [...due, m('gA-2', s2, s3)] }),
        'BAD_CALENDAR',
      );
      expect(await db.as(b.org).rpc('generate_calendar', { p_torneo: T, p_partite: [...due, m('gA-3', s2, s3)] })).toBe(3);
      expect(await db.val('select stato from public.tornei where id = $1', [T])).toBe('gironi');
      await expectHint(
        db.as(b.org).rpc('generate_calendar', { p_torneo: T, p_partite: [m('gA-9', s2, s3)] }),
        'CALENDAR_EXISTS',
      );
      // finals: one match, then the phase exists
      const fin = [{ codice: 'gold-F', turno: 1, posizione: 1, prossima_codice: null, lato: null, squadra_a: s1, squadra_b: s2, periodo_id: null }];
      expect(await db.as(b.org).rpc('generate_finals', { p_torneo: T, p_fase: 'Gold', p_partite: fin })).toBe(1);
      expect(await db.one('select stato, fasi_generate from public.tornei where id = $1', [T])).toEqual({ stato: 'fasiFinali', fasi_generate: ['gold'] });
      await expectHint(db.as(b.org).rpc('generate_finals', { p_torneo: T, p_fase: 'gold', p_partite: fin }), 'PHASE_EXISTS');
      await expectHint(
        db.as(b.org).rpc('generate_finals', {
          p_torneo: T,
          p_fase: 'silver',
          p_partite: [{ ...fin[0], codice: 'silver-F', squadra_a: s1, squadra_b: s1 }],
        }),
        'BAD_BRACKET',
      );
      // sync_bracket only touches unplayed final matches
      expect(await db.as(b.org).rpc('sync_bracket', { p_torneo: T, p_updates: [{ codice: 'gold-F', squadra_a: s3, squadra_b: s2 }] })).toBe(1);
      await expectHint(db.as(b.org).rpc('sync_bracket', { p_torneo: T, p_updates: [{ codice: 'gA-1', squadra_a: s3, squadra_b: s2 }] }), 'BAD_BRACKET');
    }));

  it('set_tournament_state: transizioni consentite e vietate', () =>
    tx(async (db) => {
      const b = await base(db);
      const { T, squadre: [s1, s2] } = await torneoIscrizioni(db, b.org, 2);
      const st = (stato: string) => db.as(b.org).rpc('set_tournament_state', { p_torneo: T, p_stato: stato });
      const stato = () => db.val('select stato from public.tornei where id = $1', [T]);
      await expectHint(db.as(b.a1).rpc('set_tournament_state', { p_torneo: T, p_stato: 'concluso' }), 'NOT_AUTHORIZED');
      await expectHint(st('gironi'), 'BAD_STATE');
      await expectHint(st('fasiFinali'), 'BAD_STATE');
      await st('concluso');
      await expectHint(st('gironi'), 'BAD_STATE');
      await st('iscrizioni');
      expect(await stato()).toBe('iscrizioni');
      // without group matches, gironi -> iscrizioni is allowed
      await db.q(`update public.tornei set stato = 'gironi' where id = $1`, [T]);
      await st('iscrizioni');
      await db.as(b.org).rpc('generate_calendar', {
        p_torneo: T,
        p_partite: [{ codice: 'gA-1', girone: 'A', turno: 1, posizione: 1, squadra_a: s1, squadra_b: s2, periodo_id: null }],
      });
      await expectHint(st('iscrizioni'), 'BAD_STATE');
      await expectHint(st('fasiFinali'), 'BAD_STATE');
      await st('concluso');
      await expectHint(st('iscrizioni'), 'BAD_STATE');
      await st('gironi');
      expect(await stato()).toBe('gironi');
      await st('gironi'); // no-op
      await db.as(b.org).rpc('generate_finals', {
        p_torneo: T,
        p_fase: 'gold',
        p_partite: [{ codice: 'gold-F', turno: 1, posizione: 1, prossima_codice: null, lato: null, squadra_a: s1, squadra_b: s2, periodo_id: null }],
      });
      await expectHint(st('gironi'), 'BAD_STATE');
      await st('concluso');
      await expectHint(st('gironi'), 'BAD_STATE');
      await st('fasiFinali');
      expect(await stato()).toBe('fasiFinali');
      // calendar generation outside iscrizioni
      await expectHint(db.as(b.org).rpc('generate_calendar', { p_torneo: b.T, p_partite: [{ codice: 'z', girone: 'A' }] }), 'CALENDAR_EXISTS');
    }));
});

describe('job pianificati', () => {
  it('job_scadenze: richieste scadute, partita libera, log', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      expect(await db.val('select private.job_scadenze()')).toBe(0);
      await db.q(`update public.richieste set scadenza = now() - interval '1 minute' where id = $1`, [id]);
      expect(await db.val('select private.job_scadenze()')).toBe(1);
      expect(await richiesta(db, id)).toMatchObject({ stato: 'scaduta' });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'da programmare', richiesta_id: null });
      expect(await db.val(`select count(*)::int from public.log where cosa = 'richiesta scaduta' and riferimento = $1`, [id])).toBe(1);
      // jobs are not callable by clients
      await expectCode(db.as(b.admin).q('select private.job_scadenze()'), '42501');
    }));

  it('job_non_giocate: segnala una volta per periodo', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.q(`update public.periodi set inizio = '2020-01-01', fine = '2020-01-31' where id = $1`, [b.periodo]);
      expect(await db.val('select private.job_non_giocate()')).toBe(2);
      expect(await db.val('select private.job_non_giocate()')).toBe(0);
    }));

  it('service_role aggiorna i ruoli (seed, admin lato server)', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.as('service_role').q(`update public.profiles set roles = '{gestore,giocatore}' where id = $1`, [b.a1]);
      expect(await db.val(`select roles::text from public.profiles where id = $1`, [b.a1])).toBe('{gestore,giocatore}');
    }));

  it('email_promemoria solo per service_role', () =>
    tx(async (db) => {
      const b = await base(db);
      await expectCode(db.as(b.admin).rpc('email_promemoria'), '42501');
      await expectCode(db.as('anon').rpc('email_promemoria'), '42501');
      const posta = await db.as('service_role').rpc<{ email: string; nome: string; righe: string[] }[]>('email_promemoria');
      const a1 = posta.find((p) => p.email === 'a1@x.it');
      expect(a1?.righe.some((r) => r.includes('disponibilità'))).toBe(true);
      expect(posta.find((p) => p.email === 'x@x.it')).toBeUndefined();
      // pending request expiring soon: who must still accept
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      await db.q(`update public.richieste set scadenza = now() + interval '2 hours' where id = $1`, [id]);
      const posta2 = await db.as('service_role').rpc<{ email: string; righe: string[] }[]>('email_promemoria');
      expect(posta2.find((p) => p.email === 'b1@x.it')?.righe.some((r) => r.includes('accettala'))).toBe(true);
      expect(posta2.find((p) => p.email === 'a1@x.it')?.righe.some((r) => r.includes('accettala'))).toBe(false);
    }));
});

describe('anon e privilegi', () => {
  it('anon non esegue RPC né legge richieste, occupazioni, profili', () =>
    tx(async (db) => {
      const b = await base(db);
      const anon = db.as('anon');
      for (const t of ['richieste', 'richiesta_giocatori', 'occupazioni', 'profiles', 'disponibilita', 'log', 'inviti', 'ricorrenze'])
        await expectCode(anon.q(`select * from public.${t}`), '42501');
      await expectCode(anon.rpc('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' }), '42501');
      await expectCode(anon.rpc('get_invite', { p_token: 'x' }), '42501');
      await expectCode(anon.rpc('confirm_request', { p_richiesta: b.P }), '42501');
      await expectCode(anon.q('select private.has_role($1)', ['admin']), '42501');
      // the public read paths
      expect((await anon.rows('select nome from public.giocatori_pubblici where id = $1', [b.a1]))[0].nome).toBe('a1');
      expect(await anon.rows('select giocatori_a from public.partite_v where id = $1', [b.P])).toEqual([{ giocatori_a: [b.a1, b.a2] }]);
      expect((await anon.rows('select * from public.campi')).length).toBe(2);
      expect((await anon.rows('select * from public.squadre where torneo_id = $1', [b.T])).length).toBe(2);
      // no anonymous writes anywhere
      await expectCode(anon.q(`update public.tornei set nome = 'x'`), '42501');
      await expectCode(anon.q(`insert into public.disponibilita (torneo_id, user_id) values ($1, $2)`, [b.T, b.a1]), '42501');
    }));

  it('nessuna RPC pubblica eseguibile da anon o PUBLIC', () =>
    tx(async (db) => {
      const leak = await db.q(`
        select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private')
          and (has_function_privilege('anon', p.oid, 'execute')
               or (p.proname = 'email_promemoria' and has_function_privilege('authenticated', p.oid, 'execute')))`);
      expect(leak).toEqual([]);
      const definer = await db.q(`
        select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and not p.prosecdef and p.prokind = 'f'`);
      expect(definer).toEqual([]);
    }));
});
