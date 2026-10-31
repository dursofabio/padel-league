import { CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import { selectableTimes, validateWindow, WINDOW_PRESETS } from '../../../lib/windows';
import { Button, cn, Field, Select } from '../../../ui';
import { WindowPresets } from './DayEditor';

/** Mon … Sun, with the `Date.getDay()` number. */
const WEEK: { n: number; short: string; long: string }[] = [
  { n: 1, short: 'lun', long: 'lunedì' },
  { n: 2, short: 'mar', long: 'martedì' },
  { n: 3, short: 'mer', long: 'mercoledì' },
  { n: 4, short: 'gio', long: 'giovedì' },
  { n: 5, short: 'ven', long: 'venerdì' },
  { n: 6, short: 'sab', long: 'sabato' },
  { n: 0, short: 'dom', long: 'domenica' },
];

/**
 * Quick fill: usual weekdays + one time (preset or from/to),
 * added to all those days of the period. Answers "when do you usually play?".
 */
export function QuickFill({
  step,
  onApply,
}: {
  step: number;
  onApply: (weekdays: number[], from: string, to: string) => void;
}) {
  const times = selectableTimes(step);
  const [chosen, setChosen] = useState<number[]>([]);
  const [from, setFrom] = useState('18:00');
  const [to, setTo] = useState('23:00');
  const [attempted, setAttempted] = useState(false);
  const timeError = validateWindow(from, to);
  const daysError = attempted && !chosen.length ? 'Scegli almeno un giorno della settimana.' : null;
  const activePreset = WINDOW_PRESETS.find((p) => p.from === from && p.to === to)?.name ?? '';

  const toggle = (n: number) => setChosen((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">Giorni in cui giochi di solito</legend>
        <div className="flex flex-wrap gap-2">
          {WEEK.map((d) => {
            const on = chosen.includes(d.n);
            return (
              <button
                key={d.n}
                type="button"
                aria-pressed={on}
                aria-label={d.long}
                onClick={() => toggle(d.n)}
                className={cn(
                  'min-h-11 min-w-14 rounded-control border px-3 text-base font-semibold',
                  on ? 'border-court bg-court text-court-ink' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
                )}
              >
                {d.short}
              </button>
            );
          })}
        </div>
        {daysError && (
          <p role="alert" className="text-sm font-semibold text-danger-ink">
            {daysError}
          </p>
        )}
      </fieldset>

      <div className="grid gap-2">
        <p className="text-sm font-semibold">Orario</p>
        <WindowPresets
          active={activePreset}
          onPick={(x, y) => {
            setFrom(x);
            setTo(y);
          }}
        />
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
        <Field label="alle" error={timeError} className="w-32">
          {(p) => (
            <Select {...p} value={to} onChange={(e) => setTo(e.target.value)}>
              {times.slice(1).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="pt-[1.6rem]">
          <Button
            variant="court"
            disabled={!!timeError}
            onClick={() => {
              setAttempted(true);
              if (!chosen.length) return;
              onApply(chosen, from, to);
            }}
          >
            <CalendarPlus aria-hidden /> Aggiungi a tutto il periodo
          </Button>
        </div>
      </div>
    </div>
  );
}
