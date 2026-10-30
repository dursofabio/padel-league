import { useMemo } from 'react';
import { etichettaFascia, percentualeGiornata } from '../../../lib/fasce';
import { slotGriglia } from '../../../lib/slots';
import { parseFascia } from '../../../lib/time';
import type { Campo } from '../../../types';
import { cn } from '../../../ui';

/** Inizi degli slot dei campi in quel giorno: il campo (0/1) decide in quale metà della linea cade la tacca. */
function useTacche(campi: Campo[], data: string) {
  return useMemo(
    () => campi.flatMap((c, i) => slotGriglia(c, data).map((s) => ({ key: `${c.id}-${s.inizio}`, inizio: s.inizio, lato: i % 2 }))),
    [campi, data],
  );
}

/**
 * Linea del tempo 08–24 di un giorno: le fasce come tratti blu, gli inizi degli slot come tacche alternate
 * (lo sfalsamento dei due campi). Decorativa: le stesse informazioni sono nei chip.
 */
export function LineaTempo({ data, fasce, campi }: { data: string; fasce: string[]; campi: Campo[] }) {
  const tacche = useTacche(campi, data);
  return (
    <div aria-hidden className="grid gap-1">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-2" />
        {fasce.map((f) => {
          const [a, b] = parseFascia(f);
          const x = percentualeGiornata(a);
          return (
            <div
              key={f}
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-court"
              style={{ left: `${x}%`, width: `${percentualeGiornata(b) - x}%` }}
            />
          );
        })}
        {tacche.map((t) => (
          <span
            key={t.key}
            className={cn('absolute h-1/2 w-px bg-ink-muted/60', t.lato ? 'top-1/2' : 'top-0')}
            style={{ left: `${percentualeGiornata(t.inizio)}%` }}
          />
        ))}
      </div>
      <div className="tabular hidden justify-between text-xs text-ink-muted md:flex">
        <span>08</span>
        <span>12</span>
        <span>16</span>
        <span>20</span>
        <span>24</span>
      </div>
    </div>
  );
}

/** Variante verticale per la vista settimana (desktop): il tempo scorre dall'alto in basso. */
export function ColonnaTempo({ data, fasce, campi }: { data: string; fasce: string[]; campi: Campo[] }) {
  const tacche = useTacche(campi, data);
  return (
    <div aria-hidden className="relative h-72 w-full overflow-hidden rounded-control bg-surface-2">
      {[12, 16, 20].map((h) => (
        <span key={h} className="absolute inset-x-0 h-px bg-line" style={{ top: `${((h - 8) / 16) * 100}%` }} />
      ))}
      {fasce.map((f) => {
        const [a, b] = parseFascia(f);
        const y = percentualeGiornata(a);
        const h = percentualeGiornata(b) - y;
        return (
          <div
            key={f}
            className="tabular absolute inset-x-1 overflow-hidden rounded-[6px] bg-court px-1 pt-0.5 text-xs font-semibold text-court-ink"
            style={{ top: `${y}%`, height: `${h}%` }}
          >
            {h >= 12 ? etichettaFascia(f) : null}
          </div>
        );
      })}
      {tacche.map((t) => (
        <span
          key={t.key}
          className={cn('absolute h-px w-1/4 bg-ink-muted/60', t.lato ? 'right-0' : 'left-0')}
          style={{ top: `${percentualeGiornata(t.inizio)}%` }}
        />
      ))}
    </div>
  );
}
