import { Check, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { formatRisultato, risultatoUfficiale } from '../lib/results';
import { labelDate } from '../lib/time';
import { nomeSquadra } from '../lib/torneo';
import type { Campo, Partita, Squadra } from '../types';
import { cn } from '../ui/cn';
import { StatoPartitaBadge } from './StatusBadge';

/** One row per match: pairs, date/court or result, state. Separated by court lines in the parent list. */
export function MatchRow({
  p,
  squadraById,
  campi,
  href,
  override,
  evidenzia,
  nota,
  senzaStato,
  vincitore,
}: {
  /** Preview (e.g. bracket not generated yet): no status badge. */
  senzaStato?: boolean;
  /** Winning pair (knockout): bold with a check icon. */
  vincitore?: string | null;
  p: Partita;
  squadraById: Map<string, Squadra>;
  campi: Campo[];
  href?: string;
  override?: { squadraA: string | null; squadraB: string | null };
  evidenzia?: string[];
  nota?: React.ReactNode;
}) {
  const a = override?.squadraA ?? p.squadraA;
  const b = override?.squadraB ?? p.squadraB;
  const prog = p.programmazione;
  const campo = prog ? (campi.find((c) => c.id === prog.campoId)?.nome ?? prog.campoId) : null;
  const ris = risultatoUfficiale(p) ? formatRisultato(p.risultato!.set) : null;
  const nome = (id: string | null) => (
    <span className={cn(id && (evidenzia?.includes(id) || vincitore === id) && 'font-bold')}>
      {id && vincitore === id && <Check className="mr-0.5 inline size-4 text-ok" aria-label="vincitore" />}
      {nomeSquadra(squadraById, id)}
    </span>
  );
  const body = (
    <>
      <span className="grid min-w-0 gap-1">
        <span className="text-base break-words">
          {nome(a)} <span className="text-ink-muted">contro</span> {nome(b)}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {ris ? (
            <span className="tabular font-bold text-ink">{ris}</span>
          ) : prog ? (
            <span className="tabular">
              {labelDate(prog.data)} · {prog.inizio} · {campo}
            </span>
          ) : null}
          {!senzaStato && <StatoPartitaBadge stato={p.stato} />}
          {nota}
        </span>
      </span>
      {href && <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />}
    </>
  );
  const cls = 'flex min-h-14 items-center justify-between gap-3 py-3';
  return href ? (
    <Link to={href} className={cn(cls, '-mx-2 rounded-control px-2 hover:bg-surface-2')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
