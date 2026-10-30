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
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTorneoCorrente } from '../app/torneo-corrente';
import { useAuth } from '../auth/AuthProvider';
import { useRichiesteGiocatore, useRichiesteInAttesa } from '../data/queries';
import { useRealtime } from '../data/realtime';
import { richiestaAttiva } from '../lib/slots';
import { Sheet } from '../ui/sheet';
import { cn } from '../ui/cn';

interface Voce {
  to: string;
  label: string;
  /** Shorter label for the mobile tab bar (5 items in 390px). */
  breve?: string;
  icon: LucideIcon;
  badge?: number;
  end?: boolean;
}

/**
 * Shell of the "court lines" world: top bar and sidebar in turf blue, white court lines as dividers.
 * Mobile: tab bar at the bottom (at most 5 items, the rest in "Altro"). Desktop: sidebar.
 * The items are the union of the user's roles.
 */
export function AppShell() {
  const { user, profile, hasRole } = useAuth();
  const { tid, torneo } = useTorneoCorrente();
  const loc = useLocation();
  const [altro, setAltro] = useState(false);
  const [annuncio, setAnnuncio] = useState('');

  const gestore = hasRole('gestore');
  const mie = useRichiesteGiocatore(user?.id);
  const inAttesa = useRichiesteInAttesa(gestore);
  const daAccettare = (mie.data ?? []).filter((r) => r.stato === 'attesa' && richiestaAttiva(r) && !r.accettazioni[user!.id]).length;
  const daConfermare = (inAttesa.data ?? []).filter((r) => richiestaAttiva(r)).length;

  const onEvento = useCallback(
    (tabella: string) => {
      if (tabella === 'richieste') setAnnuncio(gestore ? 'Le richieste sono state aggiornate.' : 'Una tua partita è stata aggiornata.');
    },
    [gestore],
  );
  useRealtime(!!user, onEvento);

  // Title per page (WCAG 2.4.2) and announcement of the new page: pages load lazily, so wait for the h1.
  const [pagina, setPagina] = useState('');
  useEffect(() => {
    let tentativi = 0;
    const t = setInterval(() => {
      const h1 = document.querySelector('main h1')?.textContent?.trim();
      if (h1 || ++tentativi > 30) {
        clearInterval(t);
        document.title = h1 ? `${h1} · Padel League` : 'Padel League';
        if (h1) setPagina(h1);
      }
    }, 100);
    return () => clearInterval(t);
  }, [loc.pathname]);

  const voci: Voce[] = [];
  if (user) voci.push({ to: '/', label: 'Da fare', icon: ListTodo, end: true, badge: daAccettare || undefined });
  if (user && tid && hasRole('giocatore')) {
    voci.push({ to: `/t/${tid}/partite`, label: 'Partite', icon: CalendarDays });
    voci.push({ to: `/t/${tid}/disponibilita`, label: 'Disponibilità', breve: 'Orari', icon: CalendarRange });
  }
  if (gestore) {
    // one entry: Richieste / Giornata / Ricorrenze / Campi are in the court area's own navigation
    voci.push({ to: '/campo', label: 'Campo', icon: Inbox, badge: daConfermare || undefined });
  }
  if (tid) voci.push({ to: `/t/${tid}`, label: 'Torneo', icon: Trophy, end: true });
  if (tid && hasRole('organizzatore')) voci.push({ to: `/t/${tid}/organizza`, label: 'Organizza', icon: Settings2 });
  if (hasRole('admin')) voci.push({ to: '/admin/utenti', label: 'Utenti', icon: Users });

  const inBarra = voci.length > 5 ? voci.slice(0, 4) : voci;
  const inAltro = voci.length > 5 ? voci.slice(4) : [];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#contenuto" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-ball focus:px-3 focus:py-2 focus:text-ball-ink">
        Vai al contenuto
      </a>

      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-court-deep text-court-ink lg:flex">
        <Brand torneo={torneo?.nome} />
        <nav aria-label="Principale" className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="grid gap-0.5">
            {voci.map((v) => (
              <li key={v.to}>
                <NavItem v={v} variante="sidebar" />
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-court-line px-3 py-3">
          <ProfiloLink nome={profile?.nome} loggato={!!user} variante="sidebar" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar (mobile/tablet) */}
        <header className="z-30 flex items-center justify-between gap-3 bg-court px-4 text-court-ink md:sticky md:top-0 lg:hidden">
          <Brand torneo={torneo?.nome} compatto />
          <div className="shrink-0">
            <ProfiloLink nome={profile?.nome} loggato={!!user} variante="topbar" />
          </div>
        </header>

        <main id="contenuto" key={loc.pathname} className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          <Outlet />
        </main>

        {/* Tab bar (mobile/tablet) */}
        {voci.length > 1 && (
          <nav aria-label="Principale" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
            <ul className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${inBarra.length + (inAltro.length ? 1 : 0)}, minmax(0,1fr))` }}>
              {inBarra.map((v) => (
                <li key={v.to}>
                  <NavItem v={v} variante="tab" />
                </li>
              ))}
              {inAltro.length > 0 && (
                <li>
                  <button
                    onClick={() => setAltro(true)}
                    className="flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold text-ink-muted"
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

      <Sheet open={altro} onOpenChange={setAltro} title="Altro">
        <ul className="court-rule">
          {[...inAltro, { to: '/profilo', label: 'Profilo', icon: UserRound }].map((v) => (
            <li key={v.to}>
              <NavLink to={v.to} onClick={() => setAltro(false)} className="flex min-h-12 items-center gap-3 text-base font-semibold">
                <v.icon className="size-5 text-court dark:text-info-ink" aria-hidden />
                {v.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Sheet>

      <p aria-live="polite" className="sr-only">
        {annuncio}
      </p>
      <p aria-live="polite" className="sr-only">
        {pagina && `Pagina: ${pagina}`}
      </p>
      <Toaster
        position="bottom-center"
        offset={{ bottom: '1.5rem' }}
        mobileOffset={{ bottom: '5.5rem' }}
        richColors
        closeButton
        toastOptions={{ className: 'font-sans !text-base', style: { fontSize: '1rem' } }}
      />
    </div>
  );
}

function Brand({ torneo, compatto }: { torneo?: string; compatto?: boolean }) {
  return (
    <Link to="/" className={cn('flex min-h-14 min-w-0 items-center gap-2.5', !compatto && 'px-5 py-4')}>
      <CourtMark />
      <span className="grid min-w-0 leading-tight">
        <span className="text-base font-bold">Padel League</span>
        {torneo && <span className="truncate text-sm text-court-ink-muted">{torneo}</span>}
      </span>
    </Link>
  );
}

/** Mark: a padel court seen from above (net and service lines), in white lines. */
function CourtMark() {
  return (
    <svg viewBox="0 0 20 32" className="h-8 w-5 shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="18" height="30" rx="1.5" />
      <path d="M1 16h18M10 8.5v15M1 8.5h18M1 23.5h18" />
      <circle cx="15" cy="12" r="1.6" fill="var(--ball)" stroke="none" />
    </svg>
  );
}

function NavItem({ v, variante }: { v: Voce; variante: 'tab' | 'sidebar' }) {
  const Icon = v.icon;
  if (variante === 'tab')
    return (
      <NavLink
        to={v.to}
        end={v.end}
        className={({ isActive }) =>
          cn(
            'relative flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold',
            isActive ? 'text-court dark:text-ball' : 'text-ink-muted',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-court dark:bg-ball" />}
            <span className="relative">
              <Icon className="size-6" aria-hidden />
              {v.badge ? <Contatore n={v.badge} /> : null}
            </span>
            <span className="max-w-full text-center leading-tight">{v.breve ?? v.label}</span>
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
          isActive
            ? 'bg-court text-court-ink ring-1 ring-court-line dark:bg-[oklch(0.4_0.1_256)] [&>svg]:text-ball'
            : 'text-court-ink-muted hover:bg-court hover:text-court-ink',
        )
      }
    >
      <Icon className="size-5" aria-hidden />
      <span className="flex-1">{v.label}</span>
      {v.badge ? <span className="tabular rounded-full bg-ball px-2 text-sm text-ball-ink">{v.badge}</span> : null}
    </NavLink>
  );
}

function Contatore({ n }: { n: number }) {
  return (
    <span className="tabular absolute -top-1.5 -right-2.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs leading-5 text-white">
      {n}
      <span className="sr-only"> da gestire</span>
    </span>
  );
}

function ProfiloLink({ nome, loggato, variante }: { nome?: string; loggato: boolean; variante: 'topbar' | 'sidebar' }) {
  if (!loggato)
    return (
      <Link to="/accedi" className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 font-semibold">
        <LogIn className="size-5" aria-hidden />
        Accedi
      </Link>
    );
  const iniziali = (nome ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  return (
    <Link
      to="/profilo"
      className={cn('flex min-h-11 items-center gap-2.5 rounded-control', variante === 'sidebar' && 'px-2 hover:bg-court')}
    >
      {variante === 'topbar' && <span className="sr-only">Profilo di {nome}</span>}
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-court-ink text-sm font-bold text-court-deep">{iniziali}</span>
      {variante === 'sidebar' && <span className="truncate font-semibold">{nome}</span>}
    </Link>
  );
}
