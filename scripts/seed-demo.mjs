/**
 * Dati dimostrativi per gli emulatori locali.
 *   npm run emulators            (in un terminale)
 *   npm run seed:demo            (in un altro)
 * Utenti: admin@demo.it, org@demo.it, gestore@demo.it, p1@demo.it … p8@demo.it — password "password".
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
initializeApp({ projectId: 'demo-padel' });
const db = getFirestore();
const auth = getAuth();

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };

const utenti = [
  ['admin', 'Anna Admin', 'admin'],
  ['org', 'Oscar Organizzatore', 'organizzatore'],
  ['gestore', 'Gino Gestore', 'gestore'],
  ...Array.from({ length: 8 }, (_, i) => [`p${i + 1}`, `Giocatore ${i + 1}`, 'giocatore']),
];
for (const [uid, nome, role] of utenti) {
  await auth.createUser({ uid, email: `${uid}@demo.it`, password: 'password', displayName: nome }).catch(() => {});
  await db.doc(`users/${uid}`).set({ nome, email: `${uid}@demo.it`, telefono: '', role });
}

const tutti = [0, 1, 2, 3, 4, 5, 6];
await db.doc('campi/c1').set({ nome: 'Campo 1', primoSlot: '13:30', ultimoSlot: '21:00', durata: 90, giorniAttivi: tutti, eccezioni: [], ordine: 1 });
await db.doc('campi/c2').set({ nome: 'Campo 2', primoSlot: '14:00', ultimoSlot: '20:00', durata: 90, giorniAttivi: tutti, eccezioni: [], ordine: 2 });

const T = 'demo';
await db.doc(`tornei/${T}`).set({
  nome: 'Campionato Demo',
  stato: 'iscrizioni',
  sorteggio: {},
  fasiGenerate: [],
  config: {
    puntiVittoria: 3, puntiSconfitta: 0, puntiSconfittaSetDecisivo: 1,
    formatoSet: { setPerVincere: 2, superTieBreak: true },
    spareggi: ['punti', 'scontroDiretto', 'diffSet', 'diffGame', 'sorteggio'],
    criterioQualificazione: 'perPosizione',
    fasiFinali: [{ nome: 'Gold', posti: 2 }, { nome: 'Silver', posti: 2 }],
    consentiFuoriGriglia: true, passoFuoriGriglia: 30, scadenzaRichiesteOre: 48,
  },
});
await db.doc(`tornei/${T}/periodi/p1`).set({ fase: 'gironi', turno: null, inizio: day(0), fine: day(27), etichetta: 'Periodo 1' });
const squadre = [['s1', 'Le Bandejas', ['p1', 'p2']], ['s2', 'Vibora Team', ['p3', 'p4']], ['s3', 'Chiquita', ['p5', 'p6']], ['s4', 'Por Tres', ['p7', 'p8']]];
for (const [id, nome, giocatori] of squadre)
  await db.doc(`tornei/${T}/squadre/${id}`).set({ nome, giocatori, girone: 'A', stato: 'approvata', creatoDa: giocatori[0] });

// disponibilità: domani 14:00–19:00 per p1..p4 (p4 solo fino alle 17:00)
const domani = day(1);
for (const g of ['p1', 'p2', 'p3'])
  await db.doc(`disponibilita/${T}_${g}`).set({ torneoId: T, uid: g, fasce: { [domani]: ['14:00-19:00'] } });
await db.doc(`disponibilita/${T}_p4`).set({ torneoId: T, uid: 'p4', fasce: { [domani]: ['14:00-17:00'] } });
// lezione domani 16:00–17:00 sul campo 1
await db.doc(`occupazioni/c1_${domani.replaceAll('-', '')}`).set({
  campoId: 'c1', data: domani,
  items: { lez1: { inizio: '16:00', fine: '17:00', tipo: 'lezione', nota: 'Scuola padel', creatoDa: 'gestore' } },
});
console.log(`Seed completato. Torneo: #/t/${T}  (domani = ${domani})`);
