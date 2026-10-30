/**
 * Test delle Security Rules sull'emulatore Firestore:
 *   npm run test:rules
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const T = 't1';
const P = 'gA-01-1';
const RID = 'c1_20991114_1800';
const giocatori = ['a1', 'a2', 'b1', 'b2'];
const scadenza = () => Timestamp.fromMillis(Date.now() + 48 * 3600_000);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-padel',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const roles: Record<string, string> = { admin: 'admin', org: 'organizzatore', gest: 'gestore', a1: 'giocatore', a2: 'giocatore', b1: 'giocatore', b2: 'giocatore', x: 'giocatore' };
    for (const [uid, role] of Object.entries(roles)) await setDoc(doc(db, 'users', uid), { nome: uid, email: `${uid}@x.it`, role });
    await setDoc(doc(db, 'tornei', T), { nome: 'T', stato: 'gironi', config: { consentiFuoriGriglia: false } });
    await setDoc(doc(db, 'tornei', T, 'partite', P), {
      fase: 'gironi', squadraA: 'sA', squadraB: 'sB', giocatoriA: ['a1', 'a2'], giocatoriB: ['b1', 'b2'], giocatori,
      stato: 'da programmare', richiestaId: null, programmazione: null, risultato: null,
    });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

function richiesta(uid: string, extra: Record<string, unknown> = {}) {
  return {
    torneoId: T, partitaId: P, campoId: 'c1', data: '2099-11-14', inizio: '18:00', fine: '19:30',
    fuoriGriglia: false, controproposta: false, giocatori,
    accettazioni: Object.fromEntries(giocatori.map((g) => [g, serverTimestamp()])),
    stato: 'attesa', scadenza: scadenza(), creatoDa: uid, nota: null, ...extra,
  };
}

async function creaRichiesta(uid: string, extra: Record<string, unknown> = {}) {
  const db = as(uid);
  const b = writeBatch(db);
  b.set(doc(db, 'richieste', RID), richiesta(uid, extra));
  b.update(doc(db, 'tornei', T, 'partite', P), { stato: 'richiesta', richiestaId: RID });
  return b.commit();
}

describe('users', () => {
  it('ci si registra solo come giocatore e non si cambia il proprio ruolo', async () => {
    await assertSucceeds(setDoc(doc(as('nuovo'), 'users', 'nuovo'), { nome: 'n', email: '', role: 'giocatore' }));
    await assertFails(setDoc(doc(as('nuovo2'), 'users', 'nuovo2'), { nome: 'n', email: '', role: 'admin' }));
    await assertFails(updateDoc(doc(as('a1'), 'users', 'a1'), { role: 'admin' }));
    await assertSucceeds(updateDoc(doc(as('a1'), 'users', 'a1'), { telefono: '123' }));
    await assertSucceeds(updateDoc(doc(as('admin'), 'users', 'a1'), { role: 'gestore' }));
  });
});

describe('tornei', () => {
  it('lettura pubblica, scrittura solo organizzatore', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'tornei', T)));
    await assertFails(updateDoc(doc(as('a1'), 'tornei', T), { nome: 'x' }));
    await assertSucceeds(updateDoc(doc(as('org'), 'tornei', T), { nome: 'x' }));
  });
});

describe('squadre e inviti', () => {
  it('il partner entra solo con il token giusto', async () => {
    const db = as('a1');
    const b = writeBatch(db);
    b.set(doc(db, 'tornei', T, 'squadre', 's1'), { nome: 'S', giocatori: ['a1'], girone: null, stato: 'in attesa partner', creatoDa: 'a1' });
    b.set(doc(db, 'tornei', T, 'inviti', 'tok'), { squadraId: 's1', creatoDa: 'a1' });
    await assertSucceeds(b.commit());
    const join = (uid: string, invito: string) =>
      updateDoc(doc(as(uid), 'tornei', T, 'squadre', 's1'), { giocatori: ['a1', uid], stato: 'da approvare', invito });
    await assertFails(join('a2', 'sbagliato'));
    await assertSucceeds(join('a2', 'tok'));
    await assertFails(join('x', 'tok'));
    await assertFails(updateDoc(doc(as('a1'), 'tornei', T, 'squadre', 's1'), { stato: 'approvata' }));
  });
});

describe('richieste', () => {
  it('solo uno dei 4 giocatori crea la richiesta, con lock sullo slot', async () => {
    await assertFails(creaRichiesta('x'));
    await assertSucceeds(creaRichiesta('a1'));
    await assertFails(creaRichiesta('b1')); // slot già richiesto e richiesta attiva
  });

  it('l\'ID deve corrispondere a campo, giorno e ora', async () => {
    const db = as('a1');
    const b = writeBatch(db);
    b.set(doc(db, 'richieste', 'c1_20991114_1900'), richiesta('a1'));
    b.update(doc(db, 'tornei', T, 'partite', P), { stato: 'richiesta', richiestaId: 'c1_20991114_1900' });
    await assertFails(b.commit());
  });

  it('fuori griglia solo se consentito dal torneo', async () => {
    await assertFails(creaRichiesta('a1', { fuoriGriglia: true }));
  });

  it('accettazioni: ognuno aggiunge solo la propria chiave', async () => {
    await creaRichiesta('a1', { accettazioni: { a1: serverTimestamp() } });
    await assertSucceeds(updateDoc(doc(as('b1'), 'richieste', RID), { 'accettazioni.b1': serverTimestamp() }));
    await assertFails(updateDoc(doc(as('b1'), 'richieste', RID), { 'accettazioni.b2': serverTimestamp() }));
    await assertFails(updateDoc(doc(as('x'), 'richieste', RID), { 'accettazioni.x': serverTimestamp() }));
  });

  it('conferma solo dal gestore, con 4 accettazioni e occupazione scritta', async () => {
    await creaRichiesta('a1');
    await assertFails(updateDoc(doc(as('a1'), 'richieste', RID), { stato: 'confermata' }));
    await assertFails(updateDoc(doc(as('gest'), 'richieste', RID), { stato: 'confermata', gestitoDa: 'gest' }));
    const db = as('gest');
    const b = writeBatch(db);
    b.set(doc(db, 'occupazioni', 'c1_20991114'), { campoId: 'c1', data: '2099-11-14', items: { [RID]: { inizio: '18:00', fine: '19:30', tipo: 'campionato', creatoDa: 'gest' } } });
    b.update(doc(db, 'richieste', RID), { stato: 'confermata', gestitoDa: 'gest' });
    b.update(doc(db, 'tornei', T, 'partite', P), { stato: 'programmata', programmazione: { campoId: 'c1', data: '2099-11-14', inizio: '18:00', fine: '19:30' } });
    await assertSucceeds(b.commit());
  });

  it('conferma bloccata se mancano accettazioni', async () => {
    await creaRichiesta('a1', { accettazioni: { a1: serverTimestamp() } });
    const db = as('gest');
    const b = writeBatch(db);
    b.set(doc(db, 'occupazioni', 'c1_20991114'), { items: { [RID]: { inizio: '18:00', fine: '19:30', tipo: 'campionato', creatoDa: 'gest' } } });
    b.update(doc(db, 'richieste', RID), { stato: 'confermata', gestitoDa: 'gest' });
    await assertFails(b.commit());
  });

  it('il giocatore annulla la richiesta e la partita torna da programmare', async () => {
    await creaRichiesta('a1');
    const db = as('b2');
    const b = writeBatch(db);
    b.update(doc(db, 'richieste', RID), { stato: 'annullata', nota: 'x' });
    b.update(doc(db, 'tornei', T, 'partite', P), { stato: 'da programmare', richiestaId: null });
    await assertSucceeds(b.commit());
    // lo slot liberato si può richiedere di nuovo
    await assertSucceeds(creaRichiesta('a2'));
  });

  it('controproposta del gestore: chiude la vecchia e ne crea una nuova', async () => {
    await creaRichiesta('a1');
    const NEW = 'c2_20991114_1830';
    const db = as('gest');
    const b = writeBatch(db);
    b.update(doc(db, 'richieste', RID), { stato: 'rifiutata', nota: 'Controproposta', gestitoDa: 'gest' });
    b.set(doc(db, 'richieste', NEW), richiesta('gest', { campoId: 'c2', inizio: '18:30', fine: '20:00', controproposta: true, accettazioni: {} }));
    b.update(doc(db, 'tornei', T, 'partite', P), { stato: 'richiesta', richiestaId: NEW });
    await assertSucceeds(b.commit());
    // un giocatore non può creare richieste a nome del gestore né per altre partite
    await assertFails(updateDoc(doc(as('a1'), 'richieste', NEW), { stato: 'confermata' }));
  });

  it('una richiesta scaduta si può sovrascrivere', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'richieste', RID), { ...richiesta('zz'), partitaId: 'altra', scadenza: Timestamp.fromMillis(Date.now() - 1000) });
    });
    await assertSucceeds(creaRichiesta('a1'));
  });
});

describe('risultati', () => {
  const set = [{ a: 6, b: 4 }, { a: 6, b: 3 }];
  const inserisci = (uid: string) =>
    updateDoc(doc(as(uid), 'tornei', T, 'partite', P), { risultato: { set, inseritoDa: uid, confermatoDa: null, contestatoDa: null, nota: null } });

  it('inserimento da un giocatore, conferma solo dagli avversari', async () => {
    await assertFails(inserisci('x'));
    await assertSucceeds(inserisci('a1'));
    await assertFails(inserisci('b1')); // l'avversario non sovrascrive: conferma o contesta
    await assertFails(updateDoc(doc(as('a2'), 'tornei', T, 'partite', P), { 'risultato.confermatoDa': 'a2', stato: 'giocata' }));
    await assertFails(updateDoc(doc(as('b1'), 'tornei', T, 'partite', P), { 'risultato.confermatoDa': 'b1', 'risultato.set': [], stato: 'giocata' }));
    await assertSucceeds(updateDoc(doc(as('b1'), 'tornei', T, 'partite', P), { 'risultato.confermatoDa': 'b1', stato: 'giocata' }));
    // dopo la conferma modifica solo l'organizzatore
    await assertFails(inserisci('a1'));
    await assertSucceeds(updateDoc(doc(as('org'), 'tornei', T, 'partite', P), { risultato: null, stato: 'programmata' }));
  });

  it('contestazione dagli avversari', async () => {
    await inserisci('a1');
    await assertSucceeds(updateDoc(doc(as('b2'), 'tornei', T, 'partite', P), { 'risultato.contestatoDa': 'b2', 'risultato.nota': 'no', stato: 'contestata' }));
  });
});

describe('disponibilità e occupazioni', () => {
  it('disponibilità: scrive solo il proprietario', async () => {
    await assertSucceeds(setDoc(doc(as('a1'), 'disponibilita', `${T}_a1`), { torneoId: T, uid: 'a1', fasce: { '2099-11-14': ['14:00-19:00'] } }));
    await assertFails(setDoc(doc(as('a2'), 'disponibilita', `${T}_a1`), { torneoId: T, uid: 'a1', fasce: {} }));
    await assertSucceeds(getDoc(doc(as('b1'), 'disponibilita', `${T}_a1`)));
  });
  it('occupazioni e campi: solo gestore e admin', async () => {
    await assertFails(setDoc(doc(as('a1'), 'occupazioni', 'c1_20991114'), { items: {} }));
    await assertSucceeds(setDoc(doc(as('gest'), 'occupazioni', 'c1_20991114'), { items: {} }));
    await assertFails(setDoc(doc(as('org'), 'campi', 'c1'), { nome: 'C1' }));
    await assertSucceeds(setDoc(doc(as('admin'), 'campi', 'c1'), { nome: 'C1' }));
  });
});
