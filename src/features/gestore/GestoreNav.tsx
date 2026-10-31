import { CalendarDays, Inbox, Repeat, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router';
import { cn } from '../../ui';

const VOCI: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/campo', label: 'Richieste', icon: Inbox, end: true },
  { to: '/campo/giorno', label: 'Giornata', icon: CalendarDays },
  { to: '/campo/ricorrenze', label: 'Ricorrenze', icon: Repeat },
  { to: '/campo/impostazioni', label: 'Campi', icon: SlidersHorizontal },
];

/** Sub-navigation shared by the four court manager screens (same look as Tabs, but real links). */
export function GestoreNav() {
  const lista = useRef<HTMLUListElement>(null);
  const { pathname } = useLocation();
  // on narrow phones the strip scrolls: keep the current section in view
  useEffect(() => {
    lista.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [pathname]);
  return (
    <nav aria-label="Sezioni del campo" className="mb-5">
      <ul
        ref={lista}
        className="flex gap-0.5 overflow-x-auto border-b border-line [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] sm:[mask-image:none]"
      >
        {VOCI.map((v) => (
          <li key={v.to}>
            <NavLink
              to={v.to}
              end={v.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-2.5 text-base font-semibold whitespace-nowrap',
                  isActive
                    ? 'border-court text-ink dark:border-ball'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )
              }
            >
              <v.icon className="hidden size-4 sm:block" aria-hidden />
              {v.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
