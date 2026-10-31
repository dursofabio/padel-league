import { Check, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { formatScore, hasOfficialResult } from '../lib/results';
import { labelDate } from '../lib/time';
import { teamName } from '../lib/tournament';
import type { Court, Match, Team } from '../types';
import { cn } from '../ui/cn';
import { MatchStatusBadge } from './StatusBadge';

/** One row per match: teams, date/court or result, status. Separated by court lines in the parent list. */
export function MatchRow({
  match,
  teamById,
  courts,
  href,
  override,
  highlight,
  note,
  hideStatus,
  winner,
}: {
  /** Preview (e.g. bracket not generated yet): no status badge. */
  hideStatus?: boolean;
  /** Winning team (knockout): bold with a check icon. */
  winner?: string | null;
  match: Match;
  teamById: Map<string, Team>;
  courts: Court[];
  href?: string;
  override?: { teamA: string | null; teamB: string | null };
  highlight?: string[];
  note?: React.ReactNode;
}) {
  const a = override?.teamA ?? match.teamA;
  const b = override?.teamB ?? match.teamB;
  const sched = match.schedule;
  const court = sched ? (courts.find((c) => c.id === sched.courtId)?.name ?? sched.courtId) : null;
  const score = hasOfficialResult(match) ? formatScore(match.result!.sets) : null;
  const name = (id: string | null) => (
    <span className={cn(id && (highlight?.includes(id) || winner === id) && 'font-bold')}>
      {id && winner === id && <Check className="mr-0.5 inline size-4 text-ok" aria-label="vincitore" />}
      {teamName(teamById, id)}
    </span>
  );
  const body = (
    <>
      <span className="grid min-w-0 gap-1">
        <span className="text-base break-words">
          {name(a)} <span className="text-ink-muted">contro</span> {name(b)}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {score ? (
            <span className="tabular font-bold text-ink">{score}</span>
          ) : sched ? (
            <span className="tabular">
              {labelDate(sched.date)} · {sched.start} · {court}
            </span>
          ) : null}
          {!hideStatus && <MatchStatusBadge status={match.status} />}
          {note}
        </span>
      </span>
      {href && <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />}
    </>
  );
  const cls = 'flex min-h-14 items-center justify-between gap-3 py-3';
  return href ? (
    <Link to={href} className={cn(cls, '-mx-2 rounded-control px-2 hover:bg-surface-2')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
