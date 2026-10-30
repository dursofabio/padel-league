import { Link } from 'react-router-dom';
import { formatRisultato } from '../lib/results';
import { labelDate } from '../lib/time';
import { nomeSquadra } from '../lib/torneo';
import type { Campo, Partita, Squadra } from '../types';
import { Badge, STATO_TONO } from './ui';

export function PartitaRiga({
  p,
  squadraById,
  campi,
  tid,
  link,
  override,
}: {
  p: Partita;
  squadraById: Map<string, Squadra>;
  campi: Campo[];
  tid: string;
  link?: boolean;
  override?: { squadraA: string | null; squadraB: string | null };
}) {
  const a = override?.squadraA ?? p.squadraA;
  const b = override?.squadraB ?? p.squadraB;
  const prog = p.programmazione;
  const campo = prog ? campi.find((c) => c.id === prog.campoId)?.nome ?? prog.campoId : null;
  const ris = p.risultato && (p.stato === 'giocata' || p.stato === 'tavolino') ? formatRisultato(p.risultato.set) : null;
  const body = (
    <>
      <span className="teams">
        {nomeSquadra(squadraById, a)} <span className="muted">vs</span> {nomeSquadra(squadraById, b)}
      </span>
      <span className="meta">
        {ris ? <strong>{ris}</strong> : prog ? `${labelDate(prog.data)} ${prog.inizio} · ${campo}` : null}{' '}
        <Badge tone={STATO_TONO[p.stato]}>{p.stato}</Badge>
      </span>
    </>
  );
  return link ? (
    <Link className="partita" to={`/t/${tid}/partita/${p.id}`}>{body}</Link>
  ) : (
    <div className="partita">{body}</div>
  );
}
