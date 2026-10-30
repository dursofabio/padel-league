/**
 * Read hooks (TanStack Query). They always return domain types; realtime only invalidates them.
 * Features import from here and never call supabase directly.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import type { Campo, Disponibilita, Partita, Periodo, Richiesta, Ricorrenza, Squadra, Torneo, UserProfile } from '../types';
import {
  occupazioniPerGiorno,
  toCampo,
  toDisponibilita,
  toOccupazione,
  toPartite,
  toPeriodo,
  toProfile,
  toRichieste,
  toRicorrenza,
  toSquadre,
  toTorneo,
} from './adapters';
import type { Tables } from './database.types';
import { qk } from './keys';
import { rpc, supabase } from './supabase';

function check<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

// ------------------------------------------------------------------ tournaments

export function useTornei() {
  return useQuery({
    queryKey: qk.tornei(),
    queryFn: async (): Promise<Torneo[]> =>
      check(await supabase.from('tornei').select('*').order('created_at', { ascending: false })).map(toTorneo),
  });
}

export function useTorneo(tid: string | undefined) {
  return useQuery({
    queryKey: qk.torneo(tid ?? ''),
    enabled: !!tid,
    queryFn: async (): Promise<Torneo> => toTorneo(check(await supabase.from('tornei').select('*').eq('id', tid!).single())),
  });
}

export function usePeriodi(tid: string | undefined) {
  return useQuery({
    queryKey: qk.periodi(tid ?? ''),
    enabled: !!tid,
    queryFn: async (): Promise<Periodo[]> =>
      check(await supabase.from('periodi').select('*').eq('torneo_id', tid!).order('inizio')).map(toPeriodo),
  });
}

export function useSquadre(tid: string | undefined) {
  return useQuery({
    queryKey: qk.squadre(tid ?? ''),
    enabled: !!tid,
    queryFn: async (): Promise<Squadra[]> => {
      const [s, m] = await Promise.all([
        supabase.from('squadre').select('*').eq('torneo_id', tid!).order('nome'),
        supabase.from('squadra_giocatori').select('*').eq('torneo_id', tid!),
      ]);
      return toSquadre(check(s), check(m));
    },
  });
}

export function usePartite(tid: string | undefined) {
  return useQuery({
    queryKey: qk.partite(tid ?? ''),
    enabled: !!tid,
    queryFn: async (): Promise<Partita[]> =>
      toPartite(check(await supabase.from('partite_v').select('*').eq('torneo_id', tid!).order('codice'))),
  });
}

/** Everything a tournament screen needs, with lookup maps. */
export function useTorneoData(tid: string | undefined) {
  const torneo = useTorneo(tid);
  const periodi = usePeriodi(tid);
  const squadre = useSquadre(tid);
  const partite = usePartite(tid);
  const squadraById = useMemo(() => new Map((squadre.data ?? []).map((s) => [s.id, s])), [squadre.data]);
  const queries = [torneo, periodi, squadre, partite];
  return {
    torneo: torneo.data,
    periodi: periodi.data ?? [],
    squadre: squadre.data ?? [],
    partite: partite.data ?? [],
    squadraById,
    isPending: queries.some((q) => q.isPending),
    error: queries.find((q) => q.error)?.error ?? null,
    refetch: () => queries.forEach((q) => q.refetch()),
  };
}

// ------------------------------------------------------------------ courts and occupations

export function useCampi() {
  return useQuery({
    queryKey: qk.campi(),
    queryFn: async (): Promise<Campo[]> =>
      check(await supabase.from('campi').select('*').order('ordine').order('nome')).map(toCampo),
  });
}

export function useRicorrenze() {
  return useQuery({
    queryKey: qk.ricorrenze(),
    queryFn: async (): Promise<Ricorrenza[]> =>
      check(await supabase.from('ricorrenze').select('*').order('giorno_settimana').order('inizio')).map(toRicorrenza),
  });
}

/** Occupations between two dates (inclusive): rows plus a per-court-day map for src/lib/slots. */
export function useOccupazioni(from: string, to: string, enabled = true) {
  const q = useQuery({
    queryKey: qk.occupazioni(from, to),
    enabled,
    queryFn: async () =>
      check(await supabase.from('occupazioni').select('*').gte('data', from).lte('data', to).order('inizio')).map(toOccupazione),
  });
  const perGiorno = useMemo(() => occupazioniPerGiorno(q.data ?? []), [q.data]);
  return { ...q, righe: q.data ?? [], perGiorno };
}

// ------------------------------------------------------------------ requests

async function richiesteDa(query: PromiseLike<{ data: Tables<'richieste'>[] | null; error: unknown }>): Promise<Richiesta[]> {
  const rows = check(await query);
  if (!rows.length) return [];
  const g = check(
    await supabase.from('richiesta_giocatori').select('*').in('richiesta_id', rows.map((r) => r.id)),
  );
  return toRichieste(rows, g);
}

/** Requests in a date window (to color the slot grid and the timeline). */
export function useRichiesteFinestra(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: qk.richieste('finestra', from, to),
    enabled,
    queryFn: () => richiesteDa(supabase.from('richieste').select('*').gte('data', from).lte('data', to)),
  });
}

/** Pending requests (court manager's inbox). */
export function useRichiesteInAttesa(enabled = true) {
  return useQuery({
    queryKey: qk.richieste('attesa'),
    enabled,
    queryFn: () => richiesteDa(supabase.from('richieste').select('*').eq('stato', 'attesa').order('data').order('inizio')),
  });
}

/** Confirmed requests from a given day on (upcoming matches, court manager side). */
export function useRichiesteConfermate(from: string, enabled = true) {
  return useQuery({
    queryKey: qk.richieste('confermate', from),
    enabled,
    queryFn: () =>
      richiesteDa(supabase.from('richieste').select('*').eq('stato', 'confermata').gte('data', from).order('data').order('inizio')),
  });
}

/** Requests that involve a player (to accept, to follow). */
export function useRichiesteGiocatore(uid: string | undefined) {
  return useQuery({
    queryKey: qk.richieste('giocatore', uid),
    enabled: !!uid,
    queryFn: async () => {
      const ids = check(await supabase.from('richiesta_giocatori').select('richiesta_id').eq('user_id', uid!)).map(
        (r) => r.richiesta_id,
      );
      if (!ids.length) return [];
      return richiesteDa(supabase.from('richieste').select('*').in('id', ids).in('stato', ['attesa', 'confermata', 'conflitto', 'scaduta', 'rifiutata']));
    },
  });
}

export function useRichiesta(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.richieste('una', id ?? ''),
    enabled: !!id,
    queryFn: async () => (await richiesteDa(supabase.from('richieste').select('*').eq('id', id!)))[0] ?? null,
  });
}

// ------------------------------------------------------------------ availability

/** Availability of several players (the 4 of a match) in a tournament: uid → fasce. */
export function useDisponibilita(tid: string | undefined, uids: string[]) {
  const sorted = [...uids].sort();
  return useQuery({
    queryKey: qk.disponibilita(tid ?? '', sorted),
    enabled: !!tid && sorted.length > 0,
    queryFn: async (): Promise<Record<string, Disponibilita | undefined>> => {
      const rows = check(await supabase.from('disponibilita').select('*').eq('torneo_id', tid!).in('user_id', sorted)).map(
        toDisponibilita,
      );
      return Object.fromEntries(rows.map((d) => [d.uid, d]));
    },
  });
}

// ------------------------------------------------------------------ people

/** All profiles (authenticated users only). */
export function useProfili() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.profili(),
    enabled: !!user,
    queryFn: async (): Promise<UserProfile[]> => check(await supabase.from('profiles').select('*').order('nome')).map(toProfile),
  });
}

/**
 * Player names: from public profiles if not logged in, from full profiles otherwise.
 * Returns `nome(uid)` that never fails ("…" while loading).
 */
export function useNomi() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: [...qk.nomi(), !!user],
    queryFn: async () => {
      const rows = check(await supabase.from('giocatori_pubblici').select('*'));
      return new Map(rows.map((r) => [r.id, r.nome]));
    },
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const map = q.data ?? new Map<string, string>();
    return { ...q, nome: (uid: string | null | undefined) => (uid ? (map.get(uid) ?? '…') : '—') };
  }, [q]);
}

export function useMioInvito(squadraId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.invito(squadraId ?? ''),
    enabled: !!squadraId && enabled,
    queryFn: () => rpc('my_invite_token', { p_squadra: squadraId! }),
  });
}

export function useInvito(token: string | undefined) {
  return useQuery({
    queryKey: ['invito-token', token],
    enabled: !!token,
    queryFn: async () =>
      (await rpc('get_invite', { p_token: token! })) as {
        squadra_id: string;
        torneo_id: string;
        nome: string;
        creatore_nome: string;
        stato: string;
        giocatori: number;
      } | null,
  });
}
