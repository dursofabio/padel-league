/**
 * Signature of the product: the week drawn as two parallel court lanes per day (Campo 2 offset by 30'),
 * every slot a button with icon + text + tone (+ pattern), keyboard roving focus, sheet on selection.
 */
import { CalendarRange, Check, ChevronLeft, ChevronRight, Clock3, Info, UserRoundX } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { CourtLanes, LaneBlock, scalaDaCampi } from '../../../../components/CourtLanes';
import { ErrorState } from '../../../../components/states';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { useDisponibilita, useOccupazioni, useRichiesteFinestra } from '../../../../data/queries';
import { campoAttivo, classificaSlot, occupazioniId, slotGriglia, type StatoSlot } from '../../../../lib/slots';
import { labelDate, toMin, today } from '../../../../lib/time';
import { appUrl } from '../../../../lib/whatsapp';
import type { Fasce } from '../../../../types';
import { Button, cn, Label, Skeleton, Switch } from '../../../../ui';
import type { ContestoPartita } from '../contesto';
import { ariaSlot, elencoNomi, etichettaSlot, finestraSettimana, muoviFocus, type CellaNav, type TastoNav } from '../logica';
import { Avviso, SLOT_UI, useOra } from '../parti';
import { OffGrid } from './OffGrid';
import { SlotSheet } from './SlotSheet';

const TASTI: TastoNav[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'];
const chiave = (s: StatoSlot) => `${s.slot.data}|${s.slot.campoId}|${s.slot.inizio}`;
const LEGENDA_VISTA = 'padel-legenda-vista';

interface Giorno {
  data: string;
  aperto: boolean;
  perCampo: Record<string, StatoSlot[]>;
  /** Visible slots of the day, in time order (both courts). */
  ordinati: StatoSlot[];
}

export function SlotGrid({ ctx }: { ctx: ContestoPartita }) {
  const { partita, campi: tuttiCampi, tid, nome } = ctx;
  const giocatori = partita.giocatori;
  const now = useOra();
  const oggi = today();
  const [settimana, setSettimana] = useState(0);
  const f = finestraSettimana(ctx.periodo, oggi, settimana);
  const disp = useDisponibilita(tid, giocatori);
  const occ = useOccupazioni(f.from, f.to);
  const ric = useRichiesteFinestra(f.from, f.to);
  const [soloVerdi, setSoloVerdi] = useState(false);
  const [sel, setSel] = useState<StatoSlot | null>(null);
  const [fuori, setFuori] = useState<{ open: boolean; campoId?: string; data?: string }>({ open: false });
  const [attivo, setAttivo] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const campi = useMemo(() => [...tuttiCampi].sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)), [tuttiCampi]);
  const scala = useMemo(() => scalaDaCampi(campi, 0.8), [campi]);

  const fasce = useMemo(
    () => Object.fromEntries(giocatori.map((g) => [g, disp.data?.[g]?.fasce])) as Record<string, Fasce | undefined>,
    [disp.data, giocatori],
  );
  const richieste = useMemo(() => (ric.data ?? []).filter((r) => r.partitaId !== partita.id), [ric.data, partita.id]);
  const minutoOra = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  const giorni: Giorno[] = useMemo(
    () =>
      f.giorni.map((data) => {
        const perCampo: Record<string, StatoSlot[]> = {};
        for (const c of campi) {
          perCampo[c.id] = slotGriglia(c, data)
            .filter((s) => data > oggi || (data === oggi && toMin(s.inizio) > minutoOra))
            .map((s) => classificaSlot(s, giocatori, fasce, occ.perGiorno[occupazioniId(c.id, data)], richieste, now))
            .filter((s) => !soloVerdi || s.colore === 'verde');
        }
        const ordinati = Object.values(perCampo)
          .flat()
          .sort((a, b) => toMin(a.slot.inizio) - toMin(b.slot.inizio) || campi.findIndex((c) => c.id === a.slot.campoId) - campi.findIndex((c) => c.id === b.slot.campoId));
        return { data, aperto: campi.some((c) => campoAttivo(c, data)), perCampo, ordinati };
      }),
    [f.from, f.to, campi, giocatori, fasce, occ.perGiorno, richieste, soloVerdi, oggi, minutoOra, now],
  );

  // counts on the full week (independent of the "only 4/4" filter)
  const verdi = useMemo(() => {
    let n = 0;
    for (const data of f.giorni)
      for (const c of campi)
        for (const s of slotGriglia(c, data)) {
          if (data === oggi && toMin(s.inizio) <= minutoOra) continue;
          if (classificaSlot(s, giocatori, fasce, occ.perGiorno[occupazioniId(c.id, data)], richieste, now).colore === 'verde') n++;
        }
    return n;
  }, [f.from, f.to, campi, giocatori, fasce, occ.perGiorno, richieste, oggi, minutoOra, now]);

  // players with no availability at all in the period (or in the window when there is no open period)
  const senzaDisponibilita = useMemo(() => {
    const da = ctx.periodo && !f.periodoFinito ? ctx.periodo.inizio : f.from;
    const a = ctx.periodo && !f.periodoFinito ? ctx.periodo.fine : f.to;
    return giocatori.filter((g) => !Object.entries(fasce[g] ?? {}).some(([d, v]) => d >= da && d <= a && v.length > 0));
  }, [giocatori, fasce, ctx.periodo, f.from, f.to, f.periodoFinito]);

  const celle: CellaNav[][] = useMemo(
    () => giorni.map((g) => g.ordinati.map((s) => ({ key: chiave(s), campoId: s.slot.campoId, inizio: s.slot.inizio }))),
    [giorni],
  );
  const tutte = celle.flat();
  const focusKey = attivo && tutte.some((c) => c.key === attivo) ? attivo : (tutte[0]?.key ?? null);

  const onKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, key: string) => {
      if (!TASTI.includes(e.key as TastoNav)) return;
      const next = muoviFocus(
        celle,
        key,
        e.key as TastoNav,
        campi.map((c) => c.id),
      );
      e.preventDefault();
      if (!next) return;
      setAttivo(next);
      refs.current.get(next)?.focus();
    },
    [celle, campi],
  );

  const chiudiSheet = () => {
    const k = sel ? chiave(sel) : null;
    setSel(null);
    // the sheet has no trigger: give focus back to the slot
    if (k) setTimeout(() => refs.current.get(k)?.focus(), 0);
  };

  const caricamento = disp.isPending || occ.isPending || ric.isPending;
  const errore = disp.error || occ.error || ric.error;
  const consenti = ctx.torneo.config.consentiFuoriGriglia;
  const giocatore = !!ctx.mioLato;
  const nomiSenza = senzaDisponibilita.map((g) => nome(g));
  const linkDisp = appUrl(`/t/${tid}/disponibilita`);

  return (
    <div className="grid gap-4">
      {f.periodoFinito && ctx.periodo && (
        <Avviso icona={Info} tono="danger">
          Periodo terminato il {labelDate(ctx.periodo.fine)}: puoi ancora programmarla finché l’organizzatore non decide.
        </Avviso>
      )}

      <nav aria-label="Settimane" className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="Settimana precedente" disabled={!f.haPrecedente} onClick={() => setSettimana(f.settimana - 1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <p className="tabular flex items-center gap-2 text-base font-semibold" aria-live="polite">
          <CalendarRange className="size-5 text-ink-muted" aria-hidden />
          {labelDate(f.from)} – {labelDate(f.to)}
        </p>
        <Button variant="ghost" size="icon" aria-label="Settimana successiva" disabled={!f.haSuccessiva} onClick={() => setSettimana(f.settimana + 1)}>
          <ChevronRight aria-hidden />
        </Button>
      </nav>

      {errore ? (
        <ErrorState
          errore={errore}
          onRiprova={() => {
            disp.refetch();
            occ.refetch();
            ric.refetch();
          }}
        />
      ) : caricamento ? (
        <SkeletonLanes />
      ) : (
        <>
          <div className="grid gap-2">
            {senzaDisponibilita.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Avviso icona={UserRoundX} tono="warn">
                  {elencoNomi(nomiSenza)} {senzaDisponibilita.length === 1 ? 'non ha' : 'non hanno'} ancora segnato le disponibilità.
                </Avviso>
                {giocatore &&
                  senzaDisponibilita
                    .filter((g) => g !== ctx.uid)
                    .map((g) => (
                      <WhatsAppButton
                        key={g}
                        size="sm"
                        telefono={ctx.telefono(g)}
                        testo={`${nome(g)}, per programmare ${ctx.titolo} mancano le tue disponibilità: segnale qui → ${linkDisp}`}
                      >
                        Chiedi a {nome(g)}
                      </WhatsAppButton>
                    ))}
                {senzaDisponibilita.includes(ctx.uid ?? '') && (
                  <Link to={`/t/${tid}/disponibilita`} className="text-base font-semibold text-court underline dark:text-info-ink">
                    Segna le tue disponibilità
                  </Link>
                )}
              </div>
            )}
            <p className="text-lg font-bold" aria-live="polite">
              {verdi === 0
                ? 'Nessun orario per tutti e 4 questa settimana.'
                : `${verdi} ${verdi === 1 ? 'orario va' : 'orari vanno'} bene per tutti e 4 questa settimana`}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {verdi > 0 && (
                <div className="flex min-h-11 items-center gap-3">
                  <Switch id="solo-verdi" checked={soloVerdi} onCheckedChange={setSoloVerdi} />
                  <Label htmlFor="solo-verdi" className="text-base">
                    Mostra solo gli orari per tutti e 4
                  </Label>
                </div>
              )}
              {giocatore && (
                <WhatsAppButton
                  size="sm"
                  testo={
                    verdi > 0
                      ? `Abbiamo ${verdi} ${verdi === 1 ? 'orario che va' : 'orari che vanno'} bene a tutti e 4, scegliamo? → ${ctx.link}`
                      : `Non abbiamo ancora un orario in comune per ${ctx.titolo}: segnate le disponibilità qui → ${linkDisp}`
                  }
                />
              )}
              {giocatore && !senzaDisponibilita.includes(ctx.uid ?? '') && (
                <Link to={`/t/${tid}/disponibilita`} className="inline-flex min-h-11 items-center text-base font-semibold text-court underline dark:text-info-ink">
                  Modifica le tue disponibilità
                </Link>
              )}
            </div>
          </div>

          <Legenda />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {giorni.map((g) => (
              <GiornoLanes
                key={g.data}
                giorno={g}
                oggi={oggi}
                ctx={ctx}
                campi={campi}
                scala={scala}
                soloVerdi={soloVerdi}
                focusKey={focusKey}
                sel={sel ? chiave(sel) : null}
                refs={refs.current}
                onKey={onKey}
                onScegli={(s) => {
                  setAttivo(chiave(s));
                  setSel(s);
                }}
              />
            ))}
          </div>

          {consenti && giocatore && (
            <Button variant="link" className="justify-self-start text-base" onClick={() => setFuori({ open: true })}>
              <Clock3 aria-hidden /> Proponi un orario fuori griglia
            </Button>
          )}

          {sel && (
            <SlotSheet
              ctx={ctx}
              stato={sel}
              onClose={chiudiSheet}
              onProponi={
                consenti && giocatore
                  ? () => {
                      const s = sel;
                      setSel(null);
                      setFuori({ open: true, campoId: s.slot.campoId, data: s.slot.data });
                    }
                  : undefined
              }
            />
          )}
          {fuori.open && (
            <OffGrid
              ctx={ctx}
              giorni={f.giorni}
              campi={campi}
              occupazioni={occ.perGiorno}
              richieste={richieste}
              fasce={fasce}
              iniziale={{ campoId: fuori.campoId, data: fuori.data }}
              onClose={() => setFuori({ open: false })}
            />
          )}
        </>
      )}
    </div>
  );
}

function GiornoLanes({
  giorno,
  oggi,
  ctx,
  campi,
  scala,
  soloVerdi,
  focusKey,
  sel,
  refs,
  onKey,
  onScegli,
}: {
  giorno: Giorno;
  oggi: string;
  ctx: ContestoPartita;
  campi: ContestoPartita['campi'];
  scala: ReturnType<typeof scalaDaCampi>;
  soloVerdi: boolean;
  focusKey: string | null;
  sel: string | null;
  refs: Map<string, HTMLButtonElement>;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, key: string) => void;
  onScegli: (s: StatoSlot) => void;
}) {
  const id = useId();
  const tot = ctx.partita.giocatori.length;
  const titolo = (
    <h3 id={id} className={cn('tabular inline-flex items-center gap-2 text-base font-bold', giorno.data === oggi && 'rounded-control bg-court px-2.5 py-1 text-court-ink')}>
      {labelDate(giorno.data)}
      {giorno.data === oggi && <span className="font-semibold">· oggi</span>}
    </h3>
  );
  if (!giorno.aperto)
    return (
      <div role="group" aria-labelledby={id} className="grid content-start gap-2 border-t border-line pt-3">
        {titolo}
        <p className="text-ink-muted">Campi chiusi</p>
      </div>
    );
  if (!giorno.ordinati.length)
    return (
      <div role="group" aria-labelledby={id} className="grid content-start gap-2 border-t border-line pt-3">
        {titolo}
        <p className="text-ink-muted">{soloVerdi ? 'Nessun orario per tutti e 4.' : 'Nessun orario ancora disponibile.'}</p>
      </div>
    );
  return (
    <div role="group" aria-labelledby={id} className="grid content-start gap-2">
      {titolo}
      <CourtLanes
        campi={campi}
        scala={scala}
        renderLane={(c) =>
          !campoAttivo(c, giorno.data) ? (
            <p className="absolute inset-x-1 top-2 text-center text-sm text-ink-muted">Chiuso</p>
          ) : (
            giorno.perCampo[c.id]?.map((s) => {
              const ui = SLOT_UI[s.colore];
              const Icona = ui.icona;
              const k = chiave(s);
              const selezionato = sel === k;
              return (
                <LaneBlock
                  key={k}
                  scala={scala}
                  inizio={s.slot.inizio}
                  fine={s.slot.fine}
                  tono={ui.tono}
                  pattern={ui.pattern}
                  selezionato={selezionato}
                  className="p-0"
                >
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) refs.set(k, el);
                      else refs.delete(k);
                    }}
                    tabIndex={focusKey === k ? 0 : -1}
                    aria-label={ariaSlot(s, c.nome, ctx.nome)}
                    aria-pressed={selezionato}
                    onClick={() => onScegli(s)}
                    onKeyDown={(e) => onKey(e, k)}
                    className={cn(
                      'absolute inset-0 grid content-center justify-items-start gap-0.5 px-2 text-left',
                      'focus-visible:rounded-[5px] focus-visible:outline-3 focus-visible:-outline-offset-3',
                      s.colore === 'grigio' && 'text-ink-muted',
                    )}
                  >
                    <span className="tabular text-base leading-tight font-bold">{s.slot.inizio}</span>
                    <span className="flex items-center gap-1 text-sm leading-tight font-semibold">
                      <Icona className="size-4 shrink-0" aria-hidden />
                      {etichettaSlot(s, tot)}
                    </span>
                    {selezionato && <Check className="absolute top-1 right-1 size-4" strokeWidth={3} aria-hidden />}
                  </button>
                </LaneBlock>
              );
            })
          )
        }
      />
    </div>
  );
}

/** Always visible on the first visit, collapsible afterwards. */
function Legenda() {
  const [aperta] = useState(() => {
    try {
      return localStorage.getItem(LEGENDA_VISTA) !== '1';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LEGENDA_VISTA, '1');
    } catch {
      /* private mode: always open */
    }
  }, []);
  return (
    <details open={aperta} className="group">
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-base font-semibold text-court dark:text-info-ink">
        Legenda
      </summary>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
        {(Object.keys(SLOT_UI) as (keyof typeof SLOT_UI)[]).map((k) => {
          const ui = SLOT_UI[k];
          const Icona = ui.icona;
          return (
            <li key={k} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className={cn(
                  'grid size-7 place-items-center rounded-[6px] border',
                  {
                    ok: 'border-ok bg-ok-soft text-ok-ink',
                    warn: 'border-warn bg-warn-soft text-warn-ink',
                    idle: 'border-line-strong bg-surface text-idle-ink',
                    danger: 'border-danger bg-danger-soft text-danger-ink',
                    info: 'border-info bg-info-soft text-info-ink',
                  }[ui.tono],
                  ui.pattern === 'hatch' && 'pattern-hatch',
                  ui.pattern === 'dots' && 'pattern-dots',
                )}
              >
                <Icona className="size-4" />
              </span>
              {ui.nome}
            </li>
          );
        })}
        <li className="flex items-center gap-2 text-sm">
          <span aria-hidden className="grid size-7 place-items-center rounded-[6px] border border-line-strong bg-surface outline-3 outline-offset-1 outline-ball">
            <Check className="size-4" strokeWidth={3} />
          </span>
          Selezionato
        </li>
      </ul>
    </details>
  );
}

function SkeletonLanes() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Caricamento degli orari">
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-6 w-24" />
          <div className="grid grid-cols-[2.75rem_1fr_1fr] gap-x-1.5">
            <span />
            <Skeleton className="h-80 rounded-control" />
            <Skeleton className="mt-6 h-80 rounded-control" />
          </div>
        </div>
      ))}
    </div>
  );
}
