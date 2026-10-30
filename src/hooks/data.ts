import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../firebase';
import type { Campo, Partita, Periodo, Squadra, Torneo, UserProfile } from '../types';
import { useAuth } from './auth';
import { useDoc, useQuery } from './firestore';

/** Dati di un torneo in tempo reale: configurazione, squadre, periodi, partite. */
export function useTorneo(tid: string | undefined) {
  const torneo = useDoc<Torneo>(tid ? `tornei/${tid}` : null);
  const squadre = useQuery<Squadra>(tid ? collection(db, 'tornei', tid, 'squadre') : null, `sq-${tid}`);
  const periodi = useQuery<Periodo>(tid ? collection(db, 'tornei', tid, 'periodi') : null, `pe-${tid}`);
  const partite = useQuery<Partita>(tid ? collection(db, 'tornei', tid, 'partite') : null, `pa-${tid}`);
  const squadraById = useMemo(() => new Map(squadre.data.map((s) => [s.id, s])), [squadre.data]);
  const periodiOrdinati = useMemo(
    () => [...periodi.data].sort((a, b) => a.inizio.localeCompare(b.inizio)),
    [periodi.data],
  );
  return {
    torneo: torneo.data,
    squadre: squadre.data,
    periodi: periodiOrdinati,
    partite: partite.data,
    squadraById,
    loading: torneo.loading || squadre.loading || periodi.loading || partite.loading,
    error: torneo.error ?? squadre.error ?? periodi.error ?? partite.error,
  };
}

export function useCampi() {
  const q = useQuery<Campo>(collection(db, 'campi'), 'campi');
  const campi = useMemo(
    () => [...q.data].sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0) || a.nome.localeCompare(b.nome)),
    [q.data],
  );
  return { ...q, data: campi };
}

/** Profili utente (solo per utenti autenticati). Il volume è piccolo: ~50 giocatori. */
export function useUtenti() {
  const { user } = useAuth();
  const q = useQuery<UserProfile>(user ? collection(db, 'users') : null, `users-${user?.uid}`);
  const byId = useMemo(() => new Map(q.data.map((u) => [u.id, u])), [q.data]);
  return { ...q, byId, nome: (uid: string) => byId.get(uid)?.nome ?? '…' };
}

export function useTornei() {
  return useQuery<Torneo>(collection(db, 'tornei'), 'tornei');
}

export function useRichiesteGiocatore(uid: string | undefined) {
  return useQuery<import('../types').Richiesta>(
    uid ? query(collection(db, 'richieste'), where('giocatori', 'array-contains', uid)) : null,
    `rich-g-${uid}`,
  );
}
