import { AlarmClock, Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { messaggioErrore } from '../../data/errors';
import { azioni, useAzione, type EsitoConferma } from '../../data/mutations';
import { descriviScadenza, type AttentionItem } from '../../lib/attention';
import { appUrl } from '../../lib/whatsapp';
import { Button, buttonVariants } from '../../ui/button';
import { cn } from '../../ui/cn';
import { doveQuando, testoRiga, type Contesto } from './contenuto';

/** Where tapping the row body leads (also for inline items). */
function destinazione(it: AttentionItem, tid: string): string {
  if (it.action.type === 'navigate') return it.action.to;
  const t = it.refs.torneoId || tid;
  switch (it.action.rpc) {
    case 'accept_request':
      return `/t/${t}/partite/${it.refs.partitaId}`;
    case 'confirm_result':
      return `/t/${t}/partite/${it.refs.partitaId}#risultato`;
    case 'confirm_request':
      return `/campo?r=${it.action.id}`;
    case 'approve_team':
      return `/t/${t}/organizza/squadre`;
  }
}

class EsitoNonOk extends Error {}

async function esegui(it: AttentionItem): Promise<void> {
  if (it.action.type !== 'inline') return;
  const id = it.action.id;
  switch (it.action.rpc) {
    case 'accept_request':
      await azioni.accettaRichiesta(id);
      return;
    case 'confirm_result':
      await azioni.confermaRisultato(id);
      return;
    case 'confirm_request': {
      const r: EsitoConferma = await azioni.confermaRichiesta(id);
      if (r?.esito === 'occupato') throw new EsitoNonOk('Il campo è già occupato in quell’orario: apri la richiesta per proporre un altro orario.');
      if (r?.esito === 'scaduta') throw new EsitoNonOk('Questa richiesta è scaduta nel frattempo.');
      return;
    }
    case 'approve_team':
      await azioni.aggiornaSquadra({ id, stato: 'approvata' });
      return;
  }
}

function erroreRiga(it: AttentionItem, e: unknown): string {
  if (e instanceof EsitoNonOk) return e.message;
  const hint = (e as { hint?: string } | null)?.hint;
  if (hint === 'EXPIRED' && it.kind === 'accetta-richiesta') return 'Questa richiesta è scaduta nel frattempo: scegli un altro orario dalla partita.';
  return messaggioErrore(e);
}

function fattoTesto(it: AttentionItem): string {
  switch (it.kind) {
    case 'accetta-richiesta': {
      const mancanti = it.mancanti?.length ?? 1;
      return `Accettata · ora ${Math.min(4, 4 - mancanti + 1)}/4`;
    }
    case 'conferma-risultato':
      return 'Risultato confermato';
    case 'conferma-richiesta':
      return 'Confermata: il campo è prenotato';
    case 'squadra-da-approvare':
      return 'Coppia approvata';
    default:
      return 'Fatto';
  }
}

/**
 * One row of the feed: icon, what to do, pairs, what is missing and until when, action.
 * Tapping the text opens the screen; the button does the inline action.
 */
export function RigaAttenzione({
  it,
  ctx,
  now,
  primaria,
  fatto,
  onFatto,
}: {
  it: AttentionItem;
  ctx: Contesto;
  now: number;
  primaria: boolean;
  fatto?: string;
  onFatto: (it: AttentionItem, testo: string) => void;
}) {
  const t = testoRiga(it, ctx);
  const [errore, setErrore] = useState<string | null>(null);
  const az = useAzione(() => esegui(it), {
    errore: false,
    onSuccess: () => {
      setErrore(null);
      onFatto(it, fattoTesto(it));
    },
  });
  const to = destinazione(it, ctx.tid);
  const scadenza = it.deadline && it.kind !== 'prossima-partita' ? descriviScadenza(it.deadline, now) : null;
  const Icona = t.icona;
  const variante = primaria ? 'primary' : 'secondary';
  const bottone = cn(primaria && 'w-full md:w-auto');

  let azione: React.ReactNode;
  if (fatto) {
    azione = (
      <span className="inline-flex min-h-11 items-center gap-2 font-semibold text-ok-ink">
        <Check className="size-5" aria-hidden />
        {fatto}
      </span>
    );
  } else if (it.action.type === 'inline') {
    azione = (
      <div className="flex flex-wrap gap-2">
        <Button
          variant={variante}
          className={bottone}
          loading={az.isPending}
          onClick={() => {
            setErrore(null);
            az.mutate(undefined, { onError: (e) => setErrore(erroreRiga(it, e)) });
          }}
        >
          {t.azione}
        </Button>
        {it.kind === 'conferma-risultato' && (
          <Link to={to} className={buttonVariants({ variant: 'ghost' })}>
            Contesta
          </Link>
        )}
      </div>
    );
  } else if (it.kind === 'richiesta-in-corso' && it.mancanti?.length) {
    const r = it.refs.richiestaId ? ctx.richiestaById.get(it.refs.richiestaId) : undefined;
    const quando = r ? doveQuando(r, ctx.campi) : 'l’orario proposto';
    azione = (
      <WhatsAppButton
        testo={`Ciao, per la nostra partita manca la tua conferma per ${quando}. Accetta qui: ${appUrl(to)}`}
        className={cn(primaria && 'w-full md:w-auto')}
      >
        {t.azione}
      </WhatsAppButton>
    );
  } else {
    azione = (
      <Link to={to} className={cn(buttonVariants({ variant: variante }), bottone)}>
        {t.azione}
      </Link>
    );
  }

  return (
    <div className="grid gap-2 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <Link to={to} className="-mx-2 flex min-h-11 min-w-0 gap-3 rounded-control px-2 py-1 hover:bg-surface-2">
          <Icona className="mt-0.5 size-6 shrink-0 text-court dark:text-info-ink" aria-hidden />
          <span className="grid min-w-0 gap-0.5">
            <span className="text-base font-bold text-balance">{t.titolo}</span>
            {t.coppie && <span className="text-base">{t.coppie}</span>}
            {t.dettaglio && <span className="tabular text-sm text-ink-muted">{t.dettaglio}</span>}
            {scadenza && (
              <span className={cn('tabular flex items-center gap-1.5 text-sm font-semibold', it.priority === 0 ? 'text-danger-ink' : 'text-ink-muted')}>
                <AlarmClock className="size-4 shrink-0" aria-hidden />
                {scadenza}
              </span>
            )}
          </span>
        </Link>
        <div className="shrink-0 md:max-w-[50%]">{azione}</div>
      </div>
      {errore && (
        <p role="alert" className="text-sm font-semibold text-danger-ink">
          {errore}
        </p>
      )}
    </div>
  );
}
