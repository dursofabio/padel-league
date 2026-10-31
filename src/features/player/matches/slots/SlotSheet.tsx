/** Sheet of a selected slot: who is free, who is missing, and the request action (4/4 and 3/4). */
import { CircleCheck, CircleMinus, Clock3, Info, Lock, Send } from 'lucide-react';
import { useState } from 'react';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { actions } from '../../../../data/mutations';
import type { SlotState } from '../../../../lib/slots';
import { labelDate } from '../../../../lib/time';
import { Button, cn, Field, Sheet, Textarea } from '../../../../ui';
import { courtName, type MatchContext } from '../context';
import { describeBooking, nameList, slotLabel } from '../logic';
import { Notice, Pill, SLOT_UI, WRAP } from '../parts';
import { hintOf, useMatchAction } from '../useMatchAction';

const CLOSE_ON = ['SLOT_TAKEN', 'MATCH_HAS_REQUEST', 'OVERLAP', 'EXPIRED', 'IN_PAST', 'COURT_CLOSED'];

export function SlotSheet({
  ctx,
  state,
  onClose,
  onPropose,
}: {
  ctx: MatchContext;
  state: SlotState;
  onClose: () => void;
  /** Off-grid entry for occupied slots, when enabled. */
  onPropose?: () => void;
}) {
  const { slot, color, missing } = state;
  const { match, name } = ctx;
  const [note, setNote] = useState('');
  const submit = useMatchAction(actions.createRequest, 'Richiesta inviata al campo');
  const court = courtName(ctx.courts, slot.courtId);
  const when = `${labelDate(slot.date)} alle ${slot.start}`;
  const ui = SLOT_UI[color];
  const requestable = (color === 'green' || color === 'yellow') && !!ctx.mySide;
  const missingNames = nameList(missing.map((p) => name(p)));
  const othersMissing = missing.filter((p) => p !== ctx.uid);

  const sendRequest = () =>
    submit.run(
      { match: match.id, court: slot.courtId, date: slot.date, start: slot.start, note: note.trim() || undefined },
      {
        onSuccess: onClose,
        onError: (e) => {
          if (CLOSE_ON.includes(hintOf(e) ?? '')) onClose();
        },
      },
    );

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        <span className="tabular">
          {labelDate(slot.date)} · {slot.start}–{slot.end} · {court}
        </span>
      }
      footer={
        requestable ? (
          <Button variant="primary" size="lg" block className="whitespace-normal" loading={submit.isPending} onClick={sendRequest}>
            <Send aria-hidden /> Invia richiesta al campo
          </Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Chiudi
          </Button>
        )
      }
    >
      <div className={cn('grid gap-5', WRAP)}>
        <Pill icon={ui.icon} tone={ui.tone} className="justify-self-start">
          {color === 'green' ? 'Liberi tutti e 4' : slotLabel(state, match.players.length)}
        </Pill>

        {(color === 'red' || color === 'blue') && (
          <div className="grid gap-3">
            {color === 'red' ? (
              <Notice icon={Lock} tone="danger">
                Il campo è occupato
                {state.bookings.length ? `: ${state.bookings.map(describeBooking).join(', ')}` : ''}.
              </Notice>
            ) : (
              <Notice icon={Send} tone="info">
                Questo orario è già stato chiesto per un’altra partita.
              </Notice>
            )}
            {onPropose && color === 'red' && (
              <Button variant="link" className="justify-self-start text-base" onClick={onPropose}>
                <Clock3 aria-hidden /> Proponi un altro orario
              </Button>
            )}
          </div>
        )}

        {color !== 'red' && color !== 'blue' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  [ctx.nameA, match.playersA],
                  [ctx.nameB, match.playersB],
                ] as const
              ).map(([team, players]) => (
                <div key={team} className="grid content-start gap-1">
                  <p className="font-bold">{team}</p>
                  <ul className="court-rule">
                    {players.map((p) => {
                      const free = state.free.includes(p);
                      return (
                        <li key={p} className="flex items-start gap-2 py-2">
                          {free ? (
                            <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok-ink" aria-hidden />
                          ) : (
                            <CircleMinus className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden />
                          )}
                          <span>
                            <span className="font-semibold">{p === ctx.uid ? 'Tu' : name(p)}</span>{' '}
                            <span className="text-ink-muted">{free ? 'libero' : 'non ha segnato questo orario'}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {color === 'green' && <p>Tutti e 4 sono liberi: la richiesta parte già accettata da tutti.</p>}
            {color === 'yellow' && (
              <p>
                {missing[0] === ctx.uid ? 'Tu non hai segnato questo orario: inviando la richiesta lo accetti.' : `${missingNames} dovrà accettare prima che il campo possa confermare.`}
              </p>
            )}
            {color === 'grey' && (
              <Notice icon={Info}>
                Servono almeno 3 giocatori liberi per chiedere il campo. {missingNames} non {missing.length === 1 ? 'ha' : 'hanno'} segnato questo orario.
              </Notice>
            )}

            {ctx.mySide && othersMissing.length > 0 && (
              <WhatsAppButton
                className="justify-self-start"
                phone={othersMissing.length === 1 ? ctx.phone(othersMissing[0]) : undefined}
                text={`${nameList(othersMissing.map((p) => name(p)))}, ${othersMissing.length === 1 ? 'puoi' : 'potete'} giocare ${when} (${court})? Segnalo nelle disponibilità → ${ctx.link}`}
              >
                {color === 'grey'
                  ? `Chiedi a ${nameList(othersMissing.map((p) => name(p)))} di segnare questo orario`
                  : `Chiedi a ${nameList(othersMissing.map((p) => name(p)))} su WhatsApp`}
              </WhatsAppButton>
            )}

            {requestable && (
              <Field label="Nota per il campo (facoltativa)">
                {(p) => <Textarea {...p} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />}
              </Field>
            )}
            {!ctx.mySide && <p className="text-ink-muted">Solo i giocatori di questa partita possono chiedere il campo.</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
