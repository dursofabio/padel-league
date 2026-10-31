import {
  AlarmClock,
  Ban,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock3,
  Hourglass,
  Lock,
  Repeat,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { scaleFromCourts } from '../../components/CourtLanes';
import { PageHeader, Section } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/states';
import { TONE_CLASSES } from '../../components/StatusBadge';
import { actions, useAction } from '../../data/mutations';
import { useCourts, useBookings, useConfirmedRequests, usePendingRequests } from '../../data/queries';
import { isRequestActive, impactedSlots } from '../../lib/slots';
import { addDays, labelDate, today } from '../../lib/time';
import type { Court, BookingRow, MatchRequest } from '../../types';
import { Button, cn, ConfirmDialog, Field, Sheet, Skeleton, Textarea } from '../../ui';
import { CounterProposeSheet } from './CounterProposeSheet';
import { useManagerMatches } from './data';
import { Outcome } from './Outcome';
import { ManagerNav } from './ManagerNav';
import { DayLanes } from './DayLanes';
import { TWO_PANES, OFFLINE_REASON, useNow, useMediaQuery, useOnline } from './hooks';
import {
  acceptanceState,
  isComplete,
  describeBooking,
  joinList,
  confirmMessage,
  confirmBlockReason,
  conflictingBookings,
  sortByDeadline,
  overlappingRequests,
  effectiveDeadline,
  deadlineText,
  startMs,
  type OutcomeMessage,
} from './logic';

const CONFIRMED_DAYS = 14;
/** Same selection treatment as the timeline block (LaneBlock): court-blue outline + ball halo. */
const SELECTED_STYLE = 'rounded-panel px-2 outline-2 outline-offset-1 outline-court-deep shadow-[0_0_0_5px_var(--ball)] dark:outline-ball';
const QUICK_NOTES = ['Campo occupato', 'Manutenzione', 'Orario non disponibile'];

/** Court manager inbox (/campo): confirm, reject, counter-propose; upcoming confirmed matches with cancel. */
export default function RequestsPage() {
  const now = useNow();
  const online = useOnline();
  const twoPanes = useMediaQuery(TWO_PANES);
  const todayDate = today();
  const [params, setParams] = useSearchParams();

  const courts = useCourts();
  const pending = usePendingRequests();
  const confirmed = useConfirmedRequests(todayDate);
  const matches = useManagerMatches();

  const live = useMemo(() => (pending.data ?? []).filter((r) => isRequestActive(r, now)), [pending.data, now]);
  const upcoming = useMemo(
    () => (confirmed.data ?? []).filter((r) => r.date <= addDays(todayDate, CONFIRMED_DAYS)),
    [confirmed.data, todayDate],
  );

  // occupations over the whole window of the listed requests (conflict preview + timeline)
  const dates = [...live, ...upcoming].map((r) => r.date).sort();
  const from = dates[0] ?? todayDate;
  const to = dates[dates.length - 1] ?? todayDate;
  const bookings = useBookings(from, to, !pending.isPending);

  const ready = useMemo(() => sortByDeadline(live.filter(isComplete)), [live]);
  const incomplete = useMemo(() => sortByDeadline(live.filter((r) => !isComplete(r))), [live]);

  const selectedId = params.get('r') ?? ready[0]?.id ?? incomplete[0]?.id ?? upcoming[0]?.id ?? null;
  const select = (id: string) => setParams({ r: id }, { replace: true });
  const selected = [...live, ...upcoming].find((r) => r.id === selectedId) ?? null;

  const [outcome, setOutcome] = useState<OutcomeMessage | null>(null);
  const [toReject, setToReject] = useState<MatchRequest | null>(null);
  const [toCounter, setToCounter] = useState<MatchRequest | null>(null);
  const [toCancel, setToCancel] = useState<MatchRequest | null>(null);
  const [incompleteOpen, setIncompleteOpen] = useState(false);

  const courtName = (id: string) => courts.data?.find((c) => c.id === id)?.name ?? id;
  const confirm = useAction(actions.confirmRequest);

  const loading = pending.isPending || courts.isPending;
  const error = pending.error ?? courts.error;
  const primary = ready.find((r) => r.id === selectedId)?.id ?? ready[0]?.id;
  const offline = online ? null : OFFLINE_REASON;

  const row = (r: MatchRequest) => (
    <RequestRow
      key={r.id}
      r={r}
      court={courts.data?.find((c) => c.id === r.courtId)}
      all={live}
      bookings={bookings.rows}
      now={now}
      matches={matches}
      primary={r.id === primary}
      selected={twoPanes && r.id === selectedId}
      twoPanes={twoPanes}
      onSelect={() => select(r.id)}
      confirming={confirm.isPending && confirm.variables === r.id}
      offline={offline}
      onConfirm={() => {
        setOutcome(null);
        confirm.mutate(r.id, { onSuccess: (res) => setOutcome(confirmMessage(res, r, courtName(r.courtId))) });
      }}
      onReject={() => setToReject(r)}
      onCounterPropose={() => setToCounter(r)}
    />
  );

  return (
    <>
      <PageHeader title="Richieste" subtitle="Conferma le partite del campionato e tieni d’occhio i campi." />
      <ManagerNav />
      <Outcome outcome={outcome} onClose={() => setOutcome(null)} />
      {offline && (
        <p className={cn('mb-5 rounded-panel p-3 font-semibold', TONE_CLASSES.warn)}>{offline}</p>
      )}

      <div className="grid gap-6 min-[820px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] min-[820px]:items-start">
        <div className="grid gap-6">
          {loading ? (
            <SkeletonRows rows={4} />
          ) : error ? (
            <ErrorState error={error} onRetry={() => (pending.refetch(), courts.refetch())} />
          ) : (
            <>
              <Section title={`Da confermare${ready.length ? ` (${ready.length})` : ''}`} id="to-confirm">
                {ready.length ? (
                  <ul className="court-rule">{ready.map(row)}</ul>
                ) : (
                  <EmptyState
                    title="Nessuna richiesta da confermare."
                    text="Le nuove arrivano qui da sole, appena tutti e 4 i giocatori hanno accettato."
                  />
                )}
              </Section>

              {incomplete.length > 0 && (
                <Section
                  title={`In attesa dei giocatori (${incomplete.length})`}
                  id="awaiting-players"
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={incompleteOpen || twoPanes}
                      aria-controls="incomplete-list"
                      onClick={() => setIncompleteOpen((v) => !v)}
                      className={twoPanes ? 'hidden' : undefined}
                    >
                      {incompleteOpen ? 'Nascondi' : 'Mostra'}
                      <ChevronDown className={cn('transition-transform', incompleteOpen && 'rotate-180')} aria-hidden />
                    </Button>
                  }
                >
                  <p className="text-ink-muted">
                    Si confermano solo a 4 su 4. Puoi già rifiutarle o proporre un altro orario.
                  </p>
                  {(incompleteOpen || twoPanes) && (
                    <ul id="incomplete-list" className="court-rule">
                      {incomplete.map(row)}
                    </ul>
                  )}
                </Section>
              )}

              <Section title="Confermate nei prossimi giorni" id="confirmed">
                {confirmed.isPending ? (
                  <SkeletonRows rows={2} />
                ) : confirmed.error ? (
                  <ErrorState error={confirmed.error} onRetry={() => confirmed.refetch()} />
                ) : upcoming.length ? (
                  <ul className="court-rule">
                    {upcoming.map((r) => (
                      <li key={r.id} className={cn('grid gap-2 py-3', twoPanes && r.id === selectedId && SELECTED_STYLE)}>
                        <Header
                          r={r}
                          courtName={courtName(r.courtId)}
                          twoPanes={twoPanes}
                          selected={twoPanes && r.id === selectedId}
                          onSelect={() => select(r.id)}
                        />
                        <p className="font-semibold">{matches.matchName(r.matchId) ?? matches.matchPlayers(r.matchId, r.players)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold', TONE_CLASSES.ok)}>
                            <CircleCheck className="size-4" aria-hidden /> Confermata
                          </span>
                          <Button variant="danger" size="sm" onClick={() => setToCancel(r)} disabled={!!offline}>
                            <Ban aria-hidden /> Annulla partita
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="Nessuna partita confermata nei prossimi 14 giorni."
                    text="Quando confermi una richiesta, la partita compare qui e nella giornata."
                  />
                )}
              </Section>
            </>
          )}
        </div>

        {twoPanes && (
          <aside aria-label="Giornata della richiesta selezionata" className="sticky top-4 grid gap-3">
            {loading ? (
              <Skeleton className="h-[28rem] w-full" />
            ) : selected && courts.data?.length ? (
              <DayPanel
                r={selected}
                courts={courts.data}
                bookings={bookings.rows.filter((o) => o.date === selected.date)}
                requests={live.filter((x) => x.date === selected.date)}
                isLoading={bookings.isPending}
                matchName={matches.matchName}
                now={now}
              />
            ) : (
              <p className="text-ink-muted">Seleziona una richiesta per vedere la sua giornata sui due campi.</p>
            )}
          </aside>
        )}
      </div>

      <RejectSheet
        request={toReject}
        description={toReject ? describe(toReject, courtName(toReject.courtId)) : ''}
        onOpenChange={(o) => !o && setToReject(null)}
        offline={offline}
      />
      <CounterProposeSheet
        request={toCounter}
        courts={courts.data ?? []}
        period={toCounter ? matches.matchPeriod(toCounter.matchId) : undefined}
        description={toCounter ? matches.matchPlayers(toCounter.matchId, toCounter.players) : undefined}
        onOpenChange={(o) => !o && setToCounter(null)}
        disabledReason={offline}
      />
      <CancelConfirmed
        request={toCancel}
        courtName={toCancel ? courtName(toCancel.courtId) : ''}
        onOpenChange={(o) => !o && setToCancel(null)}
      />
    </>
  );
}

function describe(r: MatchRequest, courtName: string) {
  return `${labelDate(r.date)} · ${r.start}–${r.end} · ${courtName}`;
}

/** Date/time/court line: on tablet it selects the request (timeline on the right), on phone it opens the day. */
function Header({
  r,
  courtName,
  twoPanes,
  selected,
  onSelect,
}: {
  r: MatchRequest;
  courtName: string;
  twoPanes: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  // one wrapping line: the pieces never split inside, the court name stays with its number
  const text = (
    <>
      <CalendarDays className="mt-[0.3rem] size-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="tabular [text-wrap:balance]">
        <span className="whitespace-nowrap">{labelDate(r.date)}</span> ·{' '}
        <span className="whitespace-nowrap">
          {r.start}–{r.end}
        </span>{' '}
        · <span className="whitespace-nowrap">{courtName}</span>
      </span>
    </>
  );
  const cls = 'flex min-h-11 items-start gap-1.5 justify-self-start py-2 text-left text-base font-bold';
  return twoPanes ? (
    <button type="button" className={cn(cls, 'hover:underline')} aria-pressed={selected} onClick={onSelect}>
      {text}
    </button>
  ) : (
    <Link to={`/campo/giorno/${r.date}`} className={cn(cls, 'underline decoration-line-strong underline-offset-4')} aria-label={`${describe(r, courtName)}: apri la giornata`}>
      {text}
    </Link>
  );
}

function Pill({
  tone,
  icon: Icon,
  children,
  noWrap,
}: {
  tone: keyof typeof TONE_CLASSES;
  icon: typeof Clock3;
  children: React.ReactNode;
  /** Never wraps or shrinks (short labels such as the expiry). */
  noWrap?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold',
        noWrap && 'shrink-0 whitespace-nowrap',
        TONE_CLASSES[tone],
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

function RequestRow({
  r,
  court,
  all,
  bookings,
  now,
  matches,
  primary,
  selected,
  twoPanes,
  onSelect,
  confirming,
  offline,
  onConfirm,
  onReject,
  onCounterPropose,
}: {
  r: MatchRequest;
  court?: Court;
  all: MatchRequest[];
  bookings: BookingRow[];
  now: number;
  matches: ReturnType<typeof useManagerMatches>;
  primary: boolean;
  selected: boolean;
  twoPanes: boolean;
  onSelect: () => void;
  confirming: boolean;
  offline: string | null;
  onConfirm: () => void;
  onReject: () => void;
  onCounterPropose: () => void;
}) {
  const acc = acceptanceState(r);
  const past = startMs(r) <= now;
  const deadline = past
    ? { text: 'Orario già passato', urgent: true, expired: true }
    : deadlineText(effectiveDeadline(r), now);
  const conflicts = conflictingBookings(r, bookings);
  const overlapping = overlappingRequests(r, all, now);
  const impact = r.offGrid && court ? impactedSlots(court, r.date, r.start, r.end) : [];
  const blockReason = offline ?? confirmBlockReason(r, conflicts, matches.name, now);
  const reasonId = `reason-${r.id}`;
  const courtName = court?.name ?? r.courtId;
  const teams = matches.matchName(r.matchId);

  return (
    <li className={cn('grid gap-2 py-4', selected && SELECTED_STYLE)}>
      <Header r={r} courtName={courtName} twoPanes={twoPanes} selected={selected} onSelect={onSelect} />
      <div>
        {teams && <p className="font-semibold">{teams}</p>}
        <p className={teams ? 'text-ink-muted' : 'font-semibold'}>{matches.matchPlayers(r.matchId, r.players)}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {acc.missing.length ? (
          <Pill tone="warn" icon={Hourglass}>
            <span className="tabular">{acc.given}/4</span> · manca {joinList(acc.missing.map(matches.name))}
          </Pill>
        ) : (
          <Pill tone="ok" icon={CircleCheck}>
            <span className="tabular">4/4</span> hanno accettato
          </Pill>
        )}
        <Pill tone={deadline.urgent ? 'danger' : 'idle'} icon={AlarmClock} noWrap>
          {deadline.text}
        </Pill>
        {r.offGrid && (
          <Pill tone="info" icon={Clock3}>
            Fuori griglia
          </Pill>
        )}
        {r.counterProposal && (
          <Pill tone="info" icon={Repeat}>
            Proposta dal campo
          </Pill>
        )}
        {overlapping.length > 0 && (
          <Pill tone="warn" icon={TriangleAlert}>
            Sovrapposta
          </Pill>
        )}
        {conflicts.length > 0 && (
          <Pill tone="danger" icon={Lock}>
            Campo occupato
          </Pill>
        )}
      </div>

      {impact.length > 0 && (
        <p className="text-sm">
          Rende inutilizzabili gli slot delle <span className="tabular">{joinList(impact.map((s) => s.start))}</span> sul {courtName}.
        </p>
      )}
      {overlapping.length > 0 && (
        <p className="text-sm">
          Sovrapposta a{' '}
          {overlapping
            .map((x) => `${x.start} ${courtName}${matches.matchName(x.matchId) ? ` (${matches.matchName(x.matchId)})` : ''}`)
            .join(', ')}
          : confermandola, l’altra passa in conflitto.
        </p>
      )}
      {r.note && <p className="text-sm text-ink-muted">Nota: {r.note}</p>}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          variant={primary ? 'primary' : 'court'}
          onClick={onConfirm}
          loading={confirming}
          disabled={!!blockReason}
          aria-describedby={blockReason ? reasonId : undefined}
        >
          <CircleCheck aria-hidden /> Conferma
        </Button>
        <Button variant="secondary" onClick={onReject} disabled={!!offline}>
          <X aria-hidden /> Rifiuta
        </Button>
        <Button variant="ghost" onClick={onCounterPropose} disabled={!!offline}>
          <Repeat aria-hidden /> Proponi altro orario
        </Button>
      </div>
      {blockReason && (
        <p id={reasonId} className="text-sm font-semibold text-ink-muted">
          {blockReason}
        </p>
      )}
      {conflicts.length > 0 && !offline && acc.missing.length === 0 && (
        <p className="text-sm text-ink-muted">Occupazioni: {conflicts.map(describeBooking).join(', ')}.</p>
      )}
    </li>
  );
}

function DayPanel({
  r,
  courts,
  bookings,
  requests,
  isLoading,
  matchName,
  now,
}: {
  r: MatchRequest;
  courts: Court[];
  bookings: BookingRow[];
  requests: MatchRequest[];
  isLoading: boolean;
  matchName: (id: string | null | undefined) => string | undefined;
  now: number;
}) {
  const scale = useMemo(() => scaleFromCourts(courts, 1, { from: r.start, to: r.end }), [courts, r.start, r.end]);
  const court = courts.find((c) => c.id === r.courtId);
  const impacted = r.offGrid && court ? impactedSlots(court, r.date, r.start, r.end) : [];
  const reqs = r.status === 'pending' && !requests.some((x) => x.id === r.id) ? [...requests, r] : requests;
  const isToday = r.date === today();
  const d = new Date(now);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Giornata di {labelDate(r.date)}</h2>
        <Link to={`/campo/giorno/${r.date}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-court underline dark:text-info-ink">
          Apri la giornata
        </Link>
      </div>
      {isLoading ? (
        <Skeleton className="h-[28rem] w-full" />
      ) : (
        <DayLanes
          date={r.date}
          courts={courts}
          scale={scale}
          bookings={bookings}
          requests={reqs}
          highlighted={r.id}
          impacted={impacted}
          matchName={matchName}
          nowMinute={isToday ? d.getHours() * 60 + d.getMinutes() : undefined}
          now={now}
        />
      )}
      <p className="text-ink-muted">
        In evidenza:{' '}
        <span className="font-semibold text-ink">{matchName(r.matchId) ?? 'la richiesta selezionata'}</span>,{' '}
        <span className="tabular whitespace-nowrap">
          {r.start}–{r.end}
        </span>{' '}
        · <span className="whitespace-nowrap">{court?.name ?? r.courtId}</span>
      </p>
    </>
  );
}

function RejectSheet({
  request,
  description,
  onOpenChange,
  offline,
}: {
  request: MatchRequest | null;
  description: string;
  onOpenChange: (o: boolean) => void;
  offline: string | null;
}) {
  const [note, setNote] = useState('');
  const reject = useAction(actions.rejectRequest, {
    success: 'Richiesta rifiutata: i giocatori possono sceglierne un altro orario.',
    onSuccess: () => {
      setNote('');
      onOpenChange(false);
    },
  });
  return (
    <Sheet
      open={!!request}
      onOpenChange={(o) => {
        if (!o) setNote('');
        onOpenChange(o);
      }}
      title="Rifiuta la richiesta"
      description={description}
      footer={
        <Button
          variant="danger"
          loading={reject.isPending}
          disabled={!!offline}
          onClick={() => request && reject.mutate({ request: request.id, note: note.trim() || undefined })}
        >
          <X aria-hidden /> Rifiuta
        </Button>
      }
    >
      <div className="grid gap-4">
        <p className="text-ink-muted">Il campo non cambia. I giocatori vedono il rifiuto e la tua nota.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Note rapide">
          {QUICK_NOTES.map((n) => (
            <Button key={n} variant="secondary" size="sm" aria-pressed={note === n} onClick={() => setNote(n)}>
              {n}
            </Button>
          ))}
        </div>
        <Field label="Nota per i giocatori" hint="Facoltativa.">
          {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}
        </Field>
        {offline && <p className="text-sm font-semibold text-ink-muted">{offline}</p>}
      </div>
    </Sheet>
  );
}

function CancelConfirmed({
  request,
  courtName,
  onOpenChange,
}: {
  request: MatchRequest | null;
  courtName: string;
  onOpenChange: (o: boolean) => void;
}) {
  const [note, setNote] = useState('');
  const cancel = useAction(actions.cancelConfirmed, {
    success: 'Partita annullata: il campo è di nuovo libero.',
    onSuccess: () => {
      setNote('');
      onOpenChange(false);
    },
  });
  return (
    <ConfirmDialog
      open={!!request}
      onOpenChange={onOpenChange}
      title={request ? `Annullare la partita di ${labelDate(request.date)} ${request.start}?` : 'Annullare la partita?'}
      description={`Il ${courtName || 'campo'} si libera e i giocatori dovranno riprogrammarla.`}
      confirmLabel="Annulla partita"
      cancelLabel="Non annullare"
      loading={cancel.isPending}
      onConfirm={() => request && cancel.mutate({ request: request.id, note: note.trim() || undefined })}
    >
      <Field label="Nota per i giocatori" hint="Facoltativa.">
        {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}
      </Field>
    </ConfirmDialog>
  );
}
