import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Section } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/states';
import { actions, useAction } from '../../data/mutations';
import { useCourts, useRecurrences } from '../../data/queries';
import { countSlots } from '../../lib/slots';
import { labelDate, today } from '../../lib/time';
import type { Court, Period, Recurrence } from '../../types';
import { Button, ConfirmDialog, Field, Input, Select, Sheet } from '../../ui';
import {
  assessCapacity,
  bookingsFromRecurrences,
  formatRatio,
  matchesInPeriod,
  periodDates,
  phaseLabel,
  type Capacity,
} from './logic';
import { Note } from './parts';
import type { SectionProps, TournamentData } from './types';

const schema = z
  .object({
    phase: z.string().min(1, { error: 'Scegli la fase' }),
    round: z.string(),
    startsOn: z.string().min(1, { error: 'Scegli la data di inizio' }),
    endsOn: z.string().min(1, { error: 'Scegli la data di fine' }),
    label: z.string().trim().max(40, { error: 'Massimo 40 caratteri' }),
  })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, { path: ['endsOn'], error: 'La fine deve venire dopo l’inizio' })
  .refine((v) => !v.round || /^[1-9]$/.test(v.round), { path: ['round'], error: 'Turno da 1 a 9' });
type PeriodForm = z.infer<typeof schema>;

export default function Periods({ d }: SectionProps) {
  const courts = useCourts();
  const rec = useRecurrences();
  const [open, setOpen] = useState<Period | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Period | null>(null);
  const remove = useAction(actions.deletePeriod, { success: 'Periodo eliminato', onSuccess: () => setToDelete(null) });

  const periods = useMemo(() => [...d.periods].sort((a, b) => a.startsOn.localeCompare(b.startsOn)), [d.periods]);
  const loading = courts.isPending || rec.isPending;
  const error = courts.error ?? rec.error;

  return (
    <div className="grid gap-8">
      <Section
        title="Periodi di gioco"
        id="per-list"
        actions={
          <Button variant="secondary" onClick={() => setOpen('new')}>
            <Plus aria-hidden /> Aggiungi periodo
          </Button>
        }
      >
        <p className="max-w-prose text-ink-muted">
          Finestre di date entro cui giocare le partite. Per le fasi finali puoi indicare un periodo per ogni turno, con scadenze più strette.
        </p>
        {!periods.length ? (
          <EmptyState
            title="Nessun periodo"
            text="Aggiungine uno per dare una scadenza alle partite. Di solito basta un periodo per i gironi e uno per le fasi finali."
          />
        ) : (
          <ul className="court-rule">
            {periods.map((p) => {
              const used = d.matches.some((m) => m.periodId === p.id);
              return (
                <li key={p.id} className="grid gap-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-0.5">
                      <p className="flex items-center gap-2 font-bold">
                        <CalendarRange className="size-5 text-ink-muted" aria-hidden />
                        {p.label}
                      </p>
                      <p className="tabular text-ink-muted">
                        {phaseLabel(p.phase)}
                        {p.round ? ` · turno ${p.round}` : ''} · {labelDate(p.startsOn)} – {labelDate(p.endsOn)}
                        {p.endsOn < today() && ' · terminato'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Modifica ${p.label}`} onClick={() => setOpen(p)}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Elimina ${p.label}`}
                        disabled={used}
                        title={used ? 'Ci sono partite in questo periodo' : undefined}
                        onClick={() => setToDelete(p)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                  {loading ? (
                    <SkeletonRows rows={1} />
                  ) : error ? (
                    <ErrorState
                      error={error}
                      onRetry={() => {
                        courts.refetch();
                        rec.refetch();
                      }}
                    />
                  ) : (
                    <CapacityRow period={p} d={d} courts={courts.data ?? []} recurrences={rec.data ?? []} />
                  )}
                  {used && <p className="text-sm text-ink-muted">Non si può eliminare: ci sono partite assegnate a questo periodo.</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <PeriodSheet d={d} period={open} onClose={() => setOpen(null)} />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Eliminare ${toDelete?.label ?? 'il periodo'}?`}
        description="Il periodo sparisce dal torneo. Non ci sono partite collegate."
        confirmLabel="Elimina periodo"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

function CapacityRow({ period, d, courts, recurrences }: { period: Period; d: TournamentData; courts: Court[]; recurrences: Recurrence[] }) {
  const c: Capacity = useMemo(() => {
    const days = periodDates(period);
    const slots = countSlots(courts, days, bookingsFromRecurrences(recurrences, days));
    const n = matchesInPeriod(period, d.periods, d.matches, d.teams, d.tournament.config.finals);
    return assessCapacity(slots, n, days.length);
  }, [period, courts, recurrences, d.periods, d.matches, d.teams, d.tournament.config.finals]);

  if (!courts.length) return <Note tone="warn">Nessun campo configurato: il gestore deve aggiungere i campi per calcolare la capienza.</Note>;
  if (c.ratio === null)
    return (
      <p className="tabular text-ink-muted">
        {c.slots} slot di gioco nel periodo (al netto delle ricorrenze). Nessuna partita ancora da giocare qui.
      </p>
    );
  const detail = `${c.matches} partite, servono ${c.neededPerWeek} slot a settimana, ce ne sono ${c.slotsPerWeek} (al netto delle ricorrenze).`;
  return (
    <div className="grid gap-1.5">
      <CapacityBar c={c} />
      {c.tone === 'ok' && <Note tone="ok">Capienza buona: {detail}</Note>}
      {c.tone === 'warn' && (
        <Note tone="warn">
          Margine stretto ({formatRatio(c.ratio)}×): allunga il periodo o libera slot. {detail}
        </Note>
      )}
      {c.tone === 'danger' && (
        <Note tone="danger">
          Capienza insufficiente ({formatRatio(c.ratio)}×): allunga il periodo o libera slot. {detail}
        </Note>
      )}
    </div>
  );
}

/** Linear bar: slots per match against the 3× target. The text next to it carries the meaning. */
function CapacityBar({ c }: { c: Capacity }) {
  const pct = Math.min(100, ((c.ratio ?? 0) / 3) * 100);
  const colour = c.tone === 'ok' ? 'bg-ok' : c.tone === 'warn' ? 'bg-warn' : 'bg-danger';
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={3}
      aria-valuenow={Number((c.ratio ?? 0).toFixed(1))}
      aria-valuetext={`${formatRatio(c.ratio ?? 0)} slot per partita`}
      aria-label="Capienza"
      className="relative h-2 max-w-md overflow-hidden rounded-full bg-surface-2"
    >
      <div className={`h-full ${colour}`} style={{ width: `${pct}%` }} />
      <span aria-hidden className="absolute top-0 left-1/2 h-full w-px bg-ink-muted" title="1,5×" />
    </div>
  );
}

function PeriodSheet({ d, period, onClose }: { d: TournamentData; period: Period | 'new' | null; onClose: () => void }) {
  const isNew = period === 'new';
  const existing = period && period !== 'new' ? period : null;
  const phases = ['groups', ...d.tournament.config.finals.map((f) => f.name.toLowerCase())];
  const values = (): PeriodForm => ({
    phase: existing?.phase ?? 'groups',
    round: existing?.round ? String(existing.round) : '',
    startsOn: existing?.startsOn ?? '',
    endsOn: existing?.endsOn ?? '',
    label: existing?.label ?? '',
  });
  const { register, handleSubmit, reset, control, formState } = useForm<PeriodForm>({ resolver: zodResolver(schema), values: values() });
  const phase = useWatch({ control, name: 'phase' });
  const save = useAction(actions.savePeriod, {
    success: isNew ? 'Periodo aggiunto' : 'Periodo aggiornato',
    onSuccess: () => {
      onClose();
      reset();
    },
  });
  const formId = 'period-form';
  const close = () => {
    reset();
    onClose();
  };

  return (
    <Sheet
      open={!!period}
      onOpenChange={(o) => !o && close()}
      title={isNew ? 'Nuovo periodo' : `Modifica ${existing?.label ?? 'periodo'}`}
      description="Le partite di questo periodo vanno giocate entro la data di fine."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Annulla
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={save.isPending}>
            {isNew ? 'Aggiungi periodo' : 'Salva periodo'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="grid gap-4"
        onSubmit={handleSubmit((v) => {
          const label = v.label.trim() || existing?.label || `Periodo ${d.periods.length + 1}`;
          save.mutate({
            tournament: d.tournament.id,
            period: {
              id: existing?.id,
              phase: v.phase,
              round: v.phase !== 'groups' && v.round ? Number(v.round) : null,
              startsOn: v.startsOn,
              endsOn: v.endsOn,
              label,
            },
          });
        })}
      >
        <Field label="Fase" error={formState.errors.phase?.message}>
          {(p) => (
            <Select {...p} {...register('phase')}>
              {phases.map((f) => (
                <option key={f} value={f}>
                  {phaseLabel(f)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {phase !== 'groups' && (
          <Field label="Turno (facoltativo)" hint="Vuoto = vale per tutta la fase. 1 = primo turno del tabellone." error={formState.errors.round?.message}>
            {(p) => <Input {...p} {...register('round')} type="number" inputMode="numeric" min={1} max={9} />}
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dal" error={formState.errors.startsOn?.message}>
            {(p) => <Input {...p} {...register('startsOn')} type="date" />}
          </Field>
          <Field label="Al" error={formState.errors.endsOn?.message}>
            {(p) => <Input {...p} {...register('endsOn')} type="date" />}
          </Field>
        </div>
        <Field label="Etichetta (facoltativa)" hint="Se la lasci vuota diventa «Periodo N»." error={formState.errors.label?.message}>
          {(p) => <Input {...p} {...register('label')} autoComplete="off" placeholder="Periodo 1" />}
        </Field>
      </form>
    </Sheet>
  );
}
