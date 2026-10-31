import { Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SkeletonRows } from '../../components/states';
import { actions, useAction } from '../../data/mutations';
import { useBookings, useRequestsInRange } from '../../data/queries';
import { courtDayId, gridSlots, nearestFreeSlot } from '../../lib/slots';
import { labelDate, today } from '../../lib/time';
import type { Court, MatchRequest, Period } from '../../types';
import { Button, Field, Input, Select, Sheet, Textarea } from '../../ui';
import { counterProposalDays, managerSlotState } from './logic';

const STATE_LABEL = { free: 'libero', booked: 'occupato', requested: 'già richiesto' } as const;

/** Counter-proposal: prefilled with the nearest free grid slot (±3 days within the match period, G3), editable. */
export function CounterProposeSheet({
  request,
  courts,
  period,
  description,
  onOpenChange,
  disabledReason,
}: {
  request: MatchRequest | null;
  courts: Court[];
  period?: Period;
  /** "Rossi/Bianchi – Verdi/Neri" */
  description?: string;
  onOpenChange: (open: boolean) => void;
  disabledReason?: string | null;
}) {
  return (
    <Sheet
      open={!!request}
      onOpenChange={onOpenChange}
      title="Proponi altro orario"
      description="I giocatori dovranno accettare. La richiesta originale viene chiusa."
    >
      {request && (
        <Content
          key={request.id}
          r={request}
          courts={courts}
          period={period}
          description={description}
          onDone={() => onOpenChange(false)}
          disabledReason={disabledReason}
        />
      )}
    </Sheet>
  );
}

function Content({
  r,
  courts,
  period,
  description,
  onDone,
  disabledReason,
}: {
  r: MatchRequest;
  courts: Court[];
  period?: Period;
  description?: string;
  onDone: () => void;
  disabledReason?: string | null;
}) {
  const todayDate = today();
  const days = useMemo(() => counterProposalDays(r.date, todayDate, period), [r.date, todayDate, period]);
  const [courtId, setCourtId] = useState(r.courtId);
  const [date, setDate] = useState(r.date);
  const [start, setStart] = useState('');
  const [note, setNote] = useState('');
  const [prefill, setPrefill] = useState<'pending' | 'found' | 'none'>('pending');

  const allDays = [...days, date, r.date].sort();
  const from = allDays[0];
  const to = allDays[allDays.length - 1];
  const bookings = useBookings(from, to);
  const inRange = useRequestsInRange(from, to);
  const others = useMemo(() => (inRange.data ?? []).filter((x) => x.id !== r.id), [inRange.data, r.id]);
  const ready = !bookings.isPending && !inRange.isPending;

  // same court first, then the others
  const sortedCourts = useMemo(
    () => [...courts.filter((c) => c.id === r.courtId), ...courts.filter((c) => c.id !== r.courtId)],
    [courts, r.courtId],
  );

  useEffect(() => {
    if (prefill !== 'pending' || !ready) return;
    const s = nearestFreeSlot(
      { courtId: r.courtId, date: r.date, start: r.start, end: r.end },
      sortedCourts,
      days,
      bookings.byCourtDay,
      others,
    );
    if (s) {
      setCourtId(s.courtId);
      setDate(s.date);
      setStart(s.start);
      setPrefill('found');
    } else setPrefill('none');
  }, [prefill, ready, r, sortedCourts, days, bookings.byCourtDay, others]);

  const court = courts.find((c) => c.id === courtId);
  const slots = useMemo(() => {
    if (!court || !date) return [];
    return gridSlots(court, date).map((s) => ({
      ...s,
      state: managerSlotState(s, bookings.byCourtDay[courtDayId(court.id, date)], others),
    }));
  }, [court, date, bookings.byCourtDay, others]);
  const chosen = slots.find((s) => s.start === start);
  const error =
    !date || !court
      ? null
      : slots.length === 0
        ? `${court.name} è chiuso in questa data: scegli un altro giorno o campo.`
        : chosen?.state === 'booked'
          ? 'Questo orario è occupato: scegline un altro.'
          : null;

  const send = useAction(actions.counterPropose, {
    success: 'Proposta inviata: i giocatori dovranno accettare.',
    onSuccess: onDone,
  });
  const minDate = period && period.startsOn > todayDate ? period.startsOn : todayDate;

  if (prefill === 'pending') return <SkeletonRows rows={3} />;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!chosen || error || disabledReason || !ready) return;
        send.mutate({ request: r.id, court: courtId, date, start, note: note.trim() || undefined });
      }}
    >
      <p className="text-ink-muted">
        Richiesta originale: <span className="tabular font-semibold text-ink">{labelDate(r.date)} · {r.start}</span> ·{' '}
        {courts.find((c) => c.id === r.courtId)?.name}
        {description && <span className="block">{description}</span>}
      </p>
      <p className="flex items-start gap-2 rounded-panel bg-info-soft p-3 text-info-ink">
        <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
        {prefill === 'found'
          ? 'Ti propongo l’orario libero più vicino. Puoi cambiarlo.'
          : 'Nessun orario libero vicino: scegline uno tu.'}
      </p>
      <Field label="Campo">
        {(p) => (
          <Select {...p} value={courtId} onChange={(e) => (setCourtId(e.target.value), setStart(''))}>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Giorno" hint={period ? `Periodo della partita: fino al ${labelDate(period.endsOn)}.` : undefined}>
        {(p) => (
          <Input
            {...p}
            type="date"
            value={date}
            min={minDate}
            max={period?.endsOn}
            required
            onChange={(e) => (setDate(e.target.value), setStart(''))}
          />
        )}
      </Field>
      <Field label="Orario" error={error} hint={ready ? undefined : 'Controllo gli orari liberi…'}>
        {(p) => (
          <Select {...p} value={start} onChange={(e) => setStart(e.target.value)} required disabled={!slots.length || !ready}>
            <option value="">Scegli l’orario</option>
            {slots.map((s) => (
              <option key={s.start} value={s.start} disabled={s.state === 'booked'}>
                {s.start}–{s.end} · {STATE_LABEL[s.state]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Nota per i giocatori" hint="Facoltativa.">
        {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}
      </Field>
      {chosen && !error && (
        <p className="font-semibold">
          Proponi: <span className="tabular">{labelDate(date)} · {chosen.start}–{chosen.end}</span> · {court?.name}
          {chosen.state === 'requested' && (
            <span className="block font-normal text-warn-ink">C’è già un’altra richiesta in attesa su questo orario.</span>
          )}
        </p>
      )}
      {disabledReason && <p className="text-sm font-semibold text-ink-muted">{disabledReason}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" variant="primary" loading={send.isPending} disabled={!chosen || !!error || !!disabledReason || !ready}>
          Invia proposta
        </Button>
      </div>
    </form>
  );
}
