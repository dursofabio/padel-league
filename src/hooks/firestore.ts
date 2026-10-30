import {
  doc,
  onSnapshot,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';

export interface Live<T> {
  data: T;
  loading: boolean;
  error?: Error;
}

/** Documento in tempo reale. `path` null = nessuna sottoscrizione. */
export function useDoc<T extends { id: string }>(path: string | null): Live<T | null> {
  const [state, setState] = useState<Live<T | null>>({ data: null, loading: !!path });
  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      doc(db, path),
      (snap) => setState({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [path]);
  return state;
}

/**
 * Query in tempo reale. `key` identifica la query (le Query di Firestore non sono confrontabili
 * per riferimento): quando cambia, ci si risottoscrive.
 */
export function useQuery<T extends { id: string }>(
  q: Query<DocumentData> | null,
  key: string,
): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: !!q });
  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false }),
      (error) => setState({ data: [], loading: false, error }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Più documenti in tempo reale per ID (es. disponibilità dei 4 giocatori, occupazioni di più giorni). */
export function useDocs<T extends { id: string }>(paths: string[]): Live<Record<string, T | undefined>> {
  const key = paths.join('|');
  const [state, setState] = useState<Live<Record<string, T | undefined>>>({ data: {}, loading: paths.length > 0 });
  useEffect(() => {
    if (!paths.length) {
      setState({ data: {}, loading: false });
      return;
    }
    const acc: Record<string, T | undefined> = {};
    let pending = new Set(paths);
    setState({ data: {}, loading: true });
    const unsubs = paths.map((p) =>
      onSnapshot(
        doc(db, p),
        (snap) => {
          acc[snap.id] = snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : undefined;
          pending.delete(p);
          setState({ data: { ...acc }, loading: pending.size > 0 });
        },
        (error) => {
          pending.delete(p);
          setState({ data: { ...acc }, loading: pending.size > 0, error });
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
