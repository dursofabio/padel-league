/**
 * Pure logic of the match screens (lane B2): week window, effective state, slot labels,
 * keyboard navigation in the lanes, score-entry helpers. Tested in __tests__/logica.test.ts.
 */
import { isSetDecisivo, validaRisultato } from '../../../lib/results';
import type { StatoSlot } from '../../../lib/slots';
import { addDays, dateRange, GIORNI_LUNGHI, labelDate, parseDate, toMin } from '../../../lib/time';
import { TIPO_OCCUPAZIONE } from '../../../lib/copy';
import type { FormatoSet, Partita, Periodo, Programmazione, Richiesta, SetScore } from '../../../types';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "2026-11-14" → "Sabato 14 novembre" */
export function dataLunga(data: string): string {
  const d = parseDate(data);
  const g = GIORNI_LUNGHI[d.getDay()];
  return `${g.charAt(0).toUpperCase()}${g.slice(1)} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** ["Luca"] → "Luca"; ["Luca", "Marta", "Ugo"] → "Luca, Marta e Ugo" */
export function elencoNomi(nomi: string[]): string {
  if (nomi.length <= 1) return nomi[0] ?? '';
  return `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

// ------------------------------------------------------------------ week window (ASSUNZIONE P1)

export interface Finestra {
  from: string;
  to: string;
  giorni: string[];
  /** Index actually shown (clamped). */
  settimana: number;
  haPrecedente: boolean;
  haSuccessiva: boolean;
  /** The match period is over (late match): the window starts from today. */
  periodoFinito: boolean;
}

/** Weeks offered after the end of the period (late matches) or when the match has no period. */
export const SETTIMANE_SENZA_PERIODO = 4;

/**
 * One week at a time, clipped to the match period, starting at max(today, period start).
 * Late matches (period over) or matches without a period: 7 days from today, up to 4 weeks ahead.
 */
export function finestraSettimana(
  periodo: Pick<Periodo, 'inizio' | 'fine'> | null | undefined,
  oggi: string,
  settimana: number,
): Finestra {
  const aperto = !!periodo && periodo.fine >= oggi;
  const inizio = aperto ? (periodo!.inizio > oggi ? periodo!.inizio : oggi) : oggi;
  const fine = aperto ? periodo!.fine : addDays(oggi, SETTIMANE_SENZA_PERIODO * 7 - 1);
  const giorniTot = dateRange(inizio, fine).length;
  const n = Math.max(1, Math.ceil(giorniTot / 7));
  const k = Math.min(Math.max(0, Math.floor(settimana)), n - 1);
  const from = addDays(inizio, k * 7);
  const fine7 = addDays(from, 6);
  const to = fine7 < fine ? fine7 : fine;
  return {
    from,
    to,
    giorni: dateRange(from, to),
    settimana: k,
    haPrecedente: k > 0,
    haSuccessiva: k < n - 1,
    periodoFinito: !!periodo && !aperto,
  };
}

// ------------------------------------------------------------------ time

/** Local instant (ms) of a day and a wall-clock time. */
export function istante(data: string, hhmm: string): number {
  return parseDate(data).getTime() + toMin(hhmm) * 60_000;
}

/** "dom 15/11 alle 10:00" */
export function quando(ms: number): string {
  const d = new Date(ms);
  const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${labelDate(data)} alle ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "tra 20 h", "tra 35 min", "tra 3 giorni"; null if already past. */
export function traQuanto(ms: number, now: number): string | null {
  const diff = ms - now;
  if (diff <= 0) return null;
  const min = Math.ceil(diff / 60_000);
  if (min < 60) return `tra ${min} min`;
  const ore = Math.round(diff / 3_600_000);
  if (ore < 48) return `tra ${ore} h`;
  return `tra ${Math.round(diff / 86_400_000)} giorni`;
}

/** Until when a player can cancel a confirmed match from the app (decision P4 changed). */
export function limiteAnnullamento(prog: Pick<Programmazione, 'data' | 'inizio'>, ore: number): number {
  return istante(prog.data, prog.inizio) - ore * 3_600_000;
}

// ------------------------------------------------------------------ state machine

export type Fase = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';

/** A request is useless once its slot has started: the effective expiry is the earlier of the two (critique M1). */
export function scadenzaEffettiva(r: Pick<Richiesta, 'scadenza'> & Partial<Pick<Richiesta, 'data' | 'inizio'>>): number {
  const scad = r.scadenza.toMillis();
  return r.data && r.inizio ? Math.min(scad, istante(r.data, r.inizio)) : scad;
}

export function richiestaViva(
  r: (Pick<Richiesta, 'stato' | 'scadenza'> & Partial<Pick<Richiesta, 'data' | 'inizio'>>) | null | undefined,
  now: number,
): boolean {
  return !!r && r.stato === 'attesa' && scadenzaEffettiva(r) > now;
}

export function accettate(r: Pick<Richiesta, 'giocatori' | 'accettazioni'>): number {
  return r.giocatori.filter((g) => !!r.accettazioni[g]).length;
}

/**
 * Effective state (brief §5). S6 = result entered and not confirmed (the page splits opponent / inserter side).
 * A `richiesta` match whose request is not live behaves as `da programmare`.
 */
export function fasePartita(p: Partita, richiesta: Richiesta | null | undefined, now: number): Fase {
  if (!p.squadraA || !p.squadraB) return 'S0';
  if (p.stato === 'giocata' || p.stato === 'tavolino') return 'S8';
  if (p.stato === 'contestata') return 'S7';
  if (p.risultato && !p.risultato.confermatoDa) return 'S6';
  if (p.stato === 'programmata') {
    if (p.programmazione && now < istante(p.programmazione.data, p.programmazione.inizio)) return 'S4';
    return 'S5';
  }
  if (richiesta && richiesta.partitaId === p.id && richiestaViva(richiesta, now)) {
    return accettate(richiesta) >= richiesta.giocatori.length ? 'S3' : 'S2';
  }
  return 'S1';
}

export function latoDi(p: Pick<Partita, 'giocatoriA' | 'giocatoriB'>, uid: string | null | undefined): 'A' | 'B' | null {
  if (!uid) return null;
  if (p.giocatoriA.includes(uid)) return 'A';
  if (p.giocatoriB.includes(uid)) return 'B';
  return null;
}

/** Period over and match still open: "In ritardo" (decision H3: still bookable). */
export function inRitardo(p: Partita, periodo: Pick<Periodo, 'fine'> | null | undefined, oggi: string): boolean {
  if (!periodo || periodo.fine >= oggi) return false;
  return (p.stato === 'da programmare' || p.stato === 'richiesta') && !p.risultato;
}

// ------------------------------------------------------------------ my matches grouping

export type GruppoPartita = 'tocca-a-te' | 'da-programmare' | 'in-corso' | 'programmate' | 'attesa-risultato' | 'da-definire' | 'concluse';

export const GRUPPI: { id: GruppoPartita; titolo: string }[] = [
  { id: 'tocca-a-te', titolo: 'Tocca a te' },
  { id: 'da-programmare', titolo: 'Da programmare' },
  { id: 'in-corso', titolo: 'Richieste in corso' },
  { id: 'programmate', titolo: 'Programmate' },
  { id: 'attesa-risultato', titolo: 'Risultato in sospeso' },
  { id: 'da-definire', titolo: 'In attesa delle coppie' },
  { id: 'concluse', titolo: 'Concluse' },
];

export type MotivoTurno = 'accetta' | 'conferma-risultato' | 'inserisci-risultato';

export function gruppoPartita(
  p: Partita,
  richiesta: Richiesta | null | undefined,
  uid: string,
  now: number,
): { gruppo: GruppoPartita; motivo?: MotivoTurno } {
  const fase = fasePartita(p, richiesta, now);
  switch (fase) {
    case 'S0':
      return { gruppo: 'da-definire' };
    case 'S1':
      return { gruppo: 'da-programmare' };
    case 'S2':
      if (richiesta && richiesta.giocatori.includes(uid) && !richiesta.accettazioni[uid]) return { gruppo: 'tocca-a-te', motivo: 'accetta' };
      return { gruppo: 'in-corso' };
    case 'S3':
      return { gruppo: 'in-corso' };
    case 'S4':
      return { gruppo: 'programmate' };
    case 'S5':
      return { gruppo: 'tocca-a-te', motivo: 'inserisci-risultato' };
    case 'S6': {
      const mio = latoDi(p, uid);
      const ins = latoDi(p, p.risultato?.inseritoDa);
      if (mio && ins && mio !== ins) return { gruppo: 'tocca-a-te', motivo: 'conferma-risultato' };
      return { gruppo: 'attesa-risultato' };
    }
    case 'S7':
      return { gruppo: 'attesa-risultato' };
    case 'S8':
      return { gruppo: 'concluse' };
  }
}

// ------------------------------------------------------------------ slot labels

export function etichettaSlot(s: Pick<StatoSlot, 'colore' | 'liberi'>, totale: number): string {
  if (s.colore === 'rosso') return 'Occupato';
  if (s.colore === 'blu') return 'Richiesto';
  return `${s.liberi.length}/${totale}`;
}

/** "lezione 15:00–16:30" */
export function descriviOccupazione(o: { tipo: keyof typeof TIPO_OCCUPAZIONE; inizio: string; fine: string; nota?: string | null }): string {
  return `${TIPO_OCCUPAZIONE[o.tipo].toLowerCase()} ${o.inizio}–${o.fine}`;
}

/** Slot that can be requested from the grid (decision P2: 4/4 and 3/4). */
export function slotUtile(s: Pick<StatoSlot, 'colore'>): boolean {
  return s.colore === 'verde' || s.colore === 'giallo';
}

/**
 * Accessible name of a slot block. It STARTS with the visible text ("15:30 3/4") for voice control
 * (WCAG 2.5.3), then the details: "15:30 3/4, Campo 2, Sabato 14 novembre, fino alle 17:00, manca Luca".
 */
export function ariaSlot(s: StatoSlot, campoNome: string, nome: (uid: string) => string): string {
  const tot = s.liberi.length + s.mancanti.length;
  const base = `${s.slot.inizio} ${etichettaSlot(s, tot)}, ${campoNome}, ${dataLunga(s.slot.data)}, fino alle ${s.slot.fine}`;
  if (s.colore === 'rosso') {
    const occ = s.occupazioni.map(descriviOccupazione).join(', ');
    return occ ? `${base}, ${occ}` : base;
  }
  if (s.colore === 'blu') return `${base}, già chiesto per un'altra partita`;
  if (!s.mancanti.length) return `${base}, tutti liberi`;
  const nomi = elencoNomi(s.mancanti.map(nome));
  return `${base}, ${s.mancanti.length === 1 ? 'manca' : 'mancano'} ${nomi}`;
}

/** Off-grid start times (ASSUNZIONE P6): 08:00–22:30 in `passo` steps, future only. */
export function opzioniInizio(passo: number, data: string, oggi: string, oraMin: number): string[] {
  const out: string[] = [];
  for (let m = 8 * 60; m <= 22 * 60 + 30; m += passo) {
    if (data === oggi && m <= oraMin) continue;
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

// ------------------------------------------------------------------ keyboard navigation in the lanes

export interface CellaNav {
  key: string;
  campoId: string;
  inizio: string;
}

export type TastoNav = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'PageUp' | 'PageDown' | 'Home' | 'End';

function piuVicina(celle: CellaNav[], inizio: string, filtro?: (c: CellaNav) => boolean): CellaNav | undefined {
  const t = toMin(inizio);
  let best: CellaNav | undefined;
  for (const c of celle) {
    if (filtro && !filtro(c)) continue;
    if (!best || Math.abs(toMin(c.inizio) - t) < Math.abs(toMin(best.inizio) - t)) best = c;
  }
  return best;
}

/**
 * Roving focus over the days (each a list of cells in time order):
 * ↑/↓ previous/next start in the day, ←/→ the other court at the nearest time,
 * PageUp/PageDown previous/next day, Home/End first/last of the day.
 */
export function muoviFocus(giorni: CellaNav[][], key: string, tasto: TastoNav, campi: string[]): string | null {
  const di = giorni.findIndex((g) => g.some((c) => c.key === key));
  if (di < 0) return null;
  const giorno = giorni[di];
  const i = giorno.findIndex((c) => c.key === key);
  const cur = giorno[i];
  switch (tasto) {
    case 'ArrowUp':
      return giorno[i - 1]?.key ?? null;
    case 'ArrowDown':
      return giorno[i + 1]?.key ?? null;
    case 'Home':
      return giorno[0].key;
    case 'End':
      return giorno[giorno.length - 1].key;
    case 'ArrowLeft':
    case 'ArrowRight': {
      const ci = campi.indexOf(cur.campoId);
      const altro = campi[ci + (tasto === 'ArrowRight' ? 1 : -1)];
      if (!altro) return null;
      return piuVicina(giorno, cur.inizio, (c) => c.campoId === altro)?.key ?? null;
    }
    case 'PageUp':
    case 'PageDown': {
      const step = tasto === 'PageDown' ? 1 : -1;
      for (let d = di + step; d >= 0 && d < giorni.length; d += step) {
        if (!giorni[d].length) continue;
        return (piuVicina(giorni[d], cur.inizio, (c) => c.campoId === cur.campoId) ?? piuVicina(giorni[d], cur.inizio))!.key;
      }
      return null;
    }
  }
}

// ------------------------------------------------------------------ score entry

export interface ValoreSet {
  a: number | null;
  b: number | null;
}

export function maxGame(i: number, formato: FormatoSet): number {
  return formato.superTieBreak && isSetDecisivo(i, formato) ? 30 : 7;
}

export function nomeSet(i: number, formato: FormatoSet): string {
  return formato.superTieBreak && isSetDecisivo(i, formato) ? 'Super tie-break' : `Set ${i + 1}`;
}

/** Rows shown: the sets needed to win, plus one more while the match is still open after complete sets. */
export function righeVisibili(valori: ValoreSet[], formato: FormatoSet): number {
  const max = formato.setPerVincere * 2 - 1;
  let va = 0;
  let vb = 0;
  let n = formato.setPerVincere;
  for (let i = 0; i < max; i++) {
    const v = valori[i];
    if (!v || v.a === null || v.b === null || v.a === v.b) break;
    if (v.a > v.b) va++;
    else vb++;
    if (va === formato.setPerVincere || vb === formato.setPerVincere) break;
    if (i + 1 >= n) n = i + 2;
  }
  return Math.min(n, max);
}

export function valoriDa(set: SetScore[] | null | undefined, formato: FormatoSet): ValoreSet[] {
  const max = formato.setPerVincere * 2 - 1;
  return Array.from({ length: max }, (_, i) => (set?.[i] ? { a: set[i].a, b: set[i].b } : { a: null, b: null }));
}

export interface ControlloRisultato {
  /** Per-row messages (row index → text). */
  perRiga: Record<number, string>;
  /** Message about the whole match (not concluded, …). */
  globale?: string;
  set: SetScore[];
  vincitore?: 'A' | 'B';
  setA: number;
  setB: number;
}

/** Live validation with validaRisultato: messages attached to the row they concern. */
export function controllaRisultato(valori: ValoreSet[], formato: FormatoSet): ControlloRisultato {
  const n = righeVisibili(valori, formato);
  const perRiga: Record<number, string> = {};
  const set: SetScore[] = [];
  for (let i = 0; i < n; i++) {
    const v = valori[i] ?? { a: null, b: null };
    const max = maxGame(i, formato);
    if ((v.a !== null && v.a > max) || (v.b !== null && v.b > max)) {
      perRiga[i] = `${nomeSet(i, formato)}: al massimo ${max}`;
      break;
    }
    if (v.a === null && v.b === null) break;
    if (v.a === null || v.b === null) {
      perRiga[i] = `${nomeSet(i, formato)}: scrivi i game di entrambe le coppie`;
      break;
    }
    set.push({ a: v.a, b: v.b });
  }
  const setA = set.filter((s) => s.a > s.b).length;
  const setB = set.filter((s) => s.b > s.a).length;
  if (Object.keys(perRiga).length || !set.length) return { perRiga, set, setA, setB };
  const esito = validaRisultato(set, formato);
  if (esito.ok) return { perRiga, set, vincitore: esito.vincitore, setA, setB };
  const m = esito.errore?.match(/^Set (\d+): (.*)$/);
  if (m) {
    const i = Number(m[1]) - 1;
    const testo = formato.superTieBreak && isSetDecisivo(i, formato) ? `Super tie-break: ${m[2].replace(/^super tie-break /, '')}` : esito.errore!;
    perRiga[i] = testo;
    return { perRiga, set, setA, setB };
  }
  const globale = esito.errore === 'La partita non è conclusa' ? 'La partita non è ancora conclusa' : esito.errore;
  return { perRiga, globale, set, setA, setB };
}

// ------------------------------------------------------------------ error copy (brief §11, risultato §7)

const ERRORI_PARTITA: Record<string, string> = {
  SLOT_TAKEN: 'Qualcuno ha appena preso questo orario. Scegline un altro.',
  MATCH_HAS_REQUEST: 'C’è già una richiesta in corso per questa partita.',
  EXPIRED: 'La richiesta è scaduta nel frattempo.',
  OFF_GRID_DISABLED: 'Gli orari fuori griglia non sono attivi in questo torneo.',
  COURT_CLOSED: 'Il campo è chiuso quel giorno.',
  IN_PAST: 'Quell’orario è già passato.',
  NOT_AUTHORIZED: 'Solo i giocatori di questa partita possono farlo.',
  ALREADY_CONFIRMED: 'Il risultato è già stato confermato.',
  BAD_STATE: 'La partita è cambiata nel frattempo: ricarico.',
  TOO_LATE: 'Manca troppo poco all’inizio per annullarla dall’app: scrivi al gestore.',
};

/**
 * Hint → copy of the match brief; `null` = use the shared mapping (messaggioErrore).
 * BAD_STEP depends on the tournament step; OVERLAP / INVALID_SCORE keep the server's explanation.
 */
export function erroreDaHint(e: unknown, passo = 30): string | null {
  const err = (e ?? {}) as { hint?: string; code?: string; message?: string };
  if (err.hint === 'BAD_STEP') return `Scegli un orario ogni ${passo} minuti.`;
  if (err.hint === 'OVERLAP' || err.code === '23P01') return err.message && err.hint === 'OVERLAP' ? err.message : 'Il campo è già occupato in quell’orario.';
  if (err.code === '23505') return ERRORI_PARTITA.SLOT_TAKEN;
  if (err.hint && ERRORI_PARTITA[err.hint]) return ERRORI_PARTITA[err.hint];
  return null;
}

/** Lanes scale cropped to the visible slots of a day (whole hours), never wider than the base scale. */
export function scalaRitagliata(
  slots: { inizio: string; fine: string }[],
  base: { da: number; a: number; px: number },
): { da: number; a: number; px: number } {
  if (!slots.length) return base;
  const da = Math.min(...slots.map((s) => toMin(s.inizio)));
  const a = Math.max(...slots.map((s) => toMin(s.fine)));
  return { da: Math.max(base.da, Math.floor(da / 60) * 60), a: Math.min(base.a, Math.ceil(a / 60) * 60), px: base.px };
}
