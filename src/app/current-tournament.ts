import { useLocation } from 'react-router';
import { useTournaments } from '../data/queries';

/**
 * Current tournament: the one in the URL (/t/:tid), otherwise the most recent not yet completed.
 * Today there is one tournament at a time, but the model does not rule out several.
 */
export function useCurrentTournament() {
  // also works from the shell (layout), where the child route's params are not available
  const tid = useLocation().pathname.match(/^\/t\/([^/]+)/)?.[1];
  const tournaments = useTournaments();
  const active = tournaments.data?.find((t) => t.status !== 'completed') ?? tournaments.data?.[0];
  const id = tid ?? active?.id;
  return {
    tid: id,
    tournament: tournaments.data?.find((t) => t.id === id),
    tournaments: tournaments.data ?? [],
    isPending: tournaments.isPending,
  };
}
