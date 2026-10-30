import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, db } from '../firebase';
import type { Role, UserProfile } from '../types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const Ctx = createContext<AuthState>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsubProfile?.();
      if (!user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        // primo accesso: profilo da giocatore. Il primo admin si imposta a mano dalla console Firebase.
        await setDoc(ref, {
          nome: user.displayName ?? user.email?.split('@')[0] ?? 'Giocatore',
          email: user.email ?? '',
          telefono: '',
          role: 'giocatore',
        });
      }
      unsubProfile = onSnapshot(ref, (s) =>
        setState({ user, profile: s.exists() ? ({ id: s.id, ...s.data() } as UserProfile) : null, loading: false }),
      );
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

export function hasRole(profile: UserProfile | null, ...roles: Role[]): boolean {
  return !!profile && (profile.role === 'admin' || roles.includes(profile.role));
}
