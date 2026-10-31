import { Plus } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { windowLabel, weeks as toWeeks } from '../../../lib/windows';
import { addDays, labelDate } from '../../../lib/time';
import type { Court, Windows } from '../../../types';
import { cn } from '../../../ui';
import { TimeColumn } from './Timeline';

const HEADINGS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/**
 * Week view (desktop): 7 columns Mon–Sun, time running top to bottom.
 * Each day is a button that opens the editor; arrows move between days (±1, ±7), Enter opens.
 */
export function WeekStrip({
  days,
  windows,
  courts,
  today,
  selected,
  onOpen,
}: {
  days: string[];
  windows: Windows;
  courts: Court[];
  today: string;
  selected: string | null;
  onOpen: (date: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const weeks = toWeeks(days);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = (e.target as HTMLElement).dataset.day;
    if (!from) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!delta) return;
    const btn = ref.current?.querySelector<HTMLButtonElement>(`[data-day="${addDays(from, delta)}"]`);
    if (btn) {
      e.preventDefault();
      btn.focus();
    }
  };

  return (
    <div ref={ref} onKeyDown={onKeyDown} className="grid gap-6">
      {weeks.map((w) => {
        const first = w.find(Boolean)!;
        return (
          <div key={first} role="group" aria-label={`Settimana dal ${labelDate(first)}`} className="grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] gap-2">
            <div aria-hidden className="tabular relative mt-12 h-72 text-xs text-ink-muted">
              {[8, 12, 16, 20, 24].map((h) => (
                <span key={h} className="absolute right-1 -translate-y-1/2" style={{ top: `${((h - 8) / 16) * 100}%` }}>
                  {String(h).padStart(2, '0')}
                </span>
              ))}
            </div>
            {w.map((d, i) => {
              if (!d)
                return (
                  <div key={i} className="grid content-start gap-2 opacity-50">
                    <p className="flex min-h-10 items-end text-sm text-ink-muted">{HEADINGS[i]}</p>
                    <div aria-hidden className="h-72 rounded-control border border-dashed border-line" />
                  </div>
                );
              const list = windows[d] ?? [];
              const descr = list.length ? list.map(windowLabel).join(', ') : 'nessun orario';
              return (
                <button
                  key={d}
                  type="button"
                  data-day={d}
                  onClick={() => onOpen(d)}
                  aria-label={`${labelDate(d)}${d === today ? ', oggi' : ''}: ${descr}. Aggiungi o modifica`}
                  className={cn(
                    'group grid content-start gap-2 rounded-control text-left',
                    selected === d && 'outline-2 outline-offset-4 outline-court dark:outline-ball',
                  )}
                >
                  <span className="flex min-h-10 flex-col justify-end">
                    <span className="tabular text-sm font-bold group-hover:underline">{labelDate(d)}</span>
                    {d === today && <span className="text-xs font-semibold text-court dark:text-info-ink">oggi</span>}
                  </span>
                  <TimeColumn date={d} windows={list} courts={courts} />
                  <span
                    aria-hidden
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-control border border-court text-sm font-semibold text-court group-hover:bg-info-soft dark:border-line-strong dark:text-ink"
                  >
                    <Plus className="size-4" /> Aggiungi
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
