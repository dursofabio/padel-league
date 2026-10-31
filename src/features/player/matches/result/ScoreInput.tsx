/**
 * Score table: one row per set, two columns headed by the pair names, separated by a vertical court line
 * like the net. Each cell is a stepper (− number +) whose number is also a numeric input.
 * Live validation with validateResult, messages under the row, winner preview in a polite live region.
 */
import { Minus, Plus, Trophy, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import type { SetFormat } from '../../../../types';
import { cn } from '../../../../ui';
import { checkResult, maxGame, setName, visibleRows, type ResultCheck, type SetValue } from '../logic';

export function ScoreInput({
  values,
  onChange,
  format,
  nameA,
  nameB,
  disabled,
}: {
  values: SetValue[];
  onChange: (v: SetValue[]) => void;
  format: SetFormat;
  nameA: string;
  nameB: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const n = visibleRows(values, format);
  const check = checkResult(values, format);
  const set = (i: number, side: 'a' | 'b', v: number | null) => {
    const next = values.map((x) => ({ ...x }));
    next[i] = { ...next[i], [side]: v };
    // rows that are no longer visible are cleared, so they never reach the server
    const vis = visibleRows(next, format);
    for (let j = vis; j < next.length; j++) next[j] = { a: null, b: null };
    onChange(next);
  };
  const touch = (i: number) => setTouched((s) => (s.has(i) ? s : new Set(s).add(i)));

  return (
    <div className="grid w-full max-w-md gap-3">
      <fieldset className="grid">
        <legend className="sr-only">Risultato per set</legend>
        <div aria-hidden className="grid grid-cols-2 items-end gap-x-2 border-b border-line pb-2 sm:grid-cols-[6.5rem_1fr_1fr]">
          <span className="hidden sm:block" />
          <span className="text-center text-base font-bold break-words">{nameA}</span>
          <span className="border-l border-line pl-2 text-center text-base font-bold break-words">{nameB}</span>
        </div>
        {Array.from({ length: n }, (_, i) => {
          const error = check.byRow[i] && (touched.has(i) || (values[i]?.a !== null && values[i]?.b !== null)) ? check.byRow[i] : undefined;
          const errId = `${id}-err-${i}`;
          const v = values[i] ?? { a: null, b: null };
          const winsA = v.a !== null && v.b !== null && v.a > v.b;
          const winsB = v.a !== null && v.b !== null && v.b > v.a;
          return (
            <div key={i} className="grid grid-cols-2 items-center gap-x-2 gap-y-1 border-b border-line py-2 sm:grid-cols-[6.5rem_1fr_1fr]">
              <span className="col-span-2 text-sm font-semibold sm:col-span-1">
                {setName(i, format)}
              </span>
              <span>
                <Stepper
                  label={`${setName(i, format)}, game di ${nameA}`}
                  value={v.a}
                  max={maxGame(i, format)}
                  strong={winsA}
                  disabled={disabled}
                  describedBy={error ? errId : undefined}
                  onChange={(x) => set(i, 'a', x)}
                  onBlur={() => touch(i)}
                />
              </span>
              <span className="border-l border-line pl-2">
                <Stepper
                  label={`${setName(i, format)}, game di ${nameB}`}
                  value={v.b}
                  max={maxGame(i, format)}
                  strong={winsB}
                  disabled={disabled}
                  describedBy={error ? errId : undefined}
                  onChange={(x) => set(i, 'b', x)}
                  onBlur={() => touch(i)}
                />
              </span>
              {error && (
                <p id={errId} className="col-span-2 flex sm:col-span-3 items-start gap-1.5 text-sm font-semibold text-danger-ink">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </fieldset>
      <ScoreSummary check={check} nameA={nameA} nameB={nameB} />
    </div>
  );
}

/** "Vincono Rossi/Bianchi 2 set a 1": the last thing read before the button. */
export function ScoreSummary({ check, nameA, nameB }: { check: ResultCheck; nameA: string; nameB: string }) {
  return (
    <p aria-live="polite" className="min-h-7 text-base">
      {check.winner ? (
        <span className="flex items-center gap-2 font-bold">
          <Trophy className="size-5 shrink-0" aria-hidden />
          <span className="tabular">
            Vincono {check.winner === 'A' ? nameA : nameB} {Math.max(check.setsA, check.setsB)} set a {Math.min(check.setsA, check.setsB)}
          </span>
        </span>
      ) : check.global ? (
        <span className="flex items-center gap-2 text-ink-muted">
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          {check.global}
        </span>
      ) : null}
    </p>
  );
}

function Stepper({
  label,
  value,
  max,
  strong,
  disabled,
  describedBy,
  onChange,
  onBlur,
}: {
  label: string;
  value: number | null;
  max: number;
  strong: boolean;
  disabled?: boolean;
  describedBy?: string;
  onChange: (v: number | null) => void;
  onBlur: () => void;
}) {
  const btn =
    'grid size-11 shrink-0 place-items-center rounded-control border border-line-strong bg-surface text-ink hover:bg-surface-2 disabled:opacity-40 [&_svg]:size-5';
  return (
    <span className="flex items-center justify-center gap-1">
      <button
        type="button"
        className={btn}
        aria-label={`${label}: meno uno`}
        disabled={disabled || value === 0}
        onClick={() => {
          // from empty, − writes 0 (a set lost 6-0); + writes 1
          onChange(value === null ? 0 : Math.max(0, value - 1));
          onBlur();
        }}
      >
        <Minus aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={value !== null && value > max ? true : undefined}
        disabled={disabled}
        value={value ?? ''}
        placeholder="–"
        onFocus={(e) => e.currentTarget.select()}
        onBlur={onBlur}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '').slice(0, 2);
          onChange(t === '' ? null : Number(t));
        }}
        className={cn(
          'tabular h-11 w-12 rounded-control border border-line-strong bg-surface text-center text-xl text-ink placeholder:text-ink-muted',
          'focus-visible:border-court focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-ball aria-[invalid=true]:border-danger',
          strong ? 'font-bold' : 'font-normal',
        )}
      />
      <button
        type="button"
        className={btn}
        aria-label={`${label}: più uno`}
        disabled={disabled || (value ?? 0) >= max}
        onClick={() => {
          onChange(Math.min(max, (value ?? 0) + 1));
          onBlur();
        }}
      >
        <Plus aria-hidden />
      </button>
    </span>
  );
}
