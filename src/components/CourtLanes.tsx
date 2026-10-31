/**
 * Signature of the "court lines" direction: a day drawn as parallel court lanes, one per court.
 * Time runs top to bottom, start times sit on the lines, so the 30' stagger between Court 1 and
 * Court 2 is visible. Used by the match slot grid and by the court manager's timeline.
 */
import type { CSSProperties, ReactNode } from 'react';
import { fromMin, toMin } from '../lib/time';
import type { Court } from '../types';
import { cn } from '../ui/cn';

export interface LaneScale {
  /** First minute shown (e.g. 13:00 → 780). */
  from: number;
  /** Last minute shown. */
  to: number;
  /** Pixels per minute. */
  px: number;
}

/** Visible range from the courts' grid, rounded to the hour, plus a margin. */
export function scaleFromCourts(courts: Court[], px = 0.8, extra?: { from?: string; to?: string }): LaneScale {
  const starts = courts.map((c) => toMin(c.firstSlot));
  const ends = courts.map((c) => toMin(c.lastSlot) + c.slotMinutes);
  let from = Math.min(...starts, extra?.from ? toMin(extra.from) : Infinity);
  let to = Math.max(...ends, extra?.to ? toMin(extra.to) : -Infinity);
  if (!Number.isFinite(from)) from = 8 * 60;
  if (!Number.isFinite(to)) to = 23 * 60;
  return { from: Math.floor(from / 60) * 60, to: Math.min(24 * 60, Math.ceil(to / 60) * 60), px };
}

/** Absolute position of an interval inside a lane. */
export function lanePosition(scale: LaneScale, start: string, end: string): CSSProperties {
  const a = Math.max(scale.from, toMin(start));
  const b = Math.min(scale.to, toMin(end));
  return { top: (a - scale.from) * scale.px, height: Math.max(20, (b - a) * scale.px) };
}

export function CourtLanes({
  courts,
  scale,
  renderLane,
  caption,
  className,
  nowMinute,
  stickyTop,
}: {
  /** Court names stay visible while scrolling (CSS top offset, e.g. '0px' or '3.5rem'). */
  stickyTop?: string;
  courts: Court[];
  scale: LaneScale;
  /** Blocks (absolutely positioned with `lanePosition`) of one court's lane. */
  renderLane: (court: Court) => ReactNode;
  caption?: ReactNode;
  className?: string;
  /** "Now" line (minute of the day), only today. */
  nowMinute?: number;
}) {
  const height = (scale.to - scale.from) * scale.px;
  const hours: number[] = [];
  for (let m = scale.from; m <= scale.to; m += 60) hours.push(m);
  return (
    <figure className={cn('grid gap-2', className)}>
      {caption && <figcaption className="text-base font-bold">{caption}</figcaption>}
      <div
        className="grid gap-x-1.5"
        style={{ gridTemplateColumns: `2.75rem repeat(${courts.length}, minmax(0, 1fr))` }}
      >
        <div aria-hidden />
        {courts.map((c) => (
          <div
            key={c.id}
            className={cn('rounded-t-control bg-court px-2 py-1.5 text-center text-sm font-bold text-court-ink', stickyTop && 'sticky z-20')}
            style={stickyTop ? { top: stickyTop } : undefined}
          >
            {c.name}
          </div>
        ))}
        <div className="relative" style={{ height }} aria-hidden>
          {hours.map((m) => (
            <span
              key={m}
              // the first label sits below its line, so the lane's top edge never clips it
              className={cn('tabular absolute right-1 text-sm text-ink-muted', m === scale.from ? 'translate-y-0' : '-translate-y-1/2')}
              style={{ top: (m - scale.from) * scale.px }}
            >
              {fromMin(m)}
            </span>
          ))}
        </div>
        {courts.map((c) => (
          <div
            key={c.id}
            role="list"
            aria-label={c.name}
            className="relative rounded-b-control border-x border-b border-line bg-surface-2"
            style={{
              height,
              // court lines: one line every 30 minutes, start times sit on the lines
              backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${30 * scale.px}px)`,
              backgroundPosition: `0 0`,
            }}
          >
            {renderLane(c)}
            {nowMinute !== undefined && nowMinute >= scale.from && nowMinute <= scale.to && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger"
                style={{ top: (nowMinute - scale.from) * scale.px }}
              />
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}

/**
 * Block positioned in a lane (slot, booking, request). Tone + icon + text: never colour alone.
 * `pattern`: 'hatch' for occupied courts, 'dots' for slots with few players free.
 */
export function LaneBlock({
  scale,
  start,
  end,
  tone,
  pattern,
  selected,
  children,
  onClick,
  ariaLabel,
  className,
  narrow,
  buttonProps,
}: {
  scale: LaneScale;
  start: string;
  end: string;
  tone: 'ok' | 'warn' | 'danger' | 'info' | 'idle' | 'court';
  pattern?: 'hatch' | 'dots' | 'cross';
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
  /** Must begin with the visible text (voice control): e.g. "14:00, Campo 2, tutti e 4 liberi". */
  ariaLabel?: string;
  className?: string;
  /** Narrower block (e.g. a booking on top of a grid slot). */
  narrow?: boolean;
  /** Extra props for the inner button (ref, tabIndex, onKeyDown, data-*). */
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> };
}) {
  const tones = {
    ok: 'bg-ok-soft text-ok-ink border-ok',
    warn: 'bg-warn-soft text-warn-ink border-warn',
    danger: 'bg-danger-soft text-danger-ink border-danger',
    info: 'bg-info-soft text-info-ink border-info',
    idle: 'bg-surface text-idle-ink border-line-strong',
    court: 'bg-court text-court-ink border-court-deep',
  } as const;
  const cls = cn(
    'block h-full w-full overflow-hidden rounded-[6px] border px-2 py-1 text-left text-sm leading-tight',
    tones[tone],
    pattern === 'hatch' && 'pattern-hatch',
    pattern === 'dots' && 'pattern-dots',
    pattern === 'cross' && 'pattern-cross',
    // selection: ink outline (contrast) with the ball halo (identity)
    selected && 'relative z-10 outline-2 outline-offset-1 outline-court-deep shadow-[0_0_0_5px_var(--ball)] dark:outline-ball',
    onClick && 'cursor-pointer transition-[filter] duration-150 hover:brightness-[0.97] dark:hover:brightness-110',
    className,
  );
  return (
    <div role="listitem" className={cn('absolute', narrow ? 'right-1 left-3' : 'inset-x-1', selected && 'z-10')} style={lanePosition(scale, start, end)}>
      {onClick ? (
        <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel} aria-pressed={selected} {...buttonProps}>
          {children}
        </button>
      ) : (
        <div className={cls} aria-label={ariaLabel}>
          {children}
        </div>
      )}
    </div>
  );
}
