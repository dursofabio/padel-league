/**
 * Database rows → domain types (src/types.ts) consumed by the pure logic in src/lib.
 * Keeping this conversion here leaves src/lib independent of the database shape.
 */
import { withDefaultConfig } from '../lib/config';
import { courtDayId } from '../lib/slots';
import type {
  Availability,
  Booking,
  BookingRow,
  Court,
  Instant,
  Match,
  MatchRequest,
  Period,
  Recurrence,
  SetScore,
  Team,
  Tournament,
  TournamentConfig,
  UserProfile,
  Windows,
} from '../types';
import type { Tables, Views } from './database.types';

/** "18:00:00" → "18:00"; "24:00:00" → "24:00". */
export function hhmm(t: string | null | undefined): string {
  return (t ?? '').slice(0, 5);
}

export function instant(iso: string): Instant {
  const ms = Date.parse(iso);
  return { toMillis: () => ms };
}

export function toProfile(r: Tables<'profiles'>): UserProfile {
  return { id: r.id, name: r.name, email: r.email, phone: r.phone, roles: r.roles };
}

export function toTournament(r: Tables<'tournaments'>): Tournament {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    config: withDefaultConfig(r.config as Partial<TournamentConfig>),
    draw: (r.draw as Record<string, number>) ?? {},
    generatedPhases: r.generated_phases ?? [],
  };
}

export function toPeriod(r: Tables<'periods'>): Period {
  return { id: r.id, phase: r.phase, round: r.round, startsOn: r.starts_on, endsOn: r.ends_on, label: r.label };
}

export function toTeams(rows: Tables<'teams'>[], members: Tables<'team_players'>[]): Team[] {
  const byTeam = new Map<string, Tables<'team_players'>[]>();
  for (const m of members) byTeam.set(m.team_id, [...(byTeam.get(m.team_id) ?? []), m]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    group: r.group_name,
    status: r.status,
    createdBy: r.created_by,
    players: (byTeam.get(r.id) ?? []).sort((a, b) => a.position - b.position).map((m) => m.user_id),
  }));
}

/** Matches from the matches_v view. next_code → id of the next match (for src/lib/bracket). */
export function toMatches(rows: Views<'matches_v'>[]): Match[] {
  const idByCode = new Map(rows.map((r) => [r.code, r.id]));
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    phase: r.phase,
    group: r.group_name,
    round: r.round,
    position: r.position,
    nextCode: r.next_code ? (idByCode.get(r.next_code) ?? null) : null,
    side: (r.side as 'A' | 'B' | null) ?? null,
    teamA: r.team_a,
    teamB: r.team_b,
    playersA: r.players_a ?? [],
    playersB: r.players_b ?? [],
    players: r.players ?? [],
    periodId: r.period_id,
    status: r.status,
    requestId: r.request_id,
    schedule:
      r.sched_court_id && r.sched_date && r.sched_start && r.sched_end
        ? { courtId: r.sched_court_id, date: r.sched_date, start: hhmm(r.sched_start), end: hhmm(r.sched_end) }
        : null,
    result:
      r.sets && r.entered_by
        ? {
            sets: r.sets as unknown as SetScore[],
            enteredBy: r.entered_by,
            confirmedBy: r.confirmed_by,
            disputedBy: r.disputed_by,
            note: r.result_note,
          }
        : null,
    updatedAt: r.updated_at,
  }));
}

export function toCourt(r: Tables<'courts'>): Court {
  return {
    id: r.id,
    name: r.name,
    firstSlot: hhmm(r.first_slot),
    lastSlot: hhmm(r.last_slot),
    slotMinutes: r.slot_minutes,
    activeDays: r.active_days ?? [],
    closedDates: r.closed_dates ?? [],
    sortOrder: r.sort_order,
  };
}

export function toRecurrence(r: Tables<'recurrences'>): Recurrence {
  return {
    id: r.id,
    courtId: r.court_id,
    weekday: r.weekday,
    start: hhmm(r.start_time),
    end: hhmm(r.end_time),
    type: r.type,
    note: r.note ?? '',
    validFrom: r.valid_from,
    validTo: r.valid_to,
  };
}

export function toBooking(r: Tables<'bookings'>): BookingRow {
  return {
    id: r.id,
    courtId: r.court_id,
    date: r.date,
    start: hhmm(r.start_time),
    end: hhmm(r.end_time),
    type: r.type,
    note: r.note,
    matchId: r.match_id,
    requestId: r.request_id,
    tournamentId: r.tournament_id,
    recurrenceId: r.recurrence_id,
    createdBy: r.created_by,
  };
}

/** Bookings grouped as src/lib/slots expects: courtDayId(court, day) → { id → booking }. */
export function bookingsByCourtDay(rows: BookingRow[]): Record<string, Record<string, Booking>> {
  const out: Record<string, Record<string, Booking>> = {};
  for (const b of rows) {
    const k = courtDayId(b.courtId, b.date);
    (out[k] ??= {})[b.id] = b;
  }
  return out;
}

export function toRequests(rows: Tables<'requests'>[], players: Tables<'request_players'>[]): MatchRequest[] {
  const byRequest = new Map<string, Tables<'request_players'>[]>();
  for (const p of players) byRequest.set(p.request_id, [...(byRequest.get(p.request_id) ?? []), p]);
  return rows.map((r) => {
    const ps = byRequest.get(r.id) ?? [];
    return {
      id: r.id,
      tournamentId: r.tournament_id,
      matchId: r.match_id,
      courtId: r.court_id,
      date: r.date,
      start: hhmm(r.start_time),
      end: hhmm(r.end_time),
      offGrid: r.off_grid,
      counterProposal: r.counter_proposal,
      players: ps.map((p) => p.user_id),
      acceptances: Object.fromEntries(ps.map((p) => [p.user_id, p.accepted_at ? instant(p.accepted_at) : null])),
      status: r.status,
      expiresAt: instant(r.expires_at),
      createdBy: r.created_by,
      note: r.note,
      createdAt: r.created_at,
    };
  });
}

export function toAvailability(r: Tables<'availability'>): Availability {
  return { id: `${r.tournament_id}_${r.user_id}`, tournamentId: r.tournament_id, uid: r.user_id, windows: (r.windows as Windows) ?? {} };
}
