import { CalendarDays, Inbox, Repeat, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../ui';

const VOCI: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/campo', label: 'Richieste', icon: Inbox, end: true },
  { to: '/campo/giorno', label: 'Giornata', icon: CalendarDays },
  { to: '/campo/ricorrenze', label: 'Ricorrenze', icon: Repeat },
  { to: '/campo/impostazioni', label: 'Campi', icon: SlidersHorizontal },
];

/** Sub-navigation shared by the four court manager screens (same look as Tabs, but real links). */
export function GestoreNav() {
  return (
    <nav aria-label="Sezioni del campo" className="mb-5">
      <ul className="flex gap-1 overflow-x-auto border-b border-line">
        {VOCI.map((v) => (
          <li key={v.to}>
            <NavLink
              to={v.to}
              end={v.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-base font-semibold whitespace-nowrap',
                  isActive
                    ? 'border-court text-ink dark:border-ball'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )
              }
            >
              <v.icon className="size-4" aria-hidden />
              {v.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
