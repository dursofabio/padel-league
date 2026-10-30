import { RotateCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { messaggioErrore } from '../data/errors';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/misc';

/** Skeleton that follows the layout of a list of rows. */
export function SkeletonRighe({ righe = 4 }: { righe?: number }) {
  return (
    <div className="grid gap-3" role="status" aria-label="Caricamento">
      {Array.from({ length: righe }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Empty state that teaches: what it means and what to do. */
export function EmptyState({ titolo, testo, azione }: { titolo: string; testo?: ReactNode; azione?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-2 py-6">
      <p className="text-lg font-bold">{titolo}</p>
      {testo && <p className="max-w-prose text-ink-muted">{testo}</p>}
      {azione && <div className="pt-1">{azione}</div>}
    </div>
  );
}

export function ErrorState({ errore, onRiprova }: { errore: unknown; onRiprova?: () => void }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div role="alert" className="grid justify-items-start gap-3 rounded-panel bg-danger-soft p-4 text-danger-ink">
      <p className="flex items-center gap-2 font-semibold">
        {offline && <WifiOff className="size-5" aria-hidden />}
        {offline ? 'Sei offline: i dati non sono aggiornati.' : messaggioErrore(errore)}
      </p>
      {onRiprova && (
        <Button variant="danger" size="sm" onClick={onRiprova}>
          <RotateCw aria-hidden /> Riprova
        </Button>
      )}
    </div>
  );
}

/** Loading → error → empty → content, in one place. */
export function QueryState<T>({
  isPending,
  error,
  data,
  onRiprova,
  vuoto,
  skeleton,
  children,
}: {
  isPending: boolean;
  error: unknown;
  data: T | undefined | null;
  onRiprova?: () => void;
  vuoto?: (d: T) => ReactNode | null;
  skeleton?: ReactNode;
  children: (d: T) => ReactNode;
}) {
  if (isPending) return <>{skeleton ?? <SkeletonRighe />}</>;
  if (error) return <ErrorState errore={error} onRiprova={onRiprova} />;
  if (data === undefined || data === null) return null;
  const empty = vuoto?.(data);
  if (empty) return <>{empty}</>;
  return <>{children(data)}</>;
}
