/**
 * Request status (S2/S3): two-step progress, the 4 acceptances in text, expiry, Accetta / Annulla richiesta,
 * per-player WhatsApp nudge, counter-proposal display. Realtime changes are announced politely.
 */
import { AlarmClock, Check, CircleCheck, Hourglass, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RequestStatusBadge } from '../../../../components/StatusBadge';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { actions } from '../../../../data/mutations';
import { labelDate } from '../../../../lib/time';
import type { MatchRequest } from '../../../../types';
import { Button, cn, ConfirmDialog } from '../../../../ui';
import { courtName, type MatchContext } from '../context';
import { acceptedCount, effectiveExpiry, formatWhen, nameList, timeUntil } from '../logic';
import { CounterProposalBadge, Notice, OffGridBadge, useNowTick } from '../parts';
import { useMatchAction } from '../useMatchAction';

export function AcceptanceTracker({ ctx, request }: { ctx: MatchContext; request: MatchRequest }) {
  const { match, name } = ctx;
  const now = useNowTick(30_000);
  const [confirming, setConfirming] = useState(false);
  const accept = useMatchAction(actions.acceptRequest, 'Hai accettato la richiesta');
  const cancel = useMatchAction(actions.cancelRequest, 'Richiesta annullata');
  const total = request.players.length;
  const n = acceptedCount(request);
  const complete = n >= total;
  const missing = request.players.filter((p) => !request.acceptances[p]);
  const mustAccept = !!ctx.uid && missing.includes(ctx.uid);
  const isPlayer = !!ctx.mySide;
  const court = courtName(ctx.courts, request.courtId);
  const slotTime = `${labelDate(request.date)} alle ${request.start}`;
  // the earlier of the server expiry and the slot start (critique M1)
  const expiry = effectiveExpiry(request);
  const until = timeUntil(expiry, now);
  const urgent = expiry - now < 2 * 3_600_000;

  // polite announcement of realtime changes ("Marta ha accettato: 4 su 4")
  const before = useRef<Record<string, boolean> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const current = Object.fromEntries(request.players.map((p) => [p, !!request.acceptances[p]]));
    const prev = before.current;
    before.current = current;
    if (!prev) return;
    const added = request.players.filter((p) => current[p] && !prev[p] && p !== ctx.uid);
    if (added.length) setAnnouncement(`${nameList(added.map((p) => name(p)))} ${added.length === 1 ? 'ha' : 'hanno'} accettato: ${n} su ${total}`);
  }, [request, n, total, name, ctx.uid]);

  const expiryNotice = (
    <Notice icon={AlarmClock} tone={urgent ? 'danger' : 'idle'}>
      <span className="tabular">
        {until ? `Scade ${until}` : 'Scade a momenti'} ({formatWhen(expiry)})
      </span>
    </Notice>
  );

  return (
    <div className="grid gap-4">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {urgent && expiryNotice}
      <div className="grid gap-2">
        <p className="tabular text-xl font-bold">
          Richiesta per {labelDate(request.date)} · {request.start}–{request.end} · {court}
        </p>
        <div className="flex flex-wrap gap-2">
          <RequestStatusBadge status="pending" />
          {request.offGrid && <OffGridBadge />}
          {request.counterProposal && <CounterProposalBadge />}
        </div>
        {request.counterProposal && (
          <p>
            Il campo propone questo orario al posto di quello che avevate chiesto.
            {request.note ? ` Nota del campo: «${request.note}».` : ''}
          </p>
        )}
        {!request.counterProposal && request.note && <p className="text-ink-muted">Nota per il campo: «{request.note}»</p>}
      </div>

      <ol className="grid gap-2 sm:grid-cols-2" aria-label="Avanzamento">
        <Step number={1} active={!complete} done={complete}>
          Accettazioni {n} su {total}
        </Step>
        <Step number={2} active={complete} done={false}>
          Conferma del campo
        </Step>
      </ol>

      {complete && (
        <Notice icon={Hourglass} tone="info">
          Aspettiamo la conferma del campo.
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            [ctx.nameA, match.playersA],
            [ctx.nameB, match.playersB],
          ] as const
        ).map(([team, players]) => (
          <div key={team} className="grid content-start gap-1">
            <p className="font-bold">{team}</p>
            <ul className="court-rule">
              {players
                .filter((p) => request.players.includes(p))
                .map((p) => {
                  const ok = !!request.acceptances[p];
                  const state = p === request.createdBy ? 'ha chiesto' : ok ? 'ha accettato' : 'deve accettare';
                  return (
                    <li key={p} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-1.5">
                      <span className="flex items-center gap-2">
                        {ok ? <CircleCheck className="size-5 shrink-0 text-ok-ink" aria-hidden /> : <Hourglass className="size-5 shrink-0 text-warn-ink" aria-hidden />}
                        <span>
                          <span className="font-semibold">{p === ctx.uid ? 'Tu' : name(p)}</span>{' '}
                          <span className={ok ? 'text-ink-muted' : 'font-semibold text-warn-ink'}>· {p === ctx.uid && !ok ? 'devi accettare' : state}</span>
                        </span>
                      </span>
                      {!ok && isPlayer && p !== ctx.uid && (
                        <WhatsAppButton
                          size="sm"
                          phone={ctx.phone(p)}
                          text={`${name(p)}, manca solo la tua conferma per ${slotTime} (${court}) → ${ctx.link}`}
                        >
                          Sollecita
                        </WhatsAppButton>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      {!urgent && expiryNotice}

      {isPlayer && (
        <div className="flex flex-wrap items-center gap-2">
          {mustAccept && (
            <Button variant="primary" size="lg" loading={accept.isPending} onClick={() => accept.run(request.id)}>
              <Check aria-hidden /> Accetta
            </Button>
          )}
          <WhatsAppButton
            text={
              missing.length
                ? `Ho chiesto il campo per ${slotTime} (${court}). ${nameList(missing.map((p) => name(p)))}: accettate qui → ${ctx.link}`
                : `Abbiamo chiesto il campo per ${slotTime} (${court}) per ${ctx.title}: aspettiamo la conferma → ${ctx.link}`
            }
          >
            Condividi su WhatsApp
          </WhatsAppButton>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title="Annullare la richiesta per tutti?"
            description="Il campo non la vedrà più. Potrete sceglierne un’altra subito dopo."
            confirmLabel="Annulla richiesta"
            cancelLabel="Tieni"
            loading={cancel.isPending}
            onConfirm={() => cancel.run({ request: request.id }, { onSuccess: () => setConfirming(false), onError: () => setConfirming(false) })}
            trigger={<Button variant="danger">Annulla richiesta</Button>}
          />
        </div>
      )}
      {mustAccept && (
        <p className="text-sm text-ink-muted">
          Se l’orario non ti va bene, annulla la richiesta: si annulla per tutti e potrete sceglierne un altro.
        </p>
      )}
      {!isPlayer && (
        <Notice icon={Send} tone="info">
          {missing.length ? `Manca ancora: ${nameList(missing.map((p) => name(p)))}.` : 'Tutti e 4 hanno accettato.'}
        </Notice>
      )}
    </div>
  );
}

function Step({ number, active, done, children }: { number: number; active: boolean; done: boolean; children: React.ReactNode }) {
  return (
    <li
      aria-current={active ? 'step' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-control px-3 py-2 font-semibold',
        active ? 'bg-court text-court-ink' : 'border border-line text-ink-muted',
        done && 'text-ink',
      )}
    >
      {done ? <Check className="size-5 text-ok-ink" strokeWidth={3} aria-hidden /> : <span className="tabular">{number}.</span>}
      <span className="tabular">{children}</span>
      {done && <span className="sr-only">(fatto)</span>}
    </li>
  );
}
