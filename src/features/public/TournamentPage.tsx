import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import {
  OfflineNotice,
  phaseInWords,
  SignInPrompt,
  romeToday,
  LinkRow,
  WinnersLine,
  TournamentPageState,
  useMyTeam,
  useOnline,
} from '../../components/common';
import { MatchRow } from '../../components/MatchRow';
import { PageHeader, Section } from '../../components/PageHeader';
import { StandingsTable } from '../../components/StandingsTable';
import { useCourts, useTournamentData } from '../../data/queries';
import { hasOfficialResult } from '../../lib/results';
import { groups, tournamentStandings } from '../../lib/tournament';
import { Skeleton } from '../../ui/misc';
import type { Match } from '../../types';

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

  // "Il tuo girone": top 4 + own row
  const myGroup = myTeam?.group ? standings[myTeam.group] : undefined;
  const myRows = myGroup?.filter((r, i) => i < 4 || r.teamId === myTeam?.id);

  return (
    <>
      <PageHeader title={tournament.name} subtitle={phaseInWords(tournament, d.periods, today)} />
      {!online && <OfflineNotice />}
      {tournament.status === 'completed' && <WinnersLine tournament={tournament} matches={d.matches} teamById={d.teamById} />}

      <div className="grid gap-8">
        {tournament.status === 'registration' || groupCount === 0 ? (
          <Section title="Coppie iscritte" id="iscritte">
            <p className="text-ink-muted">I gironi non sono ancora stati composti. Le coppie iscritte sono qui sotto.</p>
            {registered.length ? (
              <ul className="court-rule">
                {registered.map((t) => (
                  <li key={t.id} className="flex min-h-12 items-center py-2 text-base">
                    <span className={myTeam?.id === t.id ? 'font-bold' : undefined}>{t.name}</span>
                    {myTeam?.id === t.id && <span className="ml-2 text-sm text-ink-muted">la tua coppia</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nessuna coppia approvata per ora.</p>
            )}
          </Section>
        ) : (
          <>
            <Section title="Prossime partite" id="prossime">
              {upcoming.length ? (
                <ul className="court-rule">
                  {upcoming.map((m) => (
                    <li key={m.id}>
                      <MatchRow match={m} teamById={d.teamById} courts={courts.data ?? []} href={href?.(m)} highlight={highlight} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">Nessuna partita in programma per ora. Le trovi qui appena vengono confermate dal campo.</p>
              )}
            </Section>

            {myTeam && myRows && myTeam.group && (
              <Section title="Il tuo girone" id="mio-girone" actions={<ShortLink to={`/t/${tournament.id}/classifiche`}>Classifica completa</ShortLink>}>
                <StandingsTable
                  group={myTeam.group}
                  rows={myRows}
                  teamById={d.teamById}
                  phases={tournament.config.finals}
                  groupCount={groupCount}
                  highlight={myTeam.id}
                />
              </Section>
            )}

            <Section title="Ultimi risultati" id="ultimi">
              {latest.length ? (
                <ul className="court-rule">
                  {latest.map((m) => (
                    <li key={m.id}>
                      <MatchRow match={m} teamById={d.teamById} courts={courts.data ?? []} href={href?.(m)} highlight={highlight} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">Ancora nessun risultato ufficiale.</p>
              )}
            </Section>
          </>
        )}

        <Section title="Segui il torneo" id="link">
          <ul className="court-rule">
            <li>
              <LinkRow to={`/t/${tournament.id}/classifiche`} detail="Punti, set e game di ogni girone">
                Classifiche
              </LinkRow>
            </li>
            <li>
              <LinkRow to={`/t/${tournament.id}/calendario`} detail="Tutte le partite, giornata per giornata">
                Calendario
              </LinkRow>
            </li>
            {tournament.status !== 'registration' &&
              tournament.config.finals.map(({ name }) => {
                const phase = name.toLowerCase();
                const generated = (tournament.generatedPhases ?? []).includes(phase);
                return (
                  <li key={phase}>
                    <LinkRow to={`/t/${tournament.id}/tabellone/${phase}`} detail={generated ? 'Eliminazione diretta' : 'Anteprima: gli incroci se i gironi finissero oggi'}>
                      Tabellone {name}
                    </LinkRow>
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

function ShortLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center text-sm font-semibold text-court underline dark:text-info-ink">
      {children}
    </Link>
  );
}
