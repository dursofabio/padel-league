import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import type { StandingsRow } from '../lib/standings';
import type { FinalPhaseConfig } from '../types';
import { cn } from '../ui/cn';
import { qualificationZone } from './StandingsTable';

/** Where the player's pair stands, as a poster statement: the position as a huge numeral, group and zone in words. */
export function StandingTile({
  group,
  rows,
  teamId,
  phases,
  groupCount,
  to,
  className,
}: {
  group: string;
  rows: StandingsRow[];
  teamId: string;
  phases: FinalPhaseConfig[];
  groupCount: number;
  /** When set, the whole tile opens the standings. */
  to?: string;
  className?: string;
}) {
  const mine = rows.find((r) => r.teamId === teamId);
  if (!mine) return null;
  const zone = qualificationZone(phases, mine.position, groupCount);
  const body = (
    <>
      <span className="poster tabular text-poster-2xl">{mine.position}°</span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-bold">
          posto nel Girone {group}
          {mine.tied && ' (a pari merito)'}
        </span>
        <span className="tabular font-semibold text-ink-muted">
          {mine.points} {mine.points === 1 ? 'punto' : 'punti'} · {zone ? `zona ${zone}` : 'fuori dalle fasi finali'}
        </span>
      </span>
      {to && <ArrowRight className="size-5 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />}
    </>
  );
  const cls = cn('flex items-center gap-4 rounded-panel border-2 border-line-strong bg-surface p-4 sm:p-5', className);
  return to ? (
    <Link to={to} className={cn(cls, 'group hover:bg-surface-2')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
