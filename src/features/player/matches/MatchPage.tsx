/**
 * /t/:tid/partite/:mid: the match as a state machine with ONE primary block per state
 * (docs/ux/programma-partita.md §5, S0–S8) + organizer tools (docs/ux/risultato.md).
 */
import { ArrowRight, Ban, CircleX, TimerOff, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { PageHeader, Section } from '../../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../../components/states';
import { MatchStatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../auth/AuthProvider';
import { useCourts, useNames, usePlayerRequests, useProfiles, useRequest, useTournamentData } from '../../../data/queries';
import { labelDate, today } from '../../../lib/time';
import { teamName } from '../../../lib/tournament';
import { appUrl } from '../../../lib/whatsapp';
import type { Match, MatchRequest, MatchStatus, Period } from '../../../types';
import { Button, cn, Skeleton } from '../../../ui';
import { courtName, type MatchContext } from './context';
import { Scheduled } from './confirmed/Scheduled';
import { isLate, isLiveRequest, matchStage, sideOf, type MatchStage } from './logic';
import { AwaitingConfirmationBadge, LateBadge, Notice, useNowTick, WRAP } from './parts';
import { AcceptanceTracker } from './request/AcceptanceTracker';
import { AwaitingConfirmation, ConfirmResult, Disputed, EnterResult, Final } from './result/ResultBlocks';
import { OrganizerTools } from './result/OrganizerTools';
import { SlotGrid } from './slots/SlotGrid';

const TITLES: Record<MatchStage, string> = {
  S0: 'In attesa delle coppie',
  S1: 'Scegli un orario',
  S2: 'Richiesta al campo',
  S3: 'Richiesta al campo',
  S4: 'Partita confermata',
  S5: 'Inserisci il risultato',
  S6: 'Risultato da confermare',
  S7: 'Risultato contestato',
  S8: 'Risultato',
};

const EFFECTIVE_STATUS: Partial<Record<MatchStage, MatchStatus>> = {
  S1: 'unscheduled',
  S2: 'requested',
  S3: 'requested',
  S4: 'scheduled',
  S5: 'scheduled',
};

export default function MatchPage() {
  const { tid, mid } = useParams();
  const { user, hasRole } = useAuth();
  const data = useTournamentData(tid);
  const courts = useCourts();
  const names = useNames();
  const profiles = useProfiles();
  const match = data.matches.find((m) => m.id === mid);
  const request = useRequest(match?.requestId);
  const mine = usePlayerRequests(user?.id);
  const now = useNowTick();
  const location = useLocation();

  const phones = useMemo(() => new Map((profiles.data ?? []).map((p) => [p.id, p.phone ?? undefined])), [profiles.data]);
  const managerPhone = profiles.data?.find((p) => p.roles.includes('manager') && p.phone)?.phone ?? undefined;

  useEffect(() => {
    if (location.hash === '#risultato' && match) document.getElementById('risultato')?.scrollIntoView({ block: 'start' });
  }, [location.hash, match]);

  if (data.isPending || courts.isPending)
    return (
      <div className="grid gap-6" role="status" aria-label="Caricamento della partita">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <SkeletonRows rows={3} />
      </div>
    );
  if (data.error || courts.error)
    return (
      <>
        <PageHeader title="Partita" back={{ to: `/t/${tid}/partite`, label: 'Le mie partite' }} />
        <ErrorState
          error={data.error ?? courts.error}
          onRetry={() => {
            data.refetch();
            courts.refetch();
          }}
        />
      </>
    );
  if (!match || !data.tournament)
    return (
      <>
        <PageHeader title="Partita non trovata" back={{ to: `/t/${tid}/partite`, label: 'Le mie partite' }} />
        <EmptyState
          title="Questa partita non esiste più"
          text="Forse il calendario è stato rigenerato. Trovi le tue partite nell’elenco."
          action={
            <Button asChild variant="secondary">
              <Link to={`/t/${tid}/partite`}>Vai alle mie partite</Link>
            </Button>
          }
        />
      </>
    );

  const nameA = teamName(data.teamById, match.teamA);
  const nameB = teamName(data.teamById, match.teamB);
  const period = data.periods.find((p) => p.id === match.periodId) ?? null;
  const ctx: MatchContext = {
    tid: tid!,
    match,
    tournament: data.tournament,
    period,
    courts: courts.data ?? [],
    name: names.name,
    nameA,
    nameB,
    uid: user?.id ?? null,
    mySide: sideOf(match, user?.id),
    phone: (uid) => phones.get(uid),
    managerPhone,
    link: appUrl(`/t/${tid}/partite/${match.id}`),
    title: `${nameA} – ${nameB}`,
  };

  const awaitingRequest = !!match.requestId && request.isPending;
  const stage = matchStage(match, request.data, now);
  const late = isLate(match, period, today());
  const organizer = hasRole('organizer');

  return <Screen ctx={ctx} stage={stage} request={request.data ?? null} mine={mine.data ?? []} late={late} organizer={organizer} loading={awaitingRequest} />;
}

function subtitle(m: Match, period: Period | null): string {
  const parts: string[] = [];
  if (m.phase === 'groups') {
    if (m.group) parts.push(`Girone ${m.group}`);
    if (m.round) parts.push(`Giornata ${m.round}`);
  } else {
    parts.push(m.phase.charAt(0).toUpperCase() + m.phase.slice(1));
    if (m.round) parts.push(`Turno ${m.round}`);
  }
  if (period) parts.push(`da giocare entro ${labelDate(period.endsOn)}`);
  return parts.join(' · ');
}

function Screen({
  ctx,
  stage,
  request,
  mine,
  late,
  organizer,
  loading,
}: {
  ctx: MatchContext;
  stage: MatchStage;
  request: MatchRequest | null;
  mine: MatchRequest[];
  late: boolean;
  organizer: boolean;
  loading: boolean;
}) {
  const { match, tid } = ctx;
  const [entering, setEntering] = useState(false);

  // polite announcement when the primary block changes (realtime)
  const previous = useRef(stage);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (previous.current !== stage) setAnnouncement(`La partita è cambiata: ${TITLES[stage]}.`);
    previous.current = stage;
  }, [stage]);

  const opponentToConfirm = stage === 'S6' && !!ctx.mySide && ctx.mySide !== sideOf(match, match.result?.enteredBy);
  const mustAccept = (stage === 'S2' || stage === 'S3') && !!ctx.uid && !!request && request.players.includes(ctx.uid) && !request.acceptances[ctx.uid];
  const playerLane = mustAccept || (stage === 'S5' && !!ctx.mySide) || opponentToConfirm || entering;
  const tools = organizer && stage !== 'S0';
  const badgeStatus = EFFECTIVE_STATUS[stage] ?? match.status;

  const blocks: Record<MatchStage, () => ReactNode> = {
    S0: () => (
      <div className="grid gap-3">
        <p>La griglia si apre quando entrambe le coppie sono note.</p>
        <Link to={`/t/${tid}/tabellone/${match.phase}`} className="inline-flex min-h-11 items-center gap-1.5 justify-self-start font-semibold text-ink underline">
          Vedi il tabellone <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    ),
    S1: () => (
      <div className="grid gap-4">
        <FailureReason ctx={ctx} candidates={[...mine, ...(request ? [request] : [])]} />
        <SlotGrid ctx={ctx} />
      </div>
    ),
    S2: () => (request ? <AcceptanceTracker ctx={ctx} request={request} /> : null),
    S3: () => (request ? <AcceptanceTracker ctx={ctx} request={request} /> : null),
    S4: () => <Scheduled ctx={ctx} />,
    S5: () => (
      <div className="grid gap-4">
        {match.schedule && (
          <p className="tabular text-ink-muted">
            Programmata {labelDate(match.schedule.date)} alle {match.schedule.start} · {courtName(ctx.courts, match.schedule.courtId)}
          </p>
        )}
        {ctx.mySide ? <EnterResult ctx={ctx} /> : <p>Aspettiamo che uno dei giocatori inserisca il risultato.</p>}
      </div>
    ),
    S6: () => (opponentToConfirm ? <ConfirmResult ctx={ctx} /> : <AwaitingConfirmation ctx={ctx} />),
    S7: () => <Disputed ctx={ctx} />,
    S8: () => <Final ctx={ctx} />,
  };

  const toolsSection = tools && (
    <Section title="Strumenti organizzatore" id="organizer-tools">
      <OrganizerTools ctx={ctx} primary={!playerLane} />
    </Section>
  );
  const primaryId = ['S5', 'S6', 'S7', 'S8'].includes(stage) ? 'risultato' : 'programma';

  return (
    <div className={cn('grid min-w-0 gap-6', WRAP)}>
      <PageHeader
        title={
          <>
            {ctx.nameA} <span className="font-sans text-xl font-semibold text-ink-muted normal-case">contro</span> {ctx.nameB}
          </>
        }
        subtitle={
          <span className="grid gap-2">
            <span>{subtitle(match, ctx.period)}</span>
            <span className="flex flex-wrap gap-2">
              {stage === 'S6' ? <AwaitingConfirmationBadge /> : <MatchStatusBadge status={badgeStatus} />}
              {late && <LateBadge />}
            </span>
          </span>
        }
        back={{ to: `/t/${tid}/partite`, label: 'Le mie partite' }}
      />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className={tools && stage === 'S7' ? 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid gap-8'}>
        {tools && stage === 'S7' && toolsSection}
        <section aria-labelledby={`${primaryId}-titolo`} id={primaryId} className="grid scroll-mt-24 gap-4">
          <h2 id={`${primaryId}-titolo`} className="poster text-poster-sm">
            {TITLES[stage]}
          </h2>
          {loading ? <SkeletonRows rows={3} /> : blocks[stage]()}
        </section>
        {tools && stage !== 'S7' && toolsSection}
      </div>

      {stage === 'S1' && ctx.mySide && (
        <Section title="Hai già giocato?" id="already-played">
          {entering ? (
            <div id="risultato" className="scroll-mt-24">
              <EnterResult ctx={ctx} onDone={() => setEntering(false)} onCancel={() => setEntering(false)} />
            </div>
          ) : (
            <Button variant="secondary" className="justify-self-start" onClick={() => setEntering(true)}>
              Inserisci il risultato
            </Button>
          )}
        </Section>
      )}

      <Section title="Giocatori" id="players">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              [ctx.nameA, match.playersA],
              [ctx.nameB, match.playersB],
            ] as const
          ).map(([team, players], i) => (
            <div key={i} className="grid content-start gap-1">
              <p className="font-bold">{team}</p>
              {players.length ? (
                <ul className="court-rule">
                  {players.map((p) => (
                    <li key={p} className="py-2">
                      {ctx.name(p)}
                      {p === ctx.uid && <span className="text-ink-muted"> (tu)</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">Coppia da definire</p>
              )}
            </div>
          ))}
        </div>
        {ctx.period && (
          <p className="tabular text-ink-muted">
            {ctx.period.label}: dal {labelDate(ctx.period.startsOn)} al {labelDate(ctx.period.endsOn)}
          </p>
        )}
      </Section>
    </div>
  );
}

/** Why the grid is back (S1): the last request of this match failed. */
function FailureReason({ ctx, candidates }: { ctx: MatchContext; candidates: MatchRequest[] }) {
  const now = Date.now();
  const last = candidates
    .filter((r) => r.matchId === ctx.match.id)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.expiresAt.toMillis() - a.expiresAt.toMillis())[0];
  if (!last || isLiveRequest(last, now) || last.status === 'confirmed') return null;
  const when = `${labelDate(last.date)} alle ${last.start}`;
  if (last.status === 'expired' || last.status === 'pending')
    return (
      <Notice icon={TimerOff} tone="warn">
        La richiesta per {when} è scaduta senza risposta. Scegline un’altra.
      </Notice>
    );
  if (last.status === 'rejected')
    return (
      <Notice icon={CircleX} tone="danger">
        Il campo ha rifiutato {when}
        {last.note ? `: «${last.note}»` : ''}. Scegli un altro orario.
      </Notice>
    );
  if (last.status === 'conflict')
    return (
      <Notice icon={TriangleAlert} tone="danger">
        Mentre il campo confermava {when}, l’orario risultava già occupato. Scegline un altro.
      </Notice>
    );
  if (last.status === 'cancelled')
    return (
      <Notice icon={Ban}>
        La richiesta per {when} è stata annullata{last.note ? `: «${last.note}»` : ''}. Scegli un altro orario.
      </Notice>
    );
  return null;
}

