/**
 * Backend schedulato del campionato (GitHub Actions + Admin SDK).
 * Sostituisce le Cloud Functions, non disponibili sul piano Spark:
 *   - scadenza delle richieste senza risposta
 *   - materializzazione delle ricorrenze dei campi
 *   - segnalazione delle partite non giocate entro il periodo
 *   - promemoria email (disponibilità, richieste in scadenza, scadenze di periodo)
 *
 * Variabili d'ambiente:
 *   FIREBASE_SERVICE_ACCOUNT  JSON del service account (secret)
 *   TASKS                     elenco separato da virgole: scadenze,ricorrenze,nonGiocate,email (default: scadenze,ricorrenze)
 *   APP_URL                   URL pubblico dell'app (per i link nelle email)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM   (se assenti, le email sono solo stampate nel log)
 *   DRY_RUN=1                 non scrive nulla
 *   TZ                        fuso orario del circolo (es. Europe/Rome)
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

const DRY = process.env.DRY_RUN === '1';
const TASKS = (process.env.TASKS || 'scadenze,ricorrenze').split(',').map((s) => s.trim());
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
const ORIZZONTE_RICORRENZE = 28; // giorni

// con FIRESTORE_EMULATOR_HOST impostato si usa l'emulatore (test locali), senza credenziali
initializeApp(
  process.env.FIRESTORE_EMULATOR_HOST
    ? { projectId: process.env.GCLOUD_PROJECT || 'demo-padel' }
    : { credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) },
);
const db = getFirestore();

// ---------------------------------------------------------------- utilità
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const overlaps = (a0, a1, b0, b1) => toMin(a0) < toMin(b1) && toMin(b0) < toMin(a1);
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => fmt(new Date());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + n); return fmt(x); };
const weekday = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function scriviLog(cosa, riferimento) {
  if (!DRY) await db.collection('log').add({ chi: 'cron', cosa, riferimento, quando: FieldValue.serverTimestamp() });
}

// ---------------------------------------------------------------- scadenze
async function scadenze() {
  const snap = await db.collection('richieste').where('stato', '==', 'attesa').get();
  const now = Timestamp.now();
  let n = 0;
  for (const d of snap.docs) {
    const r = d.data();
    if (!r.scadenza || r.scadenza.toMillis() > now.toMillis()) continue;
    n++;
    if (DRY) continue;
    await db.runTransaction(async (tx) => {
      const pRef = db.doc(`tornei/${r.torneoId}/partite/${r.partitaId}`);
      const [cur, p] = await Promise.all([tx.get(d.ref), tx.get(pRef)]);
      if (cur.data()?.stato !== 'attesa') return;
      tx.update(d.ref, { stato: 'scaduta', nota: 'Nessuna risposta entro la scadenza' });
      if (p.exists && p.data().richiestaId === d.id && p.data().stato === 'richiesta')
        tx.update(pRef, { stato: 'da programmare', richiestaId: null });
    });
    await scriviLog('richiesta scaduta', d.id);
  }
  log(`scadenze: ${n} richieste scadute`);
}

// ---------------------------------------------------------------- ricorrenze
async function ricorrenze() {
  const snap = await db.collection('ricorrenze').get();
  const from = today();
  const to = addDays(from, ORIZZONTE_RICORRENZE);
  let creati = 0, saltati = 0;
  for (const d of snap.docs) {
    const r = { id: d.id, ...d.data() };
    for (let g = from > r.dal ? from : r.dal; g <= to && g <= r.al; g = addDays(g, 1)) {
      if (weekday(g) !== Number(r.giornoSettimana)) continue;
      const ref = db.doc(`occupazioni/${r.campoId}_${g.replaceAll('-', '')}`);
      const itemId = `ric_${r.id}`;
      const esito = await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        const items = s.exists ? s.data().items || {} : {};
        if (items[itemId]) return 'presente';
        if (Object.values(items).some((o) => overlaps(o.inizio, o.fine, r.inizio, r.fine))) return 'sovrapposta';
        if (DRY) return 'creato';
        const item = { inizio: r.inizio, fine: r.fine, tipo: r.tipo, nota: r.nota || null, ricorrenzaId: r.id, creatoDa: 'cron' };
        if (s.exists) tx.update(ref, { [`items.${itemId}`]: item });
        else tx.set(ref, { campoId: r.campoId, data: g, items: { [itemId]: item } });
        return 'creato';
      });
      if (esito === 'creato') creati++;
      if (esito === 'sovrapposta') { saltati++; log(`ricorrenza ${r.id}: ${g} saltato (sovrapposizione)`); }
    }
  }
  log(`ricorrenze: ${creati} occupazioni create, ${saltati} saltate`);
}

// ---------------------------------------------------------------- partite non giocate
async function nonGiocate() {
  const out = [];
  const tornei = await db.collection('tornei').where('stato', 'in', ['gironi', 'fasiFinali']).get();
  for (const t of tornei.docs) {
    const periodi = await t.ref.collection('periodi').get();
    const scaduti = periodi.docs.filter((p) => p.data().fine < today());
    if (!scaduti.length) continue;
    const partite = await t.ref.collection('partite').get();
    for (const per of scaduti) {
      const aperte = partite.docs.filter((p) => p.data().periodoId === per.id && !['giocata', 'tavolino'].includes(p.data().stato));
      if (aperte.length) out.push({ torneo: t.data().nome, torneoId: t.id, periodo: per.data().etichetta, partite: aperte.map((p) => p.id) });
    }
  }
  for (const o of out) await scriviLog('partite non giocate', `${o.torneoId}/${o.periodo}: ${o.partite.join(', ')}`);
  log(`non giocate: ${out.reduce((a, o) => a + o.partite.length, 0)} partite in periodi terminati`);
  return out;
}

// ---------------------------------------------------------------- email
async function email() {
  const users = new Map((await db.collection('users').get()).docs.map((d) => [d.id, d.data()]));
  const posta = new Map(); // uid -> righe
  const add = (uid, riga) => posta.set(uid, [...(posta.get(uid) || []), riga]);

  const tornei = await db.collection('tornei').where('stato', 'in', ['gironi', 'fasiFinali']).get();
  for (const t of tornei.docs) {
    const nome = t.data().nome;
    const [squadre, periodi, partite] = await Promise.all([
      t.ref.collection('squadre').where('stato', '==', 'approvata').get(),
      t.ref.collection('periodi').get(),
      t.ref.collection('partite').get(),
    ]);
    // 1. disponibilità non compilate (nessuna fascia futura)
    for (const s of squadre.docs)
      for (const uid of s.data().giocatori) {
        const disp = await db.doc(`disponibilita/${t.id}_${uid}`).get();
        const future = Object.keys(disp.data()?.fasce || {}).filter((d) => d >= today());
        if (!future.length) add(uid, `${nome}: non hai ancora indicato le tue disponibilità → ${APP_URL}/#/t/${t.id}/disponibilita`);
      }
    // 2. periodi in scadenza entro 3 giorni con partite non giocate
    for (const per of periodi.docs) {
      const { fine, etichetta } = per.data();
      if (fine < today() || fine > addDays(today(), 3)) continue;
      for (const p of partite.docs) {
        const pd = p.data();
        if (pd.periodoId !== per.id || ['giocata', 'tavolino', 'programmata'].includes(pd.stato)) continue;
        for (const uid of pd.giocatori || [])
          add(uid, `${nome}: il periodo "${etichetta}" termina il ${fine} e la tua partita non è ancora programmata → ${APP_URL}/#/t/${t.id}/partita/${p.id}`);
      }
    }
  }
  // 3. richieste in scadenza entro 12 ore
  const limite = Date.now() + 12 * 3600_000;
  const gestori = [...users.entries()].filter(([, u]) => ['gestore', 'admin'].includes(u.role)).map(([id]) => id);
  const attesa = await db.collection('richieste').where('stato', '==', 'attesa').get();
  for (const d of attesa.docs) {
    const r = d.data();
    const ms = r.scadenza?.toMillis?.() ?? 0;
    if (ms < Date.now() || ms > limite) continue;
    const mancanti = r.giocatori.filter((g) => !r.accettazioni?.[g]);
    const link = `${APP_URL}/#/t/${r.torneoId}/partita/${r.partitaId}`;
    if (mancanti.length) for (const uid of mancanti) add(uid, `Richiesta del ${r.data} alle ${r.inizio} in scadenza: accettala → ${link}`);
    else for (const uid of gestori) add(uid, `Richiesta del ${r.data} alle ${r.inizio} in scadenza: conferma o rifiuta → ${APP_URL}/#/gestore`);
  }

  // invio
  const smtp = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  let inviate = 0;
  for (const [uid, righe] of posta) {
    const u = users.get(uid);
    if (!u?.email) continue;
    const text = `Ciao ${u.nome || ''},\n\n${righe.map((r) => `• ${r}`).join('\n')}\n\nCampionato di padel`;
    if (!smtp || DRY) { log(`[email simulata] ${u.email}\n${text}`); continue; }
    await smtp.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: u.email, subject: 'Campionato di padel: promemoria', text });
    inviate++;
  }
  log(`email: ${posta.size} destinatari, ${inviate} inviate`);
}

// ---------------------------------------------------------------- main
const TASK = { scadenze, ricorrenze, nonGiocate, email };
for (const t of TASKS) {
  if (!TASK[t]) { console.error(`task sconosciuto: ${t}`); process.exitCode = 1; continue; }
  log(`--> ${t}${DRY ? ' (dry run)' : ''}`);
  await TASK[t]();
}
