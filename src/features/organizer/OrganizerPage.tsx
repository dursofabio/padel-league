import { CalendarDays, CalendarRange, LayoutDashboard, ListChecks, Settings2, Trophy, Users, type LucideIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, type ComponentType } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/states';
import { useTournamentData } from '../../data/queries';
import { TOURNAMENT_STATUS_LABEL } from '../../lib/copy';
import { today } from '../../lib/time';
import { cn } from '../../ui';
import { exceptions, SECTIONS, validSection, type SectionId } from './logic';
import type { SectionProps } from './types';

const COMPONENTS: Record<SectionId, ComponentType<SectionProps>> = {
  panoramica: lazy(() => import('./Overview')),
  configurazione: lazy(() => import('./Settings')),
  periodi: lazy(() => import('./Periods')),
  squadre: lazy(() => import('./Teams')),
  calendario: lazy(() => import('./Schedule')),
  monitoraggio: lazy(() => import('./Monitoring')),
  finali: lazy(() => import('./Finals')),
};

const ICONS: Record<SectionId, LucideIcon> = {
  panoramica: LayoutDashboard,
  configurazione: Settings2,
  periodi: CalendarRange,
  squadre: Users,
  calendario: CalendarDays,
  monitoraggio: ListChecks,
  finali: Trophy,
};

/** Organizer area: one route, a section list (sidebar on desktop, scrollable tabs on mobile), one lazy section. */
export default function OrganizerPage() {
  const { tid, section: param } = useParams();
  const section = validSection(param);
  const d = useTournamentData(tid);

  const counts = useMemo(() => {
    const e = exceptions(d.matches, d.periods, today());
    return {
      squadre: d.teams.filter((t) => t.status === 'pending_approval').length,
      monitoraggio: e.disputed.length + e.late.length,
    } as Partial<Record<SectionId, number>>;
  }, [d.matches, d.periods, d.teams]);

  // on narrow screens the tab strip scrolls: keep the current section in view
  const active = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    active.current?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [section]);

  const entry = SECTIONS.find((s) => s.id === section)!;
  const Content = COMPONENTS[section];

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Sezioni di Organizza" className="-mx-4 mb-5 border-b border-line md:-mx-6 lg:mx-0 lg:mb-0 lg:border-b-0">
        <ul className="flex gap-1 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] md:px-6 lg:[mask-image:none] lg:sticky lg:top-8 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0">
          {SECTIONS.map((s) => {
            const Icon = ICONS[s.id];
            const n = counts[s.id];
            return (
              <li key={s.id} className="shrink-0">
                <Link
                  ref={s.id === section ? active : undefined}
                  to={`/t/${tid}/organizza/${s.id}`}
                  aria-current={s.id === section ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 text-base font-semibold whitespace-nowrap text-ink-muted hover:text-ink',
                    'lg:rounded-control lg:border-b-0 lg:hover:bg-surface-2',
                    s.id === section && 'border-court text-ink dark:border-ball lg:bg-court lg:text-court-ink lg:hover:bg-court-deep',
                  )}
                >
                  <Icon className="hidden size-5 shrink-0 lg:block" aria-hidden />
                  <span className="flex-1">{s.label}</span>
                  {!!n && (
                    <span className="tabular rounded-full bg-warn-soft px-2 text-sm text-warn-ink">
                      {n}
                      <span className="sr-only"> da gestire</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        <PageHeader
          title={entry.label}
          subtitle={d.tournament ? `${d.tournament.name} · ${TOURNAMENT_STATUS_LABEL[d.tournament.status]}` : undefined}
        />
        {d.isPending ? (
          <SkeletonRows rows={5} />
        ) : d.error ? (
          <ErrorState error={d.error} onRetry={d.refetch} />
        ) : !d.tournament ? (
          <EmptyState title="Torneo non trovato" text="Controlla il link o torna alla pagina iniziale." />
        ) : (
          <Suspense fallback={<SkeletonRows rows={5} />}>
            <Content d={{ ...d, tournament: d.tournament }} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
