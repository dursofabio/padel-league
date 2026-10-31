import { CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/states';
import { TONE_CLASSES } from '../../components/StatusBadge';
import { actions, useAction } from '../../data/mutations';
import { useCourts, useRecurrences } from '../../data/queries';
import { addDays, today, WEEKDAY_NAMES } from '../../lib/time';
import { BOOKING_TYPE_LABEL } from '../../lib/copy';
import type { BookingType, Court, Recurrence } from '../../types';
import { Button, cn, ConfirmDialog, Field, Input, Segmented, Select, Sheet, Textarea } from '../../ui';
import { BOOKING_LOOK } from './DayLanes';
import { OFFLINE_REASON, useOnline } from './hooks';
import { materializeMessage, rangeError, recurrenceWhen, shortDate, times, type OutcomeMessage } from './logic';
import { ManagerNav } from './ManagerNav';
import { Outcome } from './Outcome';

type ManualType = Exclude<BookingType, 'match'>;
type Draft = Omit<Recurrence, 'id' | 'type'> & { id?: string; type: ManualType };

const TYPES: { value: ManualType; label: string }[] = [
  { value: 'lesson', label: 'Lezione' },
  { value: 'external', label: 'Esterno' },
  { value: 'closure', label: 'Chiusura' },
];
const START_TIMES = times('08:00', '23:45', 15);
const END_TIMES = times('08:15', '24:00', 15);
/** Monday first, as people read a week. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Recurrences (/campo/ricorrenze): fixed lessons and bookings, applied to the next 60 days (G6). */
export default function RecurrencesPage() {
  const recurrences = useRecurrences();
  const courts = useCourts();
  const online = useOnline();
  const offline = online ? null : OFFLINE_REASON;
  const [outcome, setOutcome] = useState<OutcomeMessage | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Recurrence | null>(null);

  const apply = useAction(actions.materializeRecurrence, { onSuccess: (res) => setOutcome(materializeMessage(res)) });
  const remove = useAction(actions.deleteRecurrence, {
    success: 'Ricorrenza eliminata. Le occupazioni già segnate restano.',
    onSuccess: () => setToDelete(null),
  });

  const list = courts.data ?? [];
  const courtName = (id: string) => list.find((c) => c.id === id)?.name ?? id;
  const blank = (): Draft => {
    const todayDate = today();
    return {
      courtId: list[0]?.id ?? '',
      weekday: 2,
      start: '18:00',
      end: '19:30',
      type: 'lesson',
      note: '',
      validFrom: todayDate,
      validTo: addDays(todayDate, 120),
    };
  };

  return (
    <>
      <PageHeader
        title="Ricorrenze"
        subtitle="Lezioni e prenotazioni fisse: le segni una volta e la giornata si riempie da sola."
        actions={
          <Button variant="primary" onClick={() => setDraft(blank())} disabled={!list.length || !!offline}>
            <Plus aria-hidden /> Nuova ricorrenza
          </Button>
        }
      />
      <ManagerNav />
      <Outcome outcome={outcome} onClose={() => setOutcome(null)} />
      {offline && <p className={cn('mb-4 rounded-panel p-3 font-semibold', TONE_CLASSES.warn)}>{offline}</p>}

      {recurrences.isPending || courts.isPending ? (
        <SkeletonRows rows={3} />
      ) : recurrences.error || courts.error ? (
        <ErrorState error={recurrences.error ?? courts.error} onRetry={() => (recurrences.refetch(), courts.refetch())} />
      ) : !recurrences.data?.length ? (
        <EmptyState
          title="Nessuna ricorrenza."
          text="Usale per lezioni e prenotazioni fisse: per esempio la scuola padel ogni martedì alle 18:00."
        />
      ) : (
        <ul className="court-rule">
          {recurrences.data.map((r) => {
            const a = BOOKING_LOOK[r.type];
            const applying = apply.isPending && apply.variables?.recurrence === r.id;
            return (
              <li key={r.id} className="grid gap-2 py-4">
                <p className="tabular text-base font-bold">{recurrenceWhen(r)}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{courtName(r.courtId)}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <a.icon className="size-4" aria-hidden /> {BOOKING_TYPE_LABEL[r.type]}
                  </span>
                  {r.note && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{r.note}</span>
                    </>
                  )}
                </p>
                <p className="tabular text-sm text-ink-muted">
                  dal {shortDate(r.validFrom)} al {shortDate(r.validTo)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="court"
                    size="sm"
                    loading={applying}
                    disabled={!!offline}
                    onClick={() => (setOutcome(null), apply.mutate({ recurrence: r.id, days: 60 }))}
                  >
                    <CalendarPlus aria-hidden /> Applica ai prossimi 60 giorni
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!offline}
                    onClick={() => setDraft({ ...r, type: r.type === 'match' ? 'external' : r.type })}
                  >
                    <Pencil aria-hidden /> Modifica
                  </Button>
                  <Button variant="danger" size="sm" disabled={!!offline} onClick={() => setToDelete(r)}>
                    <Trash2 aria-hidden /> Elimina
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? 'Modifica ricorrenza' : 'Nuova ricorrenza'}
        description="Dopo il salvataggio la applico ai prossimi 60 giorni."
      >
        {draft && (
          <RecurrenceForm
            key={draft.id ?? 'new'}
            initial={draft}
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
        title={toDelete ? `Eliminare la ricorrenza ${recurrenceWhen(toDelete)}?` : 'Eliminare la ricorrenza?'}
        description="Le occupazioni già segnate restano: liberale dalla giornata se serve."
        confirmLabel="Elimina"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}

interface Errors {
  courtId?: string;
  end?: string;
  validTo?: string;
}

function validate(b: Draft): Errors {
  const e: Errors = {};
  if (!b.courtId) e.courtId = 'Scegli il campo.';
  const i = rangeError(b.start, b.end);
  if (i) e.end = i;
  if (!b.validFrom || !b.validTo) e.validTo = 'Indica da quando e fino a quando vale.';
  else if (b.validTo < b.validFrom) e.validTo = 'La data di fine deve venire dopo quella di inizio.';
  return e;
}

function RecurrenceForm({ initial, courts, onDone }: { initial: Draft; courts: Court[]; onDone: (e: OutcomeMessage) => void }) {
  const [b, setB] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [working, setWorking] = useState(false);
  const save = useAction(actions.saveRecurrence);
  const apply = useAction(actions.materializeRecurrence);
  const errors = validate(b);
  const show = (k: keyof Errors) => (submitted ? errors[k] : undefined);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setB((x) => ({ ...x, [k]: v }));

  async function submit() {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    setWorking(true);
    try {
      const { id } = await save.mutateAsync({ ...b, note: b.note.trim() });
      try {
        const res = await apply.mutateAsync({ recurrence: id, days: 60 });
        const m = materializeMessage(res);
        onDone({ ...m, text: `Ricorrenza salvata. ${m.text}` });
      } catch {
        onDone({ tone: 'warn', text: 'Ricorrenza salvata, ma non sono riuscito ad applicarla: usa “Applica ai prossimi 60 giorni”.' });
      }
    } catch {
      // error toast already shown by useAction
    } finally {
      setWorking(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Campo" error={show('courtId')}>
        {(p) => (
          <Select {...p} value={b.courtId} onChange={(e) => set('courtId', e.target.value)}>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Giorno della settimana">
        {(p) => (
          <Select {...p} value={b.weekday} onChange={(e) => set('weekday', Number(e.target.value))}>
            {WEEK.map((g) => (
              <option key={g} value={g}>
                {WEEKDAY_NAMES[g]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dalle">
          {(p) => (
            <Select {...p} value={b.start} onChange={(e) => set('start', e.target.value)}>
              {START_TIMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Alle" error={show('end')}>
          {(p) => (
            <Select {...p} value={b.end} onChange={(e) => set('end', e.target.value)}>
              {END_TIMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-semibold" aria-hidden>
          Tipo
        </span>
        <Segmented label="Tipo di occupazione" value={b.type} onValueChange={(v) => set('type', v)} options={TYPES} />
      </div>
      <Field label="Nota" hint="Facoltativa, per esempio “scuola padel”.">
        {(p) => <Textarea {...p} value={b.note} onChange={(e) => set('note', e.target.value)} maxLength={200} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dal">
          {(p) => <Input {...p} type="date" value={b.validFrom} onChange={(e) => set('validFrom', e.target.value)} />}
        </Field>
        <Field label="Al" error={show('validTo')}>
          {(p) => <Input {...p} type="date" value={b.validTo} min={b.validFrom} onChange={(e) => set('validTo', e.target.value)} />}
        </Field>
      </div>
      {b.id && (
        <p className="text-sm text-ink-muted">
          Le modifiche non cambiano le occupazioni già segnate: liberale dalla giornata se serve, poi riapplica.
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={working}>
          Salva e applica
        </Button>
      </div>
    </form>
  );
}
