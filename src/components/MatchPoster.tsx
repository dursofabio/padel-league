import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { labelDate } from '../lib/time';
import { teamName } from '../lib/tournament';
import type { Court, Match, Team } from '../types';

/**
 * A scheduled match as the poster's headline block (ink fill): date and time in big type,
 * the label and court as the supporting line, the pairs below. Whole block is a link when `href` is set.
 */
export function MatchPoster({
  match,
  teamById,
  courts,
  label,
  href,
  id,
}: {
  match: Match;
  teamById: Map<string, Team>;
  courts: Court[];
  /** Supporting line and screen-reader prefix: "La tua prossima partita", "Si gioca". */
  label: string;
  href?: string;
  /** id of the heading, for the section's aria-labelledby. */
  id: string;
}) {
  const s = match.schedule!;
  const court = courts.find((c) => c.id === s.courtId)?.name ?? 'Campo';
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <h2 id={id} className="poster tabular text-poster-lg">
          <span className="sr-only">{label}: </span>
          {labelDate(s.date)} <span className="mark">{s.start}</span>
        </h2>
        {href && <ArrowRight className="mt-1 size-6 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />}
      </span>
      <p className="font-bold">
        {label} · {court}
      </p>
      <p className="poster text-2xl leading-[1.1] break-words">
        {teamName(teamById, match.teamA)} <span className="font-sans text-base font-semibold normal-case">contro</span>{' '}
        {teamName(teamById, match.teamB)}
      </p>
    </>
  );
  return (
    <section aria-labelledby={id} className="rounded-panel border-2 border-line-strong bg-court text-court-ink">
      {href ? (
        <Link to={href} className="group grid gap-3 rounded-panel p-5">
          {body}
        </Link>
      ) : (
        <div className="grid gap-3 p-5">{body}</div>
      )}
    </section>
  );
}
