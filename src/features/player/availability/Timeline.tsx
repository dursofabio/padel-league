import { useMemo } from 'react';
import { dayPercent, windowLabel } from '../../../lib/windows';
import { gridSlots } from '../../../lib/slots';
import { parseWindow } from '../../../lib/time';
import type { Court } from '../../../types';
import { cn } from '../../../ui';

/** Slot starts of the courts on that day: the court (0/1) decides which half of the line the tick falls in. */
function useTicks(courts: Court[], date: string) {
  return useMemo(
    () => courts.flatMap((c, i) => gridSlots(c, date).map((s) => ({ key: `${c.id}-${s.start}`, start: s.start, side: i % 2 }))),
    [courts, date],
  );
}

/**
 * 08–24 timeline of one day: windows as blue bars, slot starts as alternating ticks
 * (the offset of the two courts). Decorative: the same information is in the chips.
 */
export function Timeline({ date, windows, courts }: { date: string; windows: string[]; courts: Court[] }) {
  const ticks = useTicks(courts, date);
  return (
    <div aria-hidden className="grid gap-1">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-2" />
        {windows.map((w) => {
          const [a, b] = parseWindow(w);
          const x = dayPercent(a);
          return (
            <div
              key={w}
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-court"
              style={{ left: `${x}%`, width: `${dayPercent(b) - x}%` }}
            />
          );
        })}
        {ticks.map((t) => (
          <span
            key={t.key}
            className={cn('absolute h-1/2 w-px bg-ink-muted/60', t.side ? 'top-1/2' : 'top-0')}
            style={{ left: `${dayPercent(t.start)}%` }}
          />
        ))}
      </div>
      <div className="tabular relative h-5 text-sm text-ink-muted">
        {['08', '14', '20', '24'].map((h, i, all) => (
          <span
            key={h}
            className={cn('absolute', i === 0 ? '' : i === all.length - 1 ? '-translate-x-full' : '-translate-x-1/2')}
            style={{ left: `${dayPercent(`${h}:00`)}%` }}
          >
            {h}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Vertical variant for the week view (desktop): time runs top to bottom. */
export function TimeColumn({ date, windows, courts }: { date: string; windows: string[]; courts: Court[] }) {
  const ticks = useTicks(courts, date);
  return (
    <div aria-hidden className="relative h-72 w-full overflow-hidden rounded-control bg-surface-2">
      {[12, 16, 20].map((h) => (
        <span key={h} className="absolute inset-x-0 h-px bg-line" style={{ top: `${((h - 8) / 16) * 100}%` }} />
      ))}
      {windows.map((w) => {
        const [a, b] = parseWindow(w);
        const y = dayPercent(a);
        const h = dayPercent(b) - y;
        return (
          <div
            key={w}
            className="tabular absolute inset-x-1 overflow-hidden rounded-[6px] bg-court px-1 pt-0.5 text-xs font-semibold text-court-ink"
            style={{ top: `${y}%`, height: `${h}%` }}
          >
            {h >= 12 ? windowLabel(w) : null}
          </div>
        );
      })}
      {ticks.map((t) => (
        <span
          key={t.key}
          className={cn('absolute h-px w-1/4 bg-ink-muted/60', t.side ? 'right-0' : 'left-0')}
          style={{ top: `${dayPercent(t.start)}%` }}
        />
      ))}
    </div>
  );
}

/** Tick legend: tells which court starts a match at that time. */
export function TickLegend({ courts, vertical }: { courts: Court[]; vertical?: boolean }) {
  if (!courts.length) return null;
  const [c1, c2] = courts;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="inline-block h-2 w-6 rounded-full bg-court" /> il tuo orario
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className={cn('relative inline-block h-4 w-6 rounded-[3px] bg-surface-2')}>
          <span className={cn('absolute bg-ink-muted', vertical ? 'top-1/2 left-0 h-px w-1/3' : 'top-0 left-1/2 h-1/2 w-px')} />
        </span>
        inizio partita {c1.name} {vertical ? '(tacca a sinistra)' : '(tacca in alto)'}
      </span>
      {c2 && (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="relative inline-block h-4 w-6 rounded-[3px] bg-surface-2">
            <span className={cn('absolute bg-ink-muted', vertical ? 'top-1/2 right-0 h-px w-1/3' : 'top-1/2 left-1/2 h-1/2 w-px')} />
          </span>
          inizio partita {c2.name} {vertical ? '(tacca a destra)' : '(tacca in basso)'}
        </span>
      )}
    </p>
  );
}
