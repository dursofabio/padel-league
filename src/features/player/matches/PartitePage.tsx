/**
 * /t/:tid/partite: my matches grouped by state. What needs me first (acceptances, results to confirm or enter),
 * then to schedule (late ones on top, "In ritardo"), requests in progress, scheduled, pending results, closed.
 */
import { AlarmClock, CircleCheck, Hourglass, PenLine } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MatchRow } from '../../../components/MatchRow';
import { StatoPartitaBadge } from '../../../components/StatusBadge';
import { PageHeader, Sezione } from '../../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../../components/states';
import { useAuth } from '../../../auth/AuthProvider';
import { useCampi, useRichiesteGiocatore, useTorneoData } from '../../../data/queries';
import { labelDate, today } from '../../../lib/time';
import type { Partita, Richiesta, StatoPartita } from '../../../types';
import { Button, cn } from '../../../ui';
import { fasePartita, GRUPPI, gruppoPartita, inRitardo, istante, scadenzaEffettiva, traQuanto, type Fase, type GruppoPartita, type MotivoTurno } from './logica';
import { AVVOLGI, DaConfermareBadge, InRitardoBadge, Pill, useOra } from './parti';

interface Voce {
  p: Partita;
  richiesta?: Richiesta;
  motivo?: MotivoTurno;
  ritardo: boolean;
  fase: Fase;
  /** Period end ("entro …" on open matches). */
  fine?: string;
  /** Sort key inside the group. */
  ordine: number;
}

export default function PartitePage() {
  const { tid } = useParams();
  const { user } = useAuth();
  const dati = useTorneoData(tid);
  const campi = useCampi();
  const richieste = useRichiesteGiocatore(user?.id);
  const now = useOra();
  const oggi = today();
  const uid = user?.id ?? '';

  const gruppi = useMemo(() => {
    const perId = new Map((richieste.data ?? []).map((r) => [r.id, r]));
    const periodi = new Map(dati.periodi.map((p) => [p.id, p]));
    const out = new Map<GruppoPartita, Voce[]>();
    for (const p of dati.partite) {
      if (!p.giocatori.includes(uid)) continue;
      const richiesta = p.richiestaId ? perId.get(p.richiestaId) : undefined;
      const { gruppo, motivo } = gruppoPartita(p, richiesta, uid, now);
      const periodo = p.periodoId ? periodi.get(p.periodoId) : undefined;
      const ritardo = inRitardo(p, periodo, oggi);
      const ordine =
        gruppo === 'programmate' && p.programmazione
          ? istante(p.programmazione.data, p.programmazione.inizio)
          : gruppo === 'tocca-a-te' && richiesta
            ? scadenzaEffettiva(richiesta)
            : gruppo === 'concluse'
              ? -Date.parse(periodo?.fine ?? '1970-01-01')
              : Date.parse(periodo?.fine ?? '2999-01-01');
      const lista = out.get(gruppo) ?? [];
      lista.push({ p, richiesta, motivo, ritardo, ordine, fase: fasePartita(p, richiesta, now), fine: periodo?.fine });
      out.set(gruppo, lista);
    }
    for (const l of out.values()) l.sort((a, b) => a.ordine - b.ordine || (a.p.codice ?? '').localeCompare(b.p.codice ?? ''));
    return out;
  }, [dati.partite, dati.periodi, richieste.data, uid, now, oggi]);

  const header = <PageHeader titolo="Le mie partite" sottotitolo={dati.torneo?.nome} />;
  if (dati.isPending || campi.isPending || (!!uid && richieste.isPending))
    return (
      <>
        {header}
        <SkeletonRighe righe={6} />
      </>
    );
  if (dati.error || campi.error || richieste.error)
    return (
      <>
        {header}
        <ErrorState
          errore={dati.error ?? campi.error ?? richieste.error}
          onRiprova={() => {
            dati.refetch();
            campi.refetch();
            richieste.refetch();
          }}
        />
      </>
    );
  const totale = [...gruppi.values()].reduce((n, l) => n + l.length, 0);
  if (!totale)
    return (
      <>
        {header}
        <EmptyState
          titolo="Non hai ancora partite in questo torneo"
          testo="Le partite compaiono qui quando la tua coppia è approvata e l’organizzatore genera il calendario. Intanto puoi segnare le tue disponibilità."
          azione={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link to={`/t/${tid}/coppia`}>Vai alla tua coppia</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to={`/t/${tid}/disponibilita`}>Segna le disponibilità</Link>
              </Button>
            </div>
          }
        />
      </>
    );

  return (
    <>
      {header}
      <div className={cn('grid gap-8', AVVOLGI)}>
        {GRUPPI.map(({ id, titolo }) => {
          const lista = gruppi.get(id);
          if (!lista?.length) return null;
          return (
            <Sezione key={id} id={`gruppo-${id}`} titolo={`${titolo} (${lista.length})`}>
              <ul className="court-rule">
                {lista.map((v) => (
                  <li key={v.p.id}>
                    <MatchRow
                      p={v.p}
                      squadraById={dati.squadraById}
                      campi={campi.data ?? []}
                      href={`/t/${tid}/partite/${v.p.id}${v.motivo === 'conferma-risultato' || v.motivo === 'inserisci-risultato' ? '#risultato' : ''}`}
                      senzaStato
                      nota={<Nota v={v} now={now} />}
                    />
                  </li>
                ))}
              </ul>
            </Sezione>
          );
        })}
      </div>
    </>
  );
}

const STATO_FASE: Partial<Record<Fase, StatoPartita>> = { S2: 'richiesta', S3: 'richiesta', S4: 'programmata', S5: 'programmata' };

function Nota({ v, now }: { v: Voce; now: number }) {
  const parti = [];
  // the derived state, not the raw one (an expired request reads "da programmare"); the "Da programmare"
  // group heading already says it, and "Tocca a te" rows carry their own action pill
  if (!v.motivo) {
    if (v.fase === 'S6') parti.push(<DaConfermareBadge key="s" />);
    else if (v.fase !== 'S0' && v.fase !== 'S1') parti.push(<StatoPartitaBadge key="s" stato={STATO_FASE[v.fase] ?? v.p.stato} />);
  }
  if (v.ritardo) parti.push(<InRitardoBadge key="r" />);
  else if (v.fine && ['S1', 'S2', 'S3'].includes(v.fase))
    parti.push(
      <span key="f" className="tabular">
        entro {labelDate(v.fine)}
      </span>,
    );
  if (v.motivo === 'accetta' && v.richiesta) {
    const tra = traQuanto(scadenzaEffettiva(v.richiesta), now);
    parti.push(
      <Pill key="m" icona={Hourglass} tono="warn">
        Accetta {labelDate(v.richiesta.data)} {v.richiesta.inizio}
      </Pill>,
    );
    if (tra)
      parti.push(
        <span key="t" className="tabular inline-flex items-center gap-1">
          <AlarmClock className="size-4" aria-hidden /> scade {tra}
        </span>,
      );
  }
  if (v.motivo === 'conferma-risultato')
    parti.push(
      <Pill key="m" icona={CircleCheck} tono="warn">
        Conferma il risultato
      </Pill>,
    );
  if (v.motivo === 'inserisci-risultato')
    parti.push(
      <Pill key="m" icona={PenLine} tono="warn">
        Inserisci il risultato
      </Pill>,
    );
  return parti.length ? <>{parti}</> : null;
}
