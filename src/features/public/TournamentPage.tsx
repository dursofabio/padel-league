import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import {
  OfflineNotice,
  phaseInWords,
  SignInPrompt,
  romeToday,
  TileLink,
  WinnersLine,
  TournamentPageState,
  useMyTeam,
  useOnline,
} from '../../components/common';
import { MatchPoster } from '../../components/MatchPoster';
import { PageHeader, Section } from '../../components/PageHeader';
import { StandingsTable } from '../../components/StandingsTable';
import { useCourts, useTournamentData } from '../../data/queries';
import { ChevronRight, Trophy } from 'lucide-react';
import { formatScore, hasOfficialResult, matchWinner } from '../../lib/results';
import { labelDate } from '../../lib/time';
import { groups, teamName, tournamentStandings } from '../../lib/tournament';
import { cn } from '../../ui/cn';
import { Skeleton } from '../../ui/misc';
import type { Court, Match, Team } from '../../types';

const when = (m: Match) => (m.schedule ? `${m.schedule.date} ${m.schedule.start}` : '');

/** Tournament overview (/t/:tid): phase, next matches, latest results, links. Readable without logging in. */
export default function TournamentPage() {
  const { tid } = useParams();
  const { user } = useAuth();
  const d = useTournamentData(tid);
  const courts = useCourts();
  const online = useOnline();
  const myTeam = useMyTeam(d.teams);
  const today = romeToday();

  const upcoming = useMemo(
    () =>
      d.matches
        .filter((m) => m.status === 'scheduled' && m.schedule && m.schedule.date >= today)
        .sort((a, b) => when(a).localeCompare(when(b)))
        .slice(0, 5),
    [d.matches, today],
  );
  const latest = useMemo(
    () =>
      d.matches
        .filter(hasOfficialResult)
        .sort((a, b) => when(b).localeCompare(when(a)))
        .slice(0, 5),
    [d.matches],
  );
  const standings = useMemo(
    () => (d.tournament ? tournamentStandings(d.tournament, d.teams, d.matches) : {}),
    [d.tournament, d.teams, d.matches],
  );

  const pageState = TournamentPageState({ isPending: d.isPending, error: d.error, tournament: d.tournament, refetch: d.refetch });
  if (pageState || !d.tournament)
    return (
      <>
        {d.tournament ? (
          <PageHeader title={d.tournament.name} subtitle={phaseInWords(d.tournament, d.periods, today)} />
        ) : (
          d.isPending && <Skeleton className="mb-5 h-8 w-2/3" />
        )}
        {pageState}
      </>
    );
  const tournament = d.tournament;
  const href = user ? (m: Match) => `/t/${tournament.id}/partite/${m.id}` : undefined;
  const highlight = myTeam ? [myTeam.id] : undefined;
  const groupCount = groups(d.teams).length;
  const registered = d.teams.filter((t) => t.status === 'approved');

  const groupNames = Object.keys(standings);
  const [featured, ...nextOnes] = upcoming;
  const tableRows = (g: string) => standings[g].filter((r, i) => i < 4 || r.teamId === myTeam?.id);

  return (
    <>
      <PageHeader title={tournament.name} subtitle={phaseInWords(tournament, d.periods, today)} />
      {!online && <OfflineNotice />}
      {tournament.status === 'completed' && <WinnersLine tournament={tournament} matches={d.matches} teamById={d.teamById} />}

      <div className="grid gap-10">
        {tournament.status === 'registration' || groupCount === 0 ? (
          <Section title={`${registered.length} ${registered.length === 1 ? 'coppia iscritta' : 'coppie iscritte'}`} id="iscritte">
            <p className="text-ink-muted">I gironi non sono ancora stati composti. Le coppie iscritte sono qui sotto.</p>
            {registered.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {registered.map((t) => (
                  <li
                    key={t.id}
                    className={cn(
                      'flex min-h-12 items-center rounded-control border-2 px-3 py-2 font-semibold',
                      myTeam?.id === t.id ? 'border-edge bg-ball text-ball-ink' : 'border-line-strong bg-surface',
                    )}
                  >
                    {t.name}
                    {myTeam?.id === t.id && <span className="ml-2 text-sm"> (la tua coppia)</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nessuna coppia approvata per ora.</p>
            )}
          </Section>
        ) : (
          <>
            {/* The next match leads; the rest of the programme sits beside it on wide screens. */}
            <div className={cn('grid gap-8 lg:items-start', nextOnes.length > 0 && 'lg:grid-cols-2')}>
              {featured ? (
                <MatchPoster
                  id="si-gioca"
                  match={featured}
                  teamById={d.teamById}
                  courts={courts.data ?? []}
                  label="Prossima partita del torneo"
                  href={href?.(featured)}
                />
              ) : (
                <Section title="Prossime partite" id="prossime">
                  <p className="text-ink-muted">Nessuna partita in programma per ora. Le trovi qui appena vengono confermate dal campo.</p>
                </Section>
              )}
              {nextOnes.length > 0 && (
                <Section title="Poi si gioca" id="prossime">
                  <ul className="court-rule">
                    {nextOnes.map((m) => (
                      <li key={m.id}>
                        <UpcomingRow match={m} teamById={d.teamById} courts={courts.data ?? []} href={href?.(m)} mine={highlight} />
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            <Section
              title="Classifiche"
              id="classifiche"
              actions={<ShortLink to={`/t/${tournament.id}/classifiche`}>Classifiche complete</ShortLink>}
            >
              <div className="grid gap-8 lg:grid-cols-2">
                {groupNames.map((g) => (
                  <div key={g} className="grid content-start gap-2">
                    <h3 className="poster text-xl">Girone {g}</h3>
                    <StandingsTable
                      group={g}
                      rows={tableRows(g)}
                      teamById={d.teamById}
                      phases={tournament.config.finals}
                      groupCount={groupCount}
                      highlight={myTeam?.id}
                    />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Ultimi risultati" id="ultimi">
              {latest.length ? (
                <ul className="grid gap-3 lg:grid-cols-2">
                  {latest.map((m) => (
                    <li key={m.id}>
                      <ResultCard match={m} teamById={d.teamById} winner={matchWinner(m, tournament.config.setFormat)} href={href?.(m)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">Ancora nessun risultato ufficiale: compaiono qui appena entrambe le coppie li confermano.</p>
              )}
            </Section>
          </>
        )}

        <Section title="Segui il torneo" id="link">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <li>
              <TileLink to={`/t/${tournament.id}/classifiche`} detail="Punti, set e game di ogni girone">
                Classifiche
              </TileLink>
            </li>
            <li>
              <TileLink to={`/t/${tournament.id}/calendario`} detail="Tutte le partite, giornata per giornata">
                Calendario
              </TileLink>
            </li>
            {tournament.status !== 'registration' &&
              tournament.config.finals.map(({ name }) => {
                const phase = name.toLowerCase();
                const generated = (tournament.generatedPhases ?? []).includes(phase);
                return (
                  <li key={phase}>
                    <TileLink to={`/t/${tournament.id}/tabellone/${phase}`} detail={generated ? 'Eliminazione diretta' : 'Anteprima: gli incroci se i gironi finissero oggi'}>
                      Tabellone {name}
                    </TileLink>
                  </li>
                );
              })}
          </ul>
        </Section>
      </div>
      <SignInPrompt />
    </>
  );
}

/** A scheduled match after the featured one: the time leads in display type, the day under it. */
function UpcomingRow({
  match,
  teamById,
  courts,
  href,
  mine,
}: {
  match: Match;
  teamById: Map<string, Team>;
  courts: Court[];
  href?: string;
  mine?: string[];
}) {
  const s = match.schedule!;
  const court = courts.find((c) => c.id === s.courtId)?.name ?? 'Campo';
  const name = (id: string | null) => <span className={cn(id && mine?.includes(id) && 'font-bold')}>{teamName(teamById, id)}</span>;
  const body = (
    <>
      <span className="grid w-20 shrink-0 gap-0.5">
        <span className="poster tabular text-2xl leading-none">{s.start}</span>
        <span className="tabular text-sm font-semibold text-ink-muted">{labelDate(s.date)}</span>
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="break-words">
          {name(match.teamA)} <span className="text-ink-muted">contro</span> {name(match.teamB)}
        </span>
        <span className="text-sm font-semibold text-ink-muted">{court}</span>
      </span>
      {href && <ChevronRight className="size-5 shrink-0" aria-hidden />}
    </>
  );
  const cls = 'flex min-h-16 items-center gap-4 py-3';
  return href ? (
    <Link to={href} className={cn(cls, '-mx-2 rounded-control px-2 hover:bg-surface-2')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** An official result: the two pairs, the winner marked in words and weight, the score in display type. */
function ResultCard({ match, teamById, winner, href }: { match: Match; teamById: Map<string, Team>; winner: string | null; href?: string }) {
  const side = (id: string | null) => (
    <span className={cn('flex items-center gap-2 break-words', winner === id ? 'font-bold' : 'text-ink-muted')}>
      {teamName(teamById, id)}
      {winner === id && (
        <span className="inline-flex items-center gap-1 rounded-full border-2 border-current px-2 text-xs font-bold text-ink">
          <Trophy className="size-3.5" aria-hidden />
          vince
        </span>
      )}
    </span>
  );
  const body = (
    <>
      <span className="grid min-w-0 flex-1 gap-1">
        {side(match.teamA)}
        {side(match.teamB)}
      </span>
      <span className="poster tabular text-poster-sm whitespace-nowrap">{formatScore(match.result!.sets)}</span>
    </>
  );
  const cls = 'flex items-center gap-4 rounded-panel border-2 border-line-strong bg-surface p-4';
  return href ? (
    <Link to={href} className={cn(cls, 'hover:bg-surface-2')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function ShortLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center text-sm font-bold text-ink underline">
      {children}
    </Link>
  );
}
