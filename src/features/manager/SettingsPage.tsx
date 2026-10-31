import { Info, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CourtLanes, LaneBlock, scaleFromCourts } from '../../components/CourtLanes';
import { PageHeader, Section } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/states';
import { TONE_CLASSES } from '../../components/StatusBadge';
import { actions, useAction } from '../../data/mutations';
import { useConfirmedRequests, useCourts } from '../../data/queries';
import { addMin, shortWeekday, today, WEEKDAY_NAMES } from '../../lib/time';
import type { Court } from '../../types';
import { Button, Checkbox, cn, ConfirmDialog, Field, Input, Label, Select, Sheet } from '../../ui';
import { OFFLINE_REASON, useOnline } from './hooks';
import { addDate, confirmedOffGrid, gridStarts, newCourtId, shortDate, times, validateCourt, type OutcomeMessage } from './logic';
import { ManagerNav } from './ManagerNav';
import { Outcome } from './Outcome';

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const TIMES = times('06:00', '23:45', 15);

function daysText(g: number[]): string {
  if (g.length === 7) return 'tutti i giorni';
  if (!g.length) return 'nessun giorno';
  return WEEK.filter((d) => g.includes(d)).map(shortWeekday).join(', ');
}

/** Court settings (/campo/impostazioni): grid rule per court with a live two-lane preview. */
export default function SettingsPage() {
  const courts = useCourts();
  const online = useOnline();
  const offline = online ? null : OFFLINE_REASON;
  const [draft, setDraft] = useState<Court | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [toDelete, setToDelete] = useState<Court | null>(null);
  const [outcome, setOutcome] = useState<OutcomeMessage | null>(null);
  const remove = useAction(actions.deleteCourt, {
    success: 'Campo eliminato.',
    onSuccess: () => setToDelete(null),
  });
  const list = useMemo(() => courts.data ?? [], [courts.data]);

  const openNew = () => {
    const n = list.length + 1;
    setIsNew(true);
    setDraft({
      id: '',
      name: `Campo ${n}`,
      firstSlot: '14:00',
      lastSlot: '21:00',
      slotMinutes: 90,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      closedDates: [],
      sortOrder: n,
    });
  };

  return (
    <>
      <PageHeader
        title="Impostazioni campi"
        subtitle="Orari e giorni di apertura: da qui nasce la griglia che vedono i giocatori."
        actions={
          <Button variant="primary" onClick={openNew} disabled={courts.isPending || !!offline}>
            <Plus aria-hidden /> Nuovo campo
          </Button>
        }
      />
      <ManagerNav />
      <Outcome outcome={outcome} onClose={() => setOutcome(null)} />
      {offline && <p className={cn('mb-4 rounded-panel p-3 font-semibold', TONE_CLASSES.warn)}>{offline}</p>}

      {courts.isPending ? (
        <SkeletonRows rows={2} />
      ) : courts.error ? (
        <ErrorState error={courts.error} onRetry={() => courts.refetch()} />
      ) : !list.length ? (
        <EmptyState
          title="Nessun campo."
          text="Aggiungi i campi del circolo con primo e ultimo orario di inizio e durata della partita: la griglia si genera da sola."
        />
      ) : (
        <div className="grid gap-6">
          <Section title="Campi" id="courts">
            <ul className="court-rule">
              {list.map((c) => (
                <li key={c.id} className="grid gap-1.5 py-4">
                  <p className="text-base font-bold">{c.name}</p>
                  <p className="tabular text-sm">
                    Inizi: {gridStarts(c.firstSlot, c.lastSlot, c.slotMinutes).join(' · ')} ({c.slotMinutes}′)
                  </p>
                  <p className="text-sm text-ink-muted">Aperto: {daysText(c.activeDays)}</p>
                  {c.closedDates.length > 0 && (
                    <p className="tabular text-sm text-ink-muted">Chiuso: {c.closedDates.map(shortDate).join(', ')}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="secondary" size="sm" disabled={!!offline} onClick={() => (setIsNew(false), setDraft(c))}>
                      <Pencil aria-hidden /> Modifica
                    </Button>
                    <Button variant="danger" size="sm" disabled={!!offline} onClick={() => setToDelete(c)}>
                      <Trash2 aria-hidden /> Elimina
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Griglia dei campi" id="preview">
            <p className="text-ink-muted">Così i giocatori vedono gli inizi possibili, con lo sfalsamento tra i campi.</p>
            <PreviewLanes courts={list} />
          </Section>
        </div>
      )}

      <Sheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={isNew ? 'Nuovo campo' : `Modifica ${draft?.name ?? 'campo'}`}
      >
        {draft && (
          <CourtForm
            key={draft.id || 'new'}
            initial={draft}
            isNew={isNew}
            courts={list}
            onDone={(e) => {
              setOutcome(e);
              setDraft(null);
            }}
          />
        )}
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Eliminare ${toDelete?.name ?? 'il campo'}?`}
        description="Il campo sparisce dalla griglia dei giocatori e dalla giornata. Se ha partite o occupazioni collegate, l’eliminazione può essere rifiutata."
        confirmLabel="Elimina campo"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}

/** Mini two-lane preview of the grid starts (every court treated as open, to show the rule). */
function PreviewLanes({ courts, highlight }: { courts: Court[]; highlight?: string }) {
  const valid = useMemo(() => courts.filter((c) => gridStarts(c.firstSlot, c.lastSlot, c.slotMinutes).length), [courts]);
  const scale = useMemo(() => scaleFromCourts(valid, 0.45), [valid]);
  if (!valid.length) return <p className="text-ink-muted">La griglia apparirà qui quando gli orari sono validi.</p>;
  return (
    <CourtLanes
      courts={valid}
      scale={scale}
      renderLane={(c) =>
        gridStarts(c.firstSlot, c.lastSlot, c.slotMinutes).map((i) => (
          <LaneBlock
            key={i}
            scale={scale}
            start={i}
            end={addMin(i, c.slotMinutes)}
            tone={c.id === highlight ? 'court' : 'idle'}
            className={c.id === highlight ? undefined : 'bg-transparent'}
            ariaLabel={`${c.name}, ${i}–${addMin(i, c.slotMinutes)}`}
          >
            <span className="tabular text-xs font-semibold">{i}</span>
          </LaneBlock>
        ))
      }
    />
  );
}

function CourtForm({
  initial,
  isNew,
  courts,
  onDone,
}: {
  initial: Court;
  isNew: boolean;
  courts: Court[];
  onDone: (e: OutcomeMessage) => void;
}) {
  const [c, setC] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [closure, setClosure] = useState('');
  const confirmed = useConfirmedRequests(today());
  const set = <K extends keyof Court>(k: K, v: Court[K]) => setC((x) => ({ ...x, [k]: v }));
  const errors = validateCourt(c);
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);
  const starts = gridStarts(c.firstSlot, c.lastSlot, c.slotMinutes);
  const id = isNew ? newCourtId(c.name, courts.map((x) => x.id)) : c.id;
  const preview = useMemo(
    () => [...courts.filter((x) => x.id !== c.id), { ...c, id: id || 'new' }].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [courts, c, id],
  );
  const orphans = isNew ? [] : confirmedOffGrid(c, confirmed.data ?? []);
  const save = useAction(actions.saveCourt, {
    onSuccess: () =>
      onDone({
        tone: orphans.length ? 'warn' : 'ok',
        text: `${c.name.trim()} salvato.${orphans.length ? ` ${orphans.length === 1 ? '1 partita confermata non è più' : `${orphans.length} partite confermate non sono più`} su uno slot di griglia: ${orphans.length === 1 ? 'resta valida' : 'restano valide'}.` : ''}`,
      }),
  });

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (Object.keys(errors).length) return;
        save.mutate({ ...c, id, name: c.name.trim() });
      }}
    >
      <Field label="Nome" error={show('name')}>
        {(p) => <Input {...p} value={c.name} onChange={(e) => set('name', e.target.value)} maxLength={40} required />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primo inizio">
          {(p) => (
            <Select {...p} value={c.firstSlot} onChange={(e) => set('firstSlot', e.target.value)}>
              {TIMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ultimo inizio" error={show('lastSlot')}>
          {(p) => (
            <Select {...p} value={c.lastSlot} onChange={(e) => set('lastSlot', e.target.value)}>
              {TIMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Durata (minuti)" error={show('slotMinutes')}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={15}
              max={600}
              step={15}
              value={Number.isFinite(c.slotMinutes) ? c.slotMinutes : ''}
              onChange={(e) => set('slotMinutes', e.target.valueAsNumber)}
            />
          )}
        </Field>
        <Field label="Ordine" hint="1 = primo a sinistra.">
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={0}
              value={c.sortOrder ?? 0}
              onChange={(e) => set('sortOrder', Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0)}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-1.5 rounded-panel bg-surface-2 p-3" aria-live="polite">
        <p className="text-sm font-semibold">Inizi generati</p>
        <p className="tabular">{starts.length ? starts.join(' · ') : 'Nessun inizio: controlla gli orari.'}</p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Giorni attivi</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
          {WEEK.map((g) => {
            const idg = `day-${g}`;
            return (
              <div key={g} className="flex min-h-11 items-center gap-2">
                <Checkbox
                  id={idg}
                  checked={c.activeDays.includes(g)}
                  onCheckedChange={(v) =>
                    set('activeDays', v ? [...c.activeDays, g].sort((a, b) => a - b) : c.activeDays.filter((x) => x !== g))
                  }
                />
                <Label htmlFor={idg} className="text-base font-normal capitalize">
                  {WEEKDAY_NAMES[g]}
                </Label>
              </div>
            );
          })}
        </div>
        {show('activeDays') && <p className="text-sm font-semibold text-danger-ink">{show('activeDays')}</p>}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Giorni di chiusura</legend>
        {c.closedDates.length ? (
          <ul className="court-rule">
            {c.closedDates.map((d) => (
              <li key={d} className="flex items-center justify-between gap-2 py-1">
                <span className="tabular">{shortDate(d)}/{d.slice(0, 4)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Rimuovi la chiusura del ${shortDate(d)}`}
                  onClick={() => set('closedDates', c.closedDates.filter((x) => x !== d))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Nessuna chiusura straordinaria.</p>
        )}
        <div className="flex items-end gap-2">
          <Field label="Aggiungi una data" className="flex-1">
            {(p) => <Input {...p} type="date" value={closure} min={today()} onChange={(e) => setClosure(e.target.value)} />}
          </Field>
          <Button
            variant="secondary"
            disabled={!closure}
            onClick={() => {
              set('closedDates', addDate(c.closedDates, closure));
              setClosure('');
            }}
          >
            <Plus aria-hidden /> Aggiungi
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-2">
        <p className="text-sm font-semibold">Anteprima con gli altri campi</p>
        <PreviewLanes courts={preview} highlight={id || 'new'} />
      </div>

      {orphans.length > 0 && (
        <p className={cn('flex items-start gap-2 rounded-panel p-3', TONE_CLASSES.info)}>
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          {orphans.length === 1
            ? '1 partita confermata non è più su uno slot di griglia: resta valida.'
            : `${orphans.length} partite confermate non sono più su uno slot di griglia: restano valide.`}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={save.isPending}>
          Salva
        </Button>
      </div>
    </form>
  );
}
