import {
  CalendarDays,
  CalendarRange,
  Inbox,
  ListTodo,
  LogIn,
  Menu,
  Settings2,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { useCurrentTournament } from '../app/current-tournament';
import { useAuth } from '../auth/AuthProvider';
import { usePendingRequests, usePlayerRequests } from '../data/queries';
import { useRealtime } from '../data/realtime';
import { isRequestActive } from '../lib/slots';
import { Sheet } from '../ui/sheet';
import { cn } from '../ui/cn';

interface NavEntry {
  to: string;
  label: string;
  /** Shorter label for the mobile tab bar (5 items in 390px). */
  short?: string;
  icon: LucideIcon;
  badge?: number;
  end?: boolean;
}

/**
 * Shell of the "Manifesto" world: a paper top bar with the wordmark, the ink-black bar for navigation
 * (tab bar on mobile, sidebar on desktop) with lime for the active item.
 * Mobile: tab bar at the bottom (at most 5 items, the rest in "Altro"). Desktop: sidebar.
 * The items are the union of the user's roles.
 */
export function AppShell() {
  const { user, profile, hasRole } = useAuth();
  const { tid, tournament } = useCurrentTournament();
  const loc = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const isManager = hasRole('manager');
  const mine = usePlayerRequests(user?.id);
  const pending = usePendingRequests(isManager);
  const toAccept = (mine.data ?? []).filter((r) => r.status === 'pending' && isRequestActive(r) && !r.acceptances[user!.id]).length;
  const toConfirm = (pending.data ?? []).filter((r) => isRequestActive(r)).length;

  const onEvent = useCallback(
    (table: string) => {
      if (table === 'requests') setAnnouncement(isManager ? 'Le richieste sono state aggiornate.' : 'Una tua partita è stata aggiornata.');
    },
    [isManager],
  );
  useRealtime(!!user, onEvent);

  // Title per page (WCAG 2.4.2) and announcement of the new page: pages load lazily, so wait for the h1.
  const [pageTitle, setPageTitle] = useState('');
  useEffect(() => {
    let attempts = 0;
    const t = setInterval(() => {
      const h1 = document.querySelector('main h1')?.textContent?.trim();
      if (h1 || ++attempts > 30) {
        clearInterval(t);
        document.title = h1 ? `${h1} · Padel League` : 'Padel League';
        if (h1) setPageTitle(h1);
      }
    }, 100);
    return () => clearInterval(t);
  }, [loc.pathname]);

  const entries: NavEntry[] = [];
  if (user) entries.push({ to: '/', label: 'Da fare', icon: ListTodo, end: true, badge: toAccept || undefined });
  if (user && tid && hasRole('player')) {
    entries.push({ to: `/t/${tid}/partite`, label: 'Partite', icon: CalendarDays });
    entries.push({ to: `/t/${tid}/disponibilita`, label: 'Disponibilità', short: 'Orari', icon: CalendarRange });
  }
  if (isManager) {
    // one entry: requests / day / recurrences / courts are in the court area's own navigation
    entries.push({ to: '/campo', label: 'Campo', icon: Inbox, badge: toConfirm || undefined });
  }
  if (tid) entries.push({ to: `/t/${tid}`, label: 'Torneo', icon: Trophy, end: true });
  if (tid && hasRole('organizer')) entries.push({ to: `/t/${tid}/organizza`, label: 'Organizza', icon: Settings2 });
  if (hasRole('admin')) entries.push({ to: '/admin/utenti', label: 'Utenti', icon: Users });

  const inBar = entries.length > 5 ? entries.slice(0, 4) : entries;
  const inMore = entries.length > 5 ? entries.slice(4) : [];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-ball focus:px-3 focus:py-2 focus:text-ball-ink">
        Vai al contenuto
      </a>

      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-bar text-bar-ink lg:flex">
        <Brand tournament={tournament?.name} />
        <nav aria-label="Principale" className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="grid gap-0.5">
            {entries.map((v) => (
              <li key={v.to}>
                <NavItem v={v} variant="sidebar" />
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-bar-line px-3 py-3">
          <ProfileLink name={profile?.name} signedIn={!!user} variant="sidebar" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar (mobile/tablet) */}
        <header className="z-30 flex items-center justify-between gap-3 border-b-2 border-line-strong bg-bg px-4 text-ink md:sticky md:top-0 lg:hidden">
          <Brand tournament={tournament?.name} compact />
          <div className="shrink-0">
            <ProfileLink name={profile?.name} signedIn={!!user} variant="topbar" />
          </div>
        </header>

        <main id="main-content" key={loc.pathname} className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          <Outlet />
        </main>

        {/* Tab bar (mobile/tablet) */}
        {entries.length > 1 && (
          <nav aria-label="Principale" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-bar-line bg-bar text-bar-ink lg:hidden">
            <ul className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${inBar.length + (inMore.length ? 1 : 0)}, minmax(0,1fr))` }}>
              {inBar.map((v) => (
                <li key={v.to}>
                  <NavItem v={v} variant="tab" />
                </li>
              ))}
              {inMore.length > 0 && (
                <li>
                  <button
                    onClick={() => setMoreOpen(true)}
                    className="flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold text-bar-ink-muted"
                  >
                    <Menu className="size-6" aria-hidden />
                    Altro
                  </button>
                </li>
              )}
            </ul>
          </nav>
        )}
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="Altro">
        <ul className="court-rule">
          {[...inMore, { to: '/profilo', label: 'Profilo', icon: UserRound }].map((v) => (
            <li key={v.to}>
              <NavLink to={v.to} onClick={() => setMoreOpen(false)} className="flex min-h-12 items-center gap-3 text-base font-semibold">
                <v.icon className="size-5 text-ink" aria-hidden />
                {v.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Sheet>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <p aria-live="polite" className="sr-only">
        {pageTitle && `Pagina: ${pageTitle}`}
      </p>
      <Toaster
        position="bottom-center"
        offset={{ bottom: '1.5rem' }}
        mobileOffset={{ bottom: '5.5rem' }}
        richColors
        closeButton
        toastOptions={{ className: 'font-sans !text-base', style: { fontSize: 'var(--text-base)' } }}
      />
    </div>
  );
}

function Brand({ tournament, compact }: { tournament?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn('flex min-h-14 min-w-0 items-center gap-2.5', !compact && 'px-5 pt-6 pb-4')}>
      <CourtMark />
      <span className="grid min-w-0 gap-0.5">
        <span className={cn('poster', compact ? 'text-xl' : 'text-2xl')}>Padel League</span>
        {tournament && (
          <span className={cn('truncate text-sm leading-tight font-semibold', compact ? 'text-ink-muted' : 'text-bar-ink-muted')}>{tournament}</span>
        )}
      </span>
    </Link>
  );
}

/** Mark: a padel court seen from above (net and service lines) on a lime tile. */
function CourtMark() {
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control border-2 border-edge bg-ball text-ball-ink">
      <svg viewBox="0 0 20 32" className="h-7 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="1" width="18" height="30" rx="1.5" />
        <path d="M1 16h18M10 8.5v15M1 8.5h18M1 23.5h18" />
      </svg>
    </span>
  );
}

function NavItem({ v, variant }: { v: NavEntry; variant: 'tab' | 'sidebar' }) {
  const Icon = v.icon;
  if (variant === 'tab')
    return (
      <NavLink
        to={v.to}
        end={v.end}
        className={({ isActive }) =>
          cn(
            'relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold',
            isActive ? 'text-ball' : 'text-bar-ink-muted hover:text-bar-ink',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span className={cn('relative grid h-8 w-12 place-items-center rounded-full', isActive && 'bg-ball text-ball-ink')}>
              <Icon className="size-6" aria-hidden />
              {v.badge ? <Counter n={v.badge} /> : null}
            </span>
            <span className="max-w-full text-center leading-tight">{v.short ?? v.label}</span>
          </>
        )}
      </NavLink>
    );
  return (
    <NavLink
      to={v.to}
      end={v.end}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-control px-3 text-base font-semibold',
          isActive ? 'bg-ball text-ball-ink' : 'text-bar-ink-muted hover:bg-bar-line hover:text-bar-ink',
        )
      }
    >
      <Icon className="size-5" aria-hidden />
      <span className="flex-1">{v.label}</span>
      {v.badge ? <span className="tabular rounded-full bg-danger px-2 text-sm font-bold text-white">{v.badge}</span> : null}
    </NavLink>
  );
}

function Counter({ n }: { n: number }) {
  return (
    <span className="tabular absolute -top-1.5 -right-1 min-w-5 rounded-full bg-danger px-1 text-center text-xs leading-5 font-bold text-white ring-2 ring-bar">
      {n}
      <span className="sr-only"> da gestire</span>
    </span>
  );
}

function ProfileLink({ name, signedIn, variant }: { name?: string; signedIn: boolean; variant: 'topbar' | 'sidebar' }) {
  if (!signedIn)
    return (
      <Link to="/accedi" className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 font-semibold">
        <LogIn className="size-5" aria-hidden />
        Accedi
      </Link>
    );
  const initials = (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  return (
    <Link
      to="/profilo"
      className={cn('flex min-h-11 items-center gap-2.5 rounded-control', variant === 'sidebar' && 'px-2 hover:bg-bar-line')}
    >
      {variant === 'topbar' && <span className="sr-only">Profilo di {name}</span>}
      <span
        aria-hidden
        className={cn(
          'grid size-11 place-items-center rounded-full text-sm font-bold',
          variant === 'topbar' ? 'bg-court text-court-ink' : 'bg-bar-ink text-bar',
        )}
      >
        {initials}
      </span>
      {variant === 'sidebar' && <span className="truncate font-semibold">{name}</span>}
    </Link>
  );
}
