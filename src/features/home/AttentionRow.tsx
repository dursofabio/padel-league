import { AlarmClock, Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { errorMessage } from '../../data/errors';
import { actions, useAction, type ConfirmOutcome } from '../../data/mutations';
import { describeDeadline, type AttentionItem } from '../../lib/attention';
import { appUrl } from '../../lib/whatsapp';
import { Button, buttonVariants } from '../../ui/button';
import { cn } from '../../ui/cn';
import { rowText, whereWhen, type RowContext } from './content';

/** Where tapping the row body leads (also for inline items). */
function destination(it: AttentionItem, tid: string): string {
  if (it.action.type === 'navigate') return it.action.to;
  const t = it.refs.tournamentId || tid;
  switch (it.action.rpc) {
    case 'accept_request':
      return `/t/${t}/partite/${it.refs.matchId}`;
    case 'confirm_result':
      return `/t/${t}/partite/${it.refs.matchId}#risultato`;
    case 'confirm_request':
      return `/campo?r=${it.action.id}`;
    case 'approve_team':
      return `/t/${t}/organizza/squadre`;
  }
}

class OutcomeNotOk extends Error {}

async function run(it: AttentionItem): Promise<void> {
  if (it.action.type !== 'inline') return;
  const id = it.action.id;
  switch (it.action.rpc) {
    case 'accept_request':
      await actions.acceptRequest(id);
      return;
    case 'confirm_result':
      await actions.confirmResult(id);
      return;
    case 'confirm_request': {
      const r: ConfirmOutcome = await actions.confirmRequest(id);
      if (r?.outcome === 'taken') throw new OutcomeNotOk('Il campo è già occupato in quell’orario: apri la richiesta per proporre un altro orario.');
      if (r?.outcome === 'expired') throw new OutcomeNotOk('Questa richiesta è scaduta nel frattempo.');
      return;
    }
    case 'approve_team':
      await actions.updateTeam({ id, status: 'approved' });
      return;
  }
}

function rowError(it: AttentionItem, e: unknown): string {
  if (e instanceof OutcomeNotOk) return e.message;
  const hint = (e as { hint?: string } | null)?.hint;
  if (hint === 'EXPIRED' && it.kind === 'accept-request') return 'Questa richiesta è scaduta nel frattempo: scegli un altro orario dalla partita.';
  return errorMessage(e);
}

function doneText(it: AttentionItem): string {
  switch (it.kind) {
    case 'accept-request': {
      const missing = it.missing?.length ?? 1;
      return `Accettata · ora ${Math.min(4, 4 - missing + 1)}/4`;
    }
    case 'confirm-result':
      return 'Risultato confermato';
    case 'confirm-request':
      return 'Confermata: il campo è prenotato';
    case 'approve-team':
      return 'Coppia approvata';
    default:
      return 'Fatto';
  }
}

/**
 * One row of the feed: icon, what to do, pairs, what is missing and until when, action.
 * Tapping the text opens the screen; the button does the inline action.
 */
export function AttentionRow({
  it,
  ctx,
  now,
  primary,
  done,
  onDone,
}: {
  it: AttentionItem;
  ctx: RowContext;
  now: number;
  primary: boolean;
  done?: string;
  onDone: (it: AttentionItem, text: string) => void;
}) {
  const t = rowText(it, ctx);
  const [error, setError] = useState<string | null>(null);
  const mutation = useAction(() => run(it), {
    error: false,
    onSuccess: () => {
      setError(null);
      onDone(it, doneText(it));
    },
  });
  const to = destination(it, ctx.tid);
  const deadline = it.deadline && it.kind !== 'upcoming-match' ? describeDeadline(it.deadline, now) : null;
  const Icon = t.icon;
  const variant = primary ? 'primary' : 'secondary';
  const buttonCls = cn(primary && 'w-full md:w-auto');

  let action: React.ReactNode;
  if (done) {
    action = (
      <span className="inline-flex min-h-11 items-center gap-2 font-semibold text-ok-ink">
        <Check className="size-5" aria-hidden />
        {done}
      </span>
    );
  } else if (it.action.type === 'inline') {
    action = (
      <div className="flex flex-wrap gap-2">
        <Button
          variant={variant}
          className={buttonCls}
          loading={mutation.isPending}
          onClick={() => {
            setError(null);
            mutation.mutate(undefined, { onError: (e) => setError(rowError(it, e)) });
          }}
        >
          {t.action}
        </Button>
        {it.kind === 'confirm-result' && (
          <Link to={to} className={buttonVariants({ variant: 'ghost' })}>
            Contesta
          </Link>
        )}
      </div>
    );
  } else if (it.kind === 'request-in-progress' && it.missing?.length) {
    const r = it.refs.requestId ? ctx.requestById.get(it.refs.requestId) : undefined;
    const when = r ? whereWhen(r, ctx.courts) : 'l’orario proposto';
    action = (
      <WhatsAppButton
        text={`Ciao, per la nostra partita manca la tua conferma per ${when}. Accetta qui: ${appUrl(to)}`}
        className={cn(primary && 'w-full md:w-auto')}
      >
        {t.action}
      </WhatsAppButton>
    );
  } else {
    action = (
      <Link to={to} className={cn(buttonVariants({ variant }), buttonCls)}>
        {t.action}
      </Link>
    );
  }

  return (
    <div className="grid gap-2 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <Link to={to} className="-mx-2 flex min-h-11 min-w-0 gap-3 rounded-control px-2 py-1 hover:bg-surface-2">
          <Icon className="mt-0.5 size-6 shrink-0 text-court dark:text-info-ink" aria-hidden />
          <span className="grid min-w-0 gap-0.5">
            <span className="text-base font-bold text-balance">{t.title}</span>
            {t.teams && <span className="text-base">{t.teams}</span>}
            {t.detail && <span className="tabular text-sm text-ink-muted">{t.detail}</span>}
            {deadline && (
              <span className={cn('tabular flex items-center gap-1.5 text-sm font-semibold', it.priority === 0 ? 'text-danger-ink' : 'text-ink-muted')}>
                <AlarmClock className="size-4 shrink-0" aria-hidden />
                {deadline}
              </span>
            )}
          </span>
        </Link>
        <div className="shrink-0 md:max-w-[50%]">{action}</div>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
