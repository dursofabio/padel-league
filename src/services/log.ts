import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/** Traccia delle azioni rilevanti. Best effort: un errore qui non blocca l'operazione. */
export async function scriviLog(chi: string, cosa: string, riferimento: string) {
  try {
    await addDoc(collection(db, 'log'), { chi, cosa, riferimento, quando: serverTimestamp() });
  } catch {
    /* ignorato */
  }
}
