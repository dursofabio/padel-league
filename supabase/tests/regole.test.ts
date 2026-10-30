/**
 * Port of every scenario of the old tests/rules.test.ts (Firestore rules) to RLS + RPC.
 */
import { describe, expect, it } from 'vitest';
import {
  accettazioni,
  base,
  creaUtente,
  DATA,
  expectCode,
  expectHint,
  partita,
  richiesta,
  richiestaCompleta,
  tx,
} from './helpers';

describe('users / profiles', () => {
  it('ci si registra solo come giocatore e non si cambia il proprio ruolo', () =>
    tx(async (db) => {
      const b = await base(db);
      // sign-up (auth.users trigger) always creates a plain player
      const nuovo = await db.val<string>(
        `insert into auth.users (email, raw_user_meta_data) values ('nuovo@x.it', '{"full_name":"Nuovo","roles":["admin"]}') returning id`,
      );
      expect(await db.one('select nome, email, roles from public.profiles where id = $1', [nuovo])).toEqual({
        nome: 'Nuovo',
        email: 'nuovo@x.it',
        roles: '{giocatore}',
      });
      // profiles are not insertable by clients
      await expectCode(
        db.as(nuovo).q(`insert into public.profiles (id, nome, roles) values (gen_random_uuid(), 'n', '{admin,giocatore}')`),
        '42501',
      );
      // self-escalation: no column privilege on roles, set_roles is admin only
      await expectCode(db.as(b.a1).q(`update public.profiles set roles = '{admin,giocatore}' where id = $1`, [b.a1]), '42501');
      await expectHint(db.as(b.a1).rpc('set_roles', { p_user: b.a1, p_roles: ['admin'] }), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.gest).rpc('set_roles', { p_user: b.gest, p_roles: ['admin'] }), 'NOT_AUTHORIZED');
      expect(await db.val('select roles from public.profiles where id = $1', [b.a1])).toBe('{giocatore}');
      // own phone yes, someone else's no (RLS filters the row)
      expect((await db.as(b.a1).q(`update public.profiles set telefono = '123' where id = $1`, [b.a1])).rowCount).toBe(1);
      expect((await db.as(b.a1).q(`update public.profiles set telefono = '999' where id = $1`, [b.a2])).rowCount).toBe(0);
      // the admin changes roles through set_roles (giocatore is always kept)
      await db.as(b.admin).rpc('set_roles', { p_user: b.a1, p_roles: ['gestore'] });
      expect(await db.val('select roles from public.profiles where id = $1', [b.a1])).toBe('{gestore,giocatore}');
      // at least one admin must remain
      await expectHint(db.as(b.admin).rpc('set_roles', { p_user: b.admin, p_roles: ['giocatore'] }), 'BAD_STATE');
    }));
});

describe('tornei', () => {
  it('lettura pubblica, scrittura solo organizzatore (config sempre modificabile)', () =>
    tx(async (db) => {
      const b = await base(db);
      expect(await db.as('anon').rows('select nome from public.tornei where id = $1', [b.T])).toEqual([{ nome: 'T' }]);
      expect((await db.as(b.a1).q(`update public.tornei set nome = 'x' where id = $1`, [b.T])).rowCount).toBe(0);
      expect((await db.as(b.org).q(`update public.tornei set nome = 'x' where id = $1`, [b.T])).rowCount).toBe(1);
      // the set format stays editable by the organiser in any state
      await db.q(`update public.tornei set stato = 'fasiFinali' where id = $1`, [b.T]);
      const cfg = { formatoSet: { setPerVincere: 1, superTieBreak: false } };
      expect(
        (await db.as(b.org).q(`update public.tornei set config = config || $2::jsonb where id = $1`, [b.T, JSON.stringify(cfg)])).rowCount,
      ).toBe(1);
      // state only through RPCs: no column privilege
      await expectCode(db.as(b.org).q(`update public.tornei set stato = 'concluso' where id = $1`, [b.T]), '42501');
      // insert / delete: admin only
      await expectCode(db.as(b.org).q(`insert into public.tornei (nome) values ('N')`), '42501');
      expect((await db.as(b.admin).q(`insert into public.tornei (nome) values ('N')`)).rowCount).toBe(1);
    }));
});

describe('squadre e inviti', () => {
  it('il partner entra solo con il token giusto', () =>
    tx(async (db) => {
      const b = await base(db);
      const T2 = await db.val<string>(`insert into public.tornei (nome) values ('Iscrizioni') returning id`);
      const { squadra_id: s1, token } = await db.as(b.a1).rpc('create_team', { p_torneo: T2, p_nome: 'S' });
      expect(await db.as(b.a1).rpc('my_invite_token', { p_squadra: s1 })).toBe(token);
      expect(await db.as(b.a2).rpc('my_invite_token', { p_squadra: s1 })).toBeNull();
      // invites are readable only by the creator (and the organiser)
      expect(await db.as(b.a2).rows('select token from public.inviti')).toEqual([]);
      expect(await db.as(b.a1).rows('select token from public.inviti')).toEqual([{ token }]);
      expect(await db.as(b.org).rows('select token from public.inviti')).toEqual([{ token }]);

      await expectHint(db.as(b.a2).rpc('join_team', { p_token: 'sbagliato' }), 'BAD_TOKEN');
      expect(await db.as(b.a2).rpc('get_invite', { p_token: token })).toMatchObject({ nome: 'S', creatore_nome: 'a1', giocatori: 1 });
      expect(await db.as(b.a2).rpc('join_team', { p_token: token })).toBe(s1);
      await expectHint(db.as(b.x).rpc('join_team', { p_token: token }), 'TEAM_FULL');
      await expectHint(db.as(b.a1).rpc('create_team', { p_torneo: T2, p_nome: 'Altra' }), 'ALREADY_IN_TEAM');
      expect(await db.val('select stato from public.squadre where id = $1', [s1])).toBe('da approvare');
      expect(await db.val('select array_agg(user_id order by ordine) from public.squadra_giocatori where squadra_id = $1', [s1])).toEqual([
        b.a1,
        b.a2,
      ]);

      // the creator renames, but cannot approve
      expect((await db.as(b.a1).q(`update public.squadre set nome = 'S2' where id = $1`, [s1])).rowCount).toBe(1);
      await expectHint(db.as(b.a1).q(`update public.squadre set stato = 'approvata' where id = $1`, [s1]), 'NOT_AUTHORIZED');
      expect((await db.as(b.org).q(`update public.squadre set stato = 'approvata', girone = 'A' where id = $1`, [s1])).rowCount).toBe(1);
      // once approved the creator cannot rename any more
      expect((await db.as(b.a1).q(`update public.squadre set nome = 'S3' where id = $1`, [s1])).rowCount).toBe(0);
      // registration closed
      await db.q(`update public.tornei set stato = 'gironi' where id = $1`, [T2]);
      await expectHint(db.as(b.x).rpc('create_team', { p_torneo: T2, p_nome: 'Tardi' }), 'REGISTRATION_CLOSED');
    }));
});

describe('richieste', () => {
  it('solo uno dei 4 giocatori crea la richiesta, con lock sullo slot', () =>
    tx(async (db) => {
      const b = await base(db);
      const args = { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' };
      await expectHint(db.as(b.x).rpc('create_request', args), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.gest).rpc('create_request', args), 'NOT_AUTHORIZED');
      const id = await db.as(b.a1).rpc<string>('create_request', args);
      await expectHint(db.as(b.b1).rpc('create_request', args), 'MATCH_HAS_REQUEST');
      await expectHint(db.as(b.b1).rpc('create_request', { ...args, p_partita: b.P2 }), 'SLOT_TAKEN');
      expect(await partita(db, b.P)).toMatchObject({ stato: 'richiesta', richiesta_id: id });
      // direct writes are impossible
      await expectCode(db.as(b.a1).q(`update public.richieste set stato = 'confermata' where id = $1`, [id]), '42501');
      await expectCode(db.as(b.a1).q(`update public.partite set stato = 'programmata' where id = $1`, [b.P]), '42501');
    }));

  it('fine, griglia e scadenza sono calcolate dal server', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      const r = await richiesta(db, id);
      expect(r).toMatchObject({ inizio: '18:00:00', fine: '19:30:00', fuori_griglia: false, controproposta: false, stato: 'attesa', creato_da: b.a1 });
      const ore = await db.val<number>(`select round(extract(epoch from scadenza - now()) / 3600) from public.richieste where id = $1`, [id]);
      expect(Number(ore)).toBe(48);
    }));

  it('fuori griglia solo se consentito dal torneo, con il passo configurato', () =>
    tx(async (db) => {
      const b = await base(db);
      const args = { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:30' };
      await expectHint(db.as(b.a1).rpc('create_request', args), 'OFF_GRID_DISABLED');
      await db.q(`update public.tornei set config = config || '{"consentiFuoriGriglia": true, "passoFuoriGriglia": 30}' where id = $1`, [b.T]);
      await expectHint(db.as(b.a1).rpc('create_request', { ...args, p_inizio: '18:15' }), 'BAD_STEP');
      await expectHint(db.as(b.a1).rpc('create_request', { ...args, p_inizio: '23:30' }), 'COURT_CLOSED');
      const id = await db.as(b.a1).rpc<string>('create_request', args);
      expect(await richiesta(db, id)).toMatchObject({ fuori_griglia: true, fine: '20:00:00' });
    }));

  it('controlli su orario passato e campo chiuso', () =>
    tx(async (db) => {
      const b = await base(db);
      await expectHint(
        db.as(b.a1).rpc('create_request', { p_partita: b.P, p_campo: 'c1', p_data: '2020-01-04', p_inizio: '18:00' }),
        'IN_PAST',
      );
      await db.q(`update public.campi set eccezioni = $1 where id = 'c1'`, [[DATA]]);
      await expectHint(
        db.as(b.a1).rpc('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' }),
        'COURT_CLOSED',
      );
    }));

  it('una partita oltre la fine del periodo resta prenotabile', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.q(`update public.periodi set inizio = '2020-01-01', fine = '2020-01-31' where id = $1`, [b.periodo]);
      await db.as(b.a1).rpc('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
    }));

  it('accettazioni: ognuno aggiunge solo la propria', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      await db.as(b.b1).rpc('accept_request', { p_richiesta: id });
      await expectHint(db.as(b.x).rpc('accept_request', { p_richiesta: id }), 'NOT_AUTHORIZED');
      await expectCode(
        db.as(b.b1).q(`update public.richiesta_giocatori set accettata_at = now() where richiesta_id = $1 and user_id = $2`, [id, b.b2]),
        '42501',
      );
      expect(await accettazioni(db, id)).toEqual({ [b.a1]: true, [b.a2]: false, [b.b1]: true, [b.b2]: false });
    }));

  it('accettazioni calcolate dalle fasce: la richiesta 3/4 è ammessa', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.q(
        `insert into public.disponibilita (torneo_id, user_id, fasce) values
           ($1, $2, '{"2099-11-14": ["14:00-19:30"]}'), ($1, $3, '{"2099-11-14": ["17:00-24:00", "bad"]}'),
           ($1, $4, '{"2099-11-14": ["14:00-17:00"]}')`,
        [b.T, b.a2, b.b1, b.b2],
      );
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      expect(await accettazioni(db, id)).toEqual({ [b.a1]: true, [b.a2]: true, [b.b1]: true, [b.b2]: false });
      await expectHint(db.as(b.gest).rpc('confirm_request', { p_richiesta: id }), 'NOT_ALL_ACCEPTED');
      await db.as(b.b2).rpc('accept_request', { p_richiesta: id });
      expect(await db.as(b.gest).rpc('confirm_request', { p_richiesta: id })).toEqual({ esito: 'ok', conflitti: 0 });
    }));

  it('conferma solo dal gestore, con 4 accettazioni e occupazione scritta', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await richiestaCompleta(db, b);
      await expectHint(db.as(b.a1).rpc('confirm_request', { p_richiesta: id }), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.org).rpc('confirm_request', { p_richiesta: id }), 'NOT_AUTHORIZED');
      expect(await db.as(b.gest).rpc('confirm_request', { p_richiesta: id })).toEqual({ esito: 'ok', conflitti: 0 });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'confermata', gestito_da: b.gest });
      expect(await db.one('select tipo, partita_id, inizio, fine from public.occupazioni where richiesta_id = $1', [id])).toEqual({
        tipo: 'campionato',
        partita_id: b.P,
        inizio: '18:00:00',
        fine: '19:30:00',
      });
      expect(
        await db.as('anon').rows('select stato, prog_campo_id, prog_inizio, giocatori from public.partite_v where id = $1', [b.P]),
      ).toEqual([{ stato: 'programmata', prog_campo_id: 'c1', prog_inizio: '18:00:00', giocatori: [b.a1, b.a2, b.b1, b.b2] }]);
      await expectHint(db.as(b.gest).rpc('confirm_request', { p_richiesta: id }), 'BAD_STATE');
    }));

  it('conferma bloccata se mancano accettazioni', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      await expectHint(db.as(b.gest).rpc('confirm_request', { p_richiesta: id }), 'NOT_ALL_ACCEPTED');
      expect(await db.val('select count(*)::int from public.occupazioni')).toBe(0);
    }));

  it('il giocatore annulla la richiesta e la partita torna da programmare', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await richiestaCompleta(db, b);
      await expectHint(db.as(b.x).rpc('cancel_request', { p_richiesta: id }), 'NOT_AUTHORIZED');
      await db.as(b.b2).rpc('cancel_request', { p_richiesta: id, p_nota: 'x' });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'annullata', nota: 'x' });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'da programmare', richiesta_id: null });
      // the freed slot can be requested again
      await db.as(b.a2).rpc('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
    }));

  it('il gestore rifiuta', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await richiestaCompleta(db, b);
      await expectHint(db.as(b.a1).rpc('reject_request', { p_richiesta: id }), 'NOT_AUTHORIZED');
      await db.as(b.gest).rpc('reject_request', { p_richiesta: id, p_nota: 'no' });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'rifiutata', nota: 'no', gestito_da: b.gest });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'da programmare', richiesta_id: null });
    }));

  it('controproposta del gestore: chiude la vecchia e ne crea una nuova', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await richiestaCompleta(db, b);
      await expectHint(
        db.as(b.a1).rpc('counter_propose', { p_richiesta: id, p_campo: 'c2', p_data: DATA, p_inizio: '18:30' }),
        'NOT_AUTHORIZED',
      );
      const nuova = await db.as(b.gest).rpc<string>('counter_propose', { p_richiesta: id, p_campo: 'c2', p_data: DATA, p_inizio: '18:30' });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'rifiutata', gestito_da: b.gest });
      expect(await richiesta(db, nuova)).toMatchObject({ stato: 'attesa', controproposta: true, campo_id: 'c2', fine: '20:00:00', creato_da: b.gest });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'richiesta', richiesta_id: nuova });
      // nobody accepted yet (the gestore is not a player of the match)
      expect(Object.values(await accettazioni(db, nuova))).toEqual([false, false, false, false]);
      await expectHint(db.as(b.a1).rpc('confirm_request', { p_richiesta: nuova }), 'NOT_AUTHORIZED');
    }));

  it('una richiesta scaduta si può sovrascrivere (scadenza pigra)', () =>
    tx(async (db) => {
      const b = await base(db);
      const vecchia = await db.val<string>(
        `insert into public.richieste (torneo_id, partita_id, campo_id, data, inizio, fine, stato, scadenza, creato_da)
         values ($1, $2, 'c1', $3, '18:00', '19:30', 'attesa', now() - interval '1 second', $4) returning id`,
        [b.T, b.P2, DATA, b.b1],
      );
      await db.q(`update public.partite set stato = 'richiesta', richiesta_id = $2 where id = $1`, [b.P2, vecchia]);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      expect(await richiesta(db, vecchia)).toMatchObject({ stato: 'scaduta' });
      expect(await partita(db, b.P2)).toMatchObject({ stato: 'da programmare', richiesta_id: null });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'attesa' });
      // accept on an expired request
      await db.q(`update public.richieste set scadenza = now() - interval '1 second' where id = $1`, [id]);
      await expectHint(db.as(b.b1).rpc('accept_request', { p_richiesta: id }), 'EXPIRED');
      // confirm on an expired request: esito scaduta, no error
      expect(await db.as(b.gest).rpc('confirm_request', { p_richiesta: id })).toEqual({ esito: 'scaduta', conflitti: 0 });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'da programmare' });
    }));

  it('utente con più ruoli (gestore + giocatore)', () =>
    tx(async (db) => {
      const b = await base(db);
      // the gestore plays in team A instead of a2
      await db.q(`update public.squadra_giocatori set user_id = $2 where squadra_id = $1 and user_id = $3`, [b.sA, b.gest, b.a2]);
      const id = await db.as(b.gest).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      for (const u of [b.a1, b.b1, b.b2]) await db.as(u).rpc('accept_request', { p_richiesta: id });
      expect(await db.as(b.gest).rpc('confirm_request', { p_richiesta: id })).toMatchObject({ esito: 'ok' });
      // still not an organiser
      await expectHint(db.as(b.gest).rpc('clear_result', { p_partita: b.P }), 'NOT_AUTHORIZED');
      expect(await db.as(b.gest).rows('select 1 from public.log')).not.toEqual([]);
    }));
});

describe('risultati', () => {
  const set = [
    { a: 6, b: 4 },
    { a: 6, b: 3 },
  ];

  it('inserimento da un giocatore, conferma solo dagli avversari', () =>
    tx(async (db) => {
      const b = await base(db);
      await expectHint(db.as(b.x).rpc('submit_result', { p_partita: b.P, p_set: set }), 'NOT_AUTHORIZED');
      await db.as(b.a1).rpc('submit_result', { p_partita: b.P, p_set: set });
      // the same pair may overwrite before confirmation
      await db.as(b.a2).rpc('submit_result', { p_partita: b.P, p_set: set });
      // the opponent does not overwrite: confirm or contest
      await expectHint(db.as(b.b1).rpc('submit_result', { p_partita: b.P, p_set: [{ a: 4, b: 6 }, { a: 3, b: 6 }] }), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.a1).rpc('confirm_result', { p_partita: b.P }), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.x).rpc('confirm_result', { p_partita: b.P }), 'NOT_AUTHORIZED');
      await db.as(b.b1).rpc('confirm_result', { p_partita: b.P });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'giocata', inserito_da: b.a2, confermato_da: b.b1, set });
      // after confirmation only the organiser changes it
      await expectHint(db.as(b.a1).rpc('submit_result', { p_partita: b.P, p_set: set }), 'ALREADY_CONFIRMED');
      await expectHint(db.as(b.b2).rpc('confirm_result', { p_partita: b.P }), 'ALREADY_CONFIRMED');
      await expectHint(db.as(b.a1).rpc('clear_result', { p_partita: b.P }), 'NOT_AUTHORIZED');
      await db.as(b.org).rpc('clear_result', { p_partita: b.P });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'da programmare', set: null, inserito_da: null });
    }));

  it('contestazione dagli avversari', () =>
    tx(async (db) => {
      const b = await base(db);
      await db.as(b.a1).rpc('submit_result', { p_partita: b.P, p_set: set });
      await expectHint(db.as(b.a2).rpc('contest_result', { p_partita: b.P, p_nota: 'no' }), 'NOT_AUTHORIZED');
      await db.as(b.b2).rpc('contest_result', { p_partita: b.P, p_nota: 'no' });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'contestata', contestato_da: b.b2, nota_risultato: 'no' });
      await expectHint(db.as(b.a1).rpc('submit_result', { p_partita: b.P, p_set: set }), 'BAD_STATE');
      // the organiser decides
      await db.as(b.org).rpc('set_official_result', { p_partita: b.P, p_set: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 10, b: 8 }] });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'giocata', confermato_da: b.org });
    }));

  it('punteggio non valido, tavolino e risultato su partita programmata', () =>
    tx(async (db) => {
      const b = await base(db);
      await expectHint(db.as(b.a1).rpc('submit_result', { p_partita: b.P, p_set: [{ a: 6, b: 5 }, { a: 6, b: 3 }] }), 'INVALID_SCORE');
      const id = await richiestaCompleta(db, b);
      await db.as(b.gest).rpc('confirm_request', { p_richiesta: id });
      await db.as(b.a1).rpc('submit_result', { p_partita: b.P, p_set: set });
      await db.as(b.b1).rpc('confirm_result', { p_partita: b.P });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'giocata', richiesta_id: id });
      // a played match cannot be cancelled
      await expectHint(db.as(b.gest).rpc('cancel_confirmed', { p_richiesta: id }), 'BAD_STATE');
      await db.as(b.org).rpc('clear_result', { p_partita: b.P });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'programmata', richiesta_id: id });
      await expectHint(db.as(b.a1).rpc('assign_forfeit', { p_partita: b.P, p_vincente: 'B' }), 'NOT_AUTHORIZED');
      await db.as(b.org).rpc('assign_forfeit', { p_partita: b.P, p_vincente: 'B' });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'tavolino', set: [{ a: 0, b: 6 }, { a: 0, b: 6 }] });
    }));

  it('confirm_result annulla la richiesta ancora in attesa', () =>
    tx(async (db) => {
      const b = await base(db);
      const id = await db.as(b.a1).rpc<string>('create_request', { p_partita: b.P, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
      await db.as(b.a1).rpc('submit_result', { p_partita: b.P, p_set: set });
      await db.as(b.b1).rpc('confirm_result', { p_partita: b.P });
      expect(await richiesta(db, id)).toMatchObject({ stato: 'annullata' });
      expect(await partita(db, b.P)).toMatchObject({ stato: 'giocata', richiesta_id: null });
      // the slot is free again
      await db.as(b.a1).rpc('create_request', { p_partita: b.P2, p_campo: 'c1', p_data: DATA, p_inizio: '18:00' });
    }));
});

describe('disponibilità e occupazioni', () => {
  it('disponibilità: scrive solo il proprietario', () =>
    tx(async (db) => {
      const b = await base(db);
      const fasce = JSON.stringify({ '2099-11-14': ['14:00-19:00'] });
      await db.as(b.a1).q(`insert into public.disponibilita (torneo_id, fasce) values ($1, $2)`, [b.T, fasce]);
      // PostgREST-style upsert
      await db
        .as(b.a1)
        .q(
          `insert into public.disponibilita (torneo_id, user_id, fasce) values ($1, $2, $3)
           on conflict (torneo_id, user_id) do update set fasce = excluded.fasce`,
          [b.T, b.a1, JSON.stringify({ '2099-11-15': ['10:00-12:00'] })],
        );
      await expectCode(
        db.as(b.a2).q(`insert into public.disponibilita (torneo_id, user_id, fasce) values ($1, $2, '{}')`, [b.T, b.a1]),
        '42501',
      );
      expect((await db.as(b.a2).q(`update public.disponibilita set fasce = '{}' where user_id = $1`, [b.a1])).rowCount).toBe(0);
      expect((await db.as(b.a2).q(`delete from public.disponibilita where user_id = $1`, [b.a1])).rowCount).toBe(0);
      expect(await db.as(b.b1).rows('select fasce from public.disponibilita where user_id = $1', [b.a1])).toEqual([
        { fasce: { '2099-11-15': ['10:00-12:00'] } },
      ]);
    }));

  it('occupazioni e campi: solo gestore e admin', () =>
    tx(async (db) => {
      const b = await base(db);
      const occ = { p_campo: 'c1', p_data: DATA, p_inizio: '10:00', p_fine: '11:00', p_tipo: 'lezione' };
      await expectHint(db.as(b.a1).rpc('add_occupation', occ), 'NOT_AUTHORIZED');
      await expectHint(db.as(b.org).rpc('add_occupation', occ), 'NOT_AUTHORIZED');
      const { id } = await db.as(b.gest).rpc('add_occupation', occ);
      await expectHint(db.as(b.gest).rpc('add_occupation', { ...occ, p_tipo: 'campionato', p_inizio: '12:00', p_fine: '13:00' }), 'BAD_STATE');
      await db.as(b.admin).rpc('add_occupation', { ...occ, p_inizio: '11:00', p_fine: '12:00' });
      await expectCode(
        db.as(b.gest).q(`insert into public.occupazioni (campo_id, data, inizio, fine, tipo) values ('c1', $1, '08:00', '09:00', 'esterno')`, [DATA]),
        '42501',
      );
      await expectHint(db.as(b.a1).rpc('remove_occupation', { p_id: id }), 'NOT_AUTHORIZED');
      await db.as(b.gest).rpc('remove_occupation', { p_id: id });

      const campo = `insert into public.campi (id, nome, primo_slot, ultimo_slot, durata) values ($1, 'C', '09:00', '20:00', 90)`;
      await expectCode(db.as(b.org).q(campo, ['c9']), '42501');
      await expectCode(db.as(b.a1).q(campo, ['c9']), '42501');
      await db.as(b.admin).q(campo, ['c9']);
      await db.as(b.gest).q(campo, ['c8']);
      expect((await db.as(b.org).q(`update public.campi set nome = 'x' where id = 'c9'`)).rowCount).toBe(0);
      // recurrences: gestore only
      const ric = `insert into public.ricorrenze (campo_id, giorno_settimana, inizio, fine, dal, al) values ('c1', 1, '10:00', '11:00', '2099-01-01', '2099-12-31')`;
      await expectCode(db.as(b.a1).q(ric), '42501');
      await db.as(b.gest).q(ric);
    }));
});
