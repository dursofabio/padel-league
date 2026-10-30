import type { FaseFinaleConfig, FormatoSet, Partita } from '../types';
import { vincitore } from './results';
import { confrontoAvulsa, type RigaClassifica } from './standings';

export interface Qualificata {
  squadraId: string;
  girone: string;
  posizione: number;
  riga: RigaClassifica;
}

export interface EsitoQualificazione {
  fasi: { nome: string; posti: number; squadre: Qualificata[] }[];
  escluse: Qualificata[];
}

/**
 * Qualificazione alle fasi finali.
 * Si scorrono le posizioni (tutte le prime, poi tutte le seconde, …). All'interno della stessa
 * posizione le squadre sono confrontate con la classifica avulsa (media punti per partita),
 * così quando posti e gironi non si dividono in modo esatto i posti restanti vanno alle migliori
 * della posizione successiva. Le fasi si riempiono in ordine (Gold, poi Silver, …).
 */
export function qualifica(
  classifiche: Record<string, RigaClassifica[]>,
  fasi: FaseFinaleConfig[],
  criterio: 'perPosizione' | 'avulsa',
  sorteggio: Record<string, number> = {},
): EsitoQualificazione {
  const tutte: Qualificata[] = Object.entries(classifiche).flatMap(([girone, righe]) =>
    righe.map((riga) => ({ squadraId: riga.squadraId, girone, posizione: riga.posizione, riga })),
  );
  const maxPos = Math.max(0, ...tutte.map((q) => q.posizione));
  const ranking: Qualificata[] = [];
  for (let k = 1; k <= maxPos; k++) {
    ranking.push(
      ...tutte.filter((q) => q.posizione === k).sort((a, b) => confrontoAvulsa(a.riga, b.riga, sorteggio)),
    );
  }
  let cursor = 0;
  const out: EsitoQualificazione = { fasi: [], escluse: [] };
  for (const f of fasi) {
    let squadre = ranking.slice(cursor, cursor + f.posti);
    cursor += squadre.length;
    if (criterio === 'perPosizione')
      squadre = [...squadre].sort((a, b) => a.posizione - b.posizione || a.girone.localeCompare(b.girone));
    out.fasi.push({ nome: f.nome, posti: f.posti, squadre });
  }
  out.escluse = ranking.slice(cursor);
  return out;
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Ordine standard delle teste di serie: per 8 → [1,8,4,5,2,7,3,6]. Le migliori si incontrano il più tardi possibile. */
export function ordineTabellone(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export interface PartitaTabellone {
  id: string;
  turno: number;
  posizione: number;
  prossimaPartita: string | null;
  /** Lato occupato dalla vincente nella partita successiva. */
  lato: 'A' | 'B' | null;
  squadraA: string | null;
  squadraB: string | null;
}

export function nomeTurno(turno: number, totaleTurni: number): string {
  const daFinale = totaleTurni - turno;
  return ['Finale', 'Semifinale', 'Quarti', 'Ottavi', 'Sedicesimi'][daFinale] ?? `Turno ${turno}`;
}

export function numeroTurni(squadre: number): number {
  return Math.log2(nextPow2(Math.max(2, squadre)));
}

/**
 * Tabellone a eliminazione diretta dalle teste di serie (in ordine).
 * Se le squadre non sono una potenza di 2 il tabellone sale alla potenza successiva e i bye
 * vanno alle teste di serie migliori: la squadra con bye viene inserita direttamente nel turno 2.
 * Si evita, quando possibile, che due squadre dello stesso girone si incontrino al primo turno.
 */
export function generaTabellone(
  prefisso: string,
  teste: string[],
  gironeDi: (id: string) => string | undefined = () => undefined,
): PartitaTabellone[] {
  if (teste.length < 2) return [];
  const size = nextPow2(teste.length);
  const turni = Math.log2(size);
  const order = ordineTabellone(size);
  const id = (t: number, p: number) => `${prefisso}-t${t}-p${p}`;
  const team = (seed: number) => teste[seed - 1] ?? null;

  const primo: [string | null, string | null][] = [];
  for (let i = 0; i < size / 2; i++) primo.push([team(order[2 * i]), team(order[2 * i + 1])]);
  evitaStessoGirone(primo, gironeDi);

  const partite: PartitaTabellone[] = [];
  for (let t = 1; t <= turni; t++) {
    const n = size / 2 ** t;
    for (let p = 0; p < n; p++)
      partite.push({
        id: id(t, p),
        turno: t,
        posizione: p,
        prossimaPartita: t < turni ? id(t + 1, Math.floor(p / 2)) : null,
        lato: t < turni ? (p % 2 === 0 ? 'A' : 'B') : null,
        squadraA: t === 1 ? primo[p][0] : null,
        squadraB: t === 1 ? primo[p][1] : null,
      });
  }
  // bye: la squadra avanza subito e la partita del primo turno non si crea
  const byId = new Map(partite.map((p) => [p.id, p]));
  const result = partite.filter((p) => {
    if (p.turno !== 1 || (p.squadraA && p.squadraB) || turni === 1) return true;
    const avanza = p.squadraA ?? p.squadraB;
    const next = byId.get(p.prossimaPartita!)!;
    if (p.lato === 'A') next.squadraA = avanza;
    else next.squadraB = avanza;
    return false;
  });
  return result;
}

function evitaStessoGirone(primo: [string | null, string | null][], gironeDi: (id: string) => string | undefined) {
  const stesso = (a: string | null, b: string | null) => !!a && !!b && !!gironeDi(a) && gironeDi(a) === gironeDi(b);
  for (let i = 0; i < primo.length; i++) {
    if (!stesso(primo[i][0], primo[i][1])) continue;
    for (let j = 0; j < primo.length; j++) {
      if (i === j) continue;
      const [ai, bi] = primo[i];
      const [aj, bj] = primo[j];
      if (!stesso(ai, bj) && !stesso(aj, bi) && bi && bj) {
        primo[i][1] = bj;
        primo[j][1] = bi;
        break;
      }
    }
  }
}

export interface StatoTabellone {
  squadraA: string | null;
  squadraB: string | null;
  vincitore: string | null;
}

/**
 * Avanzamento derivato dal client: le squadre dei turni successivi si ricavano
 * dai risultati ufficiali delle partite che li alimentano.
 */
export function derivaTabellone(partite: Partita[], formato: FormatoSet): Map<string, StatoTabellone> {
  const byId = new Map(partite.map((p) => [p.id, p]));
  const memo = new Map<string, StatoTabellone>();
  const feeders = new Map<string, Partita[]>();
  for (const p of partite)
    if (p.prossimaPartita) feeders.set(p.prossimaPartita, [...(feeders.get(p.prossimaPartita) ?? []), p]);

  const calc = (id: string): StatoTabellone => {
    const cached = memo.get(id);
    if (cached) return cached;
    const p = byId.get(id)!;
    let a = p.squadraA ?? null;
    let b = p.squadraB ?? null;
    // se un lato è alimentato da una partita precedente vale il suo vincitore; altrimenti (bye) il valore salvato
    for (const f of feeders.get(id) ?? []) {
      const w = calc(f.id).vincitore;
      if (f.lato === 'A') a = w;
      if (f.lato === 'B') b = w;
    }
    const st: StatoTabellone = { squadraA: a, squadraB: b, vincitore: null };
    if (a && b) st.vincitore = vincitore({ ...p, squadraA: a, squadraB: b }, formato);
    memo.set(id, st);
    return st;
  };
  for (const p of partite) calc(p.id);
  return memo;
}
