import { Copy, Eraser, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { selectableTimes, validateWindow, WINDOW_PRESETS, windowLabel } from '../../../lib/windows';
import { WEEKDAY_NAMES, weekday } from '../../../lib/time';
import { Button, Field, Select } from '../../../ui';

const EVERY: string[] = [
  'tutte le domeniche',
  'tutti i lunedì',
  'tutti i martedì',
  'tutti i mercoledì',
  'tutti i giovedì',
  'tutti i venerdì',
  'tutti i sabati',
];

/** "Copia su tutti i sabati" */
export function copyLabel(date: string): string {
  return `Copia su ${EVERY[weekday(date)]}`;
}

/** Plural of the weekday: "sabati", "domeniche", "lunedì". */
export function weekdayPlural(date: string, n: number): string {
  const wd = weekday(date);
  if (n === 1) return WEEKDAY_NAMES[wd];
  return EVERY[wd].replace(/^tutt[ie] (i|le) /, '');
}

/** "14:00" -> "14", "18:30" -> "18:30" (short preset labels). */
function short(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
}

/** Chips of a day's windows, each with its own remove button (44px). */
export function WindowChips({ windows, onRemove }: { windows: string[]; onRemove: (w: string) => void }) {
  if (!windows.length) return <p className="text-ink-muted">Nessun orario</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {windows.map((w) => (
        <li key={w} className="inline-flex min-h-11 items-center rounded-full bg-court pl-4 text-court-ink dark:bg-info-soft dark:text-info-ink dark:ring-1 dark:ring-info">
          <span className="tabular font-semibold">{windowLabel(w)}</span>
          <button
            type="button"
            onClick={() => onRemove(w)}
            aria-label={`${windowLabel(w)}, rimuovi`}
            className="grid size-11 place-items-center rounded-full hover:bg-court-deep"
          >
            <X className="size-5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Preset buttons: one tap adds the time. The text can wrap (large text). */
export function WindowPresets({ onPick, active }: { onPick: (from: string, to: string) => void; active?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {WINDOW_PRESETS.map((p) => (
        <Button
          key={p.name}
          variant="secondary"
          aria-pressed={active === undefined ? undefined : active === p.name}
          className="h-auto py-2 text-left whitespace-normal aria-pressed:bg-court aria-pressed:text-court-ink dark:aria-pressed:bg-ball dark:aria-pressed:text-ball-ink"
          onClick={() => onPick(p.from, p.to)}
        >
          {p.name} <span className="tabular">{`${short(p.from)}–${short(p.to)}`}</span>
        </Button>
      ))}
    </div>
  );
}

/**
 * "Aggiungi orario" row: two from/to selects at the tournament step, plus the presets.
 * On open the focus goes to the first select; Esc closes.
 * `onAdd` returns the window the new one merged into (or null), to tell the user.
 */
export function AddWindow({
  step,
  onAdd,
  onClose,
  framed = true,
  autoFocus = true,
}: {
  step: number;
  framed?: boolean;
  autoFocus?: boolean;
  onAdd: (from: string, to: string) => string | null;
  onClose?: () => void;
}) {
  const times = selectableTimes(step);
  const [from, setFrom] = useState('18:00');
  const [to, setTo] = useState('21:00');
  const [outcome, setOutcome] = useState('');
  const error = validateWindow(from, to);
  const ref = useRef<HTMLDivElement>(null);

  // the button that opened the row disappears: focus moves into the row's first control
  useEffect(() => {
    if (autoFocus) ref.current?.querySelector<HTMLElement>('button, select')?.focus();
  }, [autoFocus]);

  const add = (x: string, y: string) => {
    const merged = onAdd(x, y);
    setOutcome(merged ? `Unito a ${windowLabel(merged)}` : `Aggiunto ${x}–${y}`);
  };

  return (
    <div
      ref={ref}
      className={framed ? 'grid gap-3 rounded-panel bg-surface-2 p-3' : 'grid gap-3'}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onClose) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="grid gap-2">
        <p className="text-sm font-semibold">Tocca un orario tipico</p>
        <WindowPresets onPick={add} />
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <Field label="oppure dalle" className="w-32">
          {(p) => (
            <Select {...p} value={from} onChange={(e) => setFrom(e.target.value)}>
              {times.slice(0, -1).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="alle" error={error} className="w-32">
          {(p) => (
            <Select {...p} value={to} onChange={(e) => setTo(e.target.value)}>
              {times.slice(1).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-wrap gap-2 pt-[1.6rem]">
          <Button variant="court" disabled={!!error} onClick={() => add(from, to)}>
            <Plus aria-hidden /> Aggiungi
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Chiudi
            </Button>
          )}
        </div>
      </div>
      <p aria-live="polite" className="text-sm text-ink-muted empty:hidden">
        {outcome}
      </p>
    </div>
  );
}

/** Day actions: copy to the same weekday and clear (only if the day has windows). */
export function DayActions({
  date,
  hasWindows,
  canCopy,
  onCopy,
  onClear,
}: {
  date: string;
  hasWindows: boolean;
  canCopy: boolean;
  onCopy: () => void;
  onClear: () => void;
}) {
  if (!hasWindows) return null;
  return (
    <>
      {canCopy && (
        <Button variant="ghost" onClick={onCopy}>
          <Copy aria-hidden /> {copyLabel(date)}
        </Button>
      )}
      <Button variant="ghost" onClick={onClear}>
        <Eraser aria-hidden /> Svuota
      </Button>
    </>
  );
}
