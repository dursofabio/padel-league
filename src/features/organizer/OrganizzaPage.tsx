import { CalendarDays, CalendarRange, LayoutDashboard, ListChecks, Settings2, Trophy, Users, type LucideIcon } from 'lucide-react';
import { lazy, Suspense, useMemo, type ComponentType } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../components/states';
import { useTorneoData } from '../../data/queries';
import { today } from '../../lib/time';
import { cn } from '../../ui';
import { eccezioni, SEZIONI, sezioneValida, type SezioneId } from './logic';
import type { PropsSezione } from './tipi';

const COMPONENTI: Record<SezioneId, ComponentType<PropsSezione>> = {
  panoramica: lazy(() => import('./Panoramica')),
  configurazione: lazy(() => import('./Configurazione')),
  periodi: lazy(() => import('./Periodi')),
  squadre: lazy(() => import('./Squadre')),
  calendario: lazy(() => import('./Calendario')),
  monitoraggio: lazy(() => import('./Monitoraggio')),
  finali: lazy(() => import('./Finali')),
};

const ICONE: Record<SezioneId, LucideIcon> = {
  panoramica: LayoutDashboard,
  configurazione: Settings2,
  periodi: CalendarRange,
  squadre: Users,
  calendario: CalendarDays,
  monitoraggio: ListChecks,
  finali: Trophy,
};

const NOMI_STATO = { iscrizioni: 'Iscrizioni aperte', gironi: 'Fase a gironi', fasiFinali: 'Fasi finali', concluso: 'Concluso' } as const;

/** Organizer area: one route, a section list (sidebar on desktop, scrollable tabs on mobile), one lazy section. */
export default function OrganizzaPage() {
  const { tid, sezione: param } = useParams();
  const sezione = sezioneValida(param);
  const d = useTorneoData(tid);

  const conteggi = useMemo(() => {
    const e = eccezioni(d.partite, d.periodi, today());
    return {
      squadre: d.squadre.filter((s) => s.stato === 'da approvare').length,
      monitoraggio: e.contestate.length + e.inRitardo.length,
    } as Partial<Record<SezioneId, number>>;
  }, [d.partite, d.periodi, d.squadre]);

  const voce = SEZIONI.find((s) => s.id === sezione)!;
  const Sezione = COMPONENTI[sezione];

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Sezioni di Organizza" className="-mx-4 mb-5 border-b border-line md:-mx-6 lg:mx-0 lg:mb-0 lg:border-b-0">
        <ul className="flex gap-1 overflow-x-auto px-4 md:px-6 lg:sticky lg:top-8 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0">
          {SEZIONI.map((s) => {
            const Icon = ICONE[s.id];
            const n = conteggi[s.id];
            return (
              <li key={s.id} className="shrink-0">
                <NavLink
                  to={`/t/${tid}/organizza/${s.id}`}
                  aria-current={s.id === sezione ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 text-base font-semibold whitespace-nowrap text-ink-muted hover:text-ink',
                    'lg:rounded-control lg:border-b-0 lg:hover:bg-surface-2',
                    s.id === sezione && 'border-court text-ink dark:border-ball lg:bg-court lg:text-court-ink lg:hover:bg-court-deep',
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
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        <PageHeader
          titolo={voce.label}
          sottotitolo={d.torneo ? `${d.torneo.nome} · ${NOMI_STATO[d.torneo.stato]}` : undefined}
        />
        {d.isPending ? (
          <SkeletonRighe righe={5} />
        ) : d.error ? (
          <ErrorState errore={d.error} onRiprova={d.refetch} />
        ) : !d.torneo ? (
          <EmptyState titolo="Torneo non trovato" testo="Controlla il link o torna alla pagina iniziale." />
        ) : (
          <Suspense fallback={<SkeletonRighe righe={5} />}>
            <Sezione d={{ ...d, torneo: d.torneo }} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
