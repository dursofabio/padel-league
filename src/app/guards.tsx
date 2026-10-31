import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { SkeletonRows } from '../components/states';
import { ROLE_LABEL } from '../lib/copy';
import type { Role } from '../types';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <SkeletonRows />;
  if (!user) return <Navigate to={`/accedi?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { hasRole, loading } = useAuth();
  if (loading) return <SkeletonRows />;
  if (!hasRole(...roles))
    return (
      <div className="grid gap-2 py-8">
        <h1 className="text-2xl font-bold">Area riservata</h1>
        <p className="text-ink-muted">
          Questa sezione è per chi ha il ruolo di {roles.map((r) => ROLE_LABEL[r]).join(' o ')}. Se pensi di averne diritto, chiedi
          all’amministratore.
        </p>
      </div>
    );
  return <>{children}</>;
}
