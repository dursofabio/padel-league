import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { OfflineNotice, SignInPrompt, TournamentPageState, useMyTeam, useOnline } from '../../components/common';
import { MatchRow } from '../../components/MatchRow';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { useCourts, useTournamentData } from '../../data/queries';
import { labelDate } from '../../lib/time';
import type { Match, Period } from '../../types';
import { Segmented, Switch } from '../../ui/misc';

type Filter = 'all' | 'to-play' | 'played';
const isPlayed = (m: Match) => m.status === 'played' || m.status === 'forfeit';

interface Matchday {
  round: number;
  matches: Match[];
  period?: Period;
}

/** Group-phase calendar (/t/:tid/calendario): per group and matchday, opens on the first matchday still to play. */
export default function SchedulePage() {
  const { tid } = useParams();
  const { user } = useAuth();
  const d = useTournamentData(tid);
  const courts = useCourts();
  const online = useOnline();
  const myTeam = useMyTeam(d.teams);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [onlyMine, setOnlyMine] = useState(false);

  const byGroup = useMemo(() => {
    const periodById = new Map(d.periods.map((p) => [p.id, p]));
    const out = new Map<string, Matchday[]>();
    for (const m of d.matches) {
      if (m.phase !== 'groups' || !m.group) continue;
      const matchdays = out.get(m.group) ?? [];
      let md = matchdays.find((x) => x.round === (m.round ?? 0));
      if (!md) matchdays.push((md = { round: m.round ?? 0, matches: [] }));
      md.matches.push(m);
      if (!md.period && m.periodId) md.period = periodById.get(m.periodId);
      out.set(m.group, matchdays);
    }
    for (const mds of out.values()) {
      mds.sort((a, b) => a.round - b.round);
      for (const md of mds) md.matches.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || (a.code ?? '').localeCompare(b.code ?? ''));
    }
    return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [d.matches, d.periods]);

  const groupNames = [...byGroup.keys()];
  const active =
    selected && groupNames.includes(selected)
      ? selected
      : myTeam?.group && groupNames.includes(myTeam.group)
        ? myTeam.group
        : groupNames[0];

  // default scroll: first matchday of the active group with unplayed matches (only once, on arrival)
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !active) return;
    const first = byGroup.get(active)?.find((md) => md.matches.some((m) => !isPlayed(m)));
    if (!first || first.round === byGroup.get(active)?.[0]?.round) {
      if (byGroup.size) scrolled.current = true;
      return;
    }
    scrolled.current = true;
    document.getElementById(`giornata-${active}-${first.round}`)?.scrollIntoView({ block: 'start' });
  }, [active, byGroup]);

  const pageState = TournamentPageState({ isPending: d.isPending, error: d.error, tournament: d.tournament, refetch: d.refetch });
  // the heading renders before the data (it is the first meaningful paint)
  if (pageState || !d.tournament)
    return (
      <>
        <PageHeader title="Calendario" subtitle={d.tournament?.name} back={{ to: `/t/${tid}`, label: 'Torneo' }} />
        {pageState}
      </>
    );
  const tournament = d.tournament;

  const visible = (m: Match) =>
    (filter === 'all' || (filter === 'played' ? isPlayed(m) : !isPlayed(m))) &&
    (!onlyMine || !myTeam || m.teamA === myTeam.id || m.teamB === myTeam.id);
  const href = user ? (m: Match) => `/t/${tournament.id}/partite/${m.id}` : undefined;

  return (
    <>
      <PageHeader title="Calendario" subtitle={tournament.name} back={{ to: `/t/${tournament.id}`, label: 'Torneo' }} />
      {!online && <OfflineNotice />}
      {groupNames.length === 0 ? (
        <EmptyState title="Il calendario non è ancora pronto." text="L’organizzatore lo genera dopo aver composto i gironi: le partite compaiono qui." />
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-3">
            {groupNames.length > 1 && (
              <Segmented
                label="Girone"
                className="max-w-full flex-wrap lg:hidden"
                value={active}
                onValueChange={setSelected}
                options={groupNames.map((g) => ({ value: g, label: `Girone ${g}` }))}
              />
            )}
            <Segmented
              className="max-w-full flex-wrap"
              label="Quali partite"
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: 'all', label: 'Tutte' },
                { value: 'to-play', label: 'Da giocare' },
                { value: 'played', label: 'Giocate' },
              ]}
            />
            {myTeam && (
              <label className="inline-flex min-h-11 items-center gap-2 text-base font-semibold">
                <Switch checked={onlyMine} onCheckedChange={setOnlyMine} />
                Solo la mia coppia
              </label>
            )}
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            {groupNames.map((g) => {
              const matchdays = byGroup
                .get(g)!
                .map((x) => ({ ...x, matches: x.matches.filter(visible) }))
                .filter((x) => x.matches.length);
              return (
                <section key={g} aria-labelledby={`cal-${g}`} className={g === active ? 'grid content-start gap-6' : 'hidden content-start gap-6 lg:grid'}>
                  <h2 id={`cal-${g}`} className="poster text-poster-sm">
                    Girone {g}
                  </h2>
                  {matchdays.length === 0 && <p className="text-ink-muted">Nessuna partita con questi filtri.</p>}
                  {matchdays.map((x) => (
                    <section key={x.round} id={`giornata-${g}-${x.round}`} aria-labelledby={`giornata-${g}-${x.round}-h`} className="grid scroll-mt-20 gap-1">
                      <h3 id={`giornata-${g}-${x.round}-h`} className="flex flex-wrap items-baseline gap-x-2 border-b-2 border-line-strong pb-1 text-base font-bold">
                        Giornata {x.round}
                        {x.period && (
                          <span className="tabular text-sm font-normal text-ink-muted">
                            <span className="sr-only">, </span>entro {labelDate(x.period.endsOn)}
                          </span>
                        )}
                      </h3>
                      <ul className="court-rule">
                        {x.matches.map((m) => (
                          <li key={m.id}>
                            <MatchRow match={m} teamById={d.teamById} courts={courts.data ?? []} href={href?.(m)} highlight={myTeam ? [myTeam.id] : undefined} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      )}
      <SignInPrompt />
    </>
  );
}
