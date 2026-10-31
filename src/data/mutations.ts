/**
 * Writes: RPCs for anything that needs integrity, direct table writes only where RLS allows them
 * (own availability, profile, courts/recurrences for the court manager, config/periods for the organizer).
 * Features use `useAction(actions.x, { success })`.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { BookingType, Court, Period, Recurrence, SetScore, TeamStatus, TournamentConfig, TournamentStatus, Windows } from '../types';
import type { AppRole, Json } from './database.types';
import { errorMessage } from './errors';
import { rpc, supabase } from './supabase';

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}

/** Result of confirm_request: `taken` = the slot was taken in the meantime, `expired` = the request expired. */
export type ConfirmOutcome = { outcome: 'ok' | 'taken' | 'expired'; conflicts: number };

/** Row of the generate_calendar payload (one group-stage match). */
export interface CalendarMatchInput {
  code: string;
  group_name: string;
  round: number;
  position: number;
  team_a: string;
  team_b: string;
  period_id: string | null;
}

/** Row of the generate_finals payload (one bracket match). */
export interface FinalsMatchInput {
  code: string;
  round: number;
  position: number;
  next_code: string | null;
  side: 'A' | 'B' | null;
  team_a: string | null;
  team_b: string | null;
  period_id: string | null;
}

export const actions = {
  // requests
  createRequest: (a: { match: string; court: string; date: string; start: string; note?: string }) =>
    rpc('create_request', { p_match: a.match, p_court: a.court, p_date: a.date, p_start: a.start, p_note: a.note ?? null }),
  acceptRequest: (request: string) => rpc('accept_request', { p_request: request }),
  cancelRequest: (a: { request: string; note?: string }) => rpc('cancel_request', { p_request: a.request, p_note: a.note ?? null }),
  confirmRequest: async (request: string) => (await rpc('confirm_request', { p_request: request })) as unknown as ConfirmOutcome,
  rejectRequest: (a: { request: string; note?: string }) => rpc('reject_request', { p_request: a.request, p_note: a.note ?? null }),
  cancelConfirmed: (a: { request: string; note?: string }) =>
    rpc('cancel_confirmed', { p_request: a.request, p_note: a.note ?? null }),
  playerCancelConfirmed: (a: { request: string; note?: string }) =>
    rpc('player_cancel_confirmed', { p_request: a.request, p_note: a.note ?? null }),
  counterPropose: (a: { request: string; court: string; date: string; start: string; note?: string }) =>
    rpc('counter_propose', { p_request: a.request, p_court: a.court, p_date: a.date, p_start: a.start, p_note: a.note ?? null }),

  // bookings
  addBooking: async (a: { court: string; date: string; start: string; end: string; type: BookingType; note?: string }) =>
    (await rpc('add_occupation', {
      p_court: a.court,
      p_date: a.date,
      p_start: a.start,
      p_end: a.end,
      p_type: a.type,
      p_note: a.note ?? null,
    })) as unknown as { id: string; conflicts: number },
  removeBooking: (id: string) => rpc('remove_occupation', { p_id: id }),
  closeDay: async (a: { date: string; note: string }) =>
    (await rpc('close_day', { p_date: a.date, p_note: a.note })) as unknown as { errors: string[]; conflicts: number },
  materializeRecurrence: async (a: { recurrence: string; days?: number }) =>
    (await rpc('materialize_recurrence', { p_recurrence: a.recurrence, p_days: a.days ?? 60 })) as unknown as {
      created: number;
      skipped: string[];
    },

  // results
  submitResult: (a: { match: string; sets: SetScore[] }) =>
    rpc('submit_result', { p_match: a.match, p_sets: a.sets as unknown as Json }),
  confirmResult: (match: string) => rpc('confirm_result', { p_match: match }),
  disputeResult: (a: { match: string; note: string }) => rpc('contest_result', { p_match: a.match, p_note: a.note }),
  setOfficialResult: (a: { match: string; sets: SetScore[]; note?: string }) =>
    rpc('set_official_result', { p_match: a.match, p_sets: a.sets as unknown as Json, p_note: a.note ?? null }),
  assignForfeit: (a: { match: string; winner: 'A' | 'B'; note?: string }) =>
    rpc('assign_forfeit', { p_match: a.match, p_winner: a.winner, p_note: a.note ?? null }),
  clearResult: (match: string) => rpc('clear_result', { p_match: match }),

  // teams
  createTeam: async (a: { tournament: string; name: string }) =>
    (await rpc('create_team', { p_tournament: a.tournament, p_name: a.name })) as unknown as { team_id: string; token: string },
  joinTeam: (token: string) => rpc('join_team', { p_token: token }),
  updateTeam: (a: { id: string; name?: string; group?: string | null; status?: TeamStatus }) => {
    const patch: { name?: string; group_name?: string | null; status?: TeamStatus } = {};
    if (a.name !== undefined) patch.name = a.name;
    if (a.group !== undefined) patch.group_name = a.group;
    if (a.status !== undefined) patch.status = a.status;
    return ok(supabase.from('teams').update(patch).eq('id', a.id));
  },
  deleteTeam: (id: string) => ok(supabase.from('teams').delete().eq('id', id)),

  // tournament (organizer)
  createTournament: async (a: { name: string; config: TournamentConfig }) =>
    ok(
      supabase
        .from('tournaments')
        .insert({ name: a.name, status: 'registration', config: a.config as unknown as Json, draw: {}, generated_phases: [] })
        .select('id')
        .single(),
    ),
  updateTournament: (a: { id: string; name?: string; config?: TournamentConfig; draw?: Record<string, number> }) => {
    const patch: { name?: string; config?: Json; draw?: Json } = {};
    if (a.name !== undefined) patch.name = a.name;
    if (a.config !== undefined) patch.config = a.config as unknown as Json;
    if (a.draw !== undefined) patch.draw = a.draw;
    return ok(supabase.from('tournaments').update(patch).eq('id', a.id));
  },
  setTournamentStatus: (a: { tournament: string; status: TournamentStatus }) =>
    rpc('set_tournament_state', { p_tournament: a.tournament, p_status: a.status }),
  savePeriod: (a: { tournament: string; period: Omit<Period, 'id'> & { id?: string } }) => {
    const { id, ...p } = a.period;
    const row = {
      tournament_id: a.tournament,
      phase: p.phase,
      round: p.round ?? null,
      starts_on: p.startsOn,
      ends_on: p.endsOn,
      label: p.label,
    };
    return id ? ok(supabase.from('periods').update(row).eq('id', id)) : ok(supabase.from('periods').insert(row));
  },
  deletePeriod: (id: string) => ok(supabase.from('periods').delete().eq('id', id)),
  generateCalendar: (a: { tournament: string; matches: CalendarMatchInput[] }) =>
    rpc('generate_calendar', { p_tournament: a.tournament, p_matches: a.matches as unknown as Json }),
  generateFinals: (a: { tournament: string; phase: string; matches: FinalsMatchInput[] }) =>
    rpc('generate_finals', { p_tournament: a.tournament, p_phase: a.phase, p_matches: a.matches as unknown as Json }),
  syncBracket: (a: { tournament: string; updates: { code: string; team_a: string | null; team_b: string | null }[] }) =>
    rpc('sync_bracket', { p_tournament: a.tournament, p_updates: a.updates as unknown as Json }),

  // courts and recurrences (court manager)
  saveCourt: (c: Court) =>
    ok(
      supabase.from('courts').upsert({
        id: c.id,
        name: c.name,
        first_slot: c.firstSlot,
        last_slot: c.lastSlot,
        slot_minutes: c.slotMinutes,
        active_days: c.activeDays,
        closed_dates: c.closedDates,
        sort_order: c.sortOrder ?? 0,
      }),
    ),
  deleteCourt: (id: string) => ok(supabase.from('courts').delete().eq('id', id)),
  saveRecurrence: async (r: Omit<Recurrence, 'id'> & { id?: string }) => {
    const row = {
      court_id: r.courtId,
      weekday: r.weekday,
      start_time: r.start,
      end_time: r.end,
      type: r.type,
      note: r.note,
      valid_from: r.validFrom,
      valid_to: r.validTo,
    };
    const res = r.id
      ? await ok(supabase.from('recurrences').update(row).eq('id', r.id).select('id').single())
      : await ok(supabase.from('recurrences').insert(row).select('id').single());
    return res as { id: string };
  },
  deleteRecurrence: (id: string) => ok(supabase.from('recurrences').delete().eq('id', id)),

  // player and profile
  saveAvailability: (a: { tournament: string; uid: string; windows: Windows }) =>
    ok(
      supabase
        .from('availability')
        .upsert({ tournament_id: a.tournament, user_id: a.uid, windows: a.windows as unknown as Json }),
    ),
  updateProfile: (a: { id: string; name?: string; phone?: string | null }) => {
    const { id, ...patch } = a;
    return ok(supabase.from('profiles').update(patch).eq('id', id));
  },
  setRoles: (a: { user: string; roles: AppRole[] }) => rpc('set_roles', { p_user: a.user, p_roles: a.roles }),
};

/**
 * Wraps an action: pending state, Italian error toast, optional success toast, and cache invalidation
 * (realtime covers other users' changes; here we refresh our own right away).
 * `success` is the Italian toast text; `error: false` disables the error toast.
 */
export function useAction<A, R>(
  fn: (a: A) => Promise<R>,
  opts: { success?: string | ((r: R) => string | null); error?: false; onSuccess?: (r: R) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      const msg = typeof opts.success === 'function' ? opts.success(r) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(r);
    },
    onError: (e) => {
      if (opts.error !== false) toast.error(errorMessage(e));
    },
    onSettled: () => qc.invalidateQueries(),
  });
}
