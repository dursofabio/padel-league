/**
 * /t/:tid/partite: my matches grouped by state. What needs me first (acceptances, results to confirm or enter),
 * then to schedule (late ones on top, "In ritardo"), requests in progress, scheduled, pending results, closed.
 */
import { AlarmClock, CircleCheck, Hourglass, PenLine } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { MatchRow } from '../../../components/MatchRow';
import { MatchStatusBadge } from '../../../components/StatusBadge';
import { PageHeader, Section } from '../../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../../components/states';
import { useAuth } from '../../../auth/AuthProvider';
import { useCourts, usePlayerRequests, useTournamentData } from '../../../data/queries';
import { labelDate, today } from '../../../lib/time';
import type { Match, MatchRequest, MatchStatus } from '../../../types';
import { Button, cn } from '../../../ui';
import { effectiveExpiry, isLate, localInstant, MATCH_GROUPS, matchGroup, matchStage, timeUntil, type MatchGroup, type MatchStage, type TurnReason } from './logic';
import { AwaitingConfirmationBadge, LateBadge, Pill, useNowTick, WRAP } from './parts';

interface Entry {
  match: Match;
  request?: MatchRequest;
  reason?: TurnReason;
  late: boolean;
  stage: MatchStage;
  /** Period end ("entro …" on open matches). */
  endsOn?: string;
  /** Sort key inside the group. */
  order: number;
}

export default function MatchesPage() {
  const { tid } = useParams();
  const { user } = useAuth();
  const data = useTournamentData(tid);
  const courts = useCourts();
  const requests = usePlayerRequests(user?.id);
  const now = useNowTick();
  const todayDate = today();
  const uid = user?.id ?? '';

  const groups = useMemo(() => {
    const byId = new Map((requests.data ?? []).map((r) => [r.id, r]));
    const periods = new Map(data.periods.map((p) => [p.id, p]));
    const out = new Map<MatchGroup, Entry[]>();
    for (const m of data.matches) {
      if (!m.players.includes(uid)) continue;
      const request = m.requestId ? byId.get(m.requestId) : undefined;
      const { group, reason } = matchGroup(m, request, uid, now);
      const period = m.periodId ? periods.get(m.periodId) : undefined;
      const late = isLate(m, period, todayDate);
      const order =
        group === 'scheduled' && m.schedule
          ? localInstant(m.schedule.date, m.schedule.start)
          : group === 'your-turn' && request
            ? effectiveExpiry(request)
            : group === 'completed'
              ? -Date.parse(period?.endsOn ?? '1970-01-01')
              : Date.parse(period?.endsOn ?? '2999-01-01');
      const list = out.get(group) ?? [];
      list.push({ match: m, request, reason, late, order, stage: matchStage(m, request, now), endsOn: period?.endsOn });
      out.set(group, list);
    }
    for (const l of out.values()) l.sort((a, b) => a.order - b.order || (a.match.code ?? '').localeCompare(b.match.code ?? ''));
    return out;
  }, [data.matches, data.periods, requests.data, uid, now, todayDate]);

  const header = <PageHeader title="Le mie partite" subtitle={data.tournament?.name} />;
  if (data.isPending || courts.isPending || (!!uid && requests.isPending))
    return (
      <>
        {header}
        <SkeletonRows rows={6} />
      </>
    );
  if (data.error || courts.error || requests.error)
    return (
      <>
        {header}
        <ErrorState
          error={data.error ?? courts.error ?? requests.error}
          onRetry={() => {
            data.refetch();
            courts.refetch();
            requests.refetch();
          }}
        />
      </>
    );
  const total = [...groups.values()].reduce((n, l) => n + l.length, 0);
  if (!total)
    return (
      <>
        {header}
        <EmptyState
          title="Non hai ancora partite in questo torneo"
          text="Le partite compaiono qui quando la tua coppia è approvata e l’organizzatore genera il calendario. Intanto puoi segnare le tue disponibilità."
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link to={`/t/${tid}/coppia`}>Vai alla tua coppia</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to={`/t/${tid}/disponibilita`}>Segna le disponibilità</Link>
              </Button>
            </div>
          }
        />
      </>
    );

  return (
    <>
      {header}
      <div className={cn('grid gap-8', WRAP)}>
        {MATCH_GROUPS.map(({ id, title }) => {
          const list = groups.get(id);
          if (!list?.length) return null;
          return (
            <Section key={id} id={`group-${id}`} title={`${title} (${list.length})`}>
              <ul className="court-rule">
                {list.map((v) => (
                  <li key={v.match.id}>
                    <MatchRow
                      match={v.match}
                      teamById={data.teamById}
                      courts={courts.data ?? []}
                      href={`/t/${tid}/partite/${v.match.id}${v.reason === 'confirm-result' || v.reason === 'enter-result' ? '#risultato' : ''}`}
                      hideStatus
                      note={<Note v={v} now={now} />}
                    />
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}
      </div>
    </>
  );
}

const STAGE_STATUS: Partial<Record<MatchStage, MatchStatus>> = { S2: 'requested', S3: 'requested', S4: 'scheduled', S5: 'scheduled' };

function Note({ v, now }: { v: Entry; now: number }) {
  const parts = [];
  // the derived state, not the raw one (an expired request reads "da programmare"); the "Da programmare"
  // group heading already says it, and "Tocca a te" rows carry their own action pill
  if (!v.reason) {
    if (v.stage === 'S6') parts.push(<AwaitingConfirmationBadge key="s" />);
    else if (v.stage !== 'S0' && v.stage !== 'S1') parts.push(<MatchStatusBadge key="s" status={STAGE_STATUS[v.stage] ?? v.match.status} />);
  }
  if (v.late) parts.push(<LateBadge key="r" />);
  else if (v.endsOn && ['S1', 'S2', 'S3'].includes(v.stage))
    parts.push(
      <span key="f" className="tabular">
        entro {labelDate(v.endsOn)}
      </span>,
    );
  if (v.reason === 'accept' && v.request) {
    const until = timeUntil(effectiveExpiry(v.request), now);
    parts.push(
      <Pill key="m" icon={Hourglass} tone="warn">
        Accetta {labelDate(v.request.date)} {v.request.start}
      </Pill>,
    );
    if (until)
      parts.push(
        <span key="t" className="tabular inline-flex items-center gap-1">
          <AlarmClock className="size-4" aria-hidden /> scade {until}
        </span>,
      );
  }
  if (v.reason === 'confirm-result')
    parts.push(
      <Pill key="m" icon={CircleCheck} tone="warn">
        Conferma il risultato
      </Pill>,
    );
  if (v.reason === 'enter-result')
    parts.push(
      <Pill key="m" icon={PenLine} tone="warn">
        Inserisci il risultato
      </Pill>,
    );
  return parts.length ? <>{parts}</> : null;
}
