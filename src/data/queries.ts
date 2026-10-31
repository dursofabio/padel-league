/**
 * Read hooks (TanStack Query). They always return domain types; realtime only invalidates them.
 * Features import from here and never call supabase directly.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import type { Availability, Court, Match, MatchRequest, Period, Recurrence, Team, TeamStatus, Tournament, UserProfile } from '../types';
import {
  bookingsByCourtDay,
  toAvailability,
  toBooking,
  toCourt,
  toMatches,
  toPeriod,
  toProfile,
  toRecurrence,
  toRequests,
  toTeams,
  toTournament,
} from './adapters';
import type { Tables } from './database.types';
import { qk } from './keys';
import { rpc, supabase } from './supabase';

function check<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

// ------------------------------------------------------------------ tournaments

export function useTournaments() {
  return useQuery({
    queryKey: qk.tournaments(),
    queryFn: async (): Promise<Tournament[]> =>
      check(await supabase.from('tournaments').select('*').order('created_at', { ascending: false })).map(toTournament),
  });
}

export function useTournament(tid: string | undefined) {
  return useQuery({
    queryKey: qk.tournament(tid ?? ''),
    enabled: !!tid,
    queryFn: async (): Promise<Tournament> =>
      toTournament(check(await supabase.from('tournaments').select('*').eq('id', tid!).single())),
  });
}

export function usePeriods(tid: string | undefined) {
  return useQuery({
    queryKey: qk.periods(tid ?? ''),
    enabled: !!tid,
    queryFn: async (): Promise<Period[]> =>
      check(await supabase.from('periods').select('*').eq('tournament_id', tid!).order('starts_on')).map(toPeriod),
  });
}

export function useTeams(tid: string | undefined) {
  return useQuery({
    queryKey: qk.teams(tid ?? ''),
    enabled: !!tid,
    queryFn: async (): Promise<Team[]> => {
      const [t, p] = await Promise.all([
        supabase.from('teams').select('*').eq('tournament_id', tid!).order('name'),
        supabase.from('team_players').select('*').eq('tournament_id', tid!),
      ]);
      return toTeams(check(t), check(p));
    },
  });
}

export function useMatches(tid: string | undefined) {
  return useQuery({
    queryKey: qk.matches(tid ?? ''),
    enabled: !!tid,
    queryFn: async (): Promise<Match[]> =>
      toMatches(check(await supabase.from('matches_v').select('*').eq('tournament_id', tid!).order('code'))),
  });
}

/** Everything a tournament screen needs, with lookup maps. */
export function useTournamentData(tid: string | undefined) {
  const tournament = useTournament(tid);
  const periods = usePeriods(tid);
  const teams = useTeams(tid);
  const matches = useMatches(tid);
  const teamById = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t])), [teams.data]);
  const queries = [tournament, periods, teams, matches];
  return {
    tournament: tournament.data,
    periods: periods.data ?? [],
    teams: teams.data ?? [],
    matches: matches.data ?? [],
    teamById,
    isPending: queries.some((q) => q.isPending),
    error: queries.find((q) => q.error)?.error ?? null,
    refetch: () => queries.forEach((q) => q.refetch()),
  };
}

// ------------------------------------------------------------------ courts and bookings

export function useCourts() {
  return useQuery({
    queryKey: qk.courts(),
    queryFn: async (): Promise<Court[]> =>
      check(await supabase.from('courts').select('*').order('sort_order').order('name')).map(toCourt),
  });
}

export function useRecurrences() {
  return useQuery({
    queryKey: qk.recurrences(),
    queryFn: async (): Promise<Recurrence[]> =>
      check(await supabase.from('recurrences').select('*').order('weekday').order('start_time')).map(toRecurrence),
  });
}

/** Bookings between two dates (inclusive): rows plus a per-court-day map for src/lib/slots. */
export function useBookings(from: string, to: string, enabled = true) {
  const q = useQuery({
    queryKey: qk.bookings(from, to),
    enabled,
    queryFn: async () =>
      check(await supabase.from('bookings').select('*').gte('date', from).lte('date', to).order('start_time')).map(toBooking),
  });
  const byCourtDay = useMemo(() => bookingsByCourtDay(q.data ?? []), [q.data]);
  return { ...q, rows: q.data ?? [], byCourtDay };
}

// ------------------------------------------------------------------ requests

async function requestsFrom(query: PromiseLike<{ data: Tables<'requests'>[] | null; error: unknown }>): Promise<MatchRequest[]> {
  const rows = check(await query);
  if (!rows.length) return [];
  const players = check(
    await supabase.from('request_players').select('*').in('request_id', rows.map((r) => r.id)),
  );
  return toRequests(rows, players);
}

/** Requests in a date range (to color the slot grid and the timeline). */
export function useRequestsInRange(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: qk.requests('range', from, to),
    enabled,
    queryFn: () => requestsFrom(supabase.from('requests').select('*').gte('date', from).lte('date', to)),
  });
}

/** Pending requests (court manager's inbox). */
export function usePendingRequests(enabled = true) {
  return useQuery({
    queryKey: qk.requests('pending'),
    enabled,
    queryFn: () =>
      requestsFrom(supabase.from('requests').select('*').eq('status', 'pending').order('date').order('start_time')),
  });
}

/** Confirmed requests from a given day on (upcoming matches, court manager side). */
export function useConfirmedRequests(from: string, enabled = true) {
  return useQuery({
    queryKey: qk.requests('confirmed', from),
    enabled,
    queryFn: () =>
      requestsFrom(
        supabase.from('requests').select('*').eq('status', 'confirmed').gte('date', from).order('date').order('start_time'),
      ),
  });
}

/** Requests that involve a player (to accept, to follow). */
export function usePlayerRequests(uid: string | undefined) {
  return useQuery({
    queryKey: qk.requests('player', uid),
    enabled: !!uid,
    queryFn: async () => {
      const ids = check(await supabase.from('request_players').select('request_id').eq('user_id', uid!)).map(
        (r) => r.request_id,
      );
      if (!ids.length) return [];
      return requestsFrom(
        supabase.from('requests').select('*').in('id', ids).in('status', ['pending', 'confirmed', 'conflict', 'expired', 'rejected']),
      );
    },
  });
}

export function useRequest(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.requests('one', id ?? ''),
    enabled: !!id,
    queryFn: async () => (await requestsFrom(supabase.from('requests').select('*').eq('id', id!)))[0] ?? null,
  });
}

// ------------------------------------------------------------------ availability

/** Availability of several players (the 4 of a match) in a tournament: uid → availability. */
export function useAvailability(tid: string | undefined, uids: string[]) {
  const sorted = [...uids].sort();
  return useQuery({
    queryKey: qk.availability(tid ?? '', sorted),
    enabled: !!tid && sorted.length > 0,
    queryFn: async (): Promise<Record<string, Availability | undefined>> => {
      const rows = check(
        await supabase.from('availability').select('*').eq('tournament_id', tid!).in('user_id', sorted),
      ).map(toAvailability);
      return Object.fromEntries(rows.map((a) => [a.uid, a]));
    },
  });
}

// ------------------------------------------------------------------ people

/** All profiles (authenticated users only). */
export function useProfiles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.profiles(),
    enabled: !!user,
    queryFn: async (): Promise<UserProfile[]> =>
      check(await supabase.from('profiles').select('*').order('name')).map(toProfile),
  });
}

/**
 * Player names from the public_players view.
 * Returns `name(uid)` that never fails ("…" while loading).
 */
export function useNames() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: [...qk.names(), !!user],
    queryFn: async () => {
      const rows = check(await supabase.from('public_players').select('*'));
      return new Map(rows.map((r) => [r.id, r.name]));
    },
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const map = q.data ?? new Map<string, string>();
    return { ...q, name: (uid: string | null | undefined) => (uid ? (map.get(uid) ?? '…') : '—') };
  }, [q]);
}

export function useMyInvite(teamId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.invite(teamId ?? ''),
    enabled: !!teamId && enabled,
    queryFn: () => rpc('my_invite_token', { p_team: teamId! }),
  });
}

/** Public data of an invite (get_invite RPC). */
export interface InviteInfo {
  team_id: string;
  tournament_id: string;
  name: string;
  creator_name: string;
  status: TeamStatus;
  /** Number of players already in the team. */
  players: number;
}

export function useInvite(token: string | undefined) {
  return useQuery({
    queryKey: ['invite-token', token],
    enabled: !!token,
    queryFn: async () => (await rpc('get_invite', { p_token: token! })) as unknown as InviteInfo | null,
  });
}
