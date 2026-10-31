/**
 * Signature of the product: the week drawn as two parallel court lanes per day (Campo 2 offset by 30'),
 * every slot a button with icon + text + tone (+ pattern), keyboard roving focus, sheet on selection.
 *
 * Density (critique M2): by default only the useful slots (4/4 and 3/4) are drawn, each day's lanes are
 * cropped to them, days without a useful slot collapse to one line, and with no useful slot in the week
 * the grid stays behind "Mostra la griglia completa". Court names stay visible while scrolling.
 */
import { CalendarRange, Check, ChevronLeft, ChevronRight, Clock3, Info, UserRoundX } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { CourtLanes, LaneBlock, scaleFromCourts, type LaneScale } from '../../../../components/CourtLanes';
import { ErrorState } from '../../../../components/states';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { useAvailability, useBookings, useRequestsInRange } from '../../../../data/queries';
import { classifySlot, courtDayId, courtOpen, gridSlots, type SlotState } from '../../../../lib/slots';
import { labelDate, toMin, today } from '../../../../lib/time';
import { appUrl } from '../../../../lib/whatsapp';
import type { Court, Windows } from '../../../../types';
import { Button, cn, Skeleton } from '../../../../ui';
import type { MatchContext } from '../context';
import {
  croppedScale,
  isSlotUsable,
  moveFocus,
  nameList,
  slotAriaLabel,
  slotLabel,
  weekWindow,
  type NavCell,
  type NavKey,
} from '../logic';
import { Notice, SLOT_UI, useNowTick } from '../parts';
import { OffGrid } from './OffGrid';
import { SlotSheet } from './SlotSheet';

const NAV_KEYS: NavKey[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'];
const slotKey = (s: SlotState) => `${s.slot.date}|${s.slot.courtId}|${s.slot.start}`;
const LINK = 'inline-flex min-h-11 items-center text-base font-semibold text-court underline dark:text-info-ink';

type DayView = 'closed' | 'none' | 'collapsed' | 'useful' | 'all';

interface Day {
  date: string;
  view: DayView;
  /** Slots drawn, per court. */
  byCourt: Record<string, SlotState[]>;
  /** Slots drawn, in time order (both courts): keyboard order. */
  ordered: SlotState[];
  scale: LaneScale;
  /** Expanded by hand (shows "Nascondi"). */
  expanded: boolean;
}

export function SlotGrid({ ctx }: { ctx: MatchContext }) {
  const { match, courts: allCourts, tid, name } = ctx;
  const players = match.players;
  const now = useNowTick();
  const todayDate = today();
  const [week, setWeek] = useState(0);
  const f = weekWindow(ctx.period, todayDate, week);
  const avail = useAvailability(tid, players);
  const bookings = useBookings(f.from, f.to);
  const reqs = useRequestsInRange(f.from, f.to);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<SlotState | null>(null);
  const [offGrid, setOffGrid] = useState<{ open: boolean; courtId?: string; date?: string }>({ open: false });
  const [active, setActive] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const courts = useMemo(() => [...allCourts].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [allCourts]);
  // lanes grow with the user's text size, so slot labels are never clipped at 200% text (WCAG 1.4.4)
  const rem = useRemPx();
  const scale = useMemo(() => scaleFromCourts(courts, 0.8 * (rem / 16)), [courts, rem]);

  const windows = useMemo(
    () => Object.fromEntries(players.map((p) => [p, avail.data?.[p]?.windows])) as Record<string, Windows | undefined>,
    [avail.data, players],
  );
  const requests = useMemo(() => (reqs.data ?? []).filter((r) => r.matchId !== match.id), [reqs.data, match.id]);
  const nowMinute = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  // every future slot of the week, classified once
  const weekSlots = useMemo(
    () =>
      f.days.map((date) => {
        const byCourt: Record<string, SlotState[]> = {};
        for (const c of courts)
          byCourt[c.id] = gridSlots(c, date)
            .filter((s) => date > todayDate || (date === todayDate && toMin(s.start) > nowMinute))
            .map((s) => classifySlot(s, players, windows, bookings.byCourtDay[courtDayId(c.id, date)], requests, now));
        return { date, open: courts.some((c) => courtOpen(c, date)), byCourt };
      }),
    // f.days is derived from f.from / f.to
    [f.from, f.to, courts, players, windows, bookings.byCourtDay, requests, todayDate, nowMinute, now],
  );
  const allSlots = weekSlots.flatMap((d) => Object.values(d.byCourt).flat());
  const greens = allSlots.filter((s) => s.color === 'green').length;
  const useful = allSlots.filter(isSlotUsable).length;
  const filtered = useful > 0 && !showAll;
  const gridVisible = useful > 0 || showAll;

  const days: Day[] = useMemo(
    () =>
      weekSlots.map(({ date, open, byCourt: all }) => {
        const isExpanded = expanded.has(date);
        const full = !filtered || isExpanded;
        const byCourt: Record<string, SlotState[]> = {};
        for (const c of courts) byCourt[c.id] = full ? all[c.id] : all[c.id].filter(isSlotUsable);
        const ordered = Object.values(byCourt)
          .flat()
          .sort(
            (a, b) =>
              toMin(a.slot.start) - toMin(b.slot.start) ||
              courts.findIndex((c) => c.id === a.slot.courtId) - courts.findIndex((c) => c.id === b.slot.courtId),
          );
        const view: DayView = !open ? 'closed' : full ? (ordered.length ? 'all' : 'none') : ordered.length ? 'useful' : 'collapsed';
        const dayScale = view === 'useful' ? croppedScale(ordered.map((s) => s.slot), scale) : scale;
        return { date, view, byCourt, ordered, scale: dayScale, expanded: isExpanded };
      }),
    [weekSlots, expanded, filtered, courts, scale],
  );

  // players with no availability at all in the period (or in the window when there is no open period)
  const withoutAvailability = useMemo(() => {
    const from = ctx.period && !f.periodOver ? ctx.period.startsOn : f.from;
    const to = ctx.period && !f.periodOver ? ctx.period.endsOn : f.to;
    return players.filter((p) => !Object.entries(windows[p] ?? {}).some(([d, v]) => d >= from && d <= to && v.length > 0));
  }, [players, windows, ctx.period, f.from, f.to, f.periodOver]);

  const cells: NavCell[][] = useMemo(
    () =>
      gridVisible
        ? days.map((d) => d.ordered.map((s) => ({ key: slotKey(s), courtId: s.slot.courtId, start: s.slot.start })))
        : [],
    [days, gridVisible],
  );
  const flatCells = cells.flat();
  const focusKey = active && flatCells.some((c) => c.key === active) ? active : (flatCells[0]?.key ?? null);

  const onKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, key: string) => {
      if (!NAV_KEYS.includes(e.key as NavKey)) return;
      const next = moveFocus(
        cells,
        key,
        e.key as NavKey,
        courts.map((c) => c.id),
      );
      e.preventDefault();
      if (!next) return;
      setActive(next);
      refs.current.get(next)?.focus();
    },
    [cells, courts],
  );

  const toggle = (date: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(date)) n.delete(date);
      else n.add(date);
      return n;
    });

  const loading = avail.isPending || bookings.isPending || reqs.isPending;
  const error = avail.error || bookings.error || reqs.error;
  const allowOffGrid = ctx.tournament.config.allowOffGrid;
  const isPlayer = !!ctx.mySide;
  const namesWithout = withoutAvailability.map((p) => name(p));
  const availabilityLink = appUrl(`/t/${tid}/disponibilita`);
  const yellows = useful - greens;

  return (
    <div className="grid gap-4">
      {f.periodOver && ctx.period && (
        <Notice icon={Info} tone="danger">
          Periodo terminato il {labelDate(ctx.period.endsOn)}: puoi ancora programmarla finché l’organizzatore non decide.
        </Notice>
      )}

      <nav aria-label="Settimane" className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="Settimana precedente" disabled={!f.hasPrevious} onClick={() => setWeek(f.week - 1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <p className="tabular flex flex-wrap items-center justify-center gap-x-2 text-center text-base font-semibold" aria-live="polite">
          <CalendarRange className="size-5 text-ink-muted" aria-hidden />
          {labelDate(f.from)} – {labelDate(f.to)}
        </p>
        <Button variant="ghost" size="icon" aria-label="Settimana successiva" disabled={!f.hasNext} onClick={() => setWeek(f.week + 1)}>
          <ChevronRight aria-hidden />
        </Button>
      </nav>

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            avail.refetch();
            bookings.refetch();
            reqs.refetch();
          }}
        />
      ) : loading ? (
        <SkeletonLanes />
      ) : (
        <>
          <div className="grid gap-3">
            <p className="text-lg font-bold" aria-live="polite">
              {greens > 0
                ? `${greens} ${greens === 1 ? 'orario va' : 'orari vanno'} bene per tutti e 4 questa settimana${yellows > 0 ? `, ${yellows} per 3 su 4` : ''}.`
                : yellows > 0
                  ? `Nessun orario per tutti e 4 questa settimana: ${yellows} ${yellows === 1 ? 'va' : 'vanno'} bene a 3 su 4.`
                  : 'Nessun orario buono questa settimana.'}
            </p>

            {withoutAvailability.length > 0 && (
              <div className="grid gap-2">
                <Notice icon={UserRoundX} tone="warn">
                  {nameList(namesWithout)} {withoutAvailability.length === 1 ? 'non ha' : 'non hanno'} ancora segnato le disponibilità.
                </Notice>
                <div className="flex flex-wrap items-center gap-2">
                  {isPlayer &&
                    withoutAvailability
                      .filter((p) => p !== ctx.uid)
                      .map((p) => (
                        <WhatsAppButton
                          key={p}
                          className="whitespace-normal"
                          phone={ctx.phone(p)}
                          text={`${name(p)}, per programmare ${ctx.title} mancano le tue disponibilità: segnale qui → ${availabilityLink}`}
                        >
                          Chiedi a {name(p)}
                        </WhatsAppButton>
                      ))}
                  {withoutAvailability.includes(ctx.uid ?? '') && (
                    <Link to={`/t/${tid}/disponibilita`} className={LINK}>
                      Segna le tue disponibilità
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {useful > 0 && (
                <p className="flex flex-wrap items-center gap-x-2">
                  <span>{filtered ? 'Mostro solo gli orari buoni (4/4 e 3/4).' : 'Mostro tutti gli orari.'}</span>
                  <Button variant="link" className="min-h-11 text-base" onClick={() => setShowAll(filtered)}>
                    {filtered ? 'Mostra tutti' : 'Mostra solo quelli buoni'}
                  </Button>
                </p>
              )}
              {useful === 0 && (
                <Button variant="secondary" className="whitespace-normal" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Nascondi la griglia' : 'Mostra la griglia completa'}
                </Button>
              )}
              {isPlayer && (greens > 0 || withoutAvailability.length === 0) && (
                <WhatsAppButton
                  className="whitespace-normal"
                  text={
                    greens > 0
                      ? `Abbiamo ${greens} ${greens === 1 ? 'orario che va' : 'orari che vanno'} bene a tutti e 4, scegliamo? → ${ctx.link}`
                      : `Non abbiamo ancora un orario in comune per ${ctx.title}: segnate le disponibilità qui → ${availabilityLink}`
                  }
                />
              )}
              {isPlayer && !withoutAvailability.includes(ctx.uid ?? '') && (
                <Link to={`/t/${tid}/disponibilita`} className={LINK}>
                  Modifica le tue disponibilità
                </Link>
              )}
            </div>
          </div>

          {gridVisible && (
            <>
              <Legend />
              <div className="grid items-start gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
                {days.map((d) => (
                  <DayLanes
                    key={d.date}
                    day={d}
                    today={todayDate}
                    ctx={ctx}
                    courts={courts}
                    focusKey={focusKey}
                    sel={sel ? slotKey(sel) : null}
                    refs={refs.current}
                    onKey={onKey}
                    onToggle={() => toggle(d.date)}
                    filtered={filtered}
                    narrow={rem >= 24}
                    onPick={(s) => {
                      setActive(slotKey(s));
                      setSel(s);
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {allowOffGrid && isPlayer && (
            <Button variant="link" className="min-h-11 justify-self-start text-base whitespace-normal" onClick={() => setOffGrid({ open: true })}>
              <Clock3 aria-hidden /> Proponi un orario fuori griglia
            </Button>
          )}

          {sel && (
            <SlotSheet
              ctx={ctx}
              state={sel}
              onClose={() => setSel(null)}
              onPropose={
                allowOffGrid && isPlayer
                  ? () => {
                      const s = sel;
                      setSel(null);
                      setOffGrid({ open: true, courtId: s.slot.courtId, date: s.slot.date });
                    }
                  : undefined
              }
            />
          )}
          {offGrid.open && (
            <OffGrid
              ctx={ctx}
              days={f.days}
              courts={courts}
              bookings={bookings.byCourtDay}
              requests={requests}
              windows={windows}
              initial={{ courtId: offGrid.courtId, date: offGrid.date }}
              onClose={() => setOffGrid({ open: false })}
            />
          )}
        </>
      )}
    </div>
  );
}

function DayLanes({
  day,
  today,
  ctx,
  courts,
  focusKey,
  sel,
  refs,
  onKey,
  onToggle,
  filtered,
  narrow,
  onPick,
}: {
  day: Day;
  today: string;
  ctx: MatchContext;
  courts: Court[];
  focusKey: string | null;
  sel: string | null;
  refs: Map<string, HTMLButtonElement>;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, key: string) => void;
  onToggle: () => void;
  filtered: boolean;
  narrow: boolean;
  onPick: (s: SlotState) => void;
}) {
  const id = useId();
  const total = ctx.match.players.length;
  const dayLabel = labelDate(day.date);
  const title = (
    <h3
      id={id}
      className={cn('tabular inline-flex flex-wrap items-center gap-x-2 text-base font-bold', day.date === today && 'rounded-control bg-court px-2.5 py-1 text-court-ink')}
    >
      {dayLabel}
      {day.date === today && <span className="font-semibold">· oggi</span>}
    </h3>
  );
  const toggle = (
    <Button
      variant="ghost"
      size="sm"
      className="text-base whitespace-normal text-court dark:text-info-ink"
      aria-expanded={day.expanded}
      aria-label={day.expanded ? `Nascondi gli altri orari di ${dayLabel}` : `Mostra tutti gli orari di ${dayLabel}`}
      onClick={onToggle}
    >
      {day.expanded ? 'Nascondi' : 'Mostra'}
    </Button>
  );

  if (day.view === 'closed' || day.view === 'none' || day.view === 'collapsed')
    return (
      <div role="group" aria-labelledby={id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2">
        {title}
        <span className="text-ink-muted">
          {day.view === 'closed' ? 'Campi chiusi' : day.view === 'none' ? 'Nessun orario ancora disponibile' : 'Nessun orario buono'}
        </span>
        {day.view === 'collapsed' && toggle}
        {day.view === 'none' && day.expanded && toggle}
      </div>
    );

  return (
    <div role="group" aria-labelledby={id} className="grid content-start gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        {title}
        {filtered && (day.expanded || day.view === 'useful') && toggle}
      </div>
      {/* large text (≥ 150%): one court per row, so the lanes keep a readable width */}
      {(narrow ? courts.map((c) => [c]) : [courts]).map((group) => (
        <div key={group.map((c) => c.id).join()}>
          <CourtLanes
            courts={group}
            scale={day.scale}
            stickyTop="0px"
            renderLane={(c) =>
              !courtOpen(c, day.date) ? (
                <p role="listitem" className="absolute inset-x-1 top-2 text-center text-base text-ink-muted">
                  Chiuso
                </p>
              ) : (
                day.byCourt[c.id]?.map((s) => {
                  const ui = SLOT_UI[s.color];
                  const Icon = ui.icon;
                  const k = slotKey(s);
                  const selected = sel === k;
                  const flat = s.color === 'grey';
                  return (
                    <LaneBlock
                      key={k}
                      scale={day.scale}
                      start={s.slot.start}
                      end={s.slot.end}
                      tone={ui.tone}
                      pattern={ui.pattern}
                      selected={selected}
                      onClick={() => onPick(s)}
                      ariaLabel={slotAriaLabel(s, c.name, ctx.name)}
                      className={cn(
                        'relative flex flex-col items-start justify-center gap-0.5 px-1.5 text-base',
                        // ≤ 2/4: flat, borderless, so it does not read as a primary target (it still explains itself)
                        flat && 'border-transparent bg-transparent text-ink-muted',
                      )}
                      buttonProps={{
                        ref: (el: HTMLButtonElement | null) => {
                          if (el) refs.set(k, el);
                          else refs.delete(k);
                        },
                        tabIndex: focusKey === k ? 0 : -1,
                        onKeyDown: (e) => onKey(e, k),
                      }}
                    >
                      <span className={cn('tabular leading-tight', flat ? 'font-semibold' : 'font-bold')}>{s.slot.start}</span>
                      <span className="flex items-center gap-1 leading-tight font-semibold">
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {slotLabel(s, total)}
                      </span>
                      {selected && <Check className="absolute top-1 right-1 size-4" strokeWidth={3} aria-hidden />}
                    </LaneBlock>
                  );
                })
              )
            }
          />
        </div>
      ))}
    </div>
  );
}

const LEGEND_TONES = {
  ok: 'border-ok bg-ok-soft text-ok-ink',
  warn: 'border-warn bg-warn-soft text-warn-ink',
  idle: 'border-transparent bg-surface-2 text-ink-muted',
  danger: 'border-danger bg-danger-soft text-danger-ink',
  info: 'border-info bg-info-soft text-info-ink',
} as const;

/** Always visible; collapsible with the native disclosure. */
function Legend() {
  return (
    <details open>
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-base font-semibold text-court dark:text-info-ink">Legenda</summary>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
        {(Object.keys(SLOT_UI) as (keyof typeof SLOT_UI)[]).map((k) => {
          const ui = SLOT_UI[k];
          const Icon = ui.icon;
          return (
            <li key={k} className="flex items-center gap-2 text-base">
              <span
                aria-hidden
                className={cn('grid size-7 shrink-0 place-items-center rounded-[6px] border', LEGEND_TONES[ui.tone as keyof typeof LEGEND_TONES], ui.pattern === 'hatch' && 'pattern-hatch')}
              >
                <Icon className="size-4" />
              </span>
              {ui.name}
            </li>
          );
        })}
        <li className="flex items-center gap-2 text-base">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[6px] border border-line-strong bg-surface shadow-[0_0_0_4px_var(--ball)] outline-2 outline-court-deep dark:outline-ball">
            <Check className="size-4" strokeWidth={3} />
          </span>
          Selezionato
        </li>
      </ul>
    </details>
  );
}

/** Root font size in px (user text-size preference), refreshed on resize / zoom. */
function useRemPx(): number {
  const read = () => (typeof window === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  const [rem, setRem] = useState(read);
  useEffect(() => {
    const update = () => setRem(read());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return rem;
}

function SkeletonLanes() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Caricamento degli orari">
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-6 w-24" />
          <div className="grid grid-cols-[2.75rem_1fr_1fr] gap-x-1.5">
            <span />
            <Skeleton className="h-80 rounded-control" />
            <Skeleton className="mt-6 h-80 rounded-control" />
          </div>
        </div>
      ))}
    </div>
  );
}
