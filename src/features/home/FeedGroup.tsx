import { AlarmClock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { describeDeadline, type AttentionItem, type AttentionKind } from '../../lib/attention';
import { labelDate } from '../../lib/time';
import { cn } from '../../ui/cn';
import { rowText, type RowContext } from './content';

/**
 * Repeated feed items as one block with the list inside: matches to schedule on paper,
 * availability periods on clay. Each line opens its screen.
 */
export function FeedGroup({
  kind,
  items,
  ctx,
  now,
  more,
}: {
  kind: AttentionKind;
  items: AttentionItem[];
  ctx: RowContext;
  now: number;
  /** The first item of the same kind is shown on its own above ("altre"). */
  more: boolean;
}) {
  const n = items.length;
  const availability = kind === 'set-availability';
  const title = availability
    ? `Segna le disponibilità di ${n} periodi`
    : `Programma ${more ? 'altre ' : ''}${n} partite`;
  const text = availability
    ? 'Così l’app trova gli orari che vanno bene a tutti e quattro.'
    : 'Scegli un orario che vada bene a tutti e quattro.';
  return (
    <div
      className={cn(
        'grid gap-2 rounded-panel border-2 p-4 sm:p-5',
        availability ? 'border-edge bg-clay text-clay-ink' : 'border-line-strong bg-surface text-ink',
      )}
    >
      <p className="poster text-xl leading-tight">{title}</p>
      <p className="font-semibold">{text}</p>
      <ul className={cn('grid', availability ? 'divide-y divide-edge/25' : 'court-rule')}>
        {items.map((it) => {
          const t = rowText(it, ctx);
          const per = it.refs.periodId ? ctx.periodById.get(it.refs.periodId) : undefined;
          const label = availability && per ? `${per.label}: ${labelDate(per.startsOn)} – ${labelDate(per.endsOn)}` : t.teams;
          const deadline = it.deadline ? describeDeadline(it.deadline, now) : null;
          const to = it.action.type === 'navigate' ? it.action.to : `/t/${ctx.tid}/partite/${it.refs.matchId}`;
          return (
            <li key={it.id}>
              <Link
                to={to}
                className={cn(
                  '-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-control px-2 py-2.5',
                  availability ? 'hover:bg-clay-strong' : 'hover:bg-surface-2',
                )}
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className="tabular font-bold break-words">{label}</span>
                  {deadline && (
                    <span
                      className={cn(
                        'tabular flex items-center gap-1.5 text-sm font-bold',
                        it.priority === 0 ? (availability ? 'underline' : 'text-danger-ink') : !availability && 'text-ink-muted',
                      )}
                    >
                      <AlarmClock className="size-4 shrink-0" aria-hidden />
                      {deadline}
                    </span>
                  )}
                  <span className="sr-only">, {t.action}</span>
                </span>
                <ChevronRight className="size-6 shrink-0" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
