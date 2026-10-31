import { AlarmClock, ArrowRight, Check } from 'lucide-react';
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

/** How a feed item is drawn: lime = the one thing to do now, clay = availability, paper = other actions, plain = for information. */
export type RowTone = 'ball' | 'clay' | 'paper' | 'plain';

const BLOCK: Record<Exclude<RowTone, 'plain'>, string> = {
  ball: 'border-edge bg-ball text-ball-ink',
  clay: 'border-edge bg-clay text-clay-ink',
  paper: 'border-line-strong bg-surface text-ink',
};

/** Deadline as a stamp; urgent ones (priority 0) in danger red, always with the clock icon and the words. */
export function DeadlineStamp({ text, urgent }: { text: string; urgent: boolean }) {
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1.5 justify-self-start rounded-full border-2 px-2.5 py-0.5 text-sm font-bold',
        urgent ? 'border-danger bg-danger text-white' : 'border-current',
      )}
    >
      <AlarmClock className="size-4 shrink-0" aria-hidden />
      {text}
    </span>
  );
}

/**
 * One item of the feed: a poster block (or a plain row for information) with what to do,
 * the pairs, what is missing and until when, and the action.
 * Tapping the text opens the screen; the button does the inline action.
 */
export function AttentionRow({
  it,
  ctx,
  now,
  tone,
  done,
  onDone,
}: {
  it: AttentionItem;
  ctx: RowContext;
  now: number;
  tone: RowTone;
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
  const filled = tone === 'ball' || tone === 'clay';
  const variant = filled ? 'ink' : 'secondary';
  const buttonCls = cn(filled && 'w-full sm:w-auto');

  let action: React.ReactNode;
  if (done) {
    action = (
      <span className={cn('inline-flex min-h-11 items-center gap-2 font-bold', !filled && 'text-ok-ink')}>
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
          <Link to={to} className={buttonVariants({ variant: 'ghost', className: filled ? 'hover:bg-edge/10' : undefined })}>
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
        variant={variant}
        className={buttonCls}
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

  const errorLine = error && (
    <p role="alert" className={cn('text-sm font-bold', filled ? 'rounded-control bg-paper px-2 py-1 text-danger-ink' : 'text-danger-ink')}>
      {error}
    </p>
  );

  if (tone === 'plain')
    return (
      <div className="grid gap-2 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
          <Link to={to} className="-mx-2 flex min-h-11 min-w-0 gap-3 rounded-control px-2 py-1 hover:bg-surface-2">
            <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span className="grid min-w-0 gap-0.5">
              <span className="font-bold text-balance">{t.title}</span>
              {t.teams && <span>{t.teams}</span>}
              {t.detail && <span className="tabular text-sm text-ink-muted">{t.detail}</span>}
            </span>
          </Link>
          <div className="shrink-0">{action}</div>
        </div>
        {errorLine}
      </div>
    );

  // The big line leads (the pairs, or the task when there are none); the task follows as the supporting line.
  // Only the lime block speaks at poster size; the other blocks step down one size.
  const big = cn('poster break-words', tone === 'ball' ? 'text-poster-sm' : 'text-xl leading-tight');
  const lines = (
    <>
      <span className={big}>{t.teams ?? t.title}</span>
      {t.teams && (
        <span className="flex items-center gap-2 font-bold">
          <Icon className="size-5 shrink-0" aria-hidden />
          {t.title}
        </span>
      )}
      {t.detail && <span className="tabular font-semibold">{t.detail}</span>}
    </>
  );

  // A block that only opens a screen is one link, whole surface; the button is its visible label.
  if (!done && it.action.type === 'navigate' && !(it.kind === 'request-in-progress' && it.missing?.length))
    return (
      <Link to={to} className={cn('group grid gap-3 rounded-panel border-2 p-4 sm:p-5', BLOCK[tone])}>
        <span className="grid min-w-0 gap-1.5 group-hover:underline">{lines}</span>
        {deadline && <DeadlineStamp text={deadline} urgent={it.priority === 0} />}
        <span className={cn(buttonVariants({ variant }), buttonCls, 'justify-self-start')}>
          {t.action}
          <ArrowRight className="transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />
        </span>
      </Link>
    );

  return (
    <div className={cn('grid gap-3 rounded-panel border-2 p-4 sm:p-5', BLOCK[tone])}>
      <Link to={to} className="-m-1 grid min-w-0 gap-1.5 rounded-control p-1 hover:underline">
        {lines}
      </Link>
      {deadline && <DeadlineStamp text={deadline} urgent={it.priority === 0} />}
      <div>{action}</div>
      {errorLine}
    </div>
  );
}
