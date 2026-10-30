/**
 * Score table: one row per set, two columns headed by the pair names, separated by a vertical court line
 * like the net. Each cell is a stepper (− number +) whose number is also a numeric input.
 * Live validation with validaRisultato, messages under the row, winner preview in a polite live region.
 */
import { Minus, Plus, Trophy, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormatoSet } from '../../../../types';
import { cn } from '../../../../ui';
import { controllaRisultato, maxGame, nomeSet, righeVisibili, type ControlloRisultato, type ValoreSet } from '../logica';

export function ScoreInput({
  valori,
  onChange,
  formato,
  nomeA,
  nomeB,
  disabled,
}: {
  valori: ValoreSet[];
  onChange: (v: ValoreSet[]) => void;
  formato: FormatoSet;
  nomeA: string;
  nomeB: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [toccate, setToccate] = useState<Set<number>>(new Set());
  const n = righeVisibili(valori, formato);
  const ctrl = controllaRisultato(valori, formato);
  const set = (i: number, lato: 'a' | 'b', v: number | null) => {
    const next = valori.map((x) => ({ ...x }));
    next[i] = { ...next[i], [lato]: v };
    // rows that are no longer visible are cleared, so they never reach the server
    const vis = righeVisibili(next, formato);
    for (let j = vis; j < next.length; j++) next[j] = { a: null, b: null };
    onChange(next);
  };
  const tocca = (i: number) => setToccate((s) => (s.has(i) ? s : new Set(s).add(i)));

  return (
    <div className="grid w-full max-w-md gap-3">
      <fieldset className="grid">
        <legend className="sr-only">Risultato per set</legend>
        <div aria-hidden className="grid grid-cols-2 items-end gap-x-2 border-b border-line pb-2 sm:grid-cols-[6.5rem_1fr_1fr]">
          <span className="hidden sm:block" />
          <span className="text-center text-base font-bold break-words">{nomeA}</span>
          <span className="border-l border-line pl-2 text-center text-base font-bold break-words">{nomeB}</span>
        </div>
        {Array.from({ length: n }, (_, i) => {
          const errore = ctrl.perRiga[i] && (toccate.has(i) || (valori[i]?.a !== null && valori[i]?.b !== null)) ? ctrl.perRiga[i] : undefined;
          const errId = `${id}-err-${i}`;
          const v = valori[i] ?? { a: null, b: null };
          const vinceA = v.a !== null && v.b !== null && v.a > v.b;
          const vinceB = v.a !== null && v.b !== null && v.b > v.a;
          return (
            <div key={i} className="grid grid-cols-2 items-center gap-x-2 gap-y-1 border-b border-line py-2 sm:grid-cols-[6.5rem_1fr_1fr]">
              <span className="col-span-2 text-sm font-semibold sm:col-span-1">
                {nomeSet(i, formato)}
              </span>
              <span>
                <Stepper
                  label={`${nomeSet(i, formato)}, game di ${nomeA}`}
                  valore={v.a}
                  max={maxGame(i, formato)}
                  forte={vinceA}
                  disabled={disabled}
                  describedBy={errore ? errId : undefined}
                  onChange={(x) => set(i, 'a', x)}
                  onBlur={() => tocca(i)}
                />
              </span>
              <span className="border-l border-line pl-2">
                <Stepper
                  label={`${nomeSet(i, formato)}, game di ${nomeB}`}
                  valore={v.b}
                  max={maxGame(i, formato)}
                  forte={vinceB}
                  disabled={disabled}
                  describedBy={errore ? errId : undefined}
                  onChange={(x) => set(i, 'b', x)}
                  onBlur={() => tocca(i)}
                />
              </span>
              {errore && (
                <p id={errId} className="col-span-2 flex sm:col-span-3 items-start gap-1.5 text-sm font-semibold text-danger-ink">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {errore}
                </p>
              )}
            </div>
          );
        })}
      </fieldset>
      <Riepilogo ctrl={ctrl} nomeA={nomeA} nomeB={nomeB} />
    </div>
  );
}

/** "Vincono Rossi/Bianchi 2 set a 1": the last thing read before the button. */
export function Riepilogo({ ctrl, nomeA, nomeB }: { ctrl: ControlloRisultato; nomeA: string; nomeB: string }) {
  return (
    <p aria-live="polite" className="min-h-7 text-base">
      {ctrl.vincitore ? (
        <span className="flex items-center gap-2 font-bold">
          <Trophy className="size-5 shrink-0" aria-hidden />
          <span className="tabular">
            Vincono {ctrl.vincitore === 'A' ? nomeA : nomeB} {Math.max(ctrl.setA, ctrl.setB)} set a {Math.min(ctrl.setA, ctrl.setB)}
          </span>
        </span>
      ) : ctrl.globale ? (
        <span className="flex items-center gap-2 text-ink-muted">
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          {ctrl.globale}
        </span>
      ) : null}
    </p>
  );
}

function Stepper({
  label,
  valore,
  max,
  forte,
  disabled,
  describedBy,
  onChange,
  onBlur,
}: {
  label: string;
  valore: number | null;
  max: number;
  forte: boolean;
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
        disabled={disabled || !valore}
        onClick={() => {
          onChange(Math.max(0, (valore ?? 0) - 1));
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
        aria-invalid={valore !== null && valore > max ? true : undefined}
        disabled={disabled}
        value={valore ?? ''}
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
          forte ? 'font-bold' : 'font-normal',
        )}
      />
      <button
        type="button"
        className={btn}
        aria-label={`${label}: più uno`}
        disabled={disabled || (valore ?? 0) >= max}
        onClick={() => {
          onChange(Math.min(max, (valore ?? -1) + 1));
          onBlur();
        }}
      >
        <Plus aria-hidden />
      </button>
    </span>
  );
}
