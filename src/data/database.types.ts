/**
 * Database types in the format produced by `supabase gen types typescript`.
 * Written by hand from docs/api-contract.md: regenerate them from the real
 * project (`npx supabase gen types typescript --project-id <ref>`) and keep
 * the two in sync.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = [];

export type AppRole = 'admin' | 'organizer' | 'manager' | 'player';
export type TournamentStatus = 'registration' | 'groups' | 'finals' | 'completed';
export type TeamStatus = 'awaiting_partner' | 'pending_approval' | 'approved' | 'withdrawn';
export type MatchStatus = 'unscheduled' | 'requested' | 'scheduled' | 'played' | 'disputed' | 'forfeit';
export type RequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'conflict' | 'expired';
export type BookingType = 'external' | 'lesson' | 'closure' | 'match';

type ProfilesRow = { id: string; name: string; email: string; phone: string | null; roles: AppRole[]; created_at: string }
type TournamentsRow = { id: string; name: string; status: TournamentStatus; config: Json; draw: Json; generated_phases: string[]; created_at: string }
type PeriodsRow = { id: string; tournament_id: string; phase: string; round: number | null; starts_on: string; ends_on: string; label: string }
type TeamsRow = { id: string; tournament_id: string; name: string; group_name: string | null; status: TeamStatus; created_by: string; created_at: string }
type TeamPlayersRow = { team_id: string; tournament_id: string; user_id: string; position: number }
type InvitesRow = { token: string; team_id: string; tournament_id: string; created_by: string }
type MatchesRow = {
  id: string; tournament_id: string; code: string; phase: string; group_name: string | null; round: number | null; position: number | null;
  next_code: string | null; side: string | null; team_a: string | null; team_b: string | null; period_id: string | null;
  status: MatchStatus; request_id: string | null; sets: Json | null; entered_by: string | null; confirmed_by: string | null;
  disputed_by: string | null; result_note: string | null; updated_at: string;
}
type MatchesVRow = MatchesRow & {
  players_a: string[]; players_b: string[]; players: string[];
  sched_court_id: string | null; sched_date: string | null; sched_start: string | null; sched_end: string | null;
}
type CourtsRow = {
  id: string; name: string; first_slot: string; last_slot: string; slot_minutes: number; active_days: number[]; closed_dates: string[]; sort_order: number;
}
type RecurrencesRow = {
  id: string; court_id: string; weekday: number; start_time: string; end_time: string; type: BookingType; note: string; valid_from: string; valid_to: string;
}
type BookingsRow = {
  id: string; court_id: string; date: string; start_time: string; end_time: string; time_range: string; type: BookingType; note: string | null;
  match_id: string | null; request_id: string | null; tournament_id: string | null; recurrence_id: string | null; created_by: string | null;
}
type RequestsRow = {
  id: string; tournament_id: string; match_id: string; court_id: string; date: string; start_time: string; end_time: string; time_range: string;
  off_grid: boolean; counter_proposal: boolean; status: RequestStatus; expires_at: string; created_by: string;
  handled_by: string | null; note: string | null; created_at: string;
}
type RequestPlayersRow = { request_id: string; user_id: string; accepted_at: string | null }
type AvailabilityRow = { tournament_id: string; user_id: string; windows: Json; updated_at: string }
type AuditLogRow = { id: number; actor_id: string | null; action: string; target: string; created_at: string }

type Table<R, I = Partial<R>> = { Row: R; Insert: I; Update: Partial<R>; Relationships: Rel };
type View<R> = { Row: R; Relationships: Rel };
type Fn<A, R> = { Args: A; Returns: R };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfilesRow>;
      tournaments: Table<TournamentsRow>;
      periods: Table<PeriodsRow>;
      teams: Table<TeamsRow>;
      team_players: Table<TeamPlayersRow>;
      invites: Table<InvitesRow>;
      matches: Table<MatchesRow>;
      courts: Table<CourtsRow>;
      recurrences: Table<RecurrencesRow>;
      bookings: Table<BookingsRow>;
      requests: Table<RequestsRow>;
      request_players: Table<RequestPlayersRow>;
      availability: Table<AvailabilityRow>;
      audit_log: Table<AuditLogRow>;
    };
    Views: {
      matches_v: View<MatchesVRow>;
      public_players: View<{ id: string; name: string }>;
    };
    Functions: {
      create_request: Fn<{ p_match: string; p_court: string; p_date: string; p_start: string; p_note?: string | null }, string>;
      accept_request: Fn<{ p_request: string }, undefined>;
      cancel_request: Fn<{ p_request: string; p_note?: string | null }, undefined>;
      confirm_request: Fn<{ p_request: string }, Json>;
      reject_request: Fn<{ p_request: string; p_note?: string | null }, undefined>;
      cancel_confirmed: Fn<{ p_request: string; p_note?: string | null }, undefined>;
      player_cancel_confirmed: Fn<{ p_request: string; p_note?: string | null }, undefined>;
      counter_propose: Fn<{ p_request: string; p_court: string; p_date: string; p_start: string; p_note?: string | null }, string>;
      add_occupation: Fn<{ p_court: string; p_date: string; p_start: string; p_end: string; p_type: BookingType; p_note?: string | null }, Json>;
      remove_occupation: Fn<{ p_id: string }, undefined>;
      close_day: Fn<{ p_date: string; p_note: string }, Json>;
      materialize_recurrence: Fn<{ p_recurrence: string; p_days?: number }, Json>;
      submit_result: Fn<{ p_match: string; p_sets: Json }, undefined>;
      confirm_result: Fn<{ p_match: string }, undefined>;
      contest_result: Fn<{ p_match: string; p_note: string }, undefined>;
      set_official_result: Fn<{ p_match: string; p_sets: Json; p_note?: string | null }, undefined>;
      assign_forfeit: Fn<{ p_match: string; p_winner: string; p_note?: string | null }, undefined>;
      clear_result: Fn<{ p_match: string }, undefined>;
      create_team: Fn<{ p_tournament: string; p_name: string }, Json>;
      get_invite: Fn<{ p_token: string }, Json>;
      join_team: Fn<{ p_token: string }, string>;
      my_invite_token: Fn<{ p_team: string }, string | null>;
      generate_calendar: Fn<{ p_tournament: string; p_matches: Json }, number>;
      generate_finals: Fn<{ p_tournament: string; p_phase: string; p_matches: Json }, number>;
      sync_bracket: Fn<{ p_tournament: string; p_updates: Json }, number>;
      set_tournament_state: Fn<{ p_tournament: string; p_status: TournamentStatus }, undefined>;
      set_roles: Fn<{ p_user: string; p_roles: AppRole[] }, undefined>;
      reminder_emails: Fn<Record<string, never>, Json>;
    };
    Enums: {
      app_role: AppRole;
      tournament_status: TournamentStatus;
      team_status: TeamStatus;
      match_status: MatchStatus;
      request_status: RequestStatus;
      booking_type: BookingType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];
