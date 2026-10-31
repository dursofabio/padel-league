import type { Court, Match, Period, Tournament } from '../../../types';

/** Everything the blocks of the match page share (built once in MatchPage). */
export interface MatchContext {
  tid: string;
  match: Match;
  tournament: Tournament;
  period: Period | null;
  courts: Court[];
  /** Player name ("…" while loading). */
  name: (uid: string | null | undefined) => string;
  /** Pair names. */
  nameA: string;
  nameB: string;
  uid: string | null;
  /** My side in this match, null if I don't play it. */
  mySide: 'A' | 'B' | null;
  /** Phone of a player, if known (WhatsApp direct link). */
  phone: (uid: string) => string | undefined;
  /** Phone of a court manager, if any profile has one. */
  managerPhone?: string;
  /** Absolute link to this match. */
  link: string;
  /** "Rossi/Bianchi – Verdi/Neri" */
  title: string;
}

export function courtName(courts: Court[], id: string): string {
  return courts.find((c) => c.id === id)?.name ?? id;
}
