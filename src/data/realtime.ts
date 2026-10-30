import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { INVALIDA_PER_TABELLA } from './keys';
import { supabase } from './supabase';

/**
 * One realtime channel for the whole app: every change invalidates the related queries
 * (debounced to 250ms). The server stays the truth: no cache patching.
 * Realtime respects RLS: everyone receives only what they can read.
 */
export function useRealtime(enabled: boolean, onEvento?: (tabella: string) => void) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      for (const t of pending) for (const key of INVALIDA_PER_TABELLA[t] ?? []) qc.invalidateQueries({ queryKey: key });
      pending.clear();
    };
    const channel = supabase.channel('app');
    for (const table of Object.keys(INVALIDA_PER_TABELLA)) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        pending.add(table);
        onEvento?.(table);
        clearTimeout(timer);
        timer = setTimeout(flush, 250);
      });
    }
    channel.subscribe((status) => {
      // after a reconnection, refetch everything that is on screen
      if (status === 'SUBSCRIBED') qc.invalidateQueries({ refetchType: 'active' });
    });
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, qc, onEvento]);
}
