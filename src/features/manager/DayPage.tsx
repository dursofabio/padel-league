import * as Menu from '@radix-ui/react-dropdown-menu';
import { Ban, ChevronLeft, ChevronRight, DoorClosed, EllipsisVertical, ExternalLink, Info, Plus, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { scaleFromCourts } from '../../components/CourtLanes';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState } from '../../components/states';
import { TONE_CLASSES } from '../../components/StatusBadge';
import { actions, useAction } from '../../data/mutations';
import { useCourts, useBookings, useRequestsInRange } from '../../data/queries';
import { courtOpen, isRequestActive, type Slot } from '../../lib/slots';
import { BOOKING_TYPE_LABEL } from '../../lib/copy';
import { addDays, WEEKDAY_NAMES, labelDate, today, weekday } from '../../lib/time';
import type { Court, BookingRow, MatchRequest, BookingType } from '../../types';
import { Button, cn, ConfirmDialog, Field, Input, Label, Segmented, Select, Sheet, Skeleton, Textarea } from '../../ui';
import { useManagerMatches } from './data';
import { Outcome } from './Outcome';
import { ManagerNav } from './ManagerNav';
import { BOOKING_LOOK, DayLanes } from './DayLanes';
import { OFFLINE_REASON, useNow, useOnline } from './hooks';
import {
  rangeError,
  readableEnd,
  closeDayMessage,
  conflictsMessage,
  initialMinute,
  times,
  type OutcomeMessage,
} from './logic';

const PX = 1;
const START_TIMES = times('08:00', '23:45', 15);
const END_TIMES = times('08:15', '24:00', 15);
type ManualType = Exclude<BookingType, 'match'>;
const TYPES: { value: ManualType; label: string }[] = [
  { value: 'external', label: 'Esterno' },
  { value: 'lesson', label: 'Lezione' },
  { value: 'closure', label: 'Chiusura' },
];

function isValidDate(d: string | undefined): d is string {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

/** Day timeline (/campo/giorno/:date?): two court lanes, add/free bookings, close the day. */
export default function DayPage() {
  const params = useParams();
  const navigate = useNavigate();
  const todayDate = today();
  const date = isValidDate(params.date) ? params.date : todayDate;
  const goTo = (d: string) => navigate(`/campo/giorno/${d}`);
  const now = useNow();
  const online = useOnline();
  const offline = online ? null : OFFLINE_REASON;

  const courts = useCourts();
  const bookings = useBookings(date, date);
  const inRange = useRequestsInRange(date, date);
  const matches = useManagerMatches();
  const pending = useMemo(() => (inRange.data ?? []).filter((r) => r.status === 'pending' && isRequestActive(r, now)), [inRange.data, now]);

  const scale = useMemo(() => scaleFromCourts(courts.data ?? [], PX, { from: '08:00', to: '24:00' }), [courts.data]);
  const isToday = date === todayDate;
  const d = new Date(now);
  const nowMin = d.getHours() * 60 + d.getMinutes();

  const [outcome, setOutcome] = useState<OutcomeMessage | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [detail, setDetail] = useState<BookingRow | null>(null);
  const [request, setRequest] = useState<MatchRequest | null>(null);
  const [closing, setClosing] = useState(false);

  // open scrolled at 13:00, or now if later (G4)
  const scroller = useRef<HTMLDivElement>(null);
  const ready = !courts.isPending && !bookings.isPending;
  useLayoutEffect(() => {
    if (!ready || !scroller.current) return;
    scroller.current.scrollTop = Math.max(0, (initialMinute(isToday, nowMin) - scale.from) * scale.px);
    // only when the day changes or the data first arrives
  }, [ready, date]);

  useEffect(() => setOutcome(null), [date]);

  const list = courts.data ?? [];
  const closed = list.filter((c) => !courtOpen(c, date));
  const error = courts.error ?? bookings.error ?? inRange.error;
  const firstCourt = list.find((c) => courtOpen(c, date)) ?? list[0];

  return (
    <>
      <PageHeader
        title="Giornata"
        subtitle={<span className="tabular">{WEEKDAY_NAMES[weekday(date)]} {labelDate(date).split(' ')[1]}</span>}
        actions={
          <>
            <Button
              variant="primary"
              disabled={!firstCourt || !!offline}
              onClick={() =>
                firstCourt && setDraft({ courtId: firstCourt.id, start: '18:00', end: '19:30', type: 'external', note: '' })
              }
            >
              <Plus aria-hidden /> Segna occupazione
            </Button>
            <Menu.Root>
              <Menu.Trigger asChild>
                <Button variant="ghost" size="icon" aria-label="Altre azioni">
                  <EllipsisVertical aria-hidden />
                </Button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content
                  align="end"
                  sideOffset={4}
                  className="z-40 min-w-56 rounded-control border border-line bg-surface p-1 text-ink shadow-raised"
                >
                  <Menu.Item
                    disabled={!!offline}
                    onSelect={() => setClosing(true)}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[6px] px-3 font-semibold text-danger-ink outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-danger-soft"
                  >
                    <DoorClosed className="size-5" aria-hidden /> Chiudi la giornata
                  </Menu.Item>
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          </>
        }
      />
      <ManagerNav />

      <nav aria-label="Scegli il giorno" className="mb-4 flex flex-wrap items-end gap-2">
        <Button variant="secondary" size="icon" aria-label={`Giorno prima: ${labelDate(addDays(date, -1))}`} onClick={() => goTo(addDays(date, -1))}>
          <ChevronLeft aria-hidden />
        </Button>
        <div className="grid gap-1">
          <Label htmlFor="day" className="sr-only">
            Data
          </Label>
          <Input id="day" type="date" value={date} onChange={(e) => isValidDate(e.target.value) && goTo(e.target.value)} className="w-auto" />
        </div>
        <Button variant="secondary" size="icon" aria-label={`Giorno dopo: ${labelDate(addDays(date, 1))}`} onClick={() => goTo(addDays(date, 1))}>
          <ChevronRight aria-hidden />
        </Button>
        <Button
          variant={isToday ? 'court' : 'ghost'}
          aria-current={isToday ? 'date' : undefined}
          onClick={() => goTo(todayDate)}
        >
          Oggi
        </Button>
      </nav>

      <Outcome outcome={outcome} onClose={() => setOutcome(null)} />
      {offline && <p className={cn('mb-4 rounded-panel p-3 font-semibold', TONE_CLASSES.warn)}>{offline}</p>}

      {error ? (
        <ErrorState error={error} onRetry={() => (courts.refetch(), bookings.refetch(), inRange.refetch())} />
      ) : !ready ? (
        <div className="grid grid-cols-[2.75rem_1fr_1fr] gap-1.5" role="status" aria-label="Caricamento della giornata">
          <span />
          <Skeleton className="h-[60dvh]" />
          <Skeleton className="h-[60dvh]" />
        </div>
      ) : !list.length ? (
        <EmptyState
          title="Nessun campo configurato."
          text="Aggiungi i campi con orari e giorni di apertura: la giornata si disegna da lì."
          action={
            <Button asChild variant="court">
              <Link to="/campo/impostazioni">Configura i campi</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {closed.map((c) => (
            <p key={c.id} className={cn('flex items-center gap-2 rounded-panel p-3', TONE_CLASSES.idle)}>
              <DoorClosed className="size-5 shrink-0" aria-hidden />
              {c.closedDates.includes(date)
                ? `${c.name} è chiuso in questa data.`
                : `${c.name} è chiuso il ${WEEKDAY_NAMES[weekday(date)]}.`}
            </p>
          ))}
          {bookings.rows.length === 0 && (
            <p className="flex items-center gap-2 text-ink-muted">
              <Info className="size-5 shrink-0" aria-hidden />
              Nessuna occupazione: tocca uno slot per segnarlo occupato.
            </p>
          )}
          <Legend />
          <div
            ref={scroller}
            className="max-h-[70dvh] overflow-y-auto overscroll-contain rounded-panel"
            tabIndex={0}
            role="region"
            aria-label="Linea del tempo dei campi, scorri per vedere tutte le ore"
          >
            <DayLanes
              date={date}
              courts={list}
              scale={scale}
              bookings={bookings.rows}
              requests={pending}
              stickyTop="0px"
              matchName={matches.matchName}
              now={now}
              nowMinute={isToday ? nowMin : undefined}
              onFreeSlot={
                offline ? undefined : (c: Court, s: Slot) => setDraft({ courtId: c.id, start: s.start, end: s.end, type: 'external', note: '' })
              }
              onBooking={setDetail}
              onRequest={setRequest}
            />
          </div>
        </div>
      )}

      <NewBooking
        draft={draft}
        date={date}
        courts={list}
        onOpenChange={(o) => !o && setDraft(null)}
        onOutcome={setOutcome}
      />
      <BookingDetail
        o={detail}
        courtName={list.find((c) => c.id === detail?.courtId)?.name ?? ''}
        matches={matches}
        offline={offline}
        onOpenChange={(o) => !o && setDetail(null)}
      />
      <Sheet
        open={!!request}
        onOpenChange={(o) => !o && setRequest(null)}
        title="Richiesta in attesa"
        description={
          request ? `${labelDate(request.date)} · ${request.start}–${request.end} · ${list.find((c) => c.id === request.courtId)?.name ?? ''}` : undefined
        }
        footer={
          request && (
            <Button asChild variant="court">
              <Link to={`/campo?r=${request.id}`}>Apri nelle richieste</Link>
            </Button>
          )
        }
      >
        {request && (
          <div className="grid gap-2">
            <p className="font-semibold">{matches.matchName(request.matchId) ?? matches.matchPlayers(request.matchId, request.players)}</p>
            <p className="text-ink-muted">
              Non è ancora un’occupazione: se segni il campo occupato in questo orario, la richiesta passa in conflitto.
            </p>
          </div>
        )}
      </Sheet>
      <CloseDay open={closing} date={date} onOpenChange={setClosing} onOutcome={setOutcome} />
    </>
  );
}

function Legend() {
  const items: { type: BookingType; text: string }[] = [
    { type: 'match', text: 'Campionato' },
    { type: 'external', text: 'Esterno' },
    { type: 'lesson', text: 'Lezione' },
    { type: 'closure', text: 'Chiuso' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-ink-muted" aria-label="Legenda">
      {items.map((v) => {
        const Icon = BOOKING_LOOK[v.type].icon;
        return (
          <li key={v.type} className="inline-flex items-center gap-1">
            <Icon className="size-4" aria-hidden /> {v.text}
          </li>
        );
      })}
      <li className="inline-flex items-center gap-1">
        <span aria-hidden className="inline-block h-3 w-4 rounded-[3px] border-2 border-dashed border-info" /> Richiesta in attesa
      </li>
      <li className="inline-flex items-center gap-1">
        <Plus className="size-4" aria-hidden /> Slot libero
      </li>
      <li className="inline-flex items-center gap-1">
        <Ban className="size-4" aria-hidden /> Inutilizzabile
      </li>
    </ul>
  );
}

interface Draft {
  courtId: string;
  start: string;
  end: string;
  type: ManualType;
  note: string;
}

function NewBooking({
  draft,
  date,
  courts,
  onOpenChange,
  onOutcome,
}: {
  draft: Draft | null;
  date: string;
  courts: Court[];
  onOpenChange: (o: boolean) => void;
  onOutcome: (e: OutcomeMessage) => void;
}) {
  return (
    <Sheet open={!!draft} onOpenChange={onOpenChange} title="Segna occupazione" description={`${WEEKDAY_NAMES[weekday(date)]} ${labelDate(date).split(' ')[1]}`}>
      {draft && (
        <BookingForm
          key={`${draft.courtId}-${draft.start}`}
          initial={draft}
          date={date}
          courts={courts}
          onDone={(e) => {
            onOutcome(e);
            onOpenChange(false);
          }}
        />
      )}
    </Sheet>
  );
}

function BookingForm({
  initial,
  date,
  courts,
  onDone,
}: {
  initial: Draft;
  date: string;
  courts: Court[];
  onDone: (e: OutcomeMessage) => void;
}) {
  const [b, setB] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const error = rangeError(b.start, b.end);
  const add = useAction(actions.addBooking, {
    onSuccess: (res) =>
      onDone({ tone: res.conflicts ? 'warn' : 'ok', text: conflictsMessage('Segnato.', res.conflicts) }),
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setB((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (error) return;
        add.mutate({ court: b.courtId, date, start: b.start, end: b.end, type: b.type, note: b.note.trim() || undefined });
      }}
    >
      <Field label="Campo">
        {(p) => (
          <Select {...p} value={b.courtId} onChange={(e) => set('courtId', e.target.value)}>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid gap-1.5">
        <span className="text-sm font-semibold" aria-hidden>
          Tipo
        </span>
        <Segmented label="Tipo di occupazione" value={b.type} onValueChange={(v) => set('type', v)} options={TYPES} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dalle">
          {(p) => (
            <Select {...p} value={b.start} onChange={(e) => set('start', e.target.value)}>
              {START_TIMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Alle" error={submitted || b.end <= b.start ? error : null}>
          {(p) => (
            <Select {...p} value={b.end} onChange={(e) => set('end', e.target.value)}>
              {END_TIMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Nota" hint="Facoltativa, per esempio il nome di chi ha prenotato.">
        {(p) => <Textarea {...p} value={b.note} onChange={(e) => set('note', e.target.value)} maxLength={200} />}
      </Field>
      <p className="text-sm text-ink-muted">Le richieste in attesa che si sovrappongono passano in conflitto.</p>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={add.isPending}>
          Segna occupato
        </Button>
      </div>
    </form>
  );
}

function BookingDetail({
  o,
  courtName,
  matches,
  offline,
  onOpenChange,
}: {
  o: BookingRow | null;
  courtName: string;
  matches: ReturnType<typeof useManagerMatches>;
  offline: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState('');
  const release = useAction(actions.removeBooking, {
    success: 'Occupazione liberata.',
    onSuccess: () => (setConfirmOpen(false), onOpenChange(false)),
  });
  const cancel = useAction(actions.cancelConfirmed, {
    success: 'Partita annullata: il campo è di nuovo libero.',
    onSuccess: () => (setConfirmOpen(false), setNote(''), onOpenChange(false)),
  });
  if (!o) return null;
  const a = BOOKING_LOOK[o.type];
  const time = `${o.start}–${readableEnd(o.end)}`;
  const isMatch = o.type === 'match';
  const link = isMatch ? matches.matchLink(o.tournamentId, o.matchId) : undefined;
  return (
    <>
      <Sheet
        open
        onOpenChange={onOpenChange}
        title={
          <span className="flex items-center gap-2">
            <a.icon className="size-5" aria-hidden /> {BOOKING_TYPE_LABEL[o.type]}
          </span>
        }
        description={`${labelDate(o.date)} · ${time} · ${courtName}`}
        footer={
          isMatch ? (
            o.requestId && (
              <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={!!offline}>
                <Trash2 aria-hidden /> Annulla partita
              </Button>
            )
          ) : (
            <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={!!offline}>
              <Trash2 aria-hidden /> Libera
            </Button>
          )
        }
      >
        <dl className="court-rule grid">
          {isMatch && (
            <div className="grid gap-0.5 py-2">
              <dt className="text-sm text-ink-muted">Partita</dt>
              <dd className="font-semibold">{matches.matchName(o.matchId) ?? 'Partita del campionato'}</dd>
              {matches.match(o.matchId) && <dd className="text-ink-muted">{matches.matchPlayers(o.matchId)}</dd>}
            </div>
          )}
          <div className="grid gap-0.5 py-2">
            <dt className="text-sm text-ink-muted">Orario</dt>
            <dd className="tabular font-semibold">{time}</dd>
          </div>
          {o.note && (
            <div className="grid gap-0.5 py-2">
              <dt className="text-sm text-ink-muted">Nota</dt>
              <dd>{o.note}</dd>
            </div>
          )}
          {o.recurrenceId && (
            <div className="grid gap-0.5 py-2">
              <dt className="text-sm text-ink-muted">Origine</dt>
              <dd>
                Da una{' '}
                <Link to="/campo/ricorrenze" className="font-semibold text-court underline dark:text-info-ink">
                  ricorrenza
                </Link>
                : liberarla qui non cambia la regola.
              </dd>
            </div>
          )}
        </dl>
        {link && (
          <Link to={link} className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-court underline dark:text-info-ink">
            <ExternalLink className="size-4" aria-hidden /> Apri la partita
          </Link>
        )}
        {offline && <p className="mt-3 text-sm font-semibold text-ink-muted">{offline}</p>}
      </Sheet>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          isMatch
            ? `Annullare la partita di ${labelDate(o.date)} ${o.start}?`
            : `Liberare ${BOOKING_TYPE_LABEL[o.type].toLowerCase()} ${time} sul ${courtName}?`
        }
        description={
          isMatch ? 'Il campo si libera e i giocatori dovranno riprogrammarla.' : 'Lo spazio torna libero e i giocatori lo vedono subito.'
        }
        confirmLabel={isMatch ? 'Annulla partita' : 'Libera'}
        cancelLabel={isMatch ? 'Non annullare' : 'Annulla'}
        loading={release.isPending || cancel.isPending}
        onConfirm={() =>
          isMatch
            ? o.requestId && cancel.mutate({ request: o.requestId, note: note.trim() || undefined })
            : release.mutate(o.id)
        }
      >
        {isMatch && (
          <Field label="Nota per i giocatori" hint="Facoltativa.">
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}
          </Field>
        )}
      </ConfirmDialog>
    </>
  );
}

function CloseDay({
  open,
  date,
  onOpenChange,
  onOutcome,
}: {
  open: boolean;
  date: string;
  onOpenChange: (o: boolean) => void;
  onOutcome: (e: OutcomeMessage) => void;
}) {
  const [reason, setReason] = useState('Chiusura');
  const [attempted, setAttempted] = useState(false);
  const closing = useAction(actions.closeDay, {
    onSuccess: (res) => {
      onOutcome(closeDayMessage(res, date));
      onOpenChange(false);
    },
  });
  const error = !reason.trim() ? 'Scrivi il motivo: lo vedono i giocatori.' : null;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) (setAttempted(false), setReason('Chiusura'));
        onOpenChange(o);
      }}
      title={`Chiudere tutti i campi ${labelDate(date)}?`}
      description="Segna entrambi i campi chiusi per tutto il giorno. Le richieste in attesa passano in conflitto; le partite già confermate bloccano la chiusura di quel campo."
      confirmLabel="Chiudi la giornata"
      loading={closing.isPending}
      onConfirm={() => {
        setAttempted(true);
        if (error) return;
        closing.mutate({ date, note: reason.trim() });
      }}
    >
      <Field label="Motivo" error={attempted ? error : null}>
        {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={120} />}
      </Field>
    </ConfirmDialog>
  );
}
