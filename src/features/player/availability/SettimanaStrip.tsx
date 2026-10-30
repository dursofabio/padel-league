import { Plus } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { etichettaFascia, settimane } from '../../../lib/fasce';
import { addDays, labelDate } from '../../../lib/time';
import type { Campo, Fasce } from '../../../types';
import { cn } from '../../../ui';
import { ColonnaTempo } from './LineaTempo';

const INTESTAZIONI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/**
 * Vista settimana (desktop): 7 colonne lun–dom, tempo dall'alto in basso.
 * Ogni giorno è un pulsante che apre la modifica; frecce per spostarsi tra i giorni (±1, ±7), Invio per aprire.
 */
export function SettimanaStrip({
  giorni,
  fasce,
  campi,
  oggi,
  selezionato,
  onApri,
}: {
  giorni: string[];
  fasce: Fasce;
  campi: Campo[];
  oggi: string;
  selezionato: string | null;
  onApri: (data: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const weeks = settimane(giorni);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const da = (e.target as HTMLElement).dataset.giorno;
    if (!da) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!delta) return;
    const btn = ref.current?.querySelector<HTMLButtonElement>(`[data-giorno="${addDays(da, delta)}"]`);
    if (btn) {
      e.preventDefault();
      btn.focus();
    }
  };

  return (
    <div ref={ref} onKeyDown={onKeyDown} className="grid gap-6">
      {weeks.map((w) => {
        const primo = w.find(Boolean)!;
        return (
          <div key={primo} role="group" aria-label={`Settimana dal ${labelDate(primo)}`} className="grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] gap-2">
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
                    <p className="flex min-h-10 items-end text-sm text-ink-muted">{INTESTAZIONI[i]}</p>
                    <div aria-hidden className="h-72 rounded-control border border-dashed border-line" />
                  </div>
                );
              const lista = fasce[d] ?? [];
              const descr = lista.length ? lista.map(etichettaFascia).join(', ') : 'nessun orario';
              return (
                <button
                  key={d}
                  type="button"
                  data-giorno={d}
                  onClick={() => onApri(d)}
                  aria-label={`${labelDate(d)}${d === oggi ? ', oggi' : ''}: ${descr}. Aggiungi o modifica`}
                  className={cn(
                    'group grid content-start gap-2 rounded-control text-left',
                    selezionato === d && 'outline-2 outline-offset-4 outline-court dark:outline-ball',
                  )}
                >
                  <span className="flex min-h-10 flex-col justify-end">
                    <span className="tabular text-sm font-bold group-hover:underline">{labelDate(d)}</span>
                    {d === oggi && <span className="text-xs font-semibold text-court dark:text-info-ink">oggi</span>}
                  </span>
                  <ColonnaTempo data={d} fasce={lista} campi={campi} />
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
