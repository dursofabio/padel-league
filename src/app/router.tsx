import type { ReactNode } from 'react';
import { createHashRouter, Navigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { RequireAuth, RequireRole } from './guards';

/**
 * Hash routing: on GitHub Pages refreshing an inner page doesn't 404.
 * Each area is a lazy chunk: public visitors don't download the organizer's code.
 */
const lazy = (imp: () => Promise<{ default: React.ComponentType }>, wrap?: (c: ReactNode) => ReactNode) => async () => {
  const { default: C } = await imp();
  return { Component: () => <>{wrap ? wrap(<C />) : <C />}</> };
};
const auth = (c: ReactNode) => <RequireAuth>{c}</RequireAuth>;
const ruolo = (...r: Parameters<typeof RequireRole>[0]['roles']) => (c: ReactNode) => (
  <RequireAuth>
    <RequireRole roles={r}>{c}</RequireRole>
  </RequireAuth>
);

export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, lazy: lazy(() => import('../features/home/HomePage')) },
      { path: 'accedi', lazy: lazy(() => import('../features/auth/AccediPage')) },
      { path: 'profilo', lazy: lazy(() => import('../features/profile/ProfiloPage'), auth) },
      { path: 'invito/:token', lazy: lazy(() => import('../features/invite/InvitoPage')) },
      { path: 't/:tid', lazy: lazy(() => import('../features/public/TorneoPage')) },
      { path: 't/:tid/classifiche', lazy: lazy(() => import('../features/public/ClassifichePage')) },
      { path: 't/:tid/calendario', lazy: lazy(() => import('../features/public/CalendarioPage')) },
      { path: 't/:tid/tabellone/:fase', lazy: lazy(() => import('../features/public/TabellonePage')) },
      { path: 't/:tid/partite', lazy: lazy(() => import('../features/player/matches/PartitePage'), auth) },
      { path: 't/:tid/partite/:mid', lazy: lazy(() => import('../features/player/matches/PartitaPage'), auth) },
      { path: 't/:tid/disponibilita', lazy: lazy(() => import('../features/player/availability/DisponibilitaPage'), auth) },
      { path: 't/:tid/coppia', lazy: lazy(() => import('../features/player/team/CoppiaPage'), auth) },
      { path: 't/:tid/organizza/:sezione?', lazy: lazy(() => import('../features/organizer/OrganizzaPage'), ruolo('organizzatore')) },
      { path: 'campo', lazy: lazy(() => import('../features/gestore/RichiestePage'), ruolo('gestore')) },
      { path: 'campo/giorno/:data?', lazy: lazy(() => import('../features/gestore/GiornataPage'), ruolo('gestore')) },
      { path: 'campo/ricorrenze', lazy: lazy(() => import('../features/gestore/RicorrenzePage'), ruolo('gestore')) },
      { path: 'campo/impostazioni', lazy: lazy(() => import('../features/gestore/ImpostazioniPage'), ruolo('gestore')) },
      { path: 'admin/utenti', lazy: lazy(() => import('../features/admin/UtentiPage'), ruolo('admin')) },
      ...(import.meta.env.DEV ? [{ path: '_kit', lazy: lazy(() => import('../dev/KitPage')) }] : []),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
