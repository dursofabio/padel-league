import { nomeTurno } from '../lib/bracket';
import type { Campo, Partita, Squadra } from '../types';
import { MatchRow } from './MatchRow';

/**
 * Knockout bracket: one column per round. On mobile the columns scroll horizontally
 * with snap (one round per screen). Each round is an ordered list: readable by screen readers too.
 */
export function Bracket({
  partite,
  derivate,
  squadraById,
  campi,
  hrefPartita,
  evidenzia,
  anteprima,
}: {
  partite: Partita[];
  derivate: Map<string, { squadraA: string | null; squadraB: string | null; vincitore?: string | null }>;
  /** Bracket not generated yet: no match states. */
  anteprima?: boolean;
  squadraById: Map<string, Squadra>;
  campi: Campo[];
  hrefPartita?: (p: Partita) => string | undefined;
  evidenzia?: string[];
}) {
  const turni = Math.max(0, ...partite.map((p) => p.turno ?? 0));
  return (
    <div
      role="region"
      aria-label="Tabellone: scorri orizzontalmente tra i turni"
      tabIndex={0}
      className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
    >
      {Array.from({ length: turni }, (_, i) => i + 1).map((turno) => {
        const lista = partite.filter((p) => p.turno === turno).sort((a, b) => (a.posizione ?? 0) - (b.posizione ?? 0));
        return (
          <section key={turno} className="w-[85%] shrink-0 snap-start md:w-auto md:min-w-64 md:flex-1" aria-label={nomeTurno(turno, turni)}>
            <h3 className="mb-1 border-b-2 border-court pb-1 text-base font-bold dark:border-line-strong">{nomeTurno(turno, turni)}</h3>
            <ol className="court-rule flex h-full flex-col justify-around">
              {lista.map((p) => (
                <li key={p.id}>
                  <MatchRow
                    p={p}
                    override={derivate.get(p.id)}
                    squadraById={squadraById}
                    campi={campi}
                    href={hrefPartita?.(p)}
                    evidenzia={evidenzia}
                    senzaStato={anteprima}
                    vincitore={derivate.get(p.id)?.vincitore}
                  />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
