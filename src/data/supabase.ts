import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/** The publishable key is public by design: security lives in RLS policies and RPC functions. */
export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient<Database>(url || 'http://localhost:54321', key || 'missing-key', {
  auth: {
    // PKCE: the OAuth/email-link code arrives as ?code= before the #, so it doesn't collide with hash routing.
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Calls an RPC and throws the error (mapped later by errors.ts). */
export async function rpc<N extends keyof Database['public']['Functions']>(
  name: N,
  args: Database['public']['Functions'][N]['Args'],
): Promise<Database['public']['Functions'][N]['Returns']> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data;
}
