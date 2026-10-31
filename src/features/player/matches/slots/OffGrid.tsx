/**
 * Off-grid proposal (only when config.allowOffGrid): court, day, start in offGridStep steps,
 * computed end, live checks, mini lanes preview of the grid slots it makes unusable, who must accept.
 * The server computes off_grid and the acceptances; it stays the authority.
 */
import { Ban, CircleCheck, Hourglass, Send, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CourtLanes, LaneBlock, type LaneScale } from '../../../../components/CourtLanes';
import { actions } from '../../../../data/mutations';
import { checkOffGrid, courtDayId, gridSlots, impactedSlots, isGridSlot, windowsCover } from '../../../../lib/slots';
import { addMin, labelDate, overlaps, toMin, today } from '../../../../lib/time';
import type { Booking, Court, MatchRequest, Windows } from '../../../../types';
import { Button, cn, Field, Segmented, Select, Sheet } from '../../../../ui';
import type { MatchContext } from '../context';
import { describeBooking, nameList, startOptions } from '../logic';
import { Notice, useNowTick, WRAP } from '../parts';
import { useMatchAction } from '../useMatchAction';

export function OffGrid({
  ctx,
  days,
  courts,
  bookings,
  requests,
  windows,
  initial,
  onClose,
}: {
  ctx: MatchContext;
  days: string[];
  courts: Court[];
  bookings: Record<string, Record<string, Booking>>;
  requests: MatchRequest[];
  windows: Record<string, Windows | undefined>;
  initial: { courtId?: string; date?: string };
  onClose: () => void;
}) {
  const step = ctx.tournament.config.offGridStep;
  const now = useNowTick();
  const todayDate = today();
  const [courtId, setCourtId] = useState(initial.courtId ?? courts[0]?.id ?? '');
  const [date, setDate] = useState(initial.date && days.includes(initial.date) ? initial.date : days[0]);
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const options = useMemo(() => startOptions(step, date, todayDate, nowMin), [step, date, todayDate, nowMin]);
  const [chosenStart, setStart] = useState('');
  const start = options.includes(chosenStart) ? chosenStart : (options.find((o) => o >= '15:00') ?? options[0] ?? '');
  const court = courts.find((c) => c.id === courtId) ?? courts[0];
  const submit = useMatchAction(actions.createRequest, 'Proposta inviata al campo', step);

  const end = court && start ? addMin(start, court.slotMinutes) : '';
  const dayBookings = court ? bookings[courtDayId(court.id, date)] : undefined;
  const check = court && start ? checkOffGrid(court, date, start, dayBookings, requests, now) : null;
  const sameStart = check?.overlappingRequests.some((r) => r.start === start);
  const impacted = court && start ? impactedSlots(court, date, start, end) : [];
  const onGrid = court && start ? isGridSlot(court, date, start) : false;

  const errors: string[] = [];
  if (!court) errors.push('Non ci sono campi configurati.');
  else if (!start) errors.push('Non ci sono più orari disponibili in questo giorno: scegline un altro.');
  if (check?.outsideHours) errors.push('Il campo è chiuso a quell’ora.');
  if (check?.blocking.length) errors.push(`Si sovrappone a: ${check.blocking.map(describeBooking).join(', ')}.`);
  if (sameStart) errors.push('Questo orario è già stato chiesto per un’altra partita.');
  const requestsWarning = !sameStart && !!check?.overlappingRequests.length;

  const acceptNow = ctx.match.players.filter((p) => p === ctx.uid || (end && windowsCover(windows[p], date, start, end)));
  const mustAccept = ctx.match.players.filter((p) => !acceptNow.includes(p));
  const who = (p: string) => (p === ctx.uid ? 'tu' : ctx.name(p));

  // mini lanes: ± 2 h around the proposal
  const scale: LaneScale | null = end
    ? { from: Math.max(0, Math.floor((toMin(start) - 120) / 30) * 30), to: Math.min(24 * 60, Math.ceil((toMin(end) + 120) / 30) * 30), px: 0.7 }
    : null;

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Proponi un orario fuori griglia"
      description="Per un orario diverso da quelli della griglia: devono accettare tutti e 4, poi decide il campo."
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          className="whitespace-normal"
          disabled={errors.length > 0}
          loading={submit.isPending}
          onClick={() => submit.run({ match: ctx.match.id, court: court.id, date, start }, { onSuccess: onClose })}
        >
          <Send aria-hidden /> Invia proposta
        </Button>
      }
    >
      <div className={cn('grid gap-5', WRAP)}>
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">Campo</span>
          <Segmented label="Campo" value={courtId} onValueChange={setCourtId} options={courts.map((c) => ({ value: c.id, label: c.name }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giorno">
            {(p) => (
              <Select {...p} value={date} onChange={(e) => setDate(e.target.value)}>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {labelDate(d)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Inizio" hint={end ? `fine ${end}, ${court.slotMinutes} minuti` : undefined}>
            {(p) => (
              <Select {...p} value={start} onChange={(e) => setStart(e.target.value)} disabled={!options.length}>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div aria-live="polite" className="grid gap-2">
          {errors.map((e) => (
            <Notice key={e} icon={TriangleAlert} tone="danger">
              {e}
            </Notice>
          ))}
          {requestsWarning && (
            <Notice icon={TriangleAlert} tone="warn">
              Si sovrappone a un’altra richiesta in attesa: il campo potrà confermarne una sola.
            </Notice>
          )}
          {onGrid && <Notice icon={CircleCheck}>Questo è un orario della griglia: la richiesta sarà normale.</Notice>}
          {!errors.length && impacted.length > 0 && (
            <Notice icon={Ban}>
              Rende inutilizzabili gli slot delle {nameList(impacted.map((s) => s.start))} sul {court.name}.
            </Notice>
          )}
        </div>

        {scale && court && (
          <CourtLanes
            caption={<span className="tabular">{labelDate(date)}: anteprima</span>}
            courts={courts}
            scale={scale}
            renderLane={(c) => {
              const slots = gridSlots(c, date).filter((s) => overlaps(s.start, s.end, addMin('00:00', scale.from), addMin('00:00', scale.to)));
              const busy = Object.values(bookings[courtDayId(c.id, date)] ?? {});
              const impact = c.id === court.id ? impacted.map((s) => s.start) : [];
              return (
                <>
                  {slots.map((s) =>
                    impact.includes(s.start) ? (
                      <LaneBlock key={s.start} scale={scale} start={s.start} end={s.end} tone="idle" pattern="hatch" ariaLabel={`${c.name} ${s.start}, inutilizzabile`}>
                        <span className="tabular flex items-center gap-1 text-sm font-semibold">
                          <Ban className="size-3.5" aria-hidden /> {s.start} inutilizzabile
                        </span>
                      </LaneBlock>
                    ) : (
                      <LaneBlock key={s.start} scale={scale} start={s.start} end={s.end} tone="idle" ariaLabel={`${c.name} ${s.start}, slot di griglia`}>
                        <span className="tabular text-sm">{s.start}</span>
                      </LaneBlock>
                    ),
                  )}
                  {busy.map((b, i) => (
                    <LaneBlock key={`o${i}`} scale={scale} start={b.start} end={b.end} tone="danger" pattern="hatch" narrow ariaLabel={describeBooking(b)}>
                      <span className="text-sm font-semibold">{describeBooking(b)}</span>
                    </LaneBlock>
                  ))}
                  {c.id === court.id && end && (
                    <LaneBlock scale={scale} start={start} end={end} tone="info" narrow className="z-10 border-2" ariaLabel={`Proposta ${start}–${end}`}>
                      <span className="tabular flex items-center gap-1 text-sm font-bold">
                        <Send className="size-3.5" aria-hidden /> Proposta {start}–{end}
                      </span>
                    </LaneBlock>
                  )}
                </>
              );
            }}
          />
        )}

        {end && (
          <div className="grid gap-1">
            <Notice icon={CircleCheck} tone="ok">
              Accettano subito: {nameList(acceptNow.map(who))}.
            </Notice>
            {mustAccept.length > 0 && (
              <Notice icon={Hourglass} tone="warn">
                {mustAccept.length === 1 ? 'Deve' : 'Devono'} accettare: {nameList(mustAccept.map(who))}.
              </Notice>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
