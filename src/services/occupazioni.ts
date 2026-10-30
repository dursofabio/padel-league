import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db } from '../firebase';
import { occupazioniId, occupazioniSovrapposte } from '../lib/slots';
import { dateRange, overlaps, today, toMin, weekday } from '../lib/time';
import type { Campo, Occupazione, Richiesta, Ricorrenza } from '../types';
import { scriviLog } from './log';
import { ErroreUtente } from './prenotazioni';

function nuovoId() {
  return Math.random().toString(36).slice(2, 10);
}

export interface EsitoOccupazione {
  conflitti: number;
}

/**
 * Aggiunge un'occupazione di qualsiasi durata e orario. La transazione legge il documento
 * del giorno, rifiuta le sovrapposizioni con occupazioni esistenti e porta in "conflitto"
 * le richieste in attesa sovrapposte, avvisando il gestore.
 */
export async function aggiungiOccupazione(
  campoId: string,
  data: string,
  occ: Omit<Occupazione, 'creatoDa'>,
  uid: string,
  itemId = nuovoId(),
): Promise<EsitoOccupazione> {
  if (toMin(occ.fine) <= toMin(occ.inizio)) throw new ErroreUtente('L\'orario di fine deve seguire quello di inizio.');
  const pendenti = await getDocs(
    query(collection(db, 'richieste'), where('campoId', '==', campoId), where('data', '==', data)),
  );
  const ids = pendenti.docs.filter((d) => d.data().stato === 'attesa').map((d) => d.id);
  let conflitti = 0;
  await runTransaction(db, async (tx) => {
    conflitti = 0;
    const oRef = doc(db, 'occupazioni', occupazioniId(campoId, data));
    const [oSnap, ...rSnaps] = await Promise.all([tx.get(oRef), ...ids.map((id) => tx.get(doc(db, 'richieste', id)))]);
    const items = (oSnap.data()?.items ?? {}) as Record<string, Occupazione>;
    if (items[itemId]) return; // già presente (ricorrenza materializzata)
    const sovr = occupazioniSovrapposte(items, occ.inizio, occ.fine);
    if (sovr.length)
      throw new ErroreUtente(
        'Si sovrappone a: ' + sovr.map(([, o]) => `${o.tipo} ${o.inizio}–${o.fine}${o.nota ? ` (${o.nota})` : ''}`).join(', '),
      );
    for (const s of rSnaps) {
      const r = s.data() as Richiesta | undefined;
      if (!r || r.stato !== 'attesa' || !overlaps(r.inizio, r.fine, occ.inizio, occ.fine)) continue;
      conflitti++;
      tx.update(s.ref, { stato: 'conflitto', nota: `Campo occupato: ${occ.tipo} ${occ.inizio}–${occ.fine}`, gestitoDa: uid });
      tx.update(doc(db, 'tornei', r.torneoId, 'partite', r.partitaId), { stato: 'da programmare', richiestaId: null });
    }
    const item: Occupazione = { ...occ, nota: occ.nota ?? null, creatoDa: uid };
    if (oSnap.exists()) tx.update(oRef, { [`items.${itemId}`]: item });
    else tx.set(oRef, { campoId, data, items: { [itemId]: item } });
  });
  await scriviLog(uid, `occupazione ${occ.tipo}`, `${occupazioniId(campoId, data)}/${itemId}`);
  return { conflitti };
}

/** Libera un intervallo. Le partite del campionato si annullano dalla richiesta confermata. */
export async function rimuoviOccupazione(campoId: string, data: string, itemId: string, uid: string) {
  await runTransaction(db, async (tx) => {
    const oRef = doc(db, 'occupazioni', occupazioniId(campoId, data));
    const snap = await tx.get(oRef);
    const items = { ...((snap.data()?.items ?? {}) as Record<string, Occupazione>) };
    if (items[itemId]?.tipo === 'campionato')
      throw new ErroreUtente('È una partita del campionato: annullala dalla richiesta confermata.');
    delete items[itemId];
    tx.update(oRef, { items });
  });
  await scriviLog(uid, 'libera occupazione', `${occupazioniId(campoId, data)}/${itemId}`);
}

/** Chiude la giornata su tutti i campi (festività, manutenzione). */
export async function chiudiGiornata(campi: Campo[], data: string, nota: string, uid: string) {
  const errori: string[] = [];
  let conflitti = 0;
  for (const c of campi) {
    try {
      const e = await aggiungiOccupazione(c.id, data, { inizio: '00:00', fine: '24:00', tipo: 'chiusura', nota }, uid, 'chiusura');
      conflitti += e.conflitti;
    } catch (e) {
      errori.push(`${c.nome}: ${(e as Error).message}`);
    }
  }
  return { errori, conflitti };
}

/**
 * Materializza una ricorrenza nei documenti giornalieri (da oggi, o da `dal` se successivo).
 * È idempotente: l'ID dell'item deriva dalla ricorrenza. I giorni con sovrapposizioni si saltano.
 */
export async function materializzaRicorrenza(r: Ricorrenza, uid: string) {
  const from = r.dal > today() ? r.dal : today();
  const giorni = dateRange(from, r.al).filter((d) => weekday(d) === r.giornoSettimana);
  const saltati: string[] = [];
  let conflitti = 0;
  for (const d of giorni) {
    try {
      const e = await aggiungiOccupazione(
        r.campoId,
        d,
        { inizio: r.inizio, fine: r.fine, tipo: r.tipo, nota: r.nota, ricorrenzaId: r.id },
        uid,
        `ric_${r.id}`,
      );
      conflitti += e.conflitti;
    } catch (e) {
      saltati.push(`${d}: ${(e as Error).message}`);
    }
  }
  return { giorni: giorni.length, saltati, conflitti };
}
