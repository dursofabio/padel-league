import { toast } from 'sonner';
import { errorMessage } from '../../../data/errors';
import { useAction } from '../../../data/mutations';
import { errorFromHint } from './logic';

/**
 * useAction with the match brief's error copy (by hint) and per-call callbacks.
 * The shared toast is turned off and replaced by the local mapping.
 */
export function useMatchAction<A, R>(fn: (a: A) => Promise<R>, success?: string, step?: number) {
  const m = useAction(fn, { success, error: false });
  const run = (a: A, cb?: { onSuccess?: (r: R) => void; onError?: (e: unknown) => void }) =>
    m.mutate(a, {
      onSuccess: (r) => cb?.onSuccess?.(r),
      onError: (e) => {
        toast.error(errorFromHint(e, step) ?? errorMessage(e));
        cb?.onError?.(e);
      },
    });
  return { run, isPending: m.isPending };
}

export function hintOf(e: unknown): string | undefined {
  return (e as { hint?: string } | null)?.hint;
}
