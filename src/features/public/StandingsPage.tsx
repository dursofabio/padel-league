import { Medal, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { OfflineNotice, SignInPrompt, TournamentPageState, useMyTeam, useOnline } from '../../components/common';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { StandingsTable } from '../../components/StandingsTable';
import { StandingTile } from '../../components/StandingTile';
import { useTournamentData } from '../../data/queries';
import type { StandingsRow } from '../../lib/standings';
import { tournamentStandings } from '../../lib/tournament';
import type { Tiebreaker } from '../../types';
import { Segmented } from '../../ui/misc';

const CRITERION: Record<Tiebreaker, string> = {
  points: 'punti',
  headToHead: 'scontro diretto',
  setDiff: 'differenza set',
  gameDiff: 'differenza game',
  setsWon: 'set vinti',
  gamesWon: 'game vinti',
  draw: 'sorteggio',
};

/** Standings of every group (/t/:tid/classifiche): switcher on mobile, side by side on desktop. */
export default function StandingsPage() {
  const { tid } = useParams();
  const d = useTournamentData(tid);
  const online = useOnline();
  const myTeam = useMyTeam(d.teams);
  const standings = useMemo(
    () => (d.tournament ? tournamentStandings(d.tournament, d.teams, d.matches) : {}),
    [d.tournament, d.teams, d.matches],
  );
  const groupNames = Object.keys(standings);
  const [selected, setSelected] = useState<string | null>(null);

  const pageState = TournamentPageState({ isPending: d.isPending, error: d.error, tournament: d.tournament, refetch: d.refetch });
  // the heading renders before the data (it is the first meaningful paint)
  if (pageState || !d.tournament)
    return (
      <>
        <PageHeader title="Classifiche" subtitle={d.tournament?.name} back={{ to: `/t/${tid}`, label: 'Torneo' }} />
        {pageState}
      </>
    );
  const tournament = d.tournament;
  const active =
    selected && groupNames.includes(selected)
      ? selected
      : myTeam?.group && groupNames.includes(myTeam.group)
        ? myTeam.group
        : groupNames[0];
  const criteria = tournament.config.tiebreakers.map((t) => CRITERION[t]).join(', ');

  return (
    <>
      <PageHeader title="Classifiche" subtitle={tournament.name} back={{ to: `/t/${tournament.id}`, label: 'Torneo' }} />
      {!online && <OfflineNotice />}
      {groupNames.length === 0 ? (
        <EmptyState title="I gironi non sono ancora stati composti." text="Le classifiche compaiono appena l’organizzatore crea i gironi e il calendario." />
      ) : (
        <div className="grid gap-6">
          {myTeam?.group && standings[myTeam.group] && (
            <StandingTile
              className="max-w-xl"
              group={myTeam.group}
              rows={standings[myTeam.group]}
              teamId={myTeam.id}
              phases={tournament.config.finals}
              groupCount={groupNames.length}
            />
          )}
          {groupNames.length > 1 && (
            <Segmented
              label="Girone"
              className="max-w-full flex-wrap justify-self-start lg:hidden"
              value={active}
              onValueChange={setSelected}
              options={groupNames.map((g) => ({ value: g, label: `Girone ${g}` }))}
            />
          )}
          <div className="grid gap-10 lg:grid-cols-2">
            {groupNames.map((g) => (
              <section key={g} aria-labelledby={`girone-${g}`} className={g === active ? 'grid content-start gap-3' : 'hidden content-start gap-3 lg:grid'}>
                <h2 id={`girone-${g}`} className="poster text-poster-sm">
                  Girone {g}
                </h2>
                <StandingsTable
                  group={g}
                  rows={standings[g]}
                  teamById={d.teamById}
                  phases={tournament.config.finals}
                  groupCount={groupNames.length}
                  highlight={myTeam?.id}
                />
                <GroupNote rows={standings[g]} myTeamId={myTeam?.id} />
              </section>
            ))}
          </div>

          <div className="grid gap-2 border-t border-line pt-4 text-sm text-ink-muted">
            <p>Pt punti · G giocate · V vinte · P perse · ±Set differenza set · ±Game differenza game</p>
            {tournament.config.qualificationRule === 'crossGroup' && (
              <p className="flex items-start gap-2">
                <Medal className="mt-0.5 size-4 shrink-0" aria-hidden />
                Le migliori seconde si decidono con la classifica avulsa (media punti).
              </p>
            )}
            <p>Criteri: {criteria}.</p>
          </div>
        </div>
      )}
      <SignInPrompt />
    </>
  );
}

/** Own pair, said in words (not only by the row tint). Ties and zones are explained by the table itself. */
function GroupNote({ rows, myTeamId }: { rows: StandingsRow[]; myTeamId?: string }) {
  const mine = myTeamId ? rows.find((r) => r.teamId === myTeamId) : undefined;
  if (!mine) return null;
  return (
    <p className="flex items-center gap-2">
      <User className="size-4 shrink-0" aria-hidden />
      <span>
        La tua coppia è <strong>{mine.position}ª</strong> con <span className="tabular">{mine.points}</span> punti.
      </span>
    </p>
  );
}
