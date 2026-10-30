import { Ban, DoorClosed, GraduationCap, Hourglass, Plus, Trophy, Users, type LucideIcon } from 'lucide-react';
import { CourtLanes, LaneBlock, type LanesScala } from '../../components/CourtLanes';
import { slotGriglia, type Slot } from '../../lib/slots';
import type { Campo, OccupazioneRiga, Richiesta, TipoOccupazione } from '../../types';
import { ETICHETTA_TIPO, fineLeggibile, statoSlotGestore } from './logic';

/** Cross-hatch for closures (the global stylesheet only has the diagonal hatch). */
const CROSS_HATCH =
  '[background-image:repeating-linear-gradient(45deg,transparent_0_6px,color-mix(in_oklch,currentColor_22%,transparent)_6px_8px),repeating-linear-gradient(-45deg,transparent_0_6px,color-mix(in_oklch,currentColor_22%,transparent)_6px_8px)]';

/** Occupation types differ by pattern + icon + label (glossary in docs/ux/README.md), never by colour alone. */
export const ASPETTO_TIPO: Record<
  TipoOccupazione,
  { icon: LucideIcon; tono: 'court' | 'idle' | 'warn' | 'danger'; pattern?: 'hatch'; className?: string }
> = {
  campionato: { icon: Trophy, tono: 'court' },
  esterno: { icon: Users, tono: 'idle', className: 'bg-idle-soft' },
  lezione: { icon: GraduationCap, tono: 'warn', pattern: 'hatch' },
  chiusura: { icon: DoorClosed, tono: 'danger', className: CROSS_HATCH },
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
}) {
  return (
    <CourtLanes
      campi={campi}
      scala={scala}
      oraCorrente={oraCorrente}
      className={className}
      renderLane={(campo) => {
        const occ = occupazioni.filter((o) => o.campoId === campo.id && o.data === data);
        const items = Object.fromEntries(occ.map((o) => [o.id, o]));
        const ric = richieste.filter((r) => r.campoId === campo.id && r.data === data);
        const imp = impattati.filter((s) => s.campoId === campo.id);
        const impKey = new Set(imp.map((s) => s.inizio));
        const liberi = slotGriglia(campo, data).filter(
          (s) => !impKey.has(s.inizio) && statoSlotGestore(s, items, ric, now) === 'libero',
        );
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
                  className="border-dashed bg-transparent text-ink-muted hover:bg-surface"
                  onClick={() => onSlotLibero(campo, s)}
                  ariaLabel={`${campo.nome}, ${s.inizio}–${s.fine} libero: segna occupato`}
                >
                  <span className="tabular flex items-center gap-1 font-semibold text-ink">
                    {s.inizio}
                    <Plus className="size-4 text-ink-muted" aria-hidden />
                  </span>
                  <span className="text-xs">Libero</span>
                </LaneBlock>
              ) : (
                <LaneBlock
                  key={`s-${s.inizio}`}
                  scala={scala}
                  inizio={s.inizio}
                  fine={s.fine}
                  tono="idle"
                  className="bg-transparent text-ink-muted"
                  ariaLabel={`${campo.nome}, ${s.inizio}–${s.fine} libero`}
                >
                  <span className="tabular font-semibold">{s.inizio}</span>
                </LaneBlock>
              ),
            )}
            {imp.map((s) => (
              <LaneBlock
                key={`i-${s.inizio}`}
                scala={scala}
                inizio={s.inizio}
                fine={s.fine}
                tono="idle"
                pattern="hatch"
                ariaLabel={`${campo.nome}, slot ${s.inizio}–${s.fine} inutilizzabile`}
              >
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <Ban className="size-3.5" aria-hidden />
                  <span className="tabular">{s.inizio}</span> inutilizzabile
                </span>
              </LaneBlock>
            ))}
            {occ.map((o) => {
              const a = ASPETTO_TIPO[o.tipo];
              const titolo = o.tipo === 'campionato' ? (nomePartita?.(o.partitaId) ?? ETICHETTA_TIPO.campionato) : ETICHETTA_TIPO[o.tipo];
              const orario = `${o.inizio}–${fineLeggibile(o.fine)}`;
              const label = `${campo.nome}, ${ETICHETTA_TIPO[o.tipo]} ${orario}${o.tipo === 'campionato' ? `, ${titolo}` : ''}${o.nota ? `, ${o.nota}` : ''}`;
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
                  <span className="flex items-center gap-1 font-semibold">
                    <a.icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{titolo}</span>
                  </span>
                  <span className="tabular block text-xs">{orario}</span>
                  {o.nota && <span className="block truncate text-xs">{o.nota}</span>}
                </LaneBlock>
              );
            })}
            {ric.map((r) => {
              const sel = r.id === evidenziata;
              const titolo = nomePartita?.(r.partitaId) ?? 'Richiesta in attesa';
              const label = `${campo.nome}, richiesta in attesa ${r.inizio}–${r.fine}, ${titolo}`;
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
                  <span className="flex items-center gap-1 text-xs font-semibold">
                    <Hourglass className="size-3.5 shrink-0" aria-hidden />
                    {sel ? 'Richiesta selezionata' : 'Richiesta in attesa'}
                  </span>
                  <span className="tabular block text-xs">
                    {r.inizio}–{r.fine}
                  </span>
                  <span className="block truncate text-xs">{titolo}</span>
                </LaneBlock>
              );
            })}
          </>
        );
      }}
    />
  );
}
