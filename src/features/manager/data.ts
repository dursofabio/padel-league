import { useCallback, useMemo } from 'react';
import { useCurrentTournament } from '../../app/current-tournament';
import { useNames, useTournamentData } from '../../data/queries';
import { teamName } from '../../lib/tournament';
import type { Match, Period } from '../../types';

/**
 * Names and periods of the current tournament's matches, for the court manager:
 * "Rossi/Bianchi – Verdi/Neri", the match period (counter-proposals) and the match link.
 */
export function useManagerMatches() {
  const { tid } = useCurrentTournament();
  const t = useTournamentData(tid);
  const names = useNames();

  const matchById = useMemo(() => new Map(t.matches.map((m) => [m.id, m])), [t.matches]);
  const periodById = useMemo(() => new Map(t.periods.map((p) => [p.id, p])), [t.periods]);

  const match = useCallback((id: string | null | undefined): Match | undefined => (id ? matchById.get(id) : undefined), [matchById]);

  /** "Team A – Team B", or undefined when the match is not in the current tournament. */
  const matchName = useCallback(
    (id: string | null | undefined) => {
      const m = match(id);
      if (!m) return undefined;
      return `${teamName(t.teamById, m.teamA)} – ${teamName(t.teamById, m.teamB)}`;
    },
    [match, t.teamById],
  );

  /** "Rossi/Bianchi – Verdi/Neri" from the players' names. */
  const matchPlayers = useCallback(
    (id: string | null | undefined, fallback: string[] = []) => {
      const m = match(id);
      if (!m) return fallback.map(names.name).join(', ');
      return `${m.playersA.map(names.name).join('/')} – ${m.playersB.map(names.name).join('/')}`;
    },
    [match, names],
  );

  const matchPeriod = useCallback(
    (id: string | null | undefined): Period | undefined => {
      const m = match(id);
      return m?.periodId ? periodById.get(m.periodId) : undefined;
    },
    [match, periodById],
  );

  const matchLink = useCallback(
    (tournamentId: string | null | undefined, matchId: string | null | undefined) =>
      tournamentId && matchId ? `/t/${tournamentId}/partite/${matchId}` : matchId && tid ? `/t/${tid}/partite/${matchId}` : undefined,
    [tid],
  );

  return { tid, name: names.name, match, matchName, matchPlayers, matchPeriod, matchLink };
}
