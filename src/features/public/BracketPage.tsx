import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { Bracket } from '../../components/Bracket';
import { OfflineNotice, SignInPrompt, phaseName, WinnersLine, TournamentPageState, useMyTeam, useOnline } from '../../components/common';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { useCourts, useTournamentData } from '../../data/queries';
import { deriveBracket, generateBracket, roundName, qualify } from '../../lib/bracket';
import { formatScore, hasOfficialResult } from '../../lib/results';
import { tournamentStandings, teamName } from '../../lib/tournament';
import type { Match, Team, Tournament } from '../../types';
import { cn } from '../../ui/cn';
import { Segmented } from '../../ui/misc';

type View = 'bracket' | 'list';

/** Knockout bracket of a final phase (/t/:tid/tabellone/:phase), plus an accessible list view. */
export default function BracketPage() {
  const { tid, phase: phaseParam = '' } = useParams();
  const { user } = useAuth();
  const d = useTournamentData(tid);
  const courts = useCourts();
  const online = useOnline();
  const myTeam = useMyTeam(d.teams);
  const [view, setView] = useState<View>('bracket');
  const phase = phaseParam.toLowerCase();

  const matches = useMemo(() => d.matches.filter((m) => m.phase === phase), [d.matches, phase]);
  const derived = useMemo(
    () => (d.tournament ? deriveBracket(matches, d.tournament.config.setFormat) : new Map()),
    [matches, d.tournament],
  );
  // Not generated yet: provisional crossings "if the groups ended today", computed only when needed.
  const preview = useMemo(
    () => (d.tournament && matches.length === 0 ? provisionalBracket(d.tournament, d.teams, d.matches, phase) : []),
    [d.tournament, d.teams, d.matches, matches.length, phase],
  );

  const pageState = TournamentPageState({ isPending: d.isPending, error: d.error, tournament: d.tournament, refetch: d.refetch });
  if (pageState || !d.tournament)
    return (
      <>
        <PageHeader title="Tabellone" subtitle={d.tournament?.name} back={{ to: `/t/${tid}`, label: 'Torneo' }} />
        {pageState}
      </>
    );
  const tournament = d.tournament;
  const phases = tournament.config.finals.map((f) => f.name.toLowerCase());
  const title = `Tabellone ${phaseName(tournament, phase)}`;

  return (
    <>
      <PageHeader title={title} subtitle={tournament.name} back={{ to: `/t/${tournament.id}`, label: 'Torneo' }} />
      {!online && <OfflineNotice />}
      {phases.length > 1 && (
        <nav aria-label="Fase finale" className="mb-5 flex gap-1 border-b border-line">
          {phases.map((f) => (
            <NavLink
              key={f}
              to={`/t/${tournament.id}/tabellone/${f}`}
              className={({ isActive }) =>
                cn(
                  '-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-base font-semibold',
                  isActive ? 'border-court text-ink dark:border-ball' : 'border-transparent text-ink-muted hover:text-ink',
                )
              }
            >
              {phaseName(tournament, f)}
            </NavLink>
          ))}
        </nav>
      )}

      {matches.length === 0 ? (
        preview.length ? (
          <div className="grid gap-4">
            <p className="max-w-prose text-ink-muted">
              Il tabellone si crea alla fine dei gironi. Questa è un’anteprima: gli incroci se i gironi finissero oggi.
            </p>
            <Bracket preview matches={preview} derived={new Map()} teamById={d.teamById} courts={[]} highlight={myTeam ? [myTeam.id] : undefined} />
          </div>
        ) : (
          <EmptyState title="Il tabellone si crea alla fine dei gironi." text="Quando l’organizzatore genera le fasi finali, qui trovi gli incroci e i risultati." />
        )
      ) : (
        <div className="grid gap-5">
          {tournament.status === 'completed' && <WinnersLine tournament={tournament} matches={d.matches} teamById={d.teamById} />}
          <Segmented
            label="Vista"
            className="hidden max-w-full flex-wrap justify-self-start md:inline-flex"
            value={view}
            onValueChange={setView}
            options={[
              { value: 'bracket', label: 'Tabellone' },
              { value: 'list', label: 'Vista elenco' },
            ]}
          />
          {/* Mobile: the bracket is already one ordered list per round with scroll-snap; desktop can switch to the list. */}
          <div className={cn(view === 'list' && 'md:hidden')}>
            <Bracket
              matches={matches}
              derived={derived}
              teamById={d.teamById}
              courts={courts.data ?? []}
              matchHref={user ? (m) => `/t/${tournament.id}/partite/${m.id}` : undefined}
              highlight={myTeam ? [myTeam.id] : undefined}
            />
          </div>
          {view === 'list' && (
            <div className="hidden md:block">
              <ListView matches={matches} derived={derived} teamById={d.teamById} myTeamId={myTeam?.id} />
            </div>
          )}
        </div>
      )}
      <SignInPrompt />
    </>
  );
}

function ListView({
  matches,
  derived,
  teamById,
  myTeamId,
}: {
  matches: Match[];
  derived: Map<string, { teamA: string | null; teamB: string | null; winner: string | null }>;
  teamById: Map<string, Team>;
  myTeamId?: string;
}) {
  const rounds = Math.max(0, ...matches.map((m) => m.round ?? 0));
  const byId = new Map(matches.map((m) => [m.id, m]));
  /** TBD side: "Vincente Quarto 1" from the feeding match. */
  const sideLabel = (m: Match, side: 'A' | 'B', id: string | null) => {
    if (id) return teamName(teamById, id);
    const feeder = matches.find((x) => x.nextCode === m.id && x.side === side);
    return feeder ? `Vincente ${label(feeder)}` : 'da definire';
  };
  const label = (m: Match) => {
    const name = roundName(m.round ?? 1, rounds);
    const inRound = matches.filter((x) => x.round === m.round).length;
    const n = (m.position ?? 0) + 1;
    if (inRound <= 1) return name;
    return `${name === 'Quarti' ? 'Quarto' : name} ${n}`;
  };
  return (
    <ol className="grid gap-6">
      {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
        <li key={r}>
          <h2 className="mb-1 border-b-2 border-line-strong pb-1 text-base font-bold">{roundName(r, rounds)}</h2>
          <ol className="court-rule">
            {matches
              .filter((m) => m.round === r)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((m) => {
                const dv = derived.get(m.id);
                const a = sideLabel(m, 'A', dv?.teamA ?? m.teamA);
                const b = sideLabel(m, 'B', dv?.teamB ?? m.teamB);
                const score = hasOfficialResult(byId.get(m.id)!) ? formatScore(m.result!.sets) : null;
                const w = dv?.winner ? teamName(teamById, dv.winner) : null;
                const mine = !!myTeamId && (dv?.teamA === myTeamId || dv?.teamB === myTeamId);
                return (
                  <li key={m.id} className={cn('flex min-h-12 items-start gap-2 py-3', mine && 'font-semibold')}>
                    {w && <Check className="mt-1 size-4 shrink-0" aria-hidden />}
                    <span>
                      {label(m)}: {a} contro {b}
                      {score && (
                        <>
                          , <span className="tabular">{score}</span>
                        </>
                      )}
                      {w && <>, vincono <strong>{w}</strong></>}
                    </span>
                  </li>
                );
              })}
          </ol>
        </li>
      ))}
    </ol>
  );
}

/** Provisional bracket of a phase from today's standings (never saved). */
function provisionalBracket(tournament: Tournament, teams: Team[], matches: Match[], phase: string): Match[] {
  if (!matches.some((m) => m.phase === 'groups')) return [];
  const cfg = tournament.config;
  const q = qualify(tournamentStandings(tournament, teams, matches), cfg.finals, cfg.qualificationRule, tournament.draw ?? {});
  const f = q.phases.find((x) => x.name.toLowerCase() === phase);
  if (!f || f.teams.length < 2) return [];
  const groupOf = new Map(f.teams.map((t) => [t.teamId, t.group]));
  return generateBracket(phase, f.teams.map((t) => t.teamId), (id) => groupOf.get(id)).map((b) => ({
    ...b,
    phase,
    playersA: [],
    playersB: [],
    players: [],
    status: 'unscheduled' as const,
  }));
}
