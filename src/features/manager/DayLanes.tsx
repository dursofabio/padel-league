import { Ban, DoorClosed, GraduationCap, Hourglass, Plus, Trophy, Users, type LucideIcon } from 'lucide-react';
import { CourtLanes, LaneBlock, type LaneScale } from '../../components/CourtLanes';
import { gridSlots, type Slot } from '../../lib/slots';
import { toMin } from '../../lib/time';
import { cn } from '../../ui';
import { BOOKING_TYPE_LABEL } from '../../lib/copy';
import type { BookingRow, BookingType, Court, MatchRequest } from '../../types';
import { managerSlotState, readableEnd } from './logic';

/** Booking types differ by pattern + icon + label (glossary in docs/ux/README.md), never by colour alone. */
export const BOOKING_LOOK: Record<
  BookingType,
  { icon: LucideIcon; tone: 'court' | 'idle' | 'danger'; pattern?: 'hatch' | 'cross'; className?: string }
> = {
  match: { icon: Trophy, tone: 'court' },
  // solid neutral fill
  external: { icon: Users, tone: 'idle', className: 'bg-idle-soft' },
  // neutral ground with the diagonal hatch: not amber, which means "3/4" elsewhere
  lesson: { icon: GraduationCap, tone: 'idle', pattern: 'hatch', className: 'bg-surface text-ink' },
  closure: { icon: DoorClosed, tone: 'danger', pattern: 'cross' },
};

/**
 * One day as two court lanes (signature): grid slots as outlines, bookings as blocks spanning their
 * real duration, pending requests dashed (G8), the selected request highlighted, the impact of an
 * off-grid request hatched.
 */
export function DayLanes({
  date,
  courts,
  scale,
  bookings,
  requests,
  highlighted,
  impacted = [],
  matchName,
  onFreeSlot,
  onBooking,
  onRequest,
  nowMinute,
  now = Date.now(),
  className,
  stickyTop,
}: {
  date: string;
  courts: Court[];
  scale: LaneScale;
  /** Bookings of this day. */
  bookings: BookingRow[];
  /** Live pending requests of this day (plus, optionally, the highlighted one). */
  requests: MatchRequest[];
  highlighted?: string | null;
  impacted?: Slot[];
  matchName?: (matchId: string | null | undefined) => string | undefined;
  onFreeSlot?: (court: Court, slot: Slot) => void;
  onBooking?: (o: BookingRow) => void;
  onRequest?: (r: MatchRequest) => void;
  nowMinute?: number;
  now?: number;
  className?: string;
  /** Keeps the court names visible while scrolling (passed to CourtLanes). */
  stickyTop?: string;
}) {
  return (
    <CourtLanes
      courts={courts}
      stickyTop={stickyTop}
      scale={scale}
      nowMinute={nowMinute}
      className={className}
      renderLane={(court) => {
        const bk = bookings.filter((o) => o.courtId === court.id && o.date === date);
        const items = Object.fromEntries(bk.map((o) => [o.id, o]));
        const req = requests.filter((r) => r.courtId === court.id && r.date === date);
        const grid = gridSlots(court, date);
        const impOffGrid = new Set(impacted.filter((s) => s.courtId === court.id).map((s) => s.start));
        const states = grid.map((s) => ({ s, state: managerSlotState(s, items, req, now) }));
        const free = states.filter((x) => x.state === 'free' && !impOffGrid.has(x.s.start)).map((x) => x.s);
        // grid slots lost to a booking (e.g. a lesson 16–17 kills 15:00 and 16:30) or to the selected off-grid request
        const exact = (x: Slot) => req.some((r) => r.start === x.start && r.end === x.end);
        const unusable = states
          .filter(
            (x) =>
              (x.state === 'booked' && !bk.some((o) => o.start === x.s.start && o.end === x.s.end)) ||
              (x.state === 'requested' && !exact(x.s)) ||
              (x.state === 'free' && impOffGrid.has(x.s.start)),
          )
          .map((x) => x.s);
        // label at the bottom when the slot's start is hidden under a booking
        const headCovered = (x: Slot) => bk.some((o) => toMin(o.start) <= toMin(x.start) && toMin(x.start) < toMin(o.end));
        return (
          <>
            {free.map((s) =>
              onFreeSlot ? (
                <LaneBlock
                  key={`s-${s.start}`}
                  scale={scale}
                  start={s.start}
                  end={s.end}
                  tone="idle"
                  className="border-dashed bg-transparent text-ink-muted hover:bg-surface dark:border-ink-muted dark:bg-idle-soft/50"
                  onClick={() => onFreeSlot(court, s)}
                  ariaLabel={`${s.start} libero, ${court.name}, fino alle ${s.end}: segna occupato`}
                >
                  <span className="tabular flex items-center gap-1 font-semibold text-ink">
                    {s.start}
                    <Plus className="size-4 text-ink-muted" aria-hidden />
                  </span>
                  <span className="text-sm">libero</span>
                </LaneBlock>
              ) : (
                <LaneBlock
                  key={`s-${s.start}`}
                  scale={scale}
                  start={s.start}
                  end={s.end}
                  tone="idle"
                  className="bg-transparent text-ink-muted dark:border-ink-muted"
                  ariaLabel={`${s.start} libero, ${court.name}, fino alle ${s.end}`}
                >
                  <span className="tabular font-semibold">{s.start}</span>
                </LaneBlock>
              ),
            )}
            {unusable.map((s) => (
              <LaneBlock
                key={`i-${s.start}`}
                scale={scale}
                start={s.start}
                end={s.end}
                tone="idle"
                pattern="hatch"
                className={cn('bg-transparent text-ink-muted', headCovered(s) && 'flex flex-col justify-end')}
                ariaLabel={`${s.start} inutilizzabile, ${court.name}: lo slot fino alle ${s.end} si sovrappone a un’occupazione o a una richiesta fuori griglia`}
              >
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <Ban className="size-4 shrink-0" aria-hidden />
                  <span className="tabular">{s.start}</span>
                </span>
                <span className="text-sm">inutilizzabile</span>
              </LaneBlock>
            ))}
            {bk.map((o) => {
              const a = BOOKING_LOOK[o.type];
              const title = o.type === 'match' ? (matchName?.(o.matchId) ?? BOOKING_TYPE_LABEL.match) : BOOKING_TYPE_LABEL[o.type];
              const time = `${o.start}–${readableEnd(o.end)}`;
              const label = `${title}, ${time}${o.type === 'match' ? `, ${BOOKING_TYPE_LABEL.match}` : ''}, ${court.name}${o.note ? `, ${o.note}` : ''}`;
              return (
                <LaneBlock
                  key={o.id}
                  scale={scale}
                  start={o.start}
                  end={o.end}
                  tone={a.tone}
                  pattern={a.pattern}
                  className={a.className}
                  narrow
                  selected={!!highlighted && o.requestId === highlighted}
                  onClick={onBooking ? () => onBooking(o) : undefined}
                  ariaLabel={onBooking ? `${label}: apri i dettagli` : label}
                >
                  {/* short blocks (≤ 75'): title and time on one line; the note is in the accessible name and in the details */}
                  {minutesBetween(o.start, o.end) <= 75 ? (
                    <span className="@container block">
                      <span className="flex items-center gap-1 font-semibold">
                        <a.icon className="size-4 shrink-0" aria-hidden />
                        <span className="leading-tight">{title}</span>
                        {/* narrow lane: the time is already on the axis; the title is never cut */}
                        <span className="tabular ml-auto hidden shrink-0 text-sm font-normal @[10rem]:inline">{time}</span>
                      </span>
                    </span>
                  ) : (
                    <>
                      <span className="flex items-start gap-1 font-semibold">
                        <a.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="line-clamp-2">{title}</span>
                      </span>
                      <span className="tabular block text-sm">{time}</span>
                      {o.note && minutesBetween(o.start, o.end) >= 120 && <span className="block truncate text-sm">{o.note}</span>}
                    </>
                  )}
                </LaneBlock>
              );
            })}
            {req.map((r) => {
              const sel = r.id === highlighted;
              const status = sel ? 'Richiesta selezionata' : 'Richiesta in attesa';
              const title = matchName?.(r.matchId);
              const label = `${status}, ${r.start}–${r.end}${title ? `, ${title}` : ''}, ${court.name}`;
              return (
                <LaneBlock
                  key={r.id}
                  scale={scale}
                  start={r.start}
                  end={r.end}
                  tone="info"
                  narrow
                  selected={sel}
                  className={sel ? undefined : 'border-2 border-dashed bg-info-soft/70'}
                  onClick={onRequest ? () => onRequest(r) : undefined}
                  ariaLabel={onRequest ? `${label}: apri` : label}
                >
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <Hourglass className="size-4 shrink-0" aria-hidden />
                    {status}
                  </span>
                  <span className="tabular block text-sm">
                    {r.start}–{r.end}
                  </span>
                  {title && <span className="line-clamp-2 text-sm">{title}</span>}
                </LaneBlock>
              );
            })}
          </>
        );
      }}
    />
  );
}

function minutesBetween(start: string, end: string) {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(end) - m(start);
}
