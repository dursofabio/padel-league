import { roundName } from '../lib/bracket';
import type { Court, Match, Team } from '../types';
import { MatchRow } from './MatchRow';

/**
 * Knockout bracket: one column per round. On mobile the columns scroll horizontally
 * with snap (one round per screen). Each round is an ordered list: readable by screen readers too.
 */
export function Bracket({
  matches,
  derived,
  teamById,
  courts,
  matchHref,
  highlight,
  preview,
}: {
  matches: Match[];
  derived: Map<string, { teamA: string | null; teamB: string | null; winner?: string | null }>;
  /** Bracket not generated yet: no match statuses. */
  preview?: boolean;
  teamById: Map<string, Team>;
  courts: Court[];
  matchHref?: (m: Match) => string | undefined;
  highlight?: string[];
}) {
  const rounds = Math.max(0, ...matches.map((m) => m.round ?? 0));
  return (
    <div
      role="region"
      aria-label="Tabellone: scorri orizzontalmente tra i turni"
      tabIndex={0}
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:scroll-px-0 md:px-0"
    >
      {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => {
        const list = matches.filter((m) => m.round === round).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        return (
          <section key={round} className="w-[85%] shrink-0 snap-start md:w-auto md:min-w-64 md:flex-1" aria-label={roundName(round, rounds)}>
            <h3 className="mb-1 border-b-2 border-court pb-1 text-base font-bold dark:border-line-strong">{roundName(round, rounds)}</h3>
            <ol className="court-rule flex h-full flex-col justify-around">
              {list.map((m) => (
                <li key={m.id}>
                  <MatchRow
                    match={m}
                    override={derived.get(m.id)}
                    teamById={teamById}
                    courts={courts}
                    href={matchHref?.(m)}
                    highlight={highlight}
                    hideStatus={preview}
                    winner={derived.get(m.id)?.winner}
                  />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
