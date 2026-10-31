import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toProfile } from '../data/adapters';
import { qk } from '../data/keys';
import { supabase } from '../data/supabase';
import type { Role, UserProfile } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  /** Effective roles: admin includes all of them. */
  roles: Role[];
  hasRole: (...r: Role[]) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

const ALL_ROLES: Role[] = ['admin', 'organizer', 'manager', 'player'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
      cleanUpUrl();
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  // The profile is created by a database trigger at sign-up: retry briefly if not there yet.
  const profileQuery = useQuery({
    queryKey: qk.me(uid ?? ''),
    enabled: !!uid,
    retry: 3,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid!).single();
      if (error) throw error;
      return toProfile(data);
    },
  });

  const value = useMemo<AuthState>(() => {
    const own = profileQuery.data?.roles ?? [];
    const roles = own.includes('admin') ? ALL_ROLES : own;
    return {
      session,
      user: session?.user ?? null,
      profile: profileQuery.data ?? null,
      roles,
      hasRole: (...r) => r.some((x) => roles.includes(x)),
      loading: !ready || (!!uid && profileQuery.isPending),
      signOut: async () => {
        await supabase.auth.signOut();
        qc.clear();
      },
    };
  }, [session, profileQuery.data, profileQuery.isPending, ready, uid, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** After the PKCE exchange, remove ?code= and go back to the saved route. */
function cleanUpUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('code') && !url.searchParams.has('error_description')) return;
  url.searchParams.delete('code');
  url.searchParams.delete('error');
  url.searchParams.delete('error_code');
  url.searchParams.delete('error_description');
  const next = sessionStorage.getItem('auth:next');
  sessionStorage.removeItem('auth:next');
  url.hash = next ? `#${next}` : url.hash || '#/';
  window.history.replaceState(null, '', url.toString());
}

/** Return URL for OAuth and email links: site base without hash (PKCE puts ?code= there). */
export function redirectBase(next?: string) {
  if (next) sessionStorage.setItem('auth:next', next);
  return window.location.href.split('#')[0].split('?')[0];
}
