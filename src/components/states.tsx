import { RotateCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '../data/errors';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/misc';

/** Skeleton that follows the layout of a list of rows. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3" role="status" aria-label="Caricamento">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Empty state that teaches: what it means and what to do. */
export function EmptyState({ title, text, action }: { title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-2 py-6">
      <p className="text-lg font-bold">{title}</p>
      {text && <p className="max-w-prose text-ink-muted">{text}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div role="alert" className="grid justify-items-start gap-3 rounded-panel border-2 border-danger bg-danger-soft p-4 text-danger-ink">
      <p className="flex items-center gap-2 font-semibold">
        {offline && <WifiOff className="size-5" aria-hidden />}
        {offline ? 'Sei offline: i dati non sono aggiornati.' : errorMessage(error)}
      </p>
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry}>
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
  onRetry,
  empty,
  skeleton,
  children,
}: {
  isPending: boolean;
  error: unknown;
  data: T | undefined | null;
  onRetry?: () => void;
  empty?: (d: T) => ReactNode | null;
  skeleton?: ReactNode;
  children: (d: T) => ReactNode;
}) {
  if (isPending) return <>{skeleton ?? <SkeletonRows />}</>;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (data === undefined || data === null) return null;
  const emptyContent = empty?.(data);
  if (emptyContent) return <>{emptyContent}</>;
  return <>{children(data)}</>;
}
