/**
 * Pure helpers for the court manager screens (inbox, day timeline, recurrences, court settings).
 * No React, no data access: tested in logic.test.ts.
 */
import { richiestaAttiva, slotGriglia, type Slot } from '../../lib/slots';
import { addDays, fromMin, GIORNI_LUNGHI, labelDate, overlaps, parseDate, toMin } from '../../lib/time';
import type { Campo, Occupazione, OccupazioneRiga, Richiesta, Ricorrenza, TipoOccupazione } from '../../types';

// ------------------------------------------------------------------ requests

export interface StatoAccettazioni {
  date: number;
  totale: number;
  mancanti: string[];
}

/** Acceptances of a request: how many out of how many, and who is still missing. */
export function accettazioni(r: Pick<Richiesta, 'giocatori' | 'accettazioni'>): StatoAccettazioni {
  const mancanti = r.giocatori.filter((g) => !r.accettazioni[g]);
  return { date: r.giocatori.length - mancanti.length, totale: Math.max(4, r.giocatori.length), mancanti };
}

export function completa(r: Pick<Richiesta, 'giocatori' | 'accettazioni'>): boolean {
  const a = accettazioni(r);
  return a.mancanti.length === 0 && a.date >= 4;
}

export interface Scadenza {
  testo: string;
  /** Less than 2 hours left. */
  urgente: boolean;
  scaduta: boolean;
}

/** "scade tra 5 h", "scade tra 40 min", "scade tra 2 g"; urgent under 2 hours. */
export function scadenzaTesto(scadenzaMs: number, now: number): Scadenza {
  const diff = scadenzaMs - now;
  if (diff <= 0) return { testo: 'Scaduta', urgente: true, scaduta: true };
  const min = Math.ceil(diff / 60_000);
  const urgente = min < 120;
  if (min < 60) return { testo: `scade tra ${min} min`, urgente, scaduta: false };
  const ore = Math.floor(min / 60);
  if (ore < 48) return { testo: `scade tra ${ore} h`, urgente, scaduta: false };
  return { testo: `scade tra ${Math.floor(ore / 24)} g`, urgente, scaduta: false };
}

/** Start of the requested slot (local club time) in ms. */
export function inizioMs(r: Pick<Richiesta, 'data' | 'inizio'>): number {
  return parseDate(r.data).getTime() + toMin(r.inizio) * 60_000;
}

/** A request can never be useful after its own start: the effective deadline is the earlier of the two. */
export function scadenzaEffettiva(r: Pick<Richiesta, 'scadenza' | 'data' | 'inizio'>): number {
  return Math.min(r.scadenza.toMillis(), inizioMs(r));
}

/** Inbox order (G1): soonest (effective) expiry first, then date and time. */
export function ordinaPerScadenza<T extends Pick<Richiesta, 'scadenza' | 'data' | 'inizio'>>(rs: T[]): T[] {
  return [...rs].sort(
    (a, b) => scadenzaEffettiva(a) - scadenzaEffettiva(b) || a.data.localeCompare(b.data) || a.inizio.localeCompare(b.inizio),
  );
}

/** Other live pending requests on the same court, day and overlapping time ("Sovrapposta"). */
export function richiesteSovrapposte(r: Richiesta, tutte: Richiesta[], now = Date.now()): Richiesta[] {
  return tutte.filter(
    (x) =>
      x.id !== r.id &&
      x.stato === 'attesa' &&
      richiestaAttiva(x, now) &&
      x.campoId === r.campoId &&
      x.data === r.data &&
      overlaps(x.inizio, x.fine, r.inizio, r.fine),
  );
}

/** Occupations that would make the confirmation fail (client-side preview; the server decides). */
export function occupazioniInConflitto<T extends Pick<OccupazioneRiga, 'campoId' | 'data' | 'inizio' | 'fine' | 'richiestaId'>>(
  r: Pick<Richiesta, 'id' | 'campoId' | 'data' | 'inizio' | 'fine'>,
  righe: T[],
): T[] {
  return righe.filter(
    (o) => o.campoId === r.campoId && o.data === r.data && o.richiestaId !== r.id && overlaps(o.inizio, o.fine, r.inizio, r.fine),
  );
}

export const ETICHETTA_TIPO: Record<TipoOccupazione, string> = {
  campionato: 'Partita del campionato',
  esterno: 'Esterno',
  lezione: 'Lezione',
  chiusura: 'Chiuso',
};

export function descriviOccupazione(o: Pick<Occupazione, 'tipo' | 'inizio' | 'fine'>): string {
  return `${ETICHETTA_TIPO[o.tipo]} ${o.inizio}–${fineLeggibile(o.fine)}`;
}

/** "24:00" stays readable; "00:00" as an end means midnight. */
export function fineLeggibile(fine: string): string {
  return fine === '00:00' ? '24:00' : fine;
}

/** Why "Conferma" is disabled, or null when it can be tapped. */
export function motivoBloccoConferma(
  r: Richiesta,
  conflitti: Pick<Occupazione, 'tipo' | 'inizio' | 'fine'>[],
  nome: (uid: string) => string,
  now = Date.now(),
): string | null {
  if (inizioMs(r) <= now) return 'L’orario richiesto è già passato: rifiutala o proponi un altro orario.';
  if (r.scadenza.toMillis() <= now) return 'La richiesta è scaduta: non si può più confermare.';
  const a = accettazioni(r);
  if (a.mancanti.length || a.date < 4) {
    const chi = a.mancanti.map(nome);
    return `Mancano accettazioni (${a.date}/4): ${chi.length ? `deve accettare ${elenco(chi)}` : 'mancano giocatori'}.`;
  }
  if (conflitti.length) return `Il campo è occupato: ${conflitti.map(descriviOccupazione).join(', ')}.`;
  return null;
}

/** "A", "A e B", "A, B e C". */
export function elenco(voci: string[]): string {
  if (voci.length <= 1) return voci[0] ?? '';
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
}

export interface EsitoMessaggio {
  tono: 'ok' | 'warn' | 'danger';
  testo: string;
}

/** Outcome of confirm_request in plain Italian. */
export function messaggioConferma(
  res: { esito: 'ok' | 'occupato' | 'scaduta'; conflitti: number },
  r: Pick<Richiesta, 'data' | 'inizio'>,
  nomeCampo: string,
): EsitoMessaggio {
  const quando = `${labelDate(r.data)} ${r.inizio} · ${nomeCampo}`;
  if (res.esito === 'occupato')
    return {
      tono: 'danger',
      testo: `Conflitto: il campo risulta occupato (${quando}). La richiesta è passata in conflitto: i giocatori devono sceglierne un altro orario.`,
    };
  if (res.esito === 'scaduta') return { tono: 'warn', testo: `La richiesta di ${quando} è scaduta nel frattempo.` };
  const extra =
    res.conflitti > 0
      ? `; ${res.conflitti === 1 ? '1 richiesta sovrapposta è passata' : `${res.conflitti} richieste sovrapposte sono passate`} in conflitto`
      : '';
  return { tono: 'ok', testo: `Confermata ${quando}${extra}.` };
}

/** "Segnato." plus how many pending requests moved to conflict. */
export function messaggioConflitti(prefisso: string, conflitti: number): string {
  if (!conflitti) return prefisso;
  return `${prefisso} ${conflitti === 1 ? '1 richiesta in attesa è passata' : `${conflitti} richieste in attesa sono passate`} in conflitto.`;
}

// ------------------------------------------------------------------ counter-proposal

/**
 * Candidate days for a counter-proposal (G3): ±raggio days around the requested date,
 * clipped to the match period and to today, ordered by distance (same day first).
 */
export function giorniControproposta(
  data: string,
  oggi: string,
  periodo?: { inizio: string; fine: string } | null,
  raggio = 3,
): string[] {
  const out: string[] = [];
  for (let d = 0; d <= raggio; d++) {
    for (const g of d === 0 ? [data] : [addDays(data, -d), addDays(data, d)]) {
      if (g < oggi) continue;
      if (periodo && (g < periodo.inizio || g > periodo.fine)) continue;
      out.push(g);
    }
  }
  return out;
}

export type StatoSlotGestore = 'libero' | 'occupato' | 'richiesto';

/** Court-side state of a grid slot (no player availability): occupied, requested by a live request, or free. */
export function statoSlotGestore(
  slot: Slot,
  occupazioni: Record<string, Occupazione> | undefined,
  richieste: Richiesta[],
  now = Date.now(),
): StatoSlotGestore {
  if (Object.values(occupazioni ?? {}).some((o) => overlaps(o.inizio, o.fine, slot.inizio, slot.fine))) return 'occupato';
  const busy = richieste.some(
    (r) =>
      r.campoId === slot.campoId && r.data === slot.data && richiestaAttiva(r, now) && overlaps(r.inizio, r.fine, slot.inizio, slot.fine),
  );
  return busy ? 'richiesto' : 'libero';
}

// ------------------------------------------------------------------ times and forms

/** Times from `da` to `a` included, every `passo` minutes ("24:00" allowed as the last end). */
export function orari(da: string, a: string, passo = 15): string[] {
  const out: string[] = [];
  for (let m = toMin(da); m <= toMin(a); m += passo) out.push(fromMin(m));
  return out;
}

export function erroreIntervallo(inizio: string, fine: string): string | null {
  if (!inizio || !fine) return 'Indica l’orario di inizio e di fine.';
  if (toMin(fine) <= toMin(inizio)) return 'L’orario di fine deve venire dopo quello di inizio.';
  return null;
}

/** Start minute the day timeline opens at (G4): 13:00, or now (rounded down to the half hour) if later and today. */
export function minutoIniziale(eOggi: boolean, oraMin: number): number {
  const base = 13 * 60;
  if (!eOggi) return base;
  return Math.max(base, Math.floor(oraMin / 30) * 30 - 30);
}

// ------------------------------------------------------------------ courts

/** Starts generated by a court rule (preview while editing): "13:30 · 15:00 · …". */
export function iniziGriglia(primo: string, ultimo: string, durata: number): string[] {
  if (!primo || !ultimo || !(durata > 0) || toMin(ultimo) < toMin(primo)) return [];
  const out: string[] = [];
  for (let t = toMin(primo); t <= toMin(ultimo); t += durata) out.push(fromMin(t));
  return out;
}

export interface ErroriCampo {
  nome?: string;
  ultimoSlot?: string;
  durata?: string;
  giorniAttivi?: string;
}

export function validaCampo(c: Pick<Campo, 'nome' | 'primoSlot' | 'ultimoSlot' | 'durata' | 'giorniAttivi'>): ErroriCampo {
  const e: ErroriCampo = {};
  if (!c.nome.trim()) e.nome = 'Dai un nome al campo.';
  if (toMin(c.ultimoSlot) < toMin(c.primoSlot)) e.ultimoSlot = 'L’ultimo inizio deve venire dopo il primo.';
  else if (toMin(c.ultimoSlot) + c.durata > 24 * 60) e.ultimoSlot = 'L’ultima partita finirebbe dopo mezzanotte.';
  if (!Number.isInteger(c.durata) || c.durata < 15 || c.durata > 600) e.durata = 'La durata va da 15 a 600 minuti.';
  if (!c.giorniAttivi.length) e.giorniAttivi = 'Scegli almeno un giorno in cui il campo è aperto.';
  return e;
}

/** Stable id for a new court from its name (`[A-Za-z0-9_-]`, unique among the existing ones). */
export function nuovoIdCampo(nome: string, esistenti: string[]): string {
  const base =
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'campo';
  let id = base;
  for (let i = 2; esistenti.includes(id); i++) id = `${base}-${i}`;
  return id;
}

/** Confirmed requests on a court that would no longer sit on a grid slot with the new rule (informational). */
export function confermateFuoriGriglia(campo: Campo, confermate: Richiesta[]): Richiesta[] {
  return confermate.filter(
    (r) => r.campoId === campo.id && !slotGriglia(campo, r.data).some((s) => s.inizio === r.inizio && s.fine === r.fine),
  );
}

/** Sorted, unique closure dates. */
export function aggiungiData(date: string[], d: string): string[] {
  return [...new Set([...date, d])].sort();
}

// ------------------------------------------------------------------ recurrences

/** "01/10" */
export function dataBreve(d: string): string {
  const x = parseDate(d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`;
}

/** "ogni martedì 18:00–19:30" */
export function quandoRicorrenza(r: Pick<Ricorrenza, 'giornoSettimana' | 'inizio' | 'fine'>): string {
  return `ogni ${GIORNI_LUNGHI[r.giornoSettimana]} ${r.inizio}–${fineLeggibile(r.fine)}`;
}

/** "Saltati: mer 18/11 (Il campo è occupato…)" — server entries are "yyyy-mm-dd: message". */
export function etichettaSaltato(s: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}):\s*(.*)$/.exec(s);
  if (!m) return s;
  return m[2] ? `${labelDate(m[1])} (${m[2]})` : labelDate(m[1]);
}

export function messaggioMaterializza(res: { creati: number; saltati: string[] }): EsitoMessaggio {
  const creati =
    res.creati === 0 ? 'Nessun giorno nuovo da segnare.' : res.creati === 1 ? 'Segnato 1 giorno.' : `Segnati ${res.creati} giorni.`;
  if (!res.saltati.length) return { tono: 'ok', testo: creati };
  return { tono: 'warn', testo: `${creati} Saltati: ${res.saltati.map(etichettaSaltato).join('; ')}.` };
}

export function messaggioChiusura(res: { errori: string[]; conflitti: number }, data: string): EsitoMessaggio {
  const base = messaggioConflitti(`Giornata di ${labelDate(data)} chiusa.`, res.conflitti);
  if (!res.errori.length) return { tono: 'ok', testo: base };
  return {
    tono: 'warn',
    testo: `Chiusura parziale di ${labelDate(data)}. Non chiusi: ${res.errori.join('; ')}.${res.conflitti ? ` ${messaggioConflitti('', res.conflitti).trim()}` : ''}`,
  };
}
