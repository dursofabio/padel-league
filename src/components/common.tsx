/** Helpers and small components shared by several features (public pages, home, player area). */
import { ChevronRight, LogIn, Trophy, WifiOff } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { romeDateTime } from '../lib/attention';
import { deriveBracket } from '../lib/bracket';
import { TOURNAMENT_STATUS_LABEL } from '../lib/copy';
import { labelDate } from '../lib/time';
import { teamName } from '../lib/tournament';
import type { Match, Period, Team, Tournament } from '../types';
import { EmptyState, ErrorState, SkeletonRows } from './states';

export { TOURNAMENT_STATUS_LABEL };

/** Today in Europe/Rome (yyyy-mm-dd). */
export function romeToday(): string {
  return romeDateTime(Date.now()).date;
}

/** Wall clock that ticks every `ms` (deadlines and "now" without reading Date.now() in render logic). */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function OfflineNotice() {
  return (
    <p role="status" className="mb-4 flex items-center gap-2 text-ink-muted">
      <WifiOff className="size-5 shrink-0" aria-hidden />
      Sei offline: i dati potrebbero non essere aggiornati.
    </p>
  );
}

/** The signed-in user's team in this tournament (not withdrawn). */
export function useMyTeam(teams: Team[]): Team | undefined {
  const { user } = useAuth();
  if (!user) return undefined;
  return teams.find((t) => t.players.includes(user.id) && t.status !== 'withdrawn');
}

/** "Fase a gironi · Periodo 2, fino a dom 30/11" */
export function phaseInWords(tournament: Tournament, periods: Period[], today: string): string {
  const base = TOURNAMENT_STATUS_LABEL[tournament.status];
  if (tournament.status === 'registration' || tournament.status === 'completed') return base;
  const inPhase = tournament.status === 'groups' ? (p: Period) => p.phase === 'groups' : (p: Period) => p.phase !== 'groups';
  const current = periods.find((p) => inPhase(p) && p.startsOn <= today && p.endsOn >= today);
  const next = periods.filter((p) => inPhase(p) && p.startsOn > today).sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
  if (current) return `${base} · ${current.label}, fino a ${labelDate(current.endsOn)}`;
  if (next) return `${base} · ${next.label} dal ${labelDate(next.startsOn)}`;
  return base;
}

/** Winners of each generated final phase (final match with an official result). */
export function winners(tournament: Tournament, matches: Match[]): { phase: string; team: string }[] {
  const out: { phase: string; team: string }[] = [];
  for (const phase of tournament.generatedPhases ?? []) {
    const list = matches.filter((m) => m.phase === phase);
    if (!list.length) continue;
    const final = list.find((m) => !m.nextCode);
    const w = final ? deriveBracket(list, tournament.config.setFormat).get(final.id)?.winner : null;
    if (w) out.push({ phase: phaseName(tournament, phase), team: w });
  }
  return out;
}

/** Display name of a final phase ("gold" → "Gold"). */
export function phaseName(tournament: Tournament, phase: string): string {
  return tournament.config.finals.find((f) => f.name.toLowerCase() === phase)?.name ?? phase.charAt(0).toUpperCase() + phase.slice(1);
}

export function WinnersLine({ tournament, matches, teamById }: { tournament: Tournament; matches: Match[]; teamById: Map<string, Team> }) {
  const w = winners(tournament, matches);
  if (!w.length) return null;
  return (
    <p className="mb-5 flex items-start gap-2 text-lg font-bold">
      <Trophy className="mt-1 size-5 shrink-0 text-court dark:text-ball" aria-hidden />
      <span>{w.map((x) => `Vincono il ${x.phase}: ${teamName(teamById, x.team)}`).join(' · ')}</span>
    </p>
  );
}

/** Footer line for anonymous visitors, not a banner. */
export function SignInPrompt() {
  const { user, loading } = useAuth();
  if (user || loading) return null;
  return (
    <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-ink-muted">
      <LogIn className="size-5 shrink-0" aria-hidden />
      Giochi in questo torneo?
      <Link to="/accedi" className="inline-flex min-h-11 items-center font-semibold text-court underline dark:text-info-ink">
        Accedi per programmare le tue partite.
      </Link>
    </p>
  );
}

/** Loading/not found/error for public tournament pages. Returns null when the content can render. */
export function TournamentPageState({
  isPending,
  error,
  tournament,
  refetch,
  skeleton,
}: {
  isPending: boolean;
  error: unknown;
  tournament: Tournament | undefined;
  refetch: () => void;
  skeleton?: ReactNode;
}): ReactNode {
  if (isPending) return skeleton ?? <SkeletonRows rows={5} />;
  const code = (error as { code?: string } | null)?.code;
  if (!tournament && (code === 'PGRST116' || code === '22P02' || !error))
    return (
      <EmptyState
        title="Torneo non trovato. Controlla il link."
        action={
          <Link to="/" className="inline-flex min-h-11 items-center font-semibold text-court underline dark:text-info-ink">
            Vai all’elenco dei tornei
          </Link>
        }
      />
    );
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return null;
}

/** A link row in a court-rule list. */
export function LinkRow({ to, children, detail }: { to: string; children: ReactNode; detail?: ReactNode }) {
  return (
    <Link to={to} className="-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-control px-2 py-3 hover:bg-surface-2">
      <span className="grid gap-0.5">
        <span className="text-base font-semibold">{children}</span>
        {detail && <span className="text-sm text-ink-muted">{detail}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}
