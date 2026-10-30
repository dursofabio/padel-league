// Prova del cron sull'emulatore: node smoke.mjs (con FIRESTORE_EMULATOR_HOST impostato)
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { execFileSync } from 'node:child_process';

initializeApp({ projectId: 'demo-padel' });
const db = getFirestore();
const d = new Date(); d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7)); // prossimo martedì
const tue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
await db.doc('tornei/t1/partite/p1').set({ stato: 'richiesta', richiestaId: 'c1_20990101_1800', giocatori: [] });
await db.doc('richieste/c1_20990101_1800').set({ torneoId: 't1', partitaId: 'p1', stato: 'attesa', scadenza: Timestamp.fromMillis(Date.now() - 1000) });
await db.doc('ricorrenze/r1').set({ campoId: 'c1', giornoSettimana: 2, inizio: '18:00', fine: '19:00', tipo: 'lezione', nota: 'scuola padel', dal: '2000-01-01', al: '2999-01-01' });
execFileSync('node', ['cron.mjs'], { stdio: 'inherit', env: { ...process.env, TASKS: 'scadenze,ricorrenze' } });
execFileSync('node', ['cron.mjs'], { stdio: 'inherit', env: { ...process.env, TASKS: 'ricorrenze' } }); // idempotente
const r = (await db.doc('richieste/c1_20990101_1800').get()).data();
const p = (await db.doc('tornei/t1/partite/p1').get()).data();
const o = (await db.doc(`occupazioni/c1_${tue.replaceAll('-', '')}`).get()).data();
const ok = r.stato === 'scaduta' && p.stato === 'da programmare' && o?.items?.ric_r1?.tipo === 'lezione';
console.log({ richiesta: r.stato, partita: p.stato, occupazione: o?.items?.ric_r1 });
if (!ok) { console.error('SMOKE FALLITO'); process.exit(1); }
console.log('SMOKE OK');
