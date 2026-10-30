import { CircleCheck, OctagonAlert, TriangleAlert, X } from 'lucide-react';
import { TONO_CLASSI } from '../../components/StatusBadge';
import { cn } from '../../ui';
import type { EsitoMessaggio } from './logic';

const ICONA = { ok: CircleCheck, warn: TriangleAlert, danger: OctagonAlert } as const;

/**
 * Outcome banner of the last action (confirm, close day, apply recurrence): stays until dismissed,
 * announced politely to screen readers. Icon + text + tone, never colour alone.
 */
export function Esito({ esito, onChiudi }: { esito: EsitoMessaggio | null; onChiudi: () => void }) {
  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      {esito && (
        <div className={cn('mb-5 flex items-start gap-3 rounded-panel p-3 pl-4', TONO_CLASSI[esito.tono])}>
          {(() => {
            const Icon = ICONA[esito.tono];
            return <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />;
          })()}
          <p className="flex-1 font-semibold">{esito.testo}</p>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi il messaggio"
            className="-my-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-control hover:bg-surface/60"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
