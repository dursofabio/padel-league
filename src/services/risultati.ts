import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Partita, SetScore, TorneoConfig } from '../types';
import { scriviLog } from './log';

const ref = (torneoId: string, partitaId: string) => doc(db, 'tornei', torneoId, 'partite', partitaId);

/** Inserito da uno dei 4 giocatori; vale solo dopo la conferma di un avversario. */
export async function inserisciRisultato(torneoId: string, p: Partita, set: SetScore[], uid: string) {
  await updateDoc(ref(torneoId, p.id), {
    risultato: { set, inseritoDa: uid, confermatoDa: null, contestatoDa: null, nota: null },
  });
  await scriviLog(uid, 'inserisce risultato', p.id);
}

export async function confermaRisultato(torneoId: string, p: Partita, uid: string) {
  await updateDoc(ref(torneoId, p.id), { 'risultato.confermatoDa': uid, stato: 'giocata' });
  await scriviLog(uid, 'conferma risultato', p.id);
}

export async function contestaRisultato(torneoId: string, p: Partita, uid: string, nota: string) {
  await updateDoc(ref(torneoId, p.id), {
    'risultato.contestatoDa': uid,
    'risultato.nota': nota || null,
    stato: 'contestata',
  });
  await scriviLog(uid, 'contesta risultato', p.id);
}

/** Organizzatore: risolve una contestazione o corregge un risultato. */
export async function impostaRisultato(torneoId: string, p: Partita, set: SetScore[], uid: string, nota?: string) {
  await updateDoc(ref(torneoId, p.id), {
    risultato: { set, inseritoDa: p.risultato?.inseritoDa ?? uid, confermatoDa: uid, contestatoDa: p.risultato?.contestatoDa ?? null, nota: nota ?? null },
    stato: 'giocata',
  });
  await scriviLog(uid, 'imposta risultato', p.id);
}

/** Organizzatore: sconfitta a tavolino (risultato convenzionale con set vinti a zero). */
export async function assegnaTavolino(
  torneoId: string,
  p: Partita,
  vincente: 'A' | 'B',
  config: TorneoConfig,
  uid: string,
  nota: string,
) {
  const set: SetScore[] = Array.from({ length: config.formatoSet.setPerVincere }, () =>
    vincente === 'A' ? { a: 6, b: 0 } : { a: 0, b: 6 },
  );
  await updateDoc(ref(torneoId, p.id), {
    risultato: { set, inseritoDa: uid, confermatoDa: uid, contestatoDa: null, nota: nota || 'Tavolino' },
    stato: 'tavolino',
  });
  await scriviLog(uid, 'tavolino', p.id);
}

export async function annullaRisultato(torneoId: string, p: Partita, uid: string) {
  await updateDoc(ref(torneoId, p.id), {
    risultato: null,
    stato: p.programmazione ? 'programmata' : 'da programmare',
  });
  await scriviLog(uid, 'annulla risultato', p.id);
}
