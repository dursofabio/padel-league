import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useCurrentTournament } from '../../app/current-tournament';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/states';
import {
  useAvailability,
  useConfirmedRequests,
  useCourts,
  useNames,
  usePendingRequests,
  usePlayerRequests,
  useTournamentData,
} from '../../data/queries';
import {
  countByRole,
  deriveAttention,
  describeDeadline,
  romeDateTime,
  romeInstant,
  type AttentionItem,
  type AttentionRole,
  type Priority,
} from '../../lib/attention';
import { groupFeed } from '../../lib/feed';
import type { Match, MatchRequest } from '../../types';
import { Button, buttonVariants } from '../../ui/button';
import { Segmented } from '../../ui/misc';
import { OfflineNotice, useNow, useOnline } from '../../components/common';
import { AttentionRow, type RowTone } from './AttentionRow';
import { teamsOf, whereWhen, type RowContext } from './content';
import { NextMatch } from './NextMatch';
import { FeedGroup } from './FeedGroup';
import { StandingTile } from '../../components/StandingTile';
import { tournamentStandings } from '../../lib/tournament';

type Filter = 'all' | AttentionRole;

const GROUPS: { p: Priority; title: string }[] = [
  { p: 0, title: 'Urgente' },
  { p: 1, title: 'Da fare' },
  { p: 2, title: 'Presto' },
  { p: 3, title: 'Per sapere' },
];
const ROLE_FILTER_LABEL: Record<AttentionRole, string> = { player: 'Partite', manager: 'Campo', organizer: 'Organizza' };
const MAX_FYI = 3;
const linkCls = 'inline-flex min-h-11 items-center font-bold text-ink underline';

const matchStart = (m: Match) => (m.schedule ? romeInstant(m.schedule.date, m.schedule.start) : Infinity);

/** Logged-in home: the "Da fare" feed merging every role of the user. */
export function TodoFeed() {
  const { user, profile } = useAuth();
  const uid = user!.id;
  // roles taken literally: admin alone gives no items (ASSUMPTION H7)
  const roles = useMemo(() => profile?.roles ?? [], [profile?.roles]);
  const isManager = roles.includes('manager');
  const now = useNow(60_000);
  const today = romeDateTime(now).date;
  const online = useOnline();

  const current = useCurrentTournament();
  const tid = current.tid;
  const d = useTournamentData(tid);
  const mine = usePlayerRequests(uid);
  const pending = usePendingRequests(isManager);
  const confirmed = useConfirmedRequests(today, isManager);
  const avail = useAvailability(tid, [uid]);
  const courts = useCourts();
  const { name } = useNames();

  const requests = useMemo(() => {
    const all = [...(mine.data ?? []), ...(pending.data ?? []), ...(confirmed.data ?? [])];
    return [...new Map(all.map((r) => [r.id, r])).values()];
  }, [mine.data, pending.data, confirmed.data]);

  const items = useMemo(
    () =>
      deriveAttention({
        now,
        today,
        uid,
        roles,
        tournament: d.tournament ?? null,
        periods: d.periods,
        teams: d.teams,
        matches: d.matches,
        requests,
        myWindows: avail.data?.[uid]?.windows ?? null,
      }),
    [now, today, uid, roles, d.tournament, d.periods, d.teams, d.matches, requests, avail.data],
  );

  const ctx = useMemo<RowContext>(() => {
    const byMatch = new Map<string, MatchRequest[]>();
    for (const r of requests) byMatch.set(r.matchId, [...(byMatch.get(r.matchId) ?? []), r]);
    return {
      tid: tid ?? '',
      matchById: new Map(d.matches.map((m) => [m.id, m])),
      requestById: new Map(requests.map((r) => [r.id, r])),
      requestsByMatch: byMatch,
      periodById: new Map(d.periods.map((p) => [p.id, p])),
      teamById: d.teamById,
      courts: courts.data ?? [],
      name,
      uid,
    };
  }, [tid, d.matches, d.periods, d.teamById, requests, courts.data, name, uid]);

  // ---- resolved rows: keep them for ~2 s with their result, then let them go
  const [done, setDone] = useState<Map<string, { it: AttentionItem; text: string }>>(new Map());
  const [announcement, setAnnouncement] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const onDone = useCallback((it: AttentionItem, text: string) => {
    setDone((m) => new Map(m).set(it.id, { it, text }));
    setAnnouncement(text);
    timers.current.push(
      setTimeout(() => {
        setDone((m) => {
          const n = new Map(m);
          n.delete(it.id);
          return n;
        });
      }, 2000),
    );
  }, []);

  // ---- realtime: one polite summary when new items arrive (not on first load)
  const seen = useRef<Set<string> | null>(null);
  const loaded = !d.isPending || !tid;
  useEffect(() => {
    if (!loaded || mine.isPending) return;
    const ids = new Set(items.map((i) => i.id));
    if (seen.current) {
      const added = [...ids].filter((id) => !seen.current!.has(id)).length;
      if (added) setAnnouncement(added === 1 ? '1 nuova cosa da fare' : `${added} nuove cose da fare`);
    }
    seen.current = ids;
  }, [items, loaded, mine.isPending]);

  // ---- role filter, only with ≥ 2 roles
  const feedRoles = (['player', 'manager', 'organizer'] as AttentionRole[]).filter((r) => roles.includes(r));
  const [filter, setFilter] = useState<Filter>('all');
  const counts = countByRole(items);
  const shows = (r: AttentionRole) => filter === 'all' || filter === r;

  const [expanded, setExpanded] = useState(false);

  const myTeam = d.teams.find((t) => t.players.includes(uid) && t.status !== 'withdrawn');
  const standings = useMemo(
    () => (d.tournament ? tournamentStandings(d.tournament, d.teams, d.matches) : {}),
    [d.tournament, d.teams, d.matches],
  );
  const upcoming = useMemo(
    () =>
      d.matches
        .filter((m) => m.status === 'scheduled' && m.players.includes(uid) && matchStart(m) > now)
        .sort((a, b) => matchStart(a) - matchStart(b))
        .slice(0, 3),
    [d.matches, uid, now],
  );

  const loading =
    current.isPending || (!!tid && d.isPending) || mine.isLoading || pending.isLoading || confirmed.isLoading || avail.isLoading;
  const error = d.error ?? mine.error ?? pending.error ?? confirmed.error ?? avail.error;
  const retry = () => {
    d.refetch();
    void mine.refetch();
    if (isManager) {
      void pending.refetch();
      void confirmed.refetch();
    }
    if (tid) void avail.refetch();
  };

  const header = (title: React.ReactNode = 'Da fare', subtitle?: React.ReactNode) => (
    <PageHeader
      title={title}
      subtitle={subtitle}
      actions={
        feedRoles.length >= 2 ? (
          <Segmented<Filter>
            className="max-w-full flex-wrap"
            label="Mostra"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: 'all', label: 'Tutto' },
              ...feedRoles.map((r) => ({ value: r, label: counts[r] ? `${ROLE_FILTER_LABEL[r]} ${counts[r]}` : ROLE_FILTER_LABEL[r] })),
            ]}
          />
        ) : undefined
      }
    />
  );

  if (loading)
    return (
      <>
        {header()}
        <SkeletonRows rows={3} />
      </>
    );
  if (error && !items.length && !d.tournament)
    return (
      <>
        {header()}
        <ErrorState error={error} onRetry={retry} />
      </>
    );

  if (!tid && !isManager)
    return (
      <>
        {header()}
        <EmptyState title="Non c’è ancora nessun torneo." text="Quando l’organizzatore crea il torneo, qui trovi quello che c’è da fare." />
      </>
    );

  // merge resolved rows back in their group while they show "Fatto"
  const visible = [
    ...[...done.values()].filter((f) => !items.some((i) => i.id === f.it.id)).map((f) => f.it),
    ...items,
  ].filter((i) => shows(i.role));
  // the next match is the headline block: drop its "Prossima partita" item from the feed
  const next = roles.includes('player') && shows('player') ? upcoming[0] : undefined;
  const feed = visible.filter((i) => !(i.kind === 'upcoming-match' && i.refs.matchId === next?.id));
  const open = feed.filter((i) => !done.has(i.id) && i.priority <= 2);
  const primary = open[0];
  const tone = (i: AttentionItem): RowTone =>
    i.id === primary?.id ? 'ball' : i.priority === 3 ? 'plain' : i.kind === 'set-availability' ? 'clay' : 'paper';

  // desktop column: upcoming matches not already shown as the headline or in the feed
  const inFeed = new Set(items.filter((i) => i.kind === 'upcoming-match').map((i) => i.refs.matchId));
  const otherMatches = roles.includes('player') && myTeam && tid ? upcoming.filter((m) => m.id !== next?.id && !inFeed.has(m.id)) : [];

  const firstName = profile?.name?.split(/\s+/)[0];
  const hello = firstName ? `Ciao ${firstName},` : 'Ciao,';
  const title = open.length ? (
    <>
      {hello}{' '}
      <br />
      hai <span className="mark">{open.length}</span> {open.length === 1 ? 'cosa' : 'cose'} da fare
    </>
  ) : (
    <>
      {hello}{' '}
      <br />
      tutto in ordine
    </>
  );
  const subtitle = primary?.deadline ? `La più urgente: ${describeDeadline(primary.deadline, now)}` : undefined;

  const myGroup = myTeam?.group ?? null;
  const tile =
    roles.includes('player') && shows('player') && myTeam && myGroup && standings[myGroup] && d.tournament ? (
      <StandingTile
        group={myGroup}
        rows={standings[myGroup]}
        teamId={myTeam.id}
        phases={d.tournament.config.finals}
        groupCount={Object.keys(standings).length}
        to={`/t/${tid}/classifiche`}
      />
    ) : null;

  const notRegistered = !!d.tournament && roles.includes('player') && !myTeam && shows('player');

  return (
    <>
      {header(title, subtitle)}
      {!online && <OfflineNotice />}
      {error && <ErrorState error={error} onRetry={retry} />}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Mobile: next match, feed, then where you stand. Desktop: feed on the left, the player's column on the right. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:grid-rows-[auto_1fr] lg:gap-x-10">
        {next && (
          <div className="lg:col-start-2 lg:row-start-1">
            <NextMatch match={next} ctx={ctx} />
          </div>
        )}
        <div className="grid content-start gap-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {feed.length === 0 ? (
            <Empty filter={filter} roles={feedRoles} tid={tid} today={today} registered={!!myTeam} />
          ) : (
            GROUPS.map(({ p, title }) => {
              const rows = feed.filter((i) => i.priority === p);
              if (!rows.length) return null;
              const truncated = p === 3 && !expanded && rows.length > MAX_FYI;
              const list = truncated ? rows.slice(0, MAX_FYI) : rows;
              const hasRequests = rows.some((i) => i.kind === 'confirm-request');
              return (
                <section key={p} aria-labelledby={`group-${p}`} className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line-strong pb-1">
                    <h2 id={`group-${p}`} className="poster text-poster-sm">
                      {title}
                    </h2>
                    {hasRequests && (
                      <Link to="/campo" className={linkCls}>
                        Apri richieste
                      </Link>
                    )}
                  </div>
                  <ul className={p === 3 ? 'court-rule' : 'grid gap-3'}>
                    {groupFeed(list, primary?.id).map((e) =>
                      e.type === 'group' ? (
                        <li key={`group:${e.kind}`}>
                          <FeedGroup kind={e.kind} items={e.items} ctx={ctx} now={now} more={primary?.kind === e.kind} />
                        </li>
                      ) : (
                        <li key={e.item.id}>
                          <AttentionRow it={e.item} ctx={ctx} now={now} tone={tone(e.item)} done={done.get(e.item.id)?.text} onDone={onDone} />
                        </li>
                      ),
                    )}
                  </ul>
                  {truncated && (
                    <Button variant="ghost" className="justify-self-start" onClick={() => setExpanded(true)}>
                      Mostra altre {rows.length - MAX_FYI}
                    </Button>
                  )}
                </section>
              );
            })
          )}

          {notRegistered && d.tournament && (
            <section aria-labelledby="not-registered" className="grid gap-2 border-t-2 border-line-strong pt-4">
              <h2 id="not-registered" className="poster text-poster-sm">
                Non sei ancora iscritto a questo torneo.
              </h2>
              {d.tournament.status === 'registration' ? (
                <Link to={`/t/${tid}/coppia`} className={buttonVariants({ variant: 'secondary', className: 'justify-self-start' })}>
                  Iscrivi la tua coppia
                </Link>
              ) : (
                <Link to={`/t/${tid}`} className={linkCls}>
                  Segui classifiche e calendario
                </Link>
              )}
            </section>
          )}
        </div>
        {(tile || otherMatches.length > 0) && (
          <div className="grid content-start gap-8 lg:col-start-2 lg:row-start-2">
            {tile}
            {otherMatches.length > 0 && (
              <section aria-labelledby="upcoming" className="hidden content-start gap-1 lg:grid">
                <h2 id="upcoming" className="poster border-b-2 border-line-strong pb-1 text-xl">
                  Prossime partite
                </h2>
                <ul className="court-rule">
                  {otherMatches.map((m) => (
                    <li key={m.id}>
                      <Link to={`/t/${tid}/partite/${m.id}`} className="-mx-2 grid min-h-14 gap-0.5 rounded-control px-2 py-3 hover:bg-surface-2">
                        <span className="text-base">{teamsOf(m, ctx)}</span>
                        {m.schedule && <span className="tabular text-sm text-ink-muted">{whereWhen(m.schedule, ctx.courts)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link to={`/t/${tid}/partite`} className={linkCls}>
                  Vedi le tue partite
                </Link>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Empty({
  filter,
  roles,
  tid,
  today,
  registered,
}: {
  registered: boolean;
  filter: Filter;
  roles: AttentionRole[];
  tid: string | undefined;
  today: string;
}) {
  const sees = (r: AttentionRole) => roles.includes(r) && (filter === 'all' || filter === r);
  return (
    <div className="grid gap-4">
      {sees('player') && tid && registered && (
        <EmptyState
          title="Niente da fare adesso."
          text="Quando qualcuno propone un orario o inserisce un risultato lo trovi qui."
          action={
            <Link to={`/t/${tid}/partite`} className={linkCls}>
              Vedi le tue partite
            </Link>
          }
        />
      )}
      {sees('manager') && (
        <EmptyState
          title="Nessuna richiesta da confermare."
          action={
            <Link to={`/campo/giorno/${today}`} className={linkCls}>
              Apri la giornata di oggi
            </Link>
          }
        />
      )}
      {sees('organizer') && (
        <EmptyState title="Il torneo procede da solo." text="Nessuna contestazione e nessuna partita in ritardo." />
      )}
      {roles.length === 0 && (
        <EmptyState
          title="Niente da fare qui."
          text="Segui classifiche e calendario del torneo."
          action={
            tid ? (
              <Link to={`/t/${tid}`} className={linkCls}>
                Apri il torneo
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
