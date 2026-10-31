/**
 * S4: confirmed match. Day, time, court; WhatsApp share; player cancellation until
 * config.playerCancelHours hours before the start (decision P4 changed), otherwise "Scrivi al gestore".
 */
import { CalendarCheck, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { actions } from '../../../../data/mutations';
import { labelDate } from '../../../../lib/time';
import { Button, ConfirmDialog } from '../../../../ui';
import { courtName, type MatchContext } from '../context';
import { cancelDeadline, formatWhen } from '../logic';
import { Notice, useNowTick } from '../parts';
import { useMatchAction } from '../useMatchAction';

export function Scheduled({ ctx }: { ctx: MatchContext }) {
  const { match } = ctx;
  const schedule = match.schedule!;
  const now = useNowTick();
  const [confirming, setConfirming] = useState(false);
  const cancel = useMatchAction(actions.playerCancelConfirmed, 'Partita annullata: il campo è di nuovo libero');
  const court = courtName(ctx.courts, schedule.courtId);
  const hours = ctx.tournament.config.playerCancelHours;
  const deadline = cancelDeadline(schedule, hours);
  const canCancel = !!ctx.mySide && !!match.requestId && now < deadline;
  const when = `${labelDate(schedule.date)} alle ${schedule.start}`;

  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-2 text-xl font-bold">
        <CalendarCheck className="mt-1 size-6 shrink-0 text-ok-ink" aria-hidden />
        <span className="tabular">
          Si gioca {when} · {court}
        </span>
      </p>
      <p className="tabular text-ink-muted">
        Dalle {schedule.start} alle {schedule.end}. Dopo la partita potrai inserire il risultato qui.
      </p>
      {ctx.mySide && (
        <div className="flex flex-wrap gap-2">
          <WhatsAppButton text={`Confermata: ${ctx.title}, ${when}, ${court} → ${ctx.link}`} />
        </div>
      )}
      {ctx.mySide &&
        (canCancel ? (
          <div className="grid gap-2 border-t border-line pt-4">
            <p className="text-ink-muted">
              Non potete più giocare? Puoi annullarla fino a <span className="tabular">{formatWhen(deadline)}</span>.
            </p>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title="Annullare la partita?"
              description="Il campo torna libero per tutti e la partita torna da programmare."
              confirmLabel="Annulla partita"
              cancelLabel="Tieni"
              loading={cancel.isPending}
              onConfirm={() =>
                cancel.run({ request: match.requestId! }, { onSuccess: () => setConfirming(false), onError: () => setConfirming(false) })
              }
              trigger={
                <Button variant="danger" className="justify-self-start">
                  Annulla partita
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-2 border-t border-line pt-4">
            <Notice icon={MessageCircle}>
              Per spostarla o annullarla scrivi al gestore del campo: mancano meno di {hours} ore all’inizio.
            </Notice>
            <WhatsAppButton
              className="justify-self-start"
              phone={ctx.managerPhone}
              text={`Ciao, per la partita ${ctx.title} di ${when} (${court}) …`}
            >
              Scrivi al gestore
            </WhatsAppButton>
          </div>
        ))}
    </div>
  );
}
