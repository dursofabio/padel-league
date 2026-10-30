/**
 * Pure helpers of the organizer area: capacity, group draw, calendar and finals payloads,
 * bracket sync, tie blocks, tournament phases. No React, no I/O: tested in __tests__/logic.test.ts.
 */
import { berger, giornataToPeriodo } from '../../lib/berger';
import { derivaTabellone, generaTabellone, nextPow2 } from '../../lib/bracket';
import { occupazioniId } from '../../lib/slots';
import type { RigaClassifica } from '../../lib/standings';
import { risultatoUfficiale } from '../../lib/results';
import { addDays, dateRange, weekday } from '../../lib/time';
import type { FormatoSet, Occupazione, Partita, Periodo, Ricorrenza, Spareggio, Squadra, StatoTorneo, Torneo } from '../../types';

// ------------------------------------------------------------------ sections

export const SEZIONI = [
  { id: 'panoramica', label: 'Panoramica' },
  { id: 'configurazione', label: 'Configurazione' },
  { id: 'periodi', label: 'Periodi' },
  { id: 'squadre', label: 'Squadre' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'monitoraggio', label: 'Monitoraggio' },
  { id: 'finali', label: 'Fasi finali' },
] as const;

export type SezioneId = (typeof SEZIONI)[number]['id'];

export function sezioneValida(s: string | undefined): SezioneId {
  return (SEZIONI.find((x) => x.id === s)?.id ?? 'panoramica') as SezioneId;
}

// ------------------------------------------------------------------ labels

export const NOMI_SPAREGGIO: Record<Spareggio, string> = {
  punti: 'Punti',
  scontroDiretto: 'Scontro diretto',
  diffSet: 'Differenza set',
  diffGame: 'Differenza game',
  setVinti: 'Set vinti',
  gameVinti: 'Game vinti',
  sorteggio: 'Sorteggio',
};

export const TUTTI_SPAREGGI = Object.keys(NOMI_SPAREGGIO) as Spareggio[];

export function nomeFase(fase: string): string {
  if (fase === 'gironi') return 'Gironi';
  return fase.charAt(0).toUpperCase() + fase.slice(1);
}

export function lettereGironi(n: number): string[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => String.fromCharCode(65 + i));
}

/** "3ª" */
export function ordinale(n: number): string {
  return `${n}ª`;
}

// ------------------------------------------------------------------ tournament phases

export const FASI_TORNEO: { stato: StatoTorneo; label: string }[] = [
  { stato: 'iscrizioni', label: 'Iscrizioni' },
  { stato: 'gironi', label: 'Gironi' },
  { stato: 'fasiFinali', label: 'Fasi finali' },
  { stato: 'concluso', label: 'Concluso' },
];

export type StatoPasso = 'fatto' | 'corrente' | 'futuro';

export function passiTorneo(stato: StatoTorneo): { stato: StatoTorneo; label: string; passo: StatoPasso }[] {
  const idx = FASI_TORNEO.findIndex((f) => f.stato === stato);
  return FASI_TORNEO.map((f, i) => ({ ...f, passo: i < idx ? 'fatto' : i === idx ? 'corrente' : 'futuro' }));
}

/** State a concluded tournament returns to with "Riapri" (same rule as set_tournament_state). */
export function statoPrecedente(torneo: Torneo, partite: Partita[]): StatoTorneo {
  if ((torneo.fasiGenerate ?? []).length) return 'fasiFinali';
  if (partite.some((p) => p.fase === 'gironi')) return 'gironi';
  return 'iscrizioni';
}

// ------------------------------------------------------------------ deterministic shuffle

/** Small seeded PRNG (mulberry32): the preview and the generated data come from the same draw. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mescola<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ------------------------------------------------------------------ groups

/** Random draw of the approved teams into n groups (A, B, …), sizes differing by at most one. */
export function sorteggiaGironi(ids: string[], n: number, rand: () => number = Math.random): Record<string, string> {
  const lettere = lettereGironi(Math.max(1, n));
  const out: Record<string, string> = {};
  mescola(ids, rand).forEach((id, i) => (out[id] = lettere[i % lettere.length]));
  return out;
}

/** Approved teams per group (only approved ones play). */
export function squadrePerGirone(squadre: Squadra[]): Map<string, Squadra[]> {
  const m = new Map<string, Squadra[]>();
  for (const s of squadre)
    if (s.stato === 'approvata' && s.girone) m.set(s.girone, [...(m.get(s.girone) ?? []), s]);
  return new Map([...m.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

// ------------------------------------------------------------------ calendar

export interface RigaCalendario {
  codice: string;
  girone: string;
  turno: number;
  posizione: number;
  squadra_a: string;
  squadra_b: string;
  periodo_id: string | null;
}

export interface RiepilogoGirone {
  girone: string;
  squadre: number;
  partite: number;
  giornate: number;
  /** Consecutive matchday blocks per period. */
  blocchi: { periodoId: string | null; etichetta: string; da: number; a: number }[];
}

export function periodiGironi(periodi: Periodo[]): Periodo[] {
  return periodi.filter((p) => p.fase === 'gironi').sort((a, b) => a.inizio.localeCompare(b.inizio));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Group-phase calendar (Berger) for the approved teams with a group: payload of generate_calendar
 * (docs/contratto-api.md) plus a summary for the preview. Codes are "gA-01-1" (group, matchday, match).
 * Matchdays go to the group periods in consecutive blocks.
 */
export function pianoCalendario(
  squadre: Squadra[],
  periodi: Periodo[],
  rand: () => number = Math.random,
): { partite: RigaCalendario[]; gironi: RiepilogoGirone[] } {
  const per = periodiGironi(periodi);
  const partite: RigaCalendario[] = [];
  const riepilogo: RiepilogoGirone[] = [];
  for (const [girone, lista] of squadrePerGirone(squadre)) {
    // random order: the calendar does not depend on the registration order
    const cal = berger(mescola(lista.map((s) => s.id), rand));
    const giornate = Math.max(0, ...cal.map((c) => c.giornata));
    const toPer = giornataToPeriodo(giornate, per.length);
    const contatore = new Map<number, number>();
    for (const c of cal) {
      const i = contatore.get(c.giornata) ?? 0;
      contatore.set(c.giornata, i + 1);
      partite.push({
        codice: `g${girone}-${pad2(c.giornata)}-${i + 1}`,
        girone,
        turno: c.giornata,
        posizione: i,
        squadra_a: c.casa,
        squadra_b: c.ospite,
        periodo_id: per.length ? per[toPer(c.giornata)].id : null,
      });
    }
    const blocchi: RiepilogoGirone['blocchi'] = [];
    for (let g = 1; g <= giornate; g++) {
      const p = per.length ? per[toPer(g)] : null;
      const last = blocchi[blocchi.length - 1];
      if (last && last.periodoId === (p?.id ?? null)) last.a = g;
      else blocchi.push({ periodoId: p?.id ?? null, etichetta: p?.etichetta ?? 'senza periodo', da: g, a: g });
    }
    riepilogo.push({ girone, squadre: lista.length, partite: cal.length, giornate, blocchi });
  }
  return { partite, gironi: riepilogo };
}

// ------------------------------------------------------------------ capacity

/** Recurring occupations as "virtual" occupations, to estimate capacity without materialising days. */
export function occupazioniDaRicorrenze(ric: Ricorrenza[], giorni: string[]): Record<string, Record<string, Occupazione>> {
  const out: Record<string, Record<string, Occupazione>> = {};
  for (const r of ric)
    for (const d of giorni)
      if (d >= r.dal && d <= r.al && weekday(d) === r.giornoSettimana)
        (out[occupazioniId(r.campoId, d)] ??= {})[r.id] = { inizio: r.inizio, fine: r.fine, tipo: r.tipo };
  return out;
}

/**
 * Matches a period must hold: the assigned ones once the calendar exists, otherwise an estimate
 * (Berger distribution across the group periods; for a final phase, the bracket size per round).
 */
export function partiteNelPeriodo(periodo: Periodo, periodi: Periodo[], partite: Partita[], squadre: Squadra[], fasiFinali: { nome: string; posti: number }[]): number {
  const assegnate = partite.filter((p) => p.periodoId === periodo.id).length;
  if (assegnate || partite.some((p) => p.fase === periodo.fase.toLowerCase())) return assegnate;
  if (periodo.fase === 'gironi') {
    const per = periodiGironi(periodi);
    const idx = per.findIndex((p) => p.id === periodo.id);
    let n = 0;
    for (const lista of squadrePerGirone(squadre).values()) {
      const cal = berger(lista.map((s) => s.id));
      const giornate = Math.max(0, ...cal.map((c) => c.giornata));
      const toPer = giornataToPeriodo(giornate, per.length);
      n += cal.filter((c) => toPer(c.giornata) === idx).length;
    }
    return n;
  }
  const fase = fasiFinali.find((f) => f.nome.toLowerCase() === periodo.fase.toLowerCase());
  if (!fase || fase.posti < 2) return 0;
  const size = nextPow2(fase.posti);
  if (periodo.turno) return Math.max(0, size / 2 ** periodo.turno - (periodo.turno === 1 ? size - fase.posti : 0));
  return fase.posti - 1;
}

export type TonoCapienza = 'ok' | 'warn' | 'danger';

export interface Capienza {
  giorni: number;
  slot: number;
  partite: number;
  /** Slots per match; null when there is nothing to play. */
  rapporto: number | null;
  tono: TonoCapienza | null;
  slotSettimana: number;
  servonoSettimana: number;
}

/** Thresholds (ASSUNZIONE O4): ≥ 3 slots per match good, 1.5–3 tight, < 1.5 insufficient. */
export function valutaCapienza(slot: number, partite: number, giorni: number): Capienza {
  const settimane = Math.max(1, giorni / 7);
  const rapporto = partite > 0 ? slot / partite : null;
  const tono: TonoCapienza | null = rapporto === null ? null : rapporto >= 3 ? 'ok' : rapporto >= 1.5 ? 'warn' : 'danger';
  return {
    giorni,
    slot,
    partite,
    rapporto,
    tono,
    slotSettimana: Math.floor(slot / settimane),
    servonoSettimana: Math.ceil(partite / settimane),
  };
}

export function giorniPeriodo(p: Pick<Periodo, 'inizio' | 'fine'>): string[] {
  return p.fine >= p.inizio ? dateRange(p.inizio, p.fine) : [];
}

/** "2,1" */
export function formatRapporto(r: number): string {
  return r.toFixed(1).replace('.', ',');
}

// ------------------------------------------------------------------ finals

export interface RigaFinale {
  codice: string;
  turno: number;
  posizione: number;
  prossima_codice: string | null;
  lato: 'A' | 'B' | null;
  squadra_a: string | null;
  squadra_b: string | null;
  periodo_id: string | null;
}

/**
 * Payload of generate_finals for one phase: codes are the generaTabellone ids ("gold-t1-p0"),
 * next match by code, and the period of the round (or the phase period without a round).
 */
export function pianoFase(
  fase: string,
  teste: string[],
  gironeDi: (id: string) => string | undefined,
  periodi: Periodo[],
): RigaFinale[] {
  const f = fase.toLowerCase();
  const perFase = periodi.filter((p) => p.fase.toLowerCase() === f);
  return generaTabellone(f, teste, gironeDi).map((m) => ({
    codice: m.id,
    turno: m.turno,
    posizione: m.posizione,
    prossima_codice: m.prossimaPartita,
    lato: m.lato,
    squadra_a: m.squadraA,
    squadra_b: m.squadraB,
    periodo_id: (perFase.find((p) => p.turno === m.turno) ?? perFase.find((p) => !p.turno))?.id ?? null,
  }));
}

/** Preview rows of a bracket as matches, for the shared Bracket component. */
export function partiteAnteprima(fase: string, righe: RigaFinale[]): Partita[] {
  return righe.map((r) => ({
    id: r.codice,
    codice: r.codice,
    fase,
    girone: null,
    turno: r.turno,
    posizione: r.posizione,
    prossimaPartita: r.prossima_codice,
    lato: r.lato,
    squadraA: r.squadra_a,
    squadraB: r.squadra_b,
    giocatoriA: [],
    giocatoriB: [],
    giocatori: [],
    periodoId: r.periodo_id,
    stato: 'da programmare',
  }));
}

/**
 * sync_bracket updates: generated-phase matches still "da programmare" whose pairs, derived from
 * the official results, differ from the stored ones.
 */
export function aggiornamentiTabellone(
  partite: Partita[],
  formato: FormatoSet,
  fasiGenerate: string[],
): { codice: string; squadra_a: string | null; squadra_b: string | null }[] {
  const finali = partite.filter((p) => fasiGenerate.includes(p.fase));
  const der = derivaTabellone(finali, formato);
  const out: { codice: string; squadra_a: string | null; squadra_b: string | null }[] = [];
  for (const p of finali) {
    const d = der.get(p.id);
    if (!d || !p.codice || p.stato !== 'da programmare') continue;
    if (d.squadraA === p.squadraA && d.squadraB === p.squadraB) continue;
    out.push({ codice: p.codice, squadra_a: d.squadraA, squadra_b: d.squadraB });
  }
  return out;
}

// ------------------------------------------------------------------ ties

/**
 * Blocks of teams tied after the whole tie-break chain (computed without any draw),
 * as lists of team ids in standing order. Adjacent tied rows with the same totals form one block.
 */
export function blocchiPari(righe: RigaClassifica[]): string[][] {
  const chiave = (r: RigaClassifica) =>
    [r.punti, r.setVinti - r.setPersi, r.gameVinti - r.gamePersi, r.setVinti, r.gameVinti, r.giocate].join('|');
  const out: string[][] = [];
  let corrente: RigaClassifica[] = [];
  const chiudi = () => {
    if (corrente.length > 1) out.push(corrente.map((r) => r.squadraId));
    corrente = [];
  };
  for (const r of righe) {
    if (!r.pariMerito) {
      chiudi();
      continue;
    }
    if (corrente.length && chiave(corrente[0]) !== chiave(r)) chiudi();
    corrente.push(r);
  }
  chiudi();
  return out;
}

/** Moves one team within its tied block; returns the new block order. */
export function spostaNelBlocco(blocco: string[], id: string, dir: -1 | 1): string[] {
  const i = blocco.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocco.length) return blocco;
  const out = [...blocco];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Writes a block order into the draw map (lower = better), keeping the other entries. */
export function sorteggioConBlocco(sorteggio: Record<string, number>, blocco: string[]): Record<string, number> {
  const out = { ...sorteggio };
  blocco.forEach((id, i) => (out[id] = i + 1));
  return out;
}

export function stessoSorteggio(a: Record<string, number> = {}, b: Record<string, number> = {}): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

// ------------------------------------------------------------------ monitoring

export interface Eccezioni {
  contestate: Partita[];
  inRitardo: Partita[];
  daConfermare: Partita[];
  inScadenza: Partita[];
}

const chiusa = (p: Partita) => p.stato === 'giocata' || p.stato === 'tavolino';

/**
 * Exceptions for the organizer: disputes; late matches (period ended, not played);
 * results entered and not confirmed; matches still to schedule whose period ends within `giorniScadenza` days.
 */
export function eccezioni(partite: Partita[], periodi: Periodo[], oggi: string, giorniScadenza = 7): Eccezioni {
  const per = new Map(periodi.map((p) => [p.id, p]));
  const limite = addDays(oggi, giorniScadenza);
  const fine = (p: Partita) => (p.periodoId ? per.get(p.periodoId)?.fine : undefined);
  return {
    contestate: partite.filter((p) => p.stato === 'contestata'),
    inRitardo: partite.filter((p) => {
      const f = fine(p);
      return !chiusa(p) && p.stato !== 'contestata' && !!f && f < oggi;
    }),
    daConfermare: partite.filter((p) => !!p.risultato && !risultatoUfficiale(p) && p.stato !== 'contestata'),
    inScadenza: partite.filter((p) => {
      const f = fine(p);
      return p.stato === 'da programmare' && !!f && f >= oggi && f <= limite && !!p.squadraA && !!p.squadraB;
    }),
  };
}

export function contaRisultati(partite: Partita[]): number {
  return partite.filter((p) => !!p.risultato?.set?.length).length;
}

/** ASSUNZIONE H6: an unconfirmed result needs the organizer after 48 hours. */
export const ORE_PROMEMORIA_RISULTATO = 48;

/** Whole hours elapsed since an ISO instant; null if unknown. */
export function oreDa(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / 3_600_000));
}

/** "da meno di un'ora", "da 5 ore", "da 1 giorno", "da 3 giorni". */
export function testoEta(ore: number): string {
  if (ore < 1) return 'da meno di un’ora';
  if (ore < 24) return `da ${ore} ${ore === 1 ? 'ora' : 'ore'}`;
  const g = Math.floor(ore / 24);
  return `da ${g} ${g === 1 ? 'giorno' : 'giorni'}`;
}
