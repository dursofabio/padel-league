import { toast } from 'sonner';
import { messaggioErrore } from '../../../data/errors';
import { useAzione } from '../../../data/mutations';
import { erroreDaHint } from './logica';

/**
 * useAzione with the match brief's error copy (by hint) and per-call callbacks.
 * The shared toast is turned off and replaced by the local mapping.
 */
export function useAzionePartita<A, R>(fn: (a: A) => Promise<R>, successo?: string, passo?: number) {
  const m = useAzione(fn, { successo, errore: false });
  const esegui = (a: A, cb?: { onSuccess?: (r: R) => void; onError?: (e: unknown) => void }) =>
    m.mutate(a, {
      onSuccess: (r) => cb?.onSuccess?.(r),
      onError: (e) => {
        toast.error(erroreDaHint(e, passo) ?? messaggioErrore(e));
        cb?.onError?.(e);
      },
    });
  return { esegui, isPending: m.isPending };
}

export function hintDi(e: unknown): string | undefined {
  return (e as { hint?: string } | null)?.hint;
}
