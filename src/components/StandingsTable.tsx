import { Fragment } from 'react';
import type { StandingsRow } from '../lib/standings';
import { teamName } from '../lib/tournament';
import type { FinalPhaseConfig, Team } from '../types';
import { cn } from '../ui/cn';

/** Qualification zone by position: Gold for the first N per group, then Silver, … (byPosition). */
export function qualificationZone(phases: FinalPhaseConfig[], position: number, groupCount: number): string | null {
  let threshold = 0;
  for (const f of phases) {
    threshold += f.spots / Math.max(1, groupCount);
    if (position <= Math.floor(threshold)) return f.name;
  }
  return null;
}

/**
 * Group standings. The zone (Gold/Silver) is a text tag in the row, not just a colour;
 * secondary columns (W, L, ±Game) are hidden on narrow screens.
 */
export function StandingsTable({
  group,
  rows,
  teamById,
  phases,
  groupCount,
  highlight,
}: {
  group: string;
  rows: StandingsRow[];
  teamById: Map<string, Team>;
  phases: FinalPhaseConfig[];
  groupCount: number;
  highlight?: string | null;
}) {
  const tied = rows.some((r) => r.tied);
  return (
    <div className="grid gap-2">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="tabular w-full border-collapse text-base">
          <caption className="sr-only">Classifica girone {group}</caption>
          <thead>
            <tr className="border-b-2 border-line-strong text-left text-sm text-ink-muted">
              <th scope="col" className="w-10 py-2 pr-2 text-right font-semibold">
                <abbr title="Posizione">Pos</abbr>
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">Coppia</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                <abbr title="Punti">Pt</abbr>
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                <abbr title="Giocate">G</abbr>
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-semibold sm:table-cell">
                <abbr title="Vinte">V</abbr>
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-semibold sm:table-cell">
                <abbr title="Perse">P</abbr>
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                <abbr title="Differenza set">±Set</abbr>
              </th>
              <th scope="col" className="hidden py-2 text-right font-semibold md:table-cell">
                <abbr title="Differenza game">±Game</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const zone = qualificationZone(phases, r.position, groupCount);
              const prevZone = i > 0 ? qualificationZone(phases, rows[i - 1].position, groupCount) : null;
              const mine = highlight === r.teamId;
              return (
                <Fragment key={r.teamId}>
                {zone !== prevZone && i > 0 && (
                  <tr aria-hidden>
                    <td colSpan={8} className="border-t-2 border-court py-1 text-xs font-semibold text-ink-muted dark:border-line-strong">
                      {prevZone ? `${prevZone} sopra questa linea` : ''}
                      {prevZone ? ' · ' : ''}
                      {zone ? `${zone} sotto` : prevZone ? 'sotto: fuori dalle fasi finali' : 'Sotto questa linea: fuori dalle fasi finali'}
                    </td>
                  </tr>
                )}
                <tr
                  className={cn(
                    'border-b border-line',
                    mine && 'bg-info-soft',
                  )}
                >
                  <td className="py-2.5 pr-2 text-right font-bold">
                    {r.position}
                    {r.tied && (
                      <span className="text-warn-ink" title="Pari merito da risolvere">
                        *
                      </span>
                    )}
                  </td>
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    <span className={cn(mine && 'font-bold')}>{teamName(teamById, r.teamId)}</span>
                    {zone && zone !== prevZone && <span className="sr-only">, inizio zona {zone}</span>}
                    {zone && zone !== prevZone && (
                      <span className="ml-2 rounded-full border border-line-strong px-1.5 text-xs font-semibold text-ink-muted">
                        {zone}
                      </span>
                    )}
                  </th>
                  <td className="py-2.5 pr-3 text-right font-bold">{r.points}</td>
                  <td className="py-2.5 pr-3 text-right">{r.played}</td>
                  <td className="hidden py-2.5 pr-3 text-right sm:table-cell">{r.won}</td>
                  <td className="hidden py-2.5 pr-3 text-right sm:table-cell">{r.lost}</td>
                  <td className="py-2.5 pr-3 text-right">{signed(r.setsWon - r.setsLost)}</td>
                  <td className="hidden py-2.5 text-right md:table-cell">{signed(r.gamesWon - r.gamesLost)}</td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {tied && <p className="text-sm text-ink-muted">* Pari merito non ancora risolto: lo decide il sorteggio dell’organizzatore.</p>}
    </div>
  );
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
