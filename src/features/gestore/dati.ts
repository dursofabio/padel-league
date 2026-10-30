import { useCallback, useMemo } from 'react';
import { useTorneoCorrente } from '../../app/torneo-corrente';
import { useNomi, useTorneoData } from '../../data/queries';
import { nomeSquadra } from '../../lib/torneo';
import type { Partita, Periodo } from '../../types';

/**
 * Names and periods of the current tournament's matches, for the court manager:
 * "Rossi/Bianchi – Verdi/Neri", the match period (counter-proposals) and the match link.
 */
export function usePartiteGestore() {
  const { tid } = useTorneoCorrente();
  const t = useTorneoData(tid);
  const nomi = useNomi();

  const partitaById = useMemo(() => new Map(t.partite.map((p) => [p.id, p])), [t.partite]);
  const periodoById = useMemo(() => new Map(t.periodi.map((p) => [p.id, p])), [t.periodi]);

  const partita = useCallback((id: string | null | undefined): Partita | undefined => (id ? partitaById.get(id) : undefined), [partitaById]);

  /** "Squadra A – Squadra B", or undefined when the match is not in the current tournament. */
  const nomePartita = useCallback(
    (id: string | null | undefined) => {
      const p = partita(id);
      if (!p) return undefined;
      return `${nomeSquadra(t.squadraById, p.squadraA)} – ${nomeSquadra(t.squadraById, p.squadraB)}`;
    },
    [partita, t.squadraById],
  );

  /** "Rossi/Bianchi – Verdi/Neri" from the players' names. */
  const giocatoriPartita = useCallback(
    (id: string | null | undefined, fallback: string[] = []) => {
      const p = partita(id);
      if (!p) return fallback.map(nomi.nome).join(', ');
      return `${p.giocatoriA.map(nomi.nome).join('/')} – ${p.giocatoriB.map(nomi.nome).join('/')}`;
    },
    [partita, nomi],
  );

  const periodoPartita = useCallback(
    (id: string | null | undefined): Periodo | undefined => {
      const p = partita(id);
      return p?.periodoId ? periodoById.get(p.periodoId) : undefined;
    },
    [partita, periodoById],
  );

  const linkPartita = useCallback(
    (torneoId: string | null | undefined, partitaId: string | null | undefined) =>
      torneoId && partitaId ? `/t/${torneoId}/partite/${partitaId}` : partitaId && tid ? `/t/${tid}/partite/${partitaId}` : undefined,
    [tid],
  );

  return { tid, nome: nomi.nome, partita, nomePartita, giocatoriPartita, periodoPartita, linkPartita };
}
