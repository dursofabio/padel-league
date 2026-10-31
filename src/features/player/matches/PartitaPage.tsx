/**
 * /t/:tid/partite/:mid: the match as a state machine with ONE primary block per state
 * (docs/ux/programma-partita.md §5, S0–S8) + organizer tools (docs/ux/risultato.md).
 */
import { ArrowRight, Ban, CircleX, TimerOff, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { PageHeader, Sezione } from '../../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../../components/states';
import { StatoPartitaBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../auth/AuthProvider';
import { useCampi, useNomi, useProfili, useRichiesta, useRichiesteGiocatore, useTorneoData } from '../../../data/queries';
import { labelDate, today } from '../../../lib/time';
import { nomeSquadra } from '../../../lib/torneo';
import { appUrl } from '../../../lib/whatsapp';
import type { Partita, Periodo, Richiesta, StatoPartita } from '../../../types';
import { Button, cn, Skeleton } from '../../../ui';
import { nomeCampo, type ContestoPartita } from './contesto';
import { Programmata } from './confirmed/Programmata';
import { fasePartita, inRitardo, latoDi, richiestaViva, type Fase } from './logica';
import { AVVOLGI, Avviso, DaConfermareBadge, InRitardoBadge, useOra } from './parti';
import { AcceptanceTracker } from './request/AcceptanceTracker';
import { AttesaConferma, ConfermaRisultato, Contestato, Finale, InserisciRisultato } from './result/RisultatoBlocchi';
import { StrumentiOrganizzatore } from './result/StrumentiOrganizzatore';
import { SlotGrid } from './slots/SlotGrid';

const TITOLI: Record<Fase, string> = {
  S0: 'In attesa delle coppie',
  S1: 'Scegli un orario',
  S2: 'Richiesta al campo',
  S3: 'Richiesta al campo',
  S4: 'Partita confermata',
  S5: 'Inserisci il risultato',
  S6: 'Risultato da confermare',
  S7: 'Risultato contestato',
  S8: 'Risultato',
};

const STATO_EFFETTIVO: Partial<Record<Fase, StatoPartita>> = {
  S1: 'da programmare',
  S2: 'richiesta',
  S3: 'richiesta',
  S4: 'programmata',
  S5: 'programmata',
};

export default function PartitaPage() {
  const { tid, mid } = useParams();
  const { user, hasRole } = useAuth();
  const dati = useTorneoData(tid);
  const campi = useCampi();
  const nomi = useNomi();
  const profili = useProfili();
  const partita = dati.partite.find((p) => p.id === mid);
  const richiesta = useRichiesta(partita?.richiestaId);
  const mie = useRichiesteGiocatore(user?.id);
  const now = useOra();
  const location = useLocation();

  const telefoni = useMemo(() => new Map((profili.data ?? []).map((p) => [p.id, p.telefono ?? undefined])), [profili.data]);
  const telefonoGestore = profili.data?.find((p) => p.roles.includes('gestore') && p.telefono)?.telefono ?? undefined;

  useEffect(() => {
    if (location.hash === '#risultato' && partita) document.getElementById('risultato')?.scrollIntoView({ block: 'start' });
  }, [location.hash, partita]);

  if (dati.isPending || campi.isPending)
    return (
      <div className="grid gap-6" role="status" aria-label="Caricamento della partita">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <SkeletonRighe righe={3} />
      </div>
    );
  if (dati.error || campi.error)
    return (
      <>
        <PageHeader titolo="Partita" indietro={{ to: `/t/${tid}/partite`, label: 'Le mie partite' }} />
        <ErrorState
          errore={dati.error ?? campi.error}
          onRiprova={() => {
            dati.refetch();
            campi.refetch();
          }}
        />
      </>
    );
  if (!partita || !dati.torneo)
    return (
      <>
        <PageHeader titolo="Partita non trovata" indietro={{ to: `/t/${tid}/partite`, label: 'Le mie partite' }} />
        <EmptyState
          titolo="Questa partita non esiste più"
          testo="Forse il calendario è stato rigenerato. Trovi le tue partite nell’elenco."
          azione={
            <Button asChild variant="secondary">
              <Link to={`/t/${tid}/partite`}>Vai alle mie partite</Link>
            </Button>
          }
        />
      </>
    );

  const nomeA = nomeSquadra(dati.squadraById, partita.squadraA);
  const nomeB = nomeSquadra(dati.squadraById, partita.squadraB);
  const periodo = dati.periodi.find((p) => p.id === partita.periodoId) ?? null;
  const ctx: ContestoPartita = {
    tid: tid!,
    partita,
    torneo: dati.torneo,
    periodo,
    campi: campi.data ?? [],
    nome: nomi.nome,
    nomeA,
    nomeB,
    uid: user?.id ?? null,
    mioLato: latoDi(partita, user?.id),
    telefono: (uid) => telefoni.get(uid),
    telefonoGestore,
    link: appUrl(`/t/${tid}/partite/${partita.id}`),
    titolo: `${nomeA} – ${nomeB}`,
  };

  const attesaRichiesta = !!partita.richiestaId && richiesta.isPending;
  const fase = fasePartita(partita, richiesta.data, now);
  const ritardo = inRitardo(partita, periodo, today());
  const organizzatore = hasRole('organizzatore');

  return <Schermata ctx={ctx} fase={fase} richiesta={richiesta.data ?? null} mie={mie.data ?? []} ritardo={ritardo} organizzatore={organizzatore} attesa={attesaRichiesta} />;
}

function sottotitolo(p: Partita, periodo: Periodo | null): string {
  const parti: string[] = [];
  if (p.fase === 'gironi') {
    if (p.girone) parti.push(`Girone ${p.girone}`);
    if (p.turno) parti.push(`Giornata ${p.turno}`);
  } else {
    parti.push(p.fase.charAt(0).toUpperCase() + p.fase.slice(1));
    if (p.turno) parti.push(`Turno ${p.turno}`);
  }
  if (periodo) parti.push(`da giocare entro ${labelDate(periodo.fine)}`);
  return parti.join(' · ');
}

function Schermata({
  ctx,
  fase,
  richiesta,
  mie,
  ritardo,
  organizzatore,
  attesa,
}: {
  ctx: ContestoPartita;
  fase: Fase;
  richiesta: Richiesta | null;
  mie: Richiesta[];
  ritardo: boolean;
  organizzatore: boolean;
  attesa: boolean;
}) {
  const { partita, tid } = ctx;
  const [inserisci, setInserisci] = useState(false);

  // polite announcement when the primary block changes (realtime)
  const precedente = useRef(fase);
  const [annuncio, setAnnuncio] = useState('');
  useEffect(() => {
    if (precedente.current !== fase) setAnnuncio(`La partita è cambiata: ${TITOLI[fase]}.`);
    precedente.current = fase;
  }, [fase]);

  const avversarioDaConfermare = fase === 'S6' && !!ctx.mioLato && ctx.mioLato !== latoDi(partita, partita.risultato?.inseritoDa);
  const devoAccettare = (fase === 'S2' || fase === 'S3') && !!ctx.uid && !!richiesta && richiesta.giocatori.includes(ctx.uid) && !richiesta.accettazioni[ctx.uid];
  const limeGiocatore = devoAccettare || (fase === 'S5' && !!ctx.mioLato) || avversarioDaConfermare || inserisci;
  const strumenti = organizzatore && fase !== 'S0';
  const statoBadge = STATO_EFFETTIVO[fase] ?? partita.stato;

  const blocchi: Record<Fase, () => ReactNode> = {
    S0: () => (
      <div className="grid gap-3">
        <p>La griglia si apre quando entrambe le coppie sono note.</p>
        <Link to={`/t/${tid}/tabellone/${partita.fase}`} className="inline-flex min-h-11 items-center gap-1.5 justify-self-start font-semibold text-court underline dark:text-info-ink">
          Vedi il tabellone <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    ),
    S1: () => (
      <div className="grid gap-4">
        <Motivo ctx={ctx} candidati={[...mie, ...(richiesta ? [richiesta] : [])]} />
        <SlotGrid ctx={ctx} />
      </div>
    ),
    S2: () => (richiesta ? <AcceptanceTracker ctx={ctx} richiesta={richiesta} /> : null),
    S3: () => (richiesta ? <AcceptanceTracker ctx={ctx} richiesta={richiesta} /> : null),
    S4: () => <Programmata ctx={ctx} />,
    S5: () => (
      <div className="grid gap-4">
        {partita.programmazione && (
          <p className="tabular text-ink-muted">
            Programmata {labelDate(partita.programmazione.data)} alle {partita.programmazione.inizio} · {nomeCampo(ctx.campi, partita.programmazione.campoId)}
          </p>
        )}
        {ctx.mioLato ? <InserisciRisultato ctx={ctx} /> : <p>Aspettiamo che uno dei giocatori inserisca il risultato.</p>}
      </div>
    ),
    S6: () => (avversarioDaConfermare ? <ConfermaRisultato ctx={ctx} /> : <AttesaConferma ctx={ctx} />),
    S7: () => <Contestato ctx={ctx} />,
    S8: () => <Finale ctx={ctx} />,
  };

  const sezioneStrumenti = strumenti && (
    <Sezione titolo="Strumenti organizzatore" id="strumenti-organizzatore">
      <StrumentiOrganizzatore ctx={ctx} primario={!limeGiocatore} />
    </Sezione>
  );
  const idPrimario = ['S5', 'S6', 'S7', 'S8'].includes(fase) ? 'risultato' : 'programma';

  return (
    <div className={cn('grid min-w-0 gap-6', AVVOLGI)}>
      <PageHeader
        titolo={
          <>
            {ctx.nomeA} <span className="font-normal text-ink-muted">contro</span> {ctx.nomeB}
          </>
        }
        sottotitolo={
          <span className="grid gap-2">
            <span>{sottotitolo(partita, ctx.periodo)}</span>
            <span className="flex flex-wrap gap-2">
              {fase === 'S6' ? <DaConfermareBadge /> : <StatoPartitaBadge stato={statoBadge} />}
              {ritardo && <InRitardoBadge />}
            </span>
          </span>
        }
        indietro={{ to: `/t/${tid}/partite`, label: 'Le mie partite' }}
      />
      <p className="sr-only" aria-live="polite">
        {annuncio}
      </p>

      <div className={strumenti && fase === 'S7' ? 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid gap-8'}>
        {strumenti && fase === 'S7' && sezioneStrumenti}
        <section aria-labelledby={`${idPrimario}-titolo`} id={idPrimario} className="grid scroll-mt-24 gap-4">
          <h2 id={`${idPrimario}-titolo`} className="text-xl font-bold">
            {TITOLI[fase]}
          </h2>
          {attesa ? <SkeletonRighe righe={3} /> : blocchi[fase]()}
        </section>
        {strumenti && fase !== 'S7' && sezioneStrumenti}
      </div>

      {fase === 'S1' && ctx.mioLato && (
        <Sezione titolo="Hai già giocato?" id="gia-giocato">
          {inserisci ? (
            <div id="risultato" className="scroll-mt-24">
              <InserisciRisultato ctx={ctx} onFatto={() => setInserisci(false)} onAnnulla={() => setInserisci(false)} />
            </div>
          ) : (
            <Button variant="secondary" className="justify-self-start" onClick={() => setInserisci(true)}>
              Inserisci il risultato
            </Button>
          )}
        </Sezione>
      )}

      <Sezione titolo="Giocatori" id="giocatori">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              [ctx.nomeA, partita.giocatoriA],
              [ctx.nomeB, partita.giocatoriB],
            ] as const
          ).map(([coppia, gs], i) => (
            <div key={i} className="grid content-start gap-1">
              <p className="font-bold">{coppia}</p>
              {gs.length ? (
                <ul className="court-rule">
                  {gs.map((g) => (
                    <li key={g} className="py-2">
                      {ctx.nome(g)}
                      {g === ctx.uid && <span className="text-ink-muted"> (tu)</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">Coppia da definire</p>
              )}
            </div>
          ))}
        </div>
        {ctx.periodo && (
          <p className="tabular text-ink-muted">
            {ctx.periodo.etichetta}: dal {labelDate(ctx.periodo.inizio)} al {labelDate(ctx.periodo.fine)}
          </p>
        )}
      </Sezione>
    </div>
  );
}

/** Why the grid is back (S1): the last request of this match failed. */
function Motivo({ ctx, candidati }: { ctx: ContestoPartita; candidati: Richiesta[] }) {
  const now = Date.now();
  const ultima = candidati
    .filter((r) => r.partitaId === ctx.partita.id)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.scadenza.toMillis() - a.scadenza.toMillis())[0];
  if (!ultima || richiestaViva(ultima, now) || ultima.stato === 'confermata') return null;
  const quando = `${labelDate(ultima.data)} alle ${ultima.inizio}`;
  if (ultima.stato === 'scaduta' || ultima.stato === 'attesa')
    return (
      <Avviso icona={TimerOff} tono="warn">
        La richiesta per {quando} è scaduta senza risposta. Scegline un’altra.
      </Avviso>
    );
  if (ultima.stato === 'rifiutata')
    return (
      <Avviso icona={CircleX} tono="danger">
        Il campo ha rifiutato {quando}
        {ultima.nota ? `: «${ultima.nota}»` : ''}. Scegli un altro orario.
      </Avviso>
    );
  if (ultima.stato === 'conflitto')
    return (
      <Avviso icona={TriangleAlert} tono="danger">
        Mentre il campo confermava {quando}, l’orario risultava già occupato. Scegline un altro.
      </Avviso>
    );
  if (ultima.stato === 'annullata')
    return (
      <Avviso icona={Ban}>
        La richiesta per {quando} è stata annullata{ultima.nota ? `: «${ultima.nota}»` : ''}. Scegli un altro orario.
      </Avviso>
    );
  return null;
}

