import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { berger, giornataToPeriodo } from '../lib/berger';
import { derivaTabellone, generaTabellone, type EsitoQualificazione } from '../lib/bracket';
import type { Partita, Periodo, Squadra, Torneo, TorneoConfig } from '../types';
import { scriviLog } from './log';
import { ErroreUtente } from './prenotazioni';

export const CONFIG_DEFAULT: TorneoConfig = {
  puntiVittoria: 3,
  puntiSconfitta: 0,
  puntiSconfittaSetDecisivo: 1,
  formatoSet: { setPerVincere: 2, superTieBreak: true },
  spareggi: ['punti', 'scontroDiretto', 'diffSet', 'diffGame', 'sorteggio'],
  criterioQualificazione: 'perPosizione',
  fasiFinali: [
    { nome: 'Gold', posti: 8 },
    { nome: 'Silver', posti: 8 },
  ],
  consentiFuoriGriglia: true,
  passoFuoriGriglia: 30,
  scadenzaRichiesteOre: 48,
};

export async function creaTorneo(nome: string, uid: string) {
  const r = await addDoc(collection(db, 'tornei'), { nome, stato: 'iscrizioni', config: CONFIG_DEFAULT, sorteggio: {}, fasiGenerate: [] });
  await scriviLog(uid, 'crea torneo', r.id);
  return r.id;
}

export async function aggiornaTorneo(torneoId: string, patch: Partial<Omit<Torneo, 'id'>>) {
  await updateDoc(doc(db, 'tornei', torneoId), patch);
}

export async function salvaPeriodo(torneoId: string, p: Omit<Periodo, 'id'>, id?: string) {
  if (id) await setDoc(doc(db, 'tornei', torneoId, 'periodi', id), p);
  else await addDoc(collection(db, 'tornei', torneoId, 'periodi'), p);
}

export async function eliminaPeriodo(torneoId: string, id: string) {
  await deleteDoc(doc(db, 'tornei', torneoId, 'periodi', id));
}

// ------------------------------------------------------------------ squadre e inviti

function token() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Il primo giocatore crea la coppia e ottiene il link d'invito per il partner. */
export async function creaSquadra(torneoId: string, nome: string, uid: string) {
  const sRef = doc(collection(db, 'tornei', torneoId, 'squadre'));
  const t = token();
  const b = writeBatch(db);
  b.set(sRef, { nome, giocatori: [uid], girone: null, stato: 'in attesa partner', creatoDa: uid });
  b.set(doc(db, 'tornei', torneoId, 'inviti', t), { squadraId: sRef.id, creatoDa: uid });
  await b.commit();
  return { squadraId: sRef.id, token: t };
}

export async function tokenInvito(torneoId: string, squadraId: string, uid: string): Promise<string | null> {
  const snap = await getDocs(
    query(collection(db, 'tornei', torneoId, 'inviti'), where('creatoDa', '==', uid)),
  );
  return snap.docs.find((d) => d.data().squadraId === squadraId)?.id ?? null;
}

export async function leggiInvito(torneoId: string, t: string) {
  const inv = await getDoc(doc(db, 'tornei', torneoId, 'inviti', t));
  if (!inv.exists()) return null;
  const s = await getDoc(doc(db, 'tornei', torneoId, 'squadre', inv.data().squadraId));
  return s.exists() ? ({ id: s.id, ...s.data() } as Squadra) : null;
}

export async function uniscitiASquadra(torneoId: string, squadra: Squadra, t: string, uid: string) {
  if (squadra.giocatori.includes(uid)) throw new ErroreUtente('Fai già parte di questa coppia.');
  if (squadra.stato !== 'in attesa partner') throw new ErroreUtente('La coppia è già completa.');
  await updateDoc(doc(db, 'tornei', torneoId, 'squadre', squadra.id), {
    giocatori: [...squadra.giocatori, uid],
    stato: 'da approvare',
    invito: t,
  });
  await scriviLog(uid, 'entra in squadra', squadra.id);
}

export async function aggiornaSquadra(torneoId: string, id: string, patch: Partial<Omit<Squadra, 'id'>>) {
  await updateDoc(doc(db, 'tornei', torneoId, 'squadre', id), patch);
}

export async function eliminaSquadra(torneoId: string, id: string) {
  await deleteDoc(doc(db, 'tornei', torneoId, 'squadre', id));
}

// ------------------------------------------------------------------ calendario

function giocatoriPartita(a: Squadra | undefined, b: Squadra | undefined) {
  const giocatoriA = a?.giocatori ?? [];
  const giocatoriB = b?.giocatori ?? [];
  return { giocatoriA, giocatoriB, giocatori: [...giocatoriA, ...giocatoriB] };
}

/**
 * Genera il calendario della fase a gironi (Berger) per tutte le coppie approvate con girone.
 * Le giornate si distribuiscono in blocchi consecutivi tra i periodi della fase a gironi.
 */
export async function generaCalendario(torneoId: string, squadre: Squadra[], periodi: Periodo[], uid: string) {
  const esistenti = await getDocs(query(collection(db, 'tornei', torneoId, 'partite'), where('fase', '==', 'gironi')));
  if (!esistenti.empty) throw new ErroreUtente('Il calendario dei gironi è già stato generato.');
  const perGirone = new Map<string, Squadra[]>();
  for (const s of squadre)
    if (s.stato === 'approvata' && s.girone) perGirone.set(s.girone, [...(perGirone.get(s.girone) ?? []), s]);
  if (!perGirone.size) throw new ErroreUtente('Nessuna coppia approvata con girone assegnato.');
  const per = periodi.filter((p) => p.fase === 'gironi').sort((a, b) => a.inizio.localeCompare(b.inizio));

  let b = writeBatch(db);
  let ops = 0;
  let tot = 0;
  for (const [girone, lista] of [...perGirone.entries()].sort()) {
    // ordine casuale: il calendario non dipende dall'ordine di iscrizione
    const mescolate = [...lista].sort(() => Math.random() - 0.5);
    const cal = berger(mescolate);
    const giornate = Math.max(...cal.map((c) => c.giornata));
    const toPer = giornataToPeriodo(giornate, per.length);
    const contatore = new Map<number, number>();
    for (const c of cal) {
      const i = contatore.get(c.giornata) ?? 0;
      contatore.set(c.giornata, i + 1);
      const id = `g${girone}-${String(c.giornata).padStart(2, '0')}-${i + 1}`;
      const partita: Omit<Partita, 'id'> = {
        fase: 'gironi',
        girone,
        turno: c.giornata,
        posizione: i,
        prossimaPartita: null,
        lato: null,
        squadraA: c.casa.id,
        squadraB: c.ospite.id,
        ...giocatoriPartita(c.casa, c.ospite),
        periodoId: per.length ? per[toPer(c.giornata)].id : null,
        stato: 'da programmare',
        richiestaId: null,
        programmazione: null,
        risultato: null,
      };
      b.set(doc(db, 'tornei', torneoId, 'partite', id), partita);
      tot++;
      if (++ops === 450) {
        await b.commit();
        b = writeBatch(db);
        ops = 0;
      }
    }
  }
  b.update(doc(db, 'tornei', torneoId), { stato: 'gironi' });
  await b.commit();
  await scriviLog(uid, 'genera calendario', torneoId);
  return tot;
}

// ------------------------------------------------------------------ fasi finali

/** Scrive i tabelloni (solo struttura e squadre note). L'avanzamento è derivato dal client. */
export async function generaFasiFinali(
  torneo: Torneo,
  q: EsitoQualificazione,
  squadre: Squadra[],
  periodi: Periodo[],
  uid: string,
) {
  const byId = new Map(squadre.map((s) => [s.id, s]));
  const b = writeBatch(db);
  const generate: string[] = [];
  for (const f of q.fasi) {
    const fase = f.nome.toLowerCase();
    if (torneo.fasiGenerate?.includes(fase)) throw new ErroreUtente(`La fase ${f.nome} è già stata generata.`);
    const tab = generaTabellone(
      fase,
      f.squadre.map((s) => s.squadraId),
      (id) => byId.get(id)?.girone ?? undefined,
    );
    for (const m of tab) {
      const periodo = periodi.find((p) => p.fase === fase && p.turno === m.turno) ?? periodi.find((p) => p.fase === fase && !p.turno);
      const partita: Omit<Partita, 'id'> = {
        fase,
        girone: null,
        turno: m.turno,
        posizione: m.posizione,
        prossimaPartita: m.prossimaPartita,
        lato: m.lato,
        squadraA: m.squadraA,
        squadraB: m.squadraB,
        ...giocatoriPartita(m.squadraA ? byId.get(m.squadraA) : undefined, m.squadraB ? byId.get(m.squadraB) : undefined),
        periodoId: periodo?.id ?? null,
        stato: 'da programmare',
        richiestaId: null,
        programmazione: null,
        risultato: null,
      };
      b.set(doc(db, 'tornei', torneo.id, 'partite', m.id), partita);
    }
    generate.push(fase);
  }
  b.update(doc(db, 'tornei', torneo.id), {
    stato: 'fasiFinali',
    fasiGenerate: [...(torneo.fasiGenerate ?? []), ...generate],
  });
  await b.commit();
  await scriviLog(uid, 'genera fasi finali', torneo.id);
}

/**
 * Le Security Rules delle richieste leggono i giocatori dalla partita: quando dai risultati
 * emerge una nuova coppia nel tabellone, l'organizzatore la scrive nella partita successiva
 * (così la griglia di prenotazione si apre solo quando entrambe le coppie sono note).
 */
export async function sincronizzaTabellone(torneo: Torneo, partite: Partita[], squadre: Squadra[]) {
  const byId = new Map(squadre.map((s) => [s.id, s]));
  const der = derivaTabellone(partite, torneo.config.formatoSet);
  const b = writeBatch(db);
  let n = 0;
  for (const p of partite) {
    const d = der.get(p.id);
    if (!d || (d.squadraA === p.squadraA && d.squadraB === p.squadraB)) continue;
    if (!['da programmare'].includes(p.stato)) continue;
    b.update(doc(db, 'tornei', torneo.id, 'partite', p.id), {
      squadraA: d.squadraA,
      squadraB: d.squadraB,
      ...giocatoriPartita(d.squadraA ? byId.get(d.squadraA) : undefined, d.squadraB ? byId.get(d.squadraB) : undefined),
    });
    n++;
  }
  if (n) await b.commit();
  return n;
}
