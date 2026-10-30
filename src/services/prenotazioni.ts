import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  fasciaCopre,
  occupazioniId,
  occupazioniSovrapposte,
  richiestaAttiva,
  richiestaId,
  slotLiberoPiuVicino,
} from '../lib/slots';
import { addDays, addMin, dateRange, overlaps, today } from '../lib/time';
import type { Campo, Occupazione, Partita, Richiesta } from '../types';
import { scriviLog } from './log';

export class ErroreUtente extends Error {}

const partitaRef = (torneoId: string, partitaId: string) => doc(db, 'tornei', torneoId, 'partite', partitaId);

export interface NuovaRichiesta {
  torneoId: string;
  partita: Partita;
  campoId: string;
  data: string;
  inizio: string;
  durata: number;
  fuoriGriglia: boolean;
  /** Giocatori che risultano già accettati (chi propone e chi ha una fascia che copre l'orario). */
  accettati: string[];
  scadenzaOre: number;
  uid: string;
  nota?: string;
  controproposta?: boolean;
  /** Richiesta precedente della partita da chiudere (controproposta del gestore). */
  sostituisce?: string;
}

/**
 * Crea una richiesta con ID deterministico (lock sullo slot) e collega la partita.
 * Fallisce se lo slot ha già una richiesta attiva o se la partita ne ha già una in attesa.
 */
export async function creaRichiesta(n: NuovaRichiesta): Promise<string> {
  const id = richiestaId(n.campoId, n.data, n.inizio);
  const rRef = doc(db, 'richieste', id);
  const pRef = partitaRef(n.torneoId, n.partita.id);
  await runTransaction(db, async (tx) => {
    const [rSnap, pSnap] = await Promise.all([tx.get(rRef), tx.get(pRef)]);
    if (rSnap.exists() && richiestaAttiva(rSnap.data() as Richiesta))
      throw new ErroreUtente('Lo slot è già stato richiesto da un\'altra partita.');
    const p = pSnap.data() as Partita | undefined;
    if (!p) throw new ErroreUtente('Partita non trovata.');
    if (!['da programmare', 'richiesta'].includes(p.stato))
      throw new ErroreUtente(`La partita è nello stato "${p.stato}".`);
    if (p.stato === 'richiesta' && p.richiestaId && p.richiestaId !== n.sostituisce) {
      const old = await tx.get(doc(db, 'richieste', p.richiestaId));
      if (old.exists() && richiestaAttiva(old.data() as Richiesta))
        throw new ErroreUtente('La partita ha già una richiesta in attesa: annullala prima di farne un\'altra.');
    }
    if (n.sostituisce) {
      tx.update(doc(db, 'richieste', n.sostituisce), {
        stato: 'rifiutata',
        nota: `Controproposta: ${n.data} ${n.inizio}`,
        gestitoDa: n.uid,
      });
    }
    const accettazioni: Record<string, unknown> = {};
    for (const g of n.accettati) if (p.giocatori.includes(g)) accettazioni[g] = serverTimestamp();
    tx.set(rRef, {
      torneoId: n.torneoId,
      partitaId: n.partita.id,
      campoId: n.campoId,
      data: n.data,
      inizio: n.inizio,
      fine: addMin(n.inizio, n.durata),
      fuoriGriglia: n.fuoriGriglia,
      controproposta: !!n.controproposta,
      giocatori: p.giocatori,
      accettazioni,
      stato: 'attesa',
      scadenza: Timestamp.fromMillis(Date.now() + n.scadenzaOre * 3600_000),
      creatoDa: n.uid,
      nota: n.nota ?? null,
    });
    tx.update(pRef, { stato: 'richiesta', richiestaId: id });
  });
  await scriviLog(n.uid, n.controproposta ? 'controproposta' : 'richiesta', id);
  return id;
}

export async function accettaRichiesta(r: Richiesta, uid: string) {
  const b = writeBatch(db);
  b.update(doc(db, 'richieste', r.id), { [`accettazioni.${uid}`]: serverTimestamp() });
  await b.commit();
}

/** Annullamento da parte di un giocatore, finché la richiesta è in attesa. */
export async function annullaRichiesta(r: Richiesta, uid: string) {
  const b = writeBatch(db);
  b.update(doc(db, 'richieste', r.id), { stato: 'annullata', nota: 'Annullata da un giocatore' });
  const p = await getDoc(partitaRef(r.torneoId, r.partitaId));
  if (p.exists() && (p.data() as Partita).richiestaId === r.id)
    b.update(p.ref, { stato: 'da programmare', richiestaId: null });
  await b.commit();
  await scriviLog(uid, 'annulla richiesta', r.id);
}

/** Richieste in attesa sullo stesso campo e giorno (le transazioni client non possono fare query). */
async function richiesteInAttesa(campoId: string, data: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, 'richieste'), where('campoId', '==', campoId), where('data', '==', data)),
  );
  return snap.docs.filter((d) => d.data().stato === 'attesa').map((d) => d.id);
}

/**
 * Conferma del gestore (§8.1 punto 4). La transazione rilegge il documento delle occupazioni
 * del giorno, verifica che non ci siano sovrapposizioni e scrive l'occupazione "campionato".
 * Le altre richieste in attesa sovrapposte passano a "conflitto".
 */
export async function confermaRichiesta(r: Richiesta, uid: string): Promise<{ conflitti: number }> {
  const altre = (await richiesteInAttesa(r.campoId, r.data)).filter((id) => id !== r.id);
  let conflitti = 0;
  const esito = await runTransaction(db, async (tx) => {
    conflitti = 0;
    const rRef = doc(db, 'richieste', r.id);
    const oRef = doc(db, 'occupazioni', occupazioniId(r.campoId, r.data));
    const pRef = partitaRef(r.torneoId, r.partitaId);
    const [rSnap, oSnap, pSnap, ...altreSnap] = await Promise.all([
      tx.get(rRef),
      tx.get(oRef),
      tx.get(pRef),
      ...altre.map((id) => tx.get(doc(db, 'richieste', id))),
    ]);
    const cur = rSnap.data() as Richiesta | undefined;
    if (!cur || cur.stato !== 'attesa') throw new ErroreUtente('La richiesta non è più in attesa.');
    const mancanti = cur.giocatori.filter((g) => !cur.accettazioni?.[g]);
    if (mancanti.length) throw new ErroreUtente('Mancano delle accettazioni: si conferma solo con 4 su 4.');
    const items = (oSnap.data()?.items ?? {}) as Record<string, Occupazione>;
    const sovrapposte = occupazioniSovrapposte(items, cur.inizio, cur.fine);
    if (sovrapposte.length) {
      tx.update(rRef, { stato: 'conflitto', nota: 'Campo occupato al momento della conferma', gestitoDa: uid });
      if ((pSnap.data() as Partita | undefined)?.richiestaId === r.id)
        tx.update(pRef, { stato: 'da programmare', richiestaId: null });
      // niente throw: il passaggio a "conflitto" deve essere salvato
      return 'occupato' as const;
    }
    const occ: Occupazione = {
      inizio: cur.inizio,
      fine: cur.fine,
      tipo: 'campionato',
      nota: null,
      partitaId: cur.partitaId,
      richiestaId: r.id,
      torneoId: cur.torneoId,
      creatoDa: uid,
    };
    for (const s of altreSnap) {
      const a = s.data() as Richiesta | undefined;
      if (!a || a.stato !== 'attesa' || !overlaps(a.inizio, a.fine, cur.inizio, cur.fine)) continue;
      conflitti++;
      tx.update(s.ref, { stato: 'conflitto', nota: `Sovrapposta alla conferma di ${r.id}`, gestitoDa: uid });
      tx.update(partitaRef(a.torneoId, a.partitaId), { stato: 'da programmare', richiestaId: null });
    }
    if (oSnap.exists()) tx.update(oRef, { [`items.${r.id}`]: occ });
    else tx.set(oRef, { campoId: cur.campoId, data: cur.data, items: { [r.id]: occ } });
    tx.update(rRef, { stato: 'confermata', gestitoDa: uid });
    tx.update(pRef, {
      stato: 'programmata',
      richiestaId: r.id,
      programmazione: { campoId: cur.campoId, data: cur.data, inizio: cur.inizio, fine: cur.fine },
    });
    return 'ok' as const;
  });
  if (esito === 'occupato') throw new ErroreUtente('Il campo risulta occupato: la richiesta è passata in conflitto.');
  await scriviLog(uid, 'conferma richiesta', r.id);
  return { conflitti };
}

export async function rifiutaRichiesta(r: Richiesta, uid: string, nota?: string) {
  const b = writeBatch(db);
  b.update(doc(db, 'richieste', r.id), { stato: 'rifiutata', nota: nota ?? null, gestitoDa: uid });
  const p = await getDoc(partitaRef(r.torneoId, r.partitaId));
  if (p.exists() && (p.data() as Partita).richiestaId === r.id)
    b.update(p.ref, { stato: 'da programmare', richiestaId: null });
  await b.commit();
  await scriviLog(uid, 'rifiuta richiesta', r.id);
}

/** Annullamento di una partita già confermata (dal gestore): libera il campo. */
export async function annullaConfermata(r: Richiesta, uid: string, nota?: string) {
  await runTransaction(db, async (tx) => {
    const oRef = doc(db, 'occupazioni', occupazioniId(r.campoId, r.data));
    const pRef = partitaRef(r.torneoId, r.partitaId);
    const [oSnap, pSnap] = await Promise.all([tx.get(oRef), tx.get(pRef)]);
    if (oSnap.exists()) {
      const items = { ...(oSnap.data().items ?? {}) };
      delete items[r.id];
      tx.update(oRef, { items });
    }
    tx.update(doc(db, 'richieste', r.id), { stato: 'annullata', nota: nota ?? 'Annullata dal gestore', gestitoDa: uid });
    const p = pSnap.data() as Partita | undefined;
    if (p && p.richiestaId === r.id && p.stato === 'programmata')
      tx.update(pRef, { stato: 'da programmare', richiestaId: null, programmazione: null });
  });
  await scriviLog(uid, 'annulla partita confermata', r.id);
}

/**
 * Controproposta del gestore (§8.1 punto 5): trova lo slot di griglia libero più vicino
 * (stesso giorno e poi i giorni vicini, su tutti i campi) per la stessa partita.
 */
export async function trovaControproposta(r: Richiesta, campi: Campo[], raggioGiorni = 3) {
  const from = addDays(r.data, -raggioGiorni) < today() ? today() : addDays(r.data, -raggioGiorni);
  const giorni = dateRange(from, addDays(r.data, raggioGiorni));
  const occSnaps = await Promise.all(
    giorni.flatMap((d) => campi.map((c) => getDoc(doc(db, 'occupazioni', occupazioniId(c.id, d))))),
  );
  const occ = Object.fromEntries(occSnaps.map((s) => [s.id, s.data()?.items as Record<string, Occupazione> | undefined]));
  const rs = await getDocs(
    query(collection(db, 'richieste'), where('data', '>=', giorni[0]), where('data', '<=', giorni[giorni.length - 1])),
  );
  const richieste = rs.docs.map((d) => ({ id: d.id, ...d.data() }) as Richiesta).filter((x) => x.id !== r.id);
  const slot = slotLiberoPiuVicino(
    { campoId: r.campoId, data: r.data, inizio: r.inizio, fine: r.fine },
    campi,
    giorni,
    occ,
    richieste,
  );
  if (!slot) return null;
  const disp = await Promise.all(r.giocatori.map((g) => getDoc(doc(db, 'disponibilita', `${r.torneoId}_${g}`))));
  const accettati = r.giocatori.filter((_, i) => fasciaCopre(disp[i].data()?.fasce, slot.data, slot.inizio, slot.fine));
  return { slot, accettati };
}
