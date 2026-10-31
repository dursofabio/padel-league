import { Fragment } from 'react';
import type { FaseFinaleConfig } from '../types';
import type { RigaClassifica } from '../lib/standings';
import { nomeSquadra } from '../lib/torneo';
import type { Squadra } from '../types';
import { cn } from '../ui/cn';

/** Qualification zone by position: Gold for the first N per group, then Silver, … (perPosizione). */
export function zonaQualificazione(fasi: FaseFinaleConfig[], posizione: number, nGironi: number): string | null {
  let soglia = 0;
  for (const f of fasi) {
    soglia += f.posti / Math.max(1, nGironi);
    if (posizione <= Math.floor(soglia)) return f.nome;
  }
  return null;
}

/**
 * Group standings. The zone (Gold/Silver) is a text tag in the row, not just a colour;
 * secondary columns (W, L, ±Game) are hidden on narrow screens.
 */
export function StandingsTable({
  girone,
  righe,
  squadraById,
  fasi,
  nGironi,
  evidenzia,
}: {
  girone: string;
  righe: RigaClassifica[];
  squadraById: Map<string, Squadra>;
  fasi: FaseFinaleConfig[];
  nGironi: number;
  evidenzia?: string | null;
}) {
  const pari = righe.some((r) => r.pariMerito);
  return (
    <div className="grid gap-2">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="tabular w-full border-collapse text-base">
          <caption className="sr-only">Classifica girone {girone}</caption>
          <thead>
            <tr className="border-b-2 border-line-strong text-left text-sm text-ink-muted">
              <th scope="col" className="w-10 py-2 pr-2 text-right font-semibold">
                <abbr title="Posizione">Pos</abbr>
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">Coppia</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                <abbr title="Punti">Pt</abbr>
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                <abbr title="Giocate">G</abbr>
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-semibold sm:table-cell">
                <abbr title="Vinte">V</abbr>
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-semibold sm:table-cell">
                <abbr title="Perse">P</abbr>
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                <abbr title="Differenza set">±Set</abbr>
              </th>
              <th scope="col" className="hidden py-2 text-right font-semibold md:table-cell">
                <abbr title="Differenza game">±Game</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const zona = zonaQualificazione(fasi, r.posizione, nGironi);
              const zonaPrima = i > 0 ? zonaQualificazione(fasi, righe[i - 1].posizione, nGironi) : null;
              const mia = evidenzia === r.squadraId;
              return (
                <Fragment key={r.squadraId}>
                {zona !== zonaPrima && i > 0 && (
                  <tr aria-hidden>
                    <td colSpan={8} className="border-t-2 border-court py-1 text-xs font-semibold text-ink-muted dark:border-line-strong">
                      {zonaPrima ? `${zonaPrima} sopra questa linea` : ''}
                      {zonaPrima ? ' · ' : ''}
                      {zona ? `${zona} sotto` : zonaPrima ? 'sotto: fuori dalle fasi finali' : 'Sotto questa linea: fuori dalle fasi finali'}
                    </td>
                  </tr>
                )}
                <tr
                  className={cn(
                    'border-b border-line',
                    mia && 'bg-info-soft',
                  )}
                >
                  <td className="py-2.5 pr-2 text-right font-bold">
                    {r.posizione}
                    {r.pariMerito && (
                      <span className="text-warn-ink" title="Pari merito da risolvere">
                        *
                      </span>
                    )}
                  </td>
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    <span className={cn(mia && 'font-bold')}>{nomeSquadra(squadraById, r.squadraId)}</span>
                    {zona && zona !== zonaPrima && <span className="sr-only">, inizio zona {zona}</span>}
                    {zona && zona !== zonaPrima && (
                      <span className="ml-2 rounded-full border border-line-strong px-1.5 text-xs font-semibold text-ink-muted">
                        {zona}
                      </span>
                    )}
                  </th>
                  <td className="py-2.5 pr-3 text-right font-bold">{r.punti}</td>
                  <td className="py-2.5 pr-3 text-right">{r.giocate}</td>
                  <td className="hidden py-2.5 pr-3 text-right sm:table-cell">{r.vinte}</td>
                  <td className="hidden py-2.5 pr-3 text-right sm:table-cell">{r.perse}</td>
                  <td className="py-2.5 pr-3 text-right">{segno(r.setVinti - r.setPersi)}</td>
                  <td className="hidden py-2.5 text-right md:table-cell">{segno(r.gameVinti - r.gamePersi)}</td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {pari && <p className="text-sm text-ink-muted">* Pari merito non ancora risolto: lo decide il sorteggio dell’organizzatore.</p>}
    </div>
  );
}

function segno(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
