/** Absolute instant (expiries, acceptances): the adapters convert the database's ISO strings. */
export interface Instant {
  toMillis(): number;
}

export type Role = 'admin' | 'organizer' | 'manager' | 'player';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  /** Multiple roles: a court manager can also play. */
  roles: Role[];
}

export type Tiebreaker = 'points' | 'headToHead' | 'setDiff' | 'gameDiff' | 'setsWon' | 'gamesWon' | 'draw';

export interface SetFormat {
  /** Sets needed to win (2 = best of three). */
  setsToWin: number;
  /** The deciding set is played as a super tie-break to 10. */
  superTieBreak: boolean;
}

export interface FinalPhaseConfig {
  name: string; // "Gold", "Silver"
  spots: number;
}

export type QualificationRule = 'byPosition' | 'crossGroup';

export interface TournamentConfig {
  pointsWin: number;
  pointsLoss: number;
  /** Extra points for the loser when the match goes to the deciding set. */
  pointsLossDecidingSet: number;
  setFormat: SetFormat;
  tiebreakers: Tiebreaker[];
  qualificationRule: QualificationRule;
  finals: FinalPhaseConfig[];
  allowOffGrid: boolean;
  offGridStep: 15 | 30;
  requestExpiryHours: number;
  /** Hours before the start within which a player can cancel a confirmed match. */
  playerCancelHours: number;
}

export type TournamentStatus = 'registration' | 'groups' | 'finals' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  config: TournamentConfig;
  /** Draw order for unresolved ties: teamId -> position (lower = better). */
  draw?: Record<string, number>;
  /** Final phases already generated (lowercase names). */
  generatedPhases?: string[];
}

export type TeamStatus = 'awaiting_partner' | 'pending_approval' | 'approved' | 'withdrawn';

export interface Team {
  id: string;
  name: string;
  players: string[];
  group?: string | null;
  status: TeamStatus;
  createdBy: string;
}

export interface Period {
  id: string;
  phase: string; // "groups" | "gold" | "silver"
  round?: number | null; // final phases: knockout round
  startsOn: string; // yyyy-mm-dd
  endsOn: string; // yyyy-mm-dd
  label: string;
}

export type MatchStatus = 'unscheduled' | 'requested' | 'scheduled' | 'played' | 'disputed' | 'forfeit';

/** One set: { a: games of team A, b: games of team B }. */
export interface SetScore {
  a: number;
  b: number;
}

export interface MatchResult {
  sets: SetScore[];
  enteredBy: string;
  confirmedBy?: string | null;
  disputedBy?: string | null;
  note?: string | null;
}

export interface Schedule {
  courtId: string;
  date: string; // yyyy-mm-dd
  start: string;
  end: string;
}

export interface Match {
  id: string;
  /** Readable, stable code (e.g. "gA-01-1", "gold-t1-p0"): links the bracket matches. */
  code?: string;
  phase: string; // "groups" | "gold" | "silver"
  group?: string | null;
  round?: number | null;
  position?: number | null;
  /** Id of the next bracket match (resolved from `next_code` by the adapter). */
  nextCode?: string | null;
  side?: 'A' | 'B' | null;
  teamA: string | null;
  teamB: string | null;
  playersA: string[];
  playersB: string[];
  players: string[];
  periodId?: string | null;
  status: MatchStatus;
  requestId?: string | null;
  schedule?: Schedule | null;
  result?: MatchResult | null;
  /** Last change (ISO): flags results left unconfirmed for too long. */
  updatedAt?: string;
}

export interface Court {
  id: string;
  name: string;
  firstSlot: string;
  /** Last start time of the grid. */
  lastSlot: string;
  slotMinutes: number;
  /** 0 = Sunday … 6 = Saturday */
  activeDays: number[];
  /** Dates (yyyy-mm-dd) when the court is closed. */
  closedDates: string[];
  sortOrder?: number;
}

export type BookingType = 'external' | 'lesson' | 'closure' | 'match';

export interface Booking {
  start: string;
  end: string;
  type: BookingType;
  note?: string | null;
  matchId?: string | null;
  requestId?: string | null;
  tournamentId?: string | null;
  recurrenceId?: string | null;
  createdBy?: string | null;
}

/** Booking with its id and its position (court, day). */
export interface BookingRow extends Booking {
  id: string;
  courtId: string;
  date: string;
}

export interface CourtDayBookings {
  id: string;
  courtId: string;
  date: string;
  items: Record<string, Booking>;
}

export interface Recurrence {
  id: string;
  courtId: string;
  weekday: number;
  start: string;
  end: string;
  type: BookingType;
  note: string;
  validFrom: string;
  validTo: string;
}

export type RequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'conflict' | 'expired';

export interface MatchRequest {
  id: string;
  tournamentId: string;
  matchId: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  offGrid: boolean;
  counterProposal?: boolean;
  players: string[];
  acceptances: Record<string, Instant | null>;
  status: RequestStatus;
  expiresAt: Instant;
  createdBy: string;
  note?: string | null;
  /** Creation (ISO). */
  createdAt?: string;
}

/** Availability windows: date (yyyy-mm-dd) -> list of "hh:mm-hh:mm" intervals. */
export type Windows = Record<string, string[]>;

export interface Availability {
  id: string;
  tournamentId: string;
  uid: string;
  windows: Windows;
}
