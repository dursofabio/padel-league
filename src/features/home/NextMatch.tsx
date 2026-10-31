import { MatchPoster } from '../../components/MatchPoster';
import type { Match } from '../../types';
import type { RowContext } from './content';

/** The player's next confirmed match as the poster's headline block. */
export function NextMatch({ match, ctx }: { match: Match; ctx: RowContext }) {
  return (
    <MatchPoster
      id="next-match"
      match={match}
      teamById={ctx.teamById}
      courts={ctx.courts}
      label="La tua prossima partita"
      href={`/t/${ctx.tid}/partite/${match.id}`}
    />
  );
}
