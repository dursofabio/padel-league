import type { Partita, Squadra, Torneo } from '../types';
import { classificaGirone, type RigaClassifica } from './standings';

export function gironi(squadre: Squadra[]): string[] {
  return [...new Set(squadre.map((s) => s.girone).filter((g): g is string => !!g))].sort();
}

/** Classifiche di tutti i gironi, derivate dai risultati ufficiali (mai salvate). */
export function classificheTorneo(torneo: Torneo, squadre: Squadra[], partite: Partita[]): Record<string, RigaClassifica[]> {
  const out: Record<string, RigaClassifica[]> = {};
  for (const g of gironi(squadre)) {
    const ids = squadre.filter((s) => s.girone === g && s.stato !== 'da approvare' && s.stato !== 'in attesa partner').map((s) => s.id);
    const pg = partite.filter((p) => p.fase === 'gironi' && p.girone === g);
    out[g] = classificaGirone(g, ids, pg, torneo.config, torneo.sorteggio ?? {});
  }
  return out;
}

export function gironiConclusi(partite: Partita[]): boolean {
  const pg = partite.filter((p) => p.fase === 'gironi');
  return pg.length > 0 && pg.every((p) => p.stato === 'giocata' || p.stato === 'tavolino');
}

export function nomeSquadra(byId: Map<string, Squadra>, id: string | null | undefined): string {
  if (!id) return 'da definire';
  return byId.get(id)?.nome ?? '…';
}
