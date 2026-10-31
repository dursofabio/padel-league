/**
 * Status glossary: one Italian label, icon and tone per state, used by every screen.
 * Stored enum values are English; the Italian the user sees lives only here (and in feature copy).
 * Tone = semantic family of the token (ok, warn, danger, info, idle); never colour alone: always icon + text.
 */
import type { SlotColor } from './slots';
import type { BookingType, MatchStatus, RequestStatus, Role, TeamStatus, TournamentStatus } from '../types';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'idle';
export type StatusIcon =
  | 'calendar-clock'
  | 'send'
  | 'calendar-check'
  | 'trophy'
  | 'flag'
  | 'gavel'
  | 'hourglass'
  | 'circle-check'
  | 'circle-x'
  | 'ban'
  | 'triangle-alert'
  | 'timer-off'
  | 'check'
  | 'circle-dashed'
  | 'lock'
  | 'clock';

export interface StatusEntry {
  label: string;
  icon: StatusIcon;
  tone: Tone;
}

export const MATCH_STATUS: Record<MatchStatus, StatusEntry> = {
  unscheduled: { label: 'Da programmare', icon: 'calendar-clock', tone: 'idle' },
  requested: { label: 'Richiesta inviata', icon: 'send', tone: 'info' },
  scheduled: { label: 'Programmata', icon: 'calendar-check', tone: 'ok' },
  played: { label: 'Giocata', icon: 'trophy', tone: 'idle' },
  disputed: { label: 'Contestata', icon: 'flag', tone: 'danger' },
  forfeit: { label: 'Tavolino', icon: 'gavel', tone: 'idle' },
};

export const REQUEST_STATUS: Record<RequestStatus, StatusEntry> = {
  pending: { label: 'In attesa', icon: 'hourglass', tone: 'info' },
  confirmed: { label: 'Confermata', icon: 'circle-check', tone: 'ok' },
  rejected: { label: 'Rifiutata', icon: 'circle-x', tone: 'danger' },
  cancelled: { label: 'Annullata', icon: 'ban', tone: 'idle' },
  conflict: { label: 'Conflitto', icon: 'triangle-alert', tone: 'danger' },
  expired: { label: 'Scaduta', icon: 'timer-off', tone: 'idle' },
};

export const SLOT_STATUS: Record<SlotColor, StatusEntry> = {
  green: { label: '4/4 liberi', icon: 'check', tone: 'ok' },
  yellow: { label: '3/4', icon: 'circle-dashed', tone: 'warn' },
  grey: { label: '≤2/4', icon: 'circle-dashed', tone: 'idle' },
  red: { label: 'Occupato', icon: 'lock', tone: 'danger' },
  blue: { label: 'Richiesto', icon: 'clock', tone: 'info' },
};

export const BOOKING_TYPE_LABEL: Record<BookingType, string> = {
  external: 'Esterno',
  lesson: 'Lezione',
  closure: 'Chiuso',
  match: 'Partita del campionato',
};

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  registration: 'Iscrizioni aperte',
  groups: 'Fase a gironi',
  finals: 'Fasi finali',
  completed: 'Concluso',
};

/** Team status as plain text (the Italian values the database used to store). */
export const TEAM_STATUS_LABEL: Record<TeamStatus, string> = {
  awaiting_partner: 'in attesa partner',
  pending_approval: 'da approvare',
  approved: 'approvata',
  withdrawn: 'ritirata',
};

/** Role names as plain lowercase text (the Italian values the database used to store). */
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'admin',
  organizer: 'organizzatore',
  manager: 'gestore',
  player: 'giocatore',
};
