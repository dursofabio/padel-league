import { Ban, DoorClosed, GraduationCap, Hourglass, Plus, Trophy, Users, type LucideIcon } from 'lucide-react';
import { CourtLanes, LaneBlock, type LanesScala } from '../../components/CourtLanes';
import { slotGriglia, type Slot } from '../../lib/slots';
import { toMin } from '../../lib/time';
import { cn } from '../../ui';
import type { Campo, OccupazioneRiga, Richiesta, TipoOccupazione } from '../../types';
import { ETICHETTA_TIPO, fineLeggibile, statoSlotGestore } from './logic';

/** Occupation types differ by pattern + icon + label (glossary in docs/ux/README.md), never by colour alone. */
export const ASPETTO_TIPO: Record<
  TipoOccupazione,
  { icon: LucideIcon; tono: 'court' | 'idle' | 'danger'; pattern?: 'hatch' | 'cross'; className?: string }
> = {
  campionato: { icon: Trophy, tono: 'court' },
  // solid neutral fill
  esterno: { icon: Users, tono: 'idle', className: 'bg-idle-soft' },
  // neutral ground with the diagonal hatch: not amber, which means "3/4" elsewhere
  lezione: { icon: GraduationCap, tono: 'idle', pattern: 'hatch', className: 'bg-surface text-ink' },
  chiusura: { icon: DoorClosed, tono: 'danger', pattern: 'cross' },
};

/**
 * One day as two court lanes (signature): grid slots as outlines, occupations as blocks spanning their
 * real duration, pending requests dashed (G8), the selected request highlighted, the impact of an
 * off-grid request hatched.
 */
export function GiornoLanes({
  data,
  campi,
  scala,
  occupazioni,
  richieste,
  evidenziata,
  impattati = [],
  nomePartita,
  onSlotLibero,
  onOccupazione,
  onRichiesta,
  oraCorrente,
  now = Date.now(),
  className,
  stickyTop,
}: {
  data: string;
  campi: Campo[];
  scala: LanesScala;
  /** Occupations of this day. */
  occupazioni: OccupazioneRiga[];
  /** Live pending requests of this day (plus, optionally, the highlighted one). */
  richieste: Richiesta[];
  evidenziata?: string | null;
  impattati?: Slot[];
  nomePartita?: (partitaId: string | null | undefined) => string | undefined;
  onSlotLibero?: (campo: Campo, slot: Slot) => void;
  onOccupazione?: (o: OccupazioneRiga) => void;
  onRichiesta?: (r: Richiesta) => void;
  oraCorrente?: number;
  now?: number;
  className?: string;
  /** Keeps the court names visible while scrolling (passed to CourtLanes). */
  stickyTop?: string;
}) {
  return (
    <CourtLanes
      campi={campi}
      stickyTop={stickyTop}
      scala={scala}
      oraCorrente={oraCorrente}
      className={className}
      renderLane={(campo) => {
        const occ = occupazioni.filter((o) => o.campoId === campo.id && o.data === data);
        const items = Object.fromEntries(occ.map((o) => [o.id, o]));
        const ric = richieste.filter((r) => r.campoId === campo.id && r.data === data);
        const griglia = slotGriglia(campo, data);
        const impOffGrid = new Set(impattati.filter((s) => s.campoId === campo.id).map((s) => s.inizio));
        const stati = griglia.map((s) => ({ s, stato: statoSlotGestore(s, items, ric, now) }));
        const liberi = stati.filter((x) => x.stato === 'libero' && !impOffGrid.has(x.s.inizio)).map((x) => x.s);
        // grid slots lost to an occupation (e.g. a lesson 16–17 kills 15:00 and 16:30) or to the selected off-grid request
        const esatto = (x: Slot) => ric.some((r) => r.inizio === x.inizio && r.fine === x.fine);
        const inutilizzabili = stati
          .filter(
            (x) =>
              (x.stato === 'occupato' && !occ.some((o) => o.inizio === x.s.inizio && o.fine === x.s.fine)) ||
              (x.stato === 'richiesto' && !esatto(x.s)) ||
              (x.stato === 'libero' && impOffGrid.has(x.s.inizio)),
          )
          .map((x) => x.s);
        // label at the bottom when the slot's start is hidden under an occupation
        const testaCoperta = (x: Slot) => occ.some((o) => toMin(o.inizio) <= toMin(x.inizio) && toMin(x.inizio) < toMin(o.fine));
        return (
          <>
            {liberi.map((s) =>
              onSlotLibero ? (
                <LaneBlock
                  key={`s-${s.inizio}`}
                  scala={scala}
                  inizio={s.inizio}
                  fine={s.fine}
                  tono="idle"
                  className="border-dashed bg-transparent text-ink-muted hover:bg-surface dark:border-ink-muted dark:bg-idle-soft/50"
                  onClick={() => onSlotLibero(campo, s)}
                  ariaLabel={`${s.inizio} libero, ${campo.nome}, fino alle ${s.fine}: segna occupato`}
                >
                  <span className="tabular flex items-center gap-1 font-semibold text-ink">
                    {s.inizio}
                    <Plus className="size-4 text-ink-muted" aria-hidden />
                  </span>
                  <span className="text-sm">libero</span>
                </LaneBlock>
              ) : (
                <LaneBlock
                  key={`s-${s.inizio}`}
                  scala={scala}
                  inizio={s.inizio}
                  fine={s.fine}
                  tono="idle"
                  className="bg-transparent text-ink-muted dark:border-ink-muted"
                  ariaLabel={`${s.inizio} libero, ${campo.nome}, fino alle ${s.fine}`}
                >
                  <span className="tabular font-semibold">{s.inizio}</span>
                </LaneBlock>
              ),
            )}
            {inutilizzabili.map((s) => (
              <LaneBlock
                key={`i-${s.inizio}`}
                scala={scala}
                inizio={s.inizio}
                fine={s.fine}
                tono="idle"
                pattern="hatch"
                className={cn('bg-transparent text-ink-muted', testaCoperta(s) && 'flex flex-col justify-end')}
                ariaLabel={`${s.inizio} inutilizzabile, ${campo.nome}: lo slot fino alle ${s.fine} si sovrappone a un’occupazione o a una richiesta fuori griglia`}
              >
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <Ban className="size-4 shrink-0" aria-hidden />
                  <span className="tabular">{s.inizio}</span>
                </span>
                <span className="text-sm">inutilizzabile</span>
              </LaneBlock>
            ))}
            {occ.map((o) => {
              const a = ASPETTO_TIPO[o.tipo];
              const titolo = o.tipo === 'campionato' ? (nomePartita?.(o.partitaId) ?? ETICHETTA_TIPO.campionato) : ETICHETTA_TIPO[o.tipo];
              const orario = `${o.inizio}–${fineLeggibile(o.fine)}`;
              const label = `${titolo}, ${orario}${o.tipo === 'campionato' ? `, ${ETICHETTA_TIPO.campionato}` : ''}, ${campo.nome}${o.nota ? `, ${o.nota}` : ''}`;
              return (
                <LaneBlock
                  key={o.id}
                  scala={scala}
                  inizio={o.inizio}
                  fine={o.fine}
                  tono={a.tono}
                  pattern={a.pattern}
                  className={a.className}
                  sfalsato
                  selezionato={!!evidenziata && o.richiestaId === evidenziata}
                  onClick={onOccupazione ? () => onOccupazione(o) : undefined}
                  ariaLabel={onOccupazione ? `${label}: apri i dettagli` : label}
                >
                  {/* short blocks (≤ 75'): title and time on one line; the note is in the accessible name and in the details */}
                  {minutiTra(o.inizio, o.fine) <= 75 ? (
                    <span className="@container block">
                      <span className="flex items-center gap-1 font-semibold">
                        <a.icon className="size-4 shrink-0" aria-hidden />
                        <span className="leading-tight">{titolo}</span>
                        {/* narrow lane: the time is already on the axis; the title is never cut */}
                        <span className="tabular ml-auto hidden shrink-0 text-sm font-normal @[10rem]:inline">{orario}</span>
                      </span>
                    </span>
                  ) : (
                    <>
                      <span className="flex items-start gap-1 font-semibold">
                        <a.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="line-clamp-2">{titolo}</span>
                      </span>
                      <span className="tabular block text-sm">{orario}</span>
                      {o.nota && minutiTra(o.inizio, o.fine) >= 120 && <span className="block truncate text-sm">{o.nota}</span>}
                    </>
                  )}
                </LaneBlock>
              );
            })}
            {ric.map((r) => {
              const sel = r.id === evidenziata;
              const stato = sel ? 'Richiesta selezionata' : 'Richiesta in attesa';
              const titolo = nomePartita?.(r.partitaId);
              const label = `${stato}, ${r.inizio}–${r.fine}${titolo ? `, ${titolo}` : ''}, ${campo.nome}`;
              return (
                <LaneBlock
                  key={r.id}
                  scala={scala}
                  inizio={r.inizio}
                  fine={r.fine}
                  tono="info"
                  sfalsato
                  selezionato={sel}
                  className={sel ? undefined : 'border-2 border-dashed bg-info-soft/70'}
                  onClick={onRichiesta ? () => onRichiesta(r) : undefined}
                  ariaLabel={onRichiesta ? `${label}: apri` : label}
                >
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <Hourglass className="size-4 shrink-0" aria-hidden />
                    {stato}
                  </span>
                  <span className="tabular block text-sm">
                    {r.inizio}–{r.fine}
                  </span>
                  {titolo && <span className="line-clamp-2 text-sm">{titolo}</span>}
                </LaneBlock>
              );
            })}
          </>
        );
      }}
    />
  );
}

function minutiTra(inizio: string, fine: string) {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(fine) - m(inizio);
}
