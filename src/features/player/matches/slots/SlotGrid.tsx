/**
 * Signature of the product: the week drawn as two parallel court lanes per day (Campo 2 offset by 30'),
 * every slot a button with icon + text + tone (+ pattern), keyboard roving focus, sheet on selection.
 *
 * Density (critique M2): by default only the useful slots (4/4 and 3/4) are drawn, each day's lanes are
 * cropped to them, days without a useful slot collapse to one line, and with no useful slot in the week
 * the grid stays behind "Mostra la griglia completa". Court names stay visible while scrolling.
 */
import { CalendarRange, Check, ChevronLeft, ChevronRight, Clock3, Info, UserRoundX } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { CourtLanes, LaneBlock, scalaDaCampi, type LanesScala } from '../../../../components/CourtLanes';
import { ErrorState } from '../../../../components/states';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { useDisponibilita, useOccupazioni, useRichiesteFinestra } from '../../../../data/queries';
import { campoAttivo, classificaSlot, occupazioniId, slotGriglia, type StatoSlot } from '../../../../lib/slots';
import { labelDate, toMin, today } from '../../../../lib/time';
import { appUrl } from '../../../../lib/whatsapp';
import type { Campo, Fasce } from '../../../../types';
import { Button, cn, Skeleton } from '../../../../ui';
import type { ContestoPartita } from '../contesto';
import {
  ariaSlot,
  elencoNomi,
  etichettaSlot,
  finestraSettimana,
  muoviFocus,
  scalaRitagliata,
  slotUtile,
  type CellaNav,
  type TastoNav,
} from '../logica';
import { Avviso, SLOT_UI, useOra } from '../parti';
import { OffGrid } from './OffGrid';
import { SlotSheet } from './SlotSheet';

const TASTI: TastoNav[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'];
const chiave = (s: StatoSlot) => `${s.slot.data}|${s.slot.campoId}|${s.slot.inizio}`;
const LINK = 'inline-flex min-h-11 items-center text-base font-semibold text-court underline dark:text-info-ink';

type Vista = 'chiuso' | 'nessuno' | 'compresso' | 'utili' | 'tutti';

interface Giorno {
  data: string;
  vista: Vista;
  /** Slots drawn, per court. */
  perCampo: Record<string, StatoSlot[]>;
  /** Slots drawn, in time order (both courts): keyboard order. */
  ordinati: StatoSlot[];
  scala: LanesScala;
  /** Expanded by hand (shows "Nascondi"). */
  espanso: boolean;
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
  const [mostraTutti, setMostraTutti] = useState(false);
  const [espansi, setEspansi] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<StatoSlot | null>(null);
  const [fuori, setFuori] = useState<{ open: boolean; campoId?: string; data?: string }>({ open: false });
  const [attivo, setAttivo] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const campi = useMemo(() => [...tuttiCampi].sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)), [tuttiCampi]);
  // lanes grow with the user's text size, so slot labels are never clipped at 200% text (WCAG 1.4.4)
  const rem = useRemPx();
  const scala = useMemo(() => scalaDaCampi(campi, 0.8 * (rem / 16)), [campi, rem]);

  const fasce = useMemo(
    () => Object.fromEntries(giocatori.map((g) => [g, disp.data?.[g]?.fasce])) as Record<string, Fasce | undefined>,
    [disp.data, giocatori],
  );
  const richieste = useMemo(() => (ric.data ?? []).filter((r) => r.partitaId !== partita.id), [ric.data, partita.id]);
  const minutoOra = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  // every future slot of the week, classified once
  const settimanaSlot = useMemo(
    () =>
      f.giorni.map((data) => {
        const perCampo: Record<string, StatoSlot[]> = {};
        for (const c of campi)
          perCampo[c.id] = slotGriglia(c, data)
            .filter((s) => data > oggi || (data === oggi && toMin(s.inizio) > minutoOra))
            .map((s) => classificaSlot(s, giocatori, fasce, occ.perGiorno[occupazioniId(c.id, data)], richieste, now));
        return { data, aperto: campi.some((c) => campoAttivo(c, data)), perCampo };
      }),
    // f.giorni is derived from f.from / f.to
    [f.from, f.to, campi, giocatori, fasce, occ.perGiorno, richieste, oggi, minutoOra, now],
  );
  const tuttiSlot = settimanaSlot.flatMap((g) => Object.values(g.perCampo).flat());
  const verdi = tuttiSlot.filter((s) => s.colore === 'verde').length;
  const utili = tuttiSlot.filter(slotUtile).length;
  const filtro = utili > 0 && !mostraTutti;
  const grigliaVisibile = utili > 0 || mostraTutti;

  const giorni: Giorno[] = useMemo(
    () =>
      settimanaSlot.map(({ data, aperto, perCampo: tutti }) => {
        const espanso = espansi.has(data);
        const pieno = !filtro || espanso;
        const perCampo: Record<string, StatoSlot[]> = {};
        for (const c of campi) perCampo[c.id] = pieno ? tutti[c.id] : tutti[c.id].filter(slotUtile);
        const ordinati = Object.values(perCampo)
          .flat()
          .sort(
            (a, b) =>
              toMin(a.slot.inizio) - toMin(b.slot.inizio) ||
              campi.findIndex((c) => c.id === a.slot.campoId) - campi.findIndex((c) => c.id === b.slot.campoId),
          );
        const vista: Vista = !aperto ? 'chiuso' : pieno ? (ordinati.length ? 'tutti' : 'nessuno') : ordinati.length ? 'utili' : 'compresso';
        const scalaGiorno = vista === 'utili' ? scalaRitagliata(ordinati.map((s) => s.slot), scala) : scala;
        return { data, vista, perCampo, ordinati, scala: scalaGiorno, espanso };
      }),
    [settimanaSlot, espansi, filtro, campi, scala],
  );

  // players with no availability at all in the period (or in the window when there is no open period)
  const senzaDisponibilita = useMemo(() => {
    const da = ctx.periodo && !f.periodoFinito ? ctx.periodo.inizio : f.from;
    const a = ctx.periodo && !f.periodoFinito ? ctx.periodo.fine : f.to;
    return giocatori.filter((g) => !Object.entries(fasce[g] ?? {}).some(([d, v]) => d >= da && d <= a && v.length > 0));
  }, [giocatori, fasce, ctx.periodo, f.from, f.to, f.periodoFinito]);

  const celle: CellaNav[][] = useMemo(
    () =>
      grigliaVisibile
        ? giorni.map((g) => g.ordinati.map((s) => ({ key: chiave(s), campoId: s.slot.campoId, inizio: s.slot.inizio })))
        : [],
    [giorni, grigliaVisibile],
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

  const alterna = (data: string) =>
    setEspansi((s) => {
      const n = new Set(s);
      if (n.has(data)) n.delete(data);
      else n.add(data);
      return n;
    });

  const caricamento = disp.isPending || occ.isPending || ric.isPending;
  const errore = disp.error || occ.error || ric.error;
  const consenti = ctx.torneo.config.consentiFuoriGriglia;
  const giocatore = !!ctx.mioLato;
  const nomiSenza = senzaDisponibilita.map((g) => nome(g));
  const linkDisp = appUrl(`/t/${tid}/disponibilita`);
  const gialli = utili - verdi;

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
        <p className="tabular flex flex-wrap items-center justify-center gap-x-2 text-center text-base font-semibold" aria-live="polite">
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
          <div className="grid gap-3">
            <p className="text-lg font-bold" aria-live="polite">
              {verdi > 0
                ? `${verdi} ${verdi === 1 ? 'orario va' : 'orari vanno'} bene per tutti e 4 questa settimana${gialli > 0 ? `, ${gialli} per 3 su 4` : ''}.`
                : gialli > 0
                  ? `Nessun orario per tutti e 4 questa settimana: ${gialli} ${gialli === 1 ? 'va' : 'vanno'} bene a 3 su 4.`
                  : 'Nessun orario buono questa settimana.'}
            </p>

            {senzaDisponibilita.length > 0 && (
              <div className="grid gap-2">
                <Avviso icona={UserRoundX} tono="warn">
                  {elencoNomi(nomiSenza)} {senzaDisponibilita.length === 1 ? 'non ha' : 'non hanno'} ancora segnato le disponibilità.
                </Avviso>
                <div className="flex flex-wrap items-center gap-2">
                  {giocatore &&
                    senzaDisponibilita
                      .filter((g) => g !== ctx.uid)
                      .map((g) => (
                        <WhatsAppButton
                          key={g}
                          className="whitespace-normal"
                          telefono={ctx.telefono(g)}
                          testo={`${nome(g)}, per programmare ${ctx.titolo} mancano le tue disponibilità: segnale qui → ${linkDisp}`}
                        >
                          Chiedi a {nome(g)}
                        </WhatsAppButton>
                      ))}
                  {senzaDisponibilita.includes(ctx.uid ?? '') && (
                    <Link to={`/t/${tid}/disponibilita`} className={LINK}>
                      Segna le tue disponibilità
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {utili > 0 && (
                <p className="flex flex-wrap items-center gap-x-2">
                  <span>{filtro ? 'Mostro solo gli orari buoni (4/4 e 3/4).' : 'Mostro tutti gli orari.'}</span>
                  <Button variant="link" className="min-h-11 text-base" onClick={() => setMostraTutti(filtro)}>
                    {filtro ? 'Mostra tutti' : 'Mostra solo quelli buoni'}
                  </Button>
                </p>
              )}
              {utili === 0 && (
                <Button variant="secondary" className="whitespace-normal" aria-expanded={mostraTutti} onClick={() => setMostraTutti((v) => !v)}>
                  {mostraTutti ? 'Nascondi la griglia' : 'Mostra la griglia completa'}
                </Button>
              )}
              {giocatore && (verdi > 0 || senzaDisponibilita.length === 0) && (
                <WhatsAppButton
                  className="whitespace-normal"
                  testo={
                    verdi > 0
                      ? `Abbiamo ${verdi} ${verdi === 1 ? 'orario che va' : 'orari che vanno'} bene a tutti e 4, scegliamo? → ${ctx.link}`
                      : `Non abbiamo ancora un orario in comune per ${ctx.titolo}: segnate le disponibilità qui → ${linkDisp}`
                  }
                />
              )}
              {giocatore && !senzaDisponibilita.includes(ctx.uid ?? '') && (
                <Link to={`/t/${tid}/disponibilita`} className={LINK}>
                  Modifica le tue disponibilità
                </Link>
              )}
            </div>
          </div>

          {grigliaVisibile && (
            <>
              <Legenda />
              <div className="grid items-start gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
                {giorni.map((g) => (
                  <GiornoLanes
                    key={g.data}
                    giorno={g}
                    oggi={oggi}
                    ctx={ctx}
                    campi={campi}
                    focusKey={focusKey}
                    sel={sel ? chiave(sel) : null}
                    refs={refs.current}
                    onKey={onKey}
                    onAlterna={() => alterna(g.data)}
                    filtro={filtro}
                    stretto={rem >= 24}
                    onScegli={(s) => {
                      setAttivo(chiave(s));
                      setSel(s);
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {consenti && giocatore && (
            <Button variant="link" className="min-h-11 justify-self-start text-base whitespace-normal" onClick={() => setFuori({ open: true })}>
              <Clock3 aria-hidden /> Proponi un orario fuori griglia
            </Button>
          )}

          {sel && (
            <SlotSheet
              ctx={ctx}
              stato={sel}
              onClose={() => setSel(null)}
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
  focusKey,
  sel,
  refs,
  onKey,
  onAlterna,
  filtro,
  stretto,
  onScegli,
}: {
  giorno: Giorno;
  oggi: string;
  ctx: ContestoPartita;
  campi: Campo[];
  focusKey: string | null;
  sel: string | null;
  refs: Map<string, HTMLButtonElement>;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, key: string) => void;
  onAlterna: () => void;
  filtro: boolean;
  stretto: boolean;
  onScegli: (s: StatoSlot) => void;
}) {
  const id = useId();
  const tot = ctx.partita.giocatori.length;
  const giorno_ = labelDate(giorno.data);
  const titolo = (
    <h3
      id={id}
      className={cn('tabular inline-flex flex-wrap items-center gap-x-2 text-base font-bold', giorno.data === oggi && 'rounded-control bg-court px-2.5 py-1 text-court-ink')}
    >
      {giorno_}
      {giorno.data === oggi && <span className="font-semibold">· oggi</span>}
    </h3>
  );
  const alterna = (
    <Button
      variant="ghost"
      size="sm"
      className="text-base whitespace-normal text-court dark:text-info-ink"
      aria-expanded={giorno.espanso}
      aria-label={giorno.espanso ? `Nascondi gli altri orari di ${giorno_}` : `Mostra tutti gli orari di ${giorno_}`}
      onClick={onAlterna}
    >
      {giorno.espanso ? 'Nascondi' : 'Mostra'}
    </Button>
  );

  if (giorno.vista === 'chiuso' || giorno.vista === 'nessuno' || giorno.vista === 'compresso')
    return (
      <div role="group" aria-labelledby={id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2">
        {titolo}
        <span className="text-ink-muted">
          {giorno.vista === 'chiuso' ? 'Campi chiusi' : giorno.vista === 'nessuno' ? 'Nessun orario ancora disponibile' : 'Nessun orario buono'}
        </span>
        {giorno.vista === 'compresso' && alterna}
        {giorno.vista === 'nessuno' && giorno.espanso && alterna}
      </div>
    );

  return (
    <div role="group" aria-labelledby={id} className="grid content-start gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        {titolo}
        {filtro && (giorno.espanso || giorno.vista === 'utili') && alterna}
      </div>
      {/* large text (≥ 150%): one court per row, so the lanes keep a readable width */}
      {(stretto ? campi.map((c) => [c]) : [campi]).map((gruppo) => (
        <div key={gruppo.map((c) => c.id).join()}>
          <CourtLanes
            campi={gruppo}
            scala={giorno.scala}
            stickyTop="0px"
            renderLane={(c) =>
              !campoAttivo(c, giorno.data) ? (
                <p role="listitem" className="absolute inset-x-1 top-2 text-center text-base text-ink-muted">
                  Chiuso
                </p>
              ) : (
                giorno.perCampo[c.id]?.map((s) => {
                  const ui = SLOT_UI[s.colore];
                  const Icona = ui.icona;
                  const k = chiave(s);
                  const selezionato = sel === k;
                  const piatto = s.colore === 'grigio';
                  return (
                    <LaneBlock
                      key={k}
                      scala={giorno.scala}
                      inizio={s.slot.inizio}
                      fine={s.slot.fine}
                      tono={ui.tono}
                      pattern={ui.pattern}
                      selezionato={selezionato}
                      onClick={() => onScegli(s)}
                      ariaLabel={ariaSlot(s, c.nome, ctx.nome)}
                      className={cn(
                        'relative flex flex-col items-start justify-center gap-0.5 px-1.5 text-base',
                        // ≤ 2/4: flat, borderless, so it does not read as a primary target (it still explains itself)
                        piatto && 'border-transparent bg-transparent text-ink-muted',
                      )}
                      buttonProps={{
                        ref: (el: HTMLButtonElement | null) => {
                          if (el) refs.set(k, el);
                          else refs.delete(k);
                        },
                        tabIndex: focusKey === k ? 0 : -1,
                        onKeyDown: (e) => onKey(e, k),
                      }}
                    >
                      <span className={cn('tabular leading-tight', piatto ? 'font-semibold' : 'font-bold')}>{s.slot.inizio}</span>
                      <span className="flex items-center gap-1 leading-tight font-semibold">
                        <Icona className="size-4 shrink-0" aria-hidden />
                        {etichettaSlot(s, tot)}
                      </span>
                      {selezionato && <Check className="absolute top-1 right-1 size-4" strokeWidth={3} aria-hidden />}
                    </LaneBlock>
                  );
                })
              )
            }
          />
        </div>
      ))}
    </div>
  );
}

const TONI_LEGENDA = {
  ok: 'border-ok bg-ok-soft text-ok-ink',
  warn: 'border-warn bg-warn-soft text-warn-ink',
  idle: 'border-transparent bg-surface-2 text-ink-muted',
  danger: 'border-danger bg-danger-soft text-danger-ink',
  info: 'border-info bg-info-soft text-info-ink',
} as const;

/** Always visible; collapsible with the native disclosure. */
function Legenda() {
  return (
    <details open>
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-base font-semibold text-court dark:text-info-ink">Legenda</summary>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
        {(Object.keys(SLOT_UI) as (keyof typeof SLOT_UI)[]).map((k) => {
          const ui = SLOT_UI[k];
          const Icona = ui.icona;
          return (
            <li key={k} className="flex items-center gap-2 text-base">
              <span
                aria-hidden
                className={cn('grid size-7 shrink-0 place-items-center rounded-[6px] border', TONI_LEGENDA[ui.tono as keyof typeof TONI_LEGENDA], ui.pattern === 'hatch' && 'pattern-hatch')}
              >
                <Icona className="size-4" />
              </span>
              {ui.nome}
            </li>
          );
        })}
        <li className="flex items-center gap-2 text-base">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[6px] border border-line-strong bg-surface shadow-[0_0_0_4px_var(--ball)] outline-2 outline-court-deep dark:outline-ball">
            <Check className="size-4" strokeWidth={3} />
          </span>
          Selezionato
        </li>
      </ul>
    </details>
  );
}

/** Root font size in px (user text-size preference), refreshed on resize / zoom. */
function useRemPx(): number {
  const leggi = () => (typeof window === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  const [rem, setRem] = useState(leggi);
  useEffect(() => {
    const aggiorna = () => setRem(leggi());
    window.addEventListener('resize', aggiorna);
    return () => window.removeEventListener('resize', aggiorna);
  }, []);
  return rem;
}

function SkeletonLanes() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Caricamento degli orari">
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
