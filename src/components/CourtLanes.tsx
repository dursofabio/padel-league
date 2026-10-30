/**
 * Signature of the "court lines" direction: a day drawn as parallel court lanes, one per court.
 * Time runs top to bottom, start times sit on the lines, so the 30' stagger between Court 1 and
 * Court 2 is visible. Used by the match slot grid and by the court manager's timeline.
 */
import type { CSSProperties, ReactNode } from 'react';
import { fromMin, toMin } from '../lib/time';
import type { Campo } from '../types';
import { cn } from '../ui/cn';

export interface LanesScala {
  /** First minute shown (e.g. 13:00 → 780). */
  da: number;
  /** Last minute shown. */
  a: number;
  /** Pixels per minute. */
  px: number;
}

/** Visible range from the courts' grid, rounded to the hour, plus a margin. */
export function scalaDaCampi(campi: Campo[], px = 0.8, extra?: { da?: string; a?: string }): LanesScala {
  const inizi = campi.map((c) => toMin(c.primoSlot));
  const fini = campi.map((c) => toMin(c.ultimoSlot) + c.durata);
  let da = Math.min(...inizi, extra?.da ? toMin(extra.da) : Infinity);
  let a = Math.max(...fini, extra?.a ? toMin(extra.a) : -Infinity);
  if (!Number.isFinite(da)) da = 8 * 60;
  if (!Number.isFinite(a)) a = 23 * 60;
  return { da: Math.floor(da / 60) * 60, a: Math.min(24 * 60, Math.ceil(a / 60) * 60), px };
}

/** Absolute position of an interval inside a lane. */
export function posizione(scala: LanesScala, inizio: string, fine: string): CSSProperties {
  const a = Math.max(scala.da, toMin(inizio));
  const b = Math.min(scala.a, toMin(fine));
  return { top: (a - scala.da) * scala.px, height: Math.max(20, (b - a) * scala.px) };
}

export function CourtLanes({
  campi,
  scala,
  renderLane,
  caption,
  className,
  oraCorrente,
  stickyTop,
}: {
  /** Court names stay visible while scrolling (CSS top offset, e.g. '0px' or '3.5rem'). */
  stickyTop?: string;
  campi: Campo[];
  scala: LanesScala;
  /** Blocks (absolutely positioned with `posizione`) of one court's lane. */
  renderLane: (campo: Campo) => ReactNode;
  caption?: ReactNode;
  className?: string;
  /** "Now" line (minute of the day), only today. */
  oraCorrente?: number;
}) {
  const altezza = (scala.a - scala.da) * scala.px;
  const ore: number[] = [];
  for (let m = scala.da; m <= scala.a; m += 60) ore.push(m);
  return (
    <figure className={cn('grid gap-2', className)}>
      {caption && <figcaption className="text-base font-bold">{caption}</figcaption>}
      <div
        className="grid gap-x-1.5"
        style={{ gridTemplateColumns: `2.75rem repeat(${campi.length}, minmax(0, 1fr))` }}
      >
        <div aria-hidden />
        {campi.map((c) => (
          <div
            key={c.id}
            className={cn('rounded-t-control bg-court px-2 py-1.5 text-center text-sm font-bold text-court-ink', stickyTop && 'sticky z-20')}
            style={stickyTop ? { top: stickyTop } : undefined}
          >
            {c.nome}
          </div>
        ))}
        <div className="relative" style={{ height: altezza }} aria-hidden>
          {ore.map((m) => (
            <span
              key={m}
              className="tabular absolute right-1 -translate-y-1/2 text-sm text-ink-muted"
              style={{ top: (m - scala.da) * scala.px }}
            >
              {fromMin(m)}
            </span>
          ))}
        </div>
        {campi.map((c) => (
          <div
            key={c.id}
            role="list"
            aria-label={c.nome}
            className="relative rounded-b-control border-x border-b border-line bg-surface-2"
            style={{
              height: altezza,
              // court lines: one line every 30 minutes, start times sit on the lines
              backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${30 * scala.px}px)`,
              backgroundPosition: `0 0`,
            }}
          >
            {renderLane(c)}
            {oraCorrente !== undefined && oraCorrente >= scala.da && oraCorrente <= scala.a && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger"
                style={{ top: (oraCorrente - scala.da) * scala.px }}
              />
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}

/**
 * Block positioned in a lane (slot, occupation, request). Tone + icon + text: never colour alone.
 * `pattern`: 'hatch' for occupied courts, 'dots' for slots with few players free.
 */
export function LaneBlock({
  scala,
  inizio,
  fine,
  tono,
  pattern,
  selezionato,
  children,
  onClick,
  ariaLabel,
  className,
  sfalsato,
  buttonProps,
}: {
  scala: LanesScala;
  inizio: string;
  fine: string;
  tono: 'ok' | 'warn' | 'danger' | 'info' | 'idle' | 'court';
  pattern?: 'hatch' | 'dots' | 'cross';
  selezionato?: boolean;
  children: ReactNode;
  onClick?: () => void;
  /** Must begin with the visible text (voice control): e.g. "14:00, Campo 2, tutti e 4 liberi". */
  ariaLabel?: string;
  className?: string;
  /** Narrower block (e.g. an occupation on top of a grid slot). */
  sfalsato?: boolean;
  /** Extra props for the inner button (ref, tabIndex, onKeyDown, data-*). */
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> };
}) {
  const toni = {
    ok: 'bg-ok-soft text-ok-ink border-ok',
    warn: 'bg-warn-soft text-warn-ink border-warn',
    danger: 'bg-danger-soft text-danger-ink border-danger',
    info: 'bg-info-soft text-info-ink border-info',
    idle: 'bg-surface text-idle-ink border-line-strong',
    court: 'bg-court text-court-ink border-court-deep',
  } as const;
  const cls = cn(
    'block h-full w-full overflow-hidden rounded-[6px] border px-2 py-1 text-left text-sm leading-tight',
    toni[tono],
    pattern === 'hatch' && 'pattern-hatch',
    pattern === 'dots' && 'pattern-dots',
    pattern === 'cross' && 'pattern-cross',
    // selection: court-blue outline (contrast) with the ball halo (identity)
    selezionato && 'relative z-10 outline-2 outline-offset-1 outline-court-deep shadow-[0_0_0_5px_var(--ball)] dark:outline-ball',
    onClick && 'cursor-pointer transition-[filter] duration-150 hover:brightness-[0.97] dark:hover:brightness-110',
    className,
  );
  return (
    <div role="listitem" className={cn('absolute', sfalsato ? 'right-1 left-3' : 'inset-x-1', selezionato && 'z-10')} style={posizione(scala, inizio, fine)}>
      {onClick ? (
        <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel} aria-pressed={selezionato} {...buttonProps}>
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
