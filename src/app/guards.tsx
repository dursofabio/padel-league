import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { SkeletonRighe } from '../components/states';
import type { Role } from '../types';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <SkeletonRighe />;
  if (!user) return <Navigate to={`/accedi?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { hasRole, loading } = useAuth();
  if (loading) return <SkeletonRighe />;
  if (!hasRole(...roles))
    return (
      <div className="grid gap-2 py-8">
        <h1 className="text-2xl font-bold">Area riservata</h1>
        <p className="text-ink-muted">Questa sezione è per chi ha il ruolo di {roles.join(' o ')}. Se pensi di averne diritto, chiedi all’amministratore.</p>
      </div>
    );
  return <>{children}</>;
}
