import type { ReactNode } from 'react';
import { createHashRouter, Navigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { RequireAuth, RequireRole } from './guards';

/**
 * Hash routing: on GitHub Pages refreshing an inner page doesn't 404.
 * Each area is a lazy chunk: public visitors don't download the organizer's code.
 * Route paths are Italian (visible and shared); params and code are English.
 */
const lazy = (imp: () => Promise<{ default: React.ComponentType }>, wrap?: (c: ReactNode) => ReactNode) => async () => {
  const { default: C } = await imp();
  return { Component: () => <>{wrap ? wrap(<C />) : <C />}</> };
};
const auth = (c: ReactNode) => <RequireAuth>{c}</RequireAuth>;
const role = (...r: Parameters<typeof RequireRole>[0]['roles']) => (c: ReactNode) => (
  <RequireAuth>
    <RequireRole roles={r}>{c}</RequireRole>
  </RequireAuth>
);

export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, lazy: lazy(() => import('../features/home/HomePage')) },
      { path: 'accedi', lazy: lazy(() => import('../features/auth/SignInPage')) },
      { path: 'profilo', lazy: lazy(() => import('../features/profile/ProfilePage'), auth) },
      { path: 'invito/:token', lazy: lazy(() => import('../features/invite/InvitePage')) },
      { path: 't/:tid', lazy: lazy(() => import('../features/public/TournamentPage')) },
      { path: 't/:tid/classifiche', lazy: lazy(() => import('../features/public/StandingsPage')) },
      { path: 't/:tid/calendario', lazy: lazy(() => import('../features/public/SchedulePage')) },
      { path: 't/:tid/tabellone/:phase', lazy: lazy(() => import('../features/public/BracketPage')) },
      { path: 't/:tid/partite', lazy: lazy(() => import('../features/player/matches/MatchesPage'), auth) },
      { path: 't/:tid/partite/:mid', lazy: lazy(() => import('../features/player/matches/MatchPage'), auth) },
      { path: 't/:tid/disponibilita', lazy: lazy(() => import('../features/player/availability/AvailabilityPage'), auth) },
      { path: 't/:tid/coppia', lazy: lazy(() => import('../features/player/team/TeamPage'), auth) },
      { path: 't/:tid/organizza/:section?', lazy: lazy(() => import('../features/organizer/OrganizerPage'), role('organizer')) },
      { path: 'campo', lazy: lazy(() => import('../features/manager/RequestsPage'), role('manager')) },
      { path: 'campo/giorno/:date?', lazy: lazy(() => import('../features/manager/DayPage'), role('manager')) },
      { path: 'campo/ricorrenze', lazy: lazy(() => import('../features/manager/RecurrencesPage'), role('manager')) },
      { path: 'campo/impostazioni', lazy: lazy(() => import('../features/manager/SettingsPage'), role('manager')) },
      { path: 'admin/utenti', lazy: lazy(() => import('../features/admin/UsersPage'), role('admin')) },
      ...(import.meta.env.DEV ? [{ path: '_kit', lazy: lazy(() => import('../dev/KitPage')) }] : []),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
