import type { Partita, Spareggio, TorneoConfig } from '../types';
import { risultatoUfficiale, statistiche } from './results';

export interface RigaClassifica {
  squadraId: string;
  girone: string;
  giocate: number;
  vinte: number;
  perse: number;
  punti: number;
  setVinti: number;
  setPersi: number;
  gameVinti: number;
  gamePersi: number;
  posizione: number;
  /** Pari merito non risolto dalla catena di spareggio: serve un sorteggio. */
  pariMerito: boolean;
}

interface Esito {
  squadraA: string;
  squadraB: string;
  setA: number;
  setB: number;
  gameA: number;
  gameB: number;
  puntiA: number;
  puntiB: number;
  vinceA: boolean;
}

function esiti(partite: Partita[], config: TorneoConfig): Esito[] {
  return partite
    .filter((p) => risultatoUfficiale(p) && p.squadraA && p.squadraB)
    .map((p) => {
      const s = statistiche(p.risultato!.set, config.formatoSet);
      const vinceA = s.vincitore === 'A';
      const puntiPerdente = config.puntiSconfitta + (s.setDecisivo ? config.puntiSconfittaSetDecisivo ?? 0 : 0);
      return {
        squadraA: p.squadraA!,
        squadraB: p.squadraB!,
        setA: s.setA,
        setB: s.setB,
        gameA: s.gameA,
        gameB: s.gameB,
        vinceA,
        puntiA: vinceA ? config.puntiVittoria : puntiPerdente,
        puntiB: vinceA ? puntiPerdente : config.puntiVittoria,
      };
    });
}

type Tot = Omit<RigaClassifica, 'posizione' | 'pariMerito' | 'girone'>;

function totali(ids: string[], es: Esito[]): Map<string, Tot> {
  const m = new Map<string, Tot>();
  for (const id of ids)
    m.set(id, { squadraId: id, giocate: 0, vinte: 0, perse: 0, punti: 0, setVinti: 0, setPersi: 0, gameVinti: 0, gamePersi: 0 });
  for (const e of es) {
    const a = m.get(e.squadraA);
    const b = m.get(e.squadraB);
    if (!a || !b) continue;
    a.giocate++; b.giocate++;
    if (e.vinceA) { a.vinte++; b.perse++; } else { b.vinte++; a.perse++; }
    a.punti += e.puntiA; b.punti += e.puntiB;
    a.setVinti += e.setA; a.setPersi += e.setB; b.setVinti += e.setB; b.setPersi += e.setA;
    a.gameVinti += e.gameA; a.gamePersi += e.gameB; b.gameVinti += e.gameB; b.gamePersi += e.gameA;
  }
  return m;
}

/**
 * Classifica di un girone, calcolata dal client a partire dai risultati ufficiali.
 * La catena di spareggio si applica in modo ricorsivo: ogni criterio divide il gruppo
 * dei pari merito in sottogruppi, e i sottogruppi ancora pari passano al criterio successivo.
 * Lo scontro diretto è la classifica avulsa delle sole partite tra le squadre a pari merito.
 */
export function classificaGirone(
  girone: string,
  squadre: string[],
  partite: Partita[],
  config: TorneoConfig,
  sorteggio: Record<string, number> = {},
): RigaClassifica[] {
  const es = esiti(partite, config);
  const tot = totali(squadre, es);
  const catena: Spareggio[] = config.spareggi?.length ? config.spareggi : ['punti'];

  const ordinati: { id: string; pari: boolean }[] = [];

  const chiave = (crit: Spareggio, id: string, gruppo: string[]): number => {
    if (crit === 'scontroDiretto') {
      const sub = es.filter((e) => gruppo.includes(e.squadraA) && gruppo.includes(e.squadraB));
      return totali(gruppo, sub).get(id)!.punti;
    }
    const t = tot.get(id)!;
    switch (crit) {
      case 'punti': return t.punti;
      case 'diffSet': return t.setVinti - t.setPersi;
      case 'diffGame': return t.gameVinti - t.gamePersi;
      case 'setVinti': return t.setVinti;
      case 'gameVinti': return t.gameVinti;
      case 'sorteggio': return id in sorteggio ? -sorteggio[id] : Number.NEGATIVE_INFINITY;
    }
  };

  const risolvi = (gruppo: string[], idx: number) => {
    if (gruppo.length === 1) { ordinati.push({ id: gruppo[0], pari: false }); return; }
    if (idx >= catena.length) {
      // pari merito non risolto: ordine stabile, segnalato per il sorteggio
      [...gruppo].sort().forEach((id) => ordinati.push({ id, pari: true }));
      return;
    }
    const crit = catena[idx];
    const byKey = new Map<number, string[]>();
    for (const id of gruppo) {
      const k = chiave(crit, id, gruppo);
      byKey.set(k, [...(byKey.get(k) ?? []), id]);
    }
    [...byKey.keys()].sort((a, b) => b - a).forEach((k) => risolvi(byKey.get(k)!, idx + 1));
  };

  risolvi([...squadre], 0);
  return ordinati.map(({ id, pari }, i) => ({ ...tot.get(id)!, girone, posizione: i + 1, pariMerito: pari }));
}

/** Classifica avulsa tra squadre di gironi diversi: media punti, poi differenze per partita. */
export function confrontoAvulsa(a: RigaClassifica, b: RigaClassifica, sorteggio: Record<string, number> = {}): number {
  const media = (r: RigaClassifica, v: number) => (r.giocate ? v / r.giocate : 0);
  const crit = [
    (r: RigaClassifica) => media(r, r.punti),
    (r: RigaClassifica) => media(r, r.setVinti - r.setPersi),
    (r: RigaClassifica) => media(r, r.gameVinti - r.gamePersi),
    (r: RigaClassifica) => -(sorteggio[r.squadraId] ?? Number.MAX_SAFE_INTEGER),
  ];
  for (const c of crit) {
    const d = c(b) - c(a);
    if (Math.abs(d) > 1e-9) return d;
  }
  return a.girone.localeCompare(b.girone);
}
