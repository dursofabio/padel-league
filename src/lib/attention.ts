/**
 * "Da fare" feed: what needs the user now, derived only from server data.
 * Pure and synchronous: time is an input (`now`, `today`), never read here. See docs/ux/home-da-fare.md §6.
 *
 * Inputs use the domain types returned by src/data (Torneo, Partita, Richiesta, …) so the page passes the
 * query results as they are. Two fields the adapters do not expose yet are optional:
 * `Partita.updatedAt` (needed by `risultati-non-confermati`) and `Richiesta.createdAt`
 * (latest request of a match; falls back to `scadenza`, which grows with creation time).
 */
import { prossimoPasso } from './prossimoPasso';
import type { Fasce, Partita, Periodo, Richiesta, Role, Squadra, Torneo } from '../types';

export type AttentionRole = 'giocatore' | 'gestore' | 'organizzatore';
/** 0 Urgente, 1 Da fare, 2 Presto, 3 Per sapere */
export type Priority = 0 | 1 | 2 | 3;

export type AttentionKind =
  // giocatore
  | 'accetta-richiesta'
  | 'conferma-risultato'
  | 'inserisci-risultato'
  | 'segna-disponibilita'
  | 'programma-partita'
  | 'completa-coppia'
  | 'richiesta-in-corso'
  | 'attesa-conferma-avversari'
  | 'coppia-da-approvare'
  | 'prossima-partita'
  // gestore
  | 'conferma-richiesta'
  | 'partite-oggi'
  // organizzatore
  | 'risultato-contestato'
  | 'squadra-da-approvare'
  | 'partite-in-ritardo'
  | 'periodo-in-scadenza'
  | 'risultati-non-confermati'
  | 'passo-torneo';

/** Table order of the brief: the tie-break after priority and deadline. */
export const KIND_ORDER: AttentionKind[] = [
  'accetta-richiesta',
  'conferma-risultato',
  'inserisci-risultato',
  'segna-disponibilita',
  'programma-partita',
  'completa-coppia',
  'richiesta-in-corso',
  'attesa-conferma-avversari',
  'coppia-da-approvare',
  'prossima-partita',
  'conferma-richiesta',
  'partite-oggi',
  'risultato-contestato',
  'squadra-da-approvare',
  'partite-in-ritardo',
  'periodo-in-scadenza',
  'risultati-non-confermati',
  'passo-torneo',
];

export type InlineRpc = 'accept_request' | 'confirm_result' | 'confirm_request' | 'approve_team';
export type Motivo = 'rifiutata' | 'conflitto' | 'scaduta' | 'annullata' | 'in-ritardo';

export interface AttentionItem {
  /** `${kind}:${refId}`: stable across renders, used as React key. */
  id: string;
  kind: AttentionKind;
  role: AttentionRole;
  priority: Priority;
  /** ISO instant (UTC); date-only deadlines are 23:59 Europe/Rome of that day. */
  deadline: string | null;
  refs: { torneoId: string; partitaId?: string; richiestaId?: string; squadraId?: string; periodoId?: string };
  count?: number;
  mancanti?: string[];
  motivo?: Motivo;
  passo?: 'periodi' | 'approva-squadre' | 'gironi' | 'calendario' | 'finali' | 'sincronizza';
  action: { type: 'inline'; rpc: InlineRpc; id: string } | { type: 'navigate'; to: string };
}

export type PartitaAttention = Partita & { updatedAt?: string | null };
export type RichiestaAttention = Richiesta & { createdAt?: string | null };

export interface AttentionInput {
  now: number;
  /** yyyy-mm-dd, Europe/Rome (passed in, not computed). */
  today: string;
  uid: string;
  /** Own roles, literally: admin is NOT implicitly organizer/gestore here (ASSUNZIONE H7). */
  roles: Role[];
  torneo: Torneo | null;
  periodi: Periodo[];
  squadre: Squadra[];
  /** partite_v rows of the tournament. */
  partite: PartitaAttention[];
  /** Player: requests of own matches; gestore: all 'attesa' + upcoming 'confermata'. Duplicates by id are fine. */
  richieste: RichiestaAttention[];
  /** Own disponibilita.fasce for this tournament; null = no row. */
  mieFasce: Fasce | null;
  /** Organizer "results not confirmed" threshold, default 48 (ASSUNZIONE H6). */
  promemoriaRisultatoOre?: number;
}

const ORA = 3_600_000;
const GIORNO = 24 * ORA;

// ------------------------------------------------------------------ Europe/Rome time (deterministic, via Intl)

const fmtRoma = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Rome',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function partiRoma(ms: number) {
  const parts = fmtRoma.formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute'), s: get('second') };
}

function offsetRoma(ms: number): number {
  const p = partiRoma(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Wall-clock time in Rome → epoch ms. Accepts "24:00" (= midnight of the next day). */
export function istanteRoma(date: string, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let ms = wall - offsetRoma(wall);
  ms = wall - offsetRoma(ms);
  return ms;
}

/** Epoch ms → { date: 'yyyy-mm-dd', ora: 'hh:mm' } in Rome. */
export function dataOraRoma(ms: number): { date: string; ora: string } {
  const p = partiRoma(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, ora: `${pad(p.h)}:${pad(p.mi)}` };
}

const iso = (ms: number) => new Date(ms).toISOString();
const fineGiorno = (date: string) => istanteRoma(date, '23:59');

// ------------------------------------------------------------------ helpers

export function richiestaViva(r: Pick<Richiesta, 'stato' | 'scadenza'>, now: number): boolean {
  return r.stato === 'attesa' && r.scadenza.toMillis() > now;
}

function accettati(r: Richiesta): string[] {
  return r.giocatori.filter((g) => !!r.accettazioni[g]);
}

function creataMs(r: RichiestaAttention): number {
  return r.createdAt ? Date.parse(r.createdAt) : r.scadenza.toMillis();
}

const ufficiale = (p: Partita) => p.stato === 'giocata' || p.stato === 'tavolino';

// ------------------------------------------------------------------ derive

export function deriveAttention(input: AttentionInput): AttentionItem[] {
  const { now, today, uid, roles, torneo, periodi, squadre, partite, mieFasce } = input;
  const tid = torneo?.id ?? '';
  const out: AttentionItem[] = [];

  // requests: dedupe by id, group by match
  const richieste = [...new Map(input.richieste.map((r) => [r.id, r])).values()];
  const perPartita = new Map<string, RichiestaAttention[]>();
  for (const r of richieste) perPartita.set(r.partitaId, [...(perPartita.get(r.partitaId) ?? []), r]);
  const periodoById = new Map(periodi.map((p) => [p.id, p]));
  const matchUrl = (mid: string) => `/t/${tid}/partite/${mid}`;

  /** The live request of a match (its current one first). */
  const viva = (p: Partita): RichiestaAttention | undefined => {
    const rs = perPartita.get(p.id) ?? [];
    const corrente = rs.find((r) => r.id === p.richiestaId);
    if (corrente && richiestaViva(corrente, now)) return corrente;
    return rs.find((r) => richiestaViva(r, now));
  };

  /** Effective state with lazy expiry: a `richiesta` match without a live request is `da programmare`. */
  const statoEffettivo = (p: Partita) => {
    if (p.stato !== 'richiesta') return p.stato;
    const rs = perPartita.get(p.id) ?? [];
    if (!rs.length) return p.stato; // no data on the request: trust the server
    return viva(p) ? 'richiesta' : 'da programmare';
  };

  const motivoRichiesta = (p: Partita): Motivo | undefined => {
    const rs = [...(perPartita.get(p.id) ?? [])].sort((a, b) => creataMs(b) - creataMs(a));
    const ultima = rs[0];
    if (!ultima) return undefined;
    if (ultima.stato === 'attesa') return richiestaViva(ultima, now) ? undefined : 'scaduta';
    if (ultima.stato === 'rifiutata' || ultima.stato === 'conflitto' || ultima.stato === 'scaduta' || ultima.stato === 'annullata')
      return ultima.stato;
    return undefined;
  };

  // ---------------------------------------------------------------- giocatore
  if (torneo) {
    for (const p of partite) {
      const lato = p.giocatoriA.includes(uid) ? 'A' : p.giocatoriB.includes(uid) ? 'B' : null;
      if (!lato) continue;
      const refs = { torneoId: tid, partitaId: p.id };
      const per = p.periodoId ? periodoById.get(p.periodoId) : undefined;
      const fineP = per ? fineGiorno(per.fine) : null;
      const r = viva(p);
      const mioAcc = r && r.giocatori.includes(uid) ? !!r.accettazioni[uid] : null;
      const ris = p.risultato;
      const nonConfermato = !!ris && !ris.confermatoDa && p.stato !== 'contestata' && !ufficiale(p);
      const inseritoDaMioLato = !!ris && (lato === 'A' ? p.giocatoriA : p.giocatoriB).includes(ris.inseritoDa);
      const inseritoDaAltri = !!ris && (lato === 'A' ? p.giocatoriB : p.giocatoriA).includes(ris.inseritoDa);
      const stato = statoEffettivo(p);

      if (r && mioAcc === false) {
        out.push({ id: `accetta-richiesta:${r.id}`, kind: 'accetta-richiesta', role: 'giocatore', priority: 1,
          deadline: iso(r.scadenza.toMillis()), refs: { ...refs, richiestaId: r.id },
          mancanti: r.giocatori.filter((g) => !r.accettazioni[g]),
          action: { type: 'inline', rpc: 'accept_request', id: r.id } });
        continue;
      }
      if (nonConfermato && inseritoDaAltri) {
        out.push({ id: `conferma-risultato:${p.id}`, kind: 'conferma-risultato', role: 'giocatore', priority: 1, deadline: null, refs,
          action: { type: 'inline', rpc: 'confirm_result', id: p.id } });
        continue;
      }
      if (p.stato === 'programmata' && !ris && p.programmazione &&
          istanteRoma(p.programmazione.data, p.programmazione.fine) < now) {
        out.push({ id: `inserisci-risultato:${p.id}`, kind: 'inserisci-risultato', role: 'giocatore', priority: 1,
          deadline: fineP !== null ? iso(fineP) : null, refs, action: { type: 'navigate', to: `${matchUrl(p.id)}#risultato` } });
        continue;
      }
      if (r && mioAcc === true) {
        const mancanti = r.giocatori.filter((g) => !r.accettazioni[g]);
        const completa = accettati(r).length >= 4 || (mancanti.length === 0 && r.giocatori.length > 0);
        out.push({ id: `richiesta-in-corso:${r.id}`, kind: 'richiesta-in-corso', role: 'giocatore', priority: completa ? 3 : 2,
          deadline: iso(r.scadenza.toMillis()), refs: { ...refs, richiestaId: r.id },
          ...(completa ? {} : { mancanti }), action: { type: 'navigate', to: matchUrl(p.id) } });
        continue;
      }
      if (nonConfermato && inseritoDaMioLato) {
        out.push({ id: `attesa-conferma-avversari:${p.id}`, kind: 'attesa-conferma-avversari', role: 'giocatore', priority: 3,
          deadline: null, refs, action: { type: 'navigate', to: matchUrl(p.id) } });
        continue;
      }
      const quattro = p.giocatoriA.length + p.giocatoriB.length === 4;
      if (stato === 'da programmare' && p.squadraA && p.squadraB && quattro && !ris) {
        let priority: Priority = 2;
        let motivo = motivoRichiesta(p);
        if (per && per.fine < today) {
          priority = 0;
          motivo = 'in-ritardo';
        } else if (fineP !== null && fineP - now <= 7 * GIORNO) priority = 1;
        out.push({ id: `programma-partita:${p.id}`, kind: 'programma-partita', role: 'giocatore', priority,
          deadline: fineP !== null ? iso(fineP) : null, refs, ...(motivo ? { motivo } : {}),
          action: { type: 'navigate', to: matchUrl(p.id) } });
        continue;
      }
      if (p.stato === 'programmata' && p.programmazione) {
        const inizio = istanteRoma(p.programmazione.data, p.programmazione.inizio);
        if (inizio > now && inizio <= now + 72 * ORA)
          out.push({ id: `prossima-partita:${p.id}`, kind: 'prossima-partita', role: 'giocatore', priority: 3,
            deadline: iso(inizio), refs, action: { type: 'navigate', to: matchUrl(p.id) } });
      }
    }

    // availability: one item per open period with my matches still to schedule
    for (const per of periodi) {
      if (per.fine < today) continue;
      const mie = partite.some(
        (p) => p.periodoId === per.id && (p.giocatoriA.includes(uid) || p.giocatoriB.includes(uid)) && statoEffettivo(p) === 'da programmare',
      );
      if (!mie) continue;
      const da = per.inizio > today ? per.inizio : today;
      const coperto = Object.entries(mieFasce ?? {}).some(([d, f]) => d >= da && d <= per.fine && f.length > 0);
      if (coperto) continue;
      out.push({ id: `segna-disponibilita:${per.id}`, kind: 'segna-disponibilita', role: 'giocatore', priority: 1,
        deadline: iso(fineGiorno(per.fine)), refs: { torneoId: tid, periodoId: per.id },
        action: { type: 'navigate', to: `/t/${tid}/disponibilita?periodo=${per.id}` } });
    }

    for (const s of squadre) {
      if (s.stato === 'in attesa partner' && s.creatoDa === uid)
        out.push({ id: `completa-coppia:${s.id}`, kind: 'completa-coppia', role: 'giocatore', priority: 1, deadline: null,
          refs: { torneoId: tid, squadraId: s.id }, action: { type: 'navigate', to: `/t/${tid}/coppia` } });
      if (s.stato === 'da approvare' && s.giocatori.includes(uid))
        out.push({ id: `coppia-da-approvare:${s.id}`, kind: 'coppia-da-approvare', role: 'giocatore', priority: 3, deadline: null,
          refs: { torneoId: tid, squadraId: s.id }, action: { type: 'navigate', to: `/t/${tid}/coppia` } });
    }
  }

  // ---------------------------------------------------------------- gestore
  if (roles.includes('gestore')) {
    for (const r of richieste) {
      if (!richiestaViva(r, now) || r.giocatori.length < 4 || accettati(r).length < r.giocatori.length) continue;
      const inline = !r.fuoriGriglia && !r.controproposta;
      out.push({ id: `conferma-richiesta:${r.id}`, kind: 'conferma-richiesta', role: 'gestore', priority: 1,
        deadline: iso(r.scadenza.toMillis()), refs: { torneoId: r.torneoId, partitaId: r.partitaId, richiestaId: r.id },
        action: inline ? { type: 'inline', rpc: 'confirm_request', id: r.id } : { type: 'navigate', to: `/campo?r=${r.id}` } });
    }
    const oggi = richieste.filter((r) => r.stato === 'confermata' && r.data === today).length;
    if (oggi)
      out.push({ id: `partite-oggi:${today}`, kind: 'partite-oggi', role: 'gestore', priority: 3, deadline: null, count: oggi,
        refs: { torneoId: tid }, action: { type: 'navigate', to: `/campo/giorno/${today}` } });
  }

  // ---------------------------------------------------------------- organizzatore
  if (roles.includes('organizzatore') && torneo) {
    const monitoraggio = (pid?: string) => `/t/${tid}/organizza/monitoraggio${pid ? `?periodo=${pid}` : ''}`;
    for (const p of partite)
      if (p.stato === 'contestata')
        out.push({ id: `risultato-contestato:${p.id}`, kind: 'risultato-contestato', role: 'organizzatore', priority: 1, deadline: null,
          refs: { torneoId: tid, partitaId: p.id }, action: { type: 'navigate', to: matchUrl(p.id) } });
    for (const s of squadre)
      if (s.stato === 'da approvare')
        out.push({ id: `squadra-da-approvare:${s.id}`, kind: 'squadra-da-approvare', role: 'organizzatore', priority: 1, deadline: null,
          refs: { torneoId: tid, squadraId: s.id }, action: { type: 'inline', rpc: 'approve_team', id: s.id } });
    for (const per of periodi) {
      const delPeriodo = partite.filter((p) => p.periodoId === per.id);
      if (per.fine < today) {
        const n = delPeriodo.filter((p) => !ufficiale(p)).length;
        if (n)
          out.push({ id: `partite-in-ritardo:${per.id}`, kind: 'partite-in-ritardo', role: 'organizzatore', priority: 1, deadline: null,
            count: n, refs: { torneoId: tid, periodoId: per.id }, action: { type: 'navigate', to: monitoraggio(per.id) } });
      } else {
        const fine = fineGiorno(per.fine);
        const n = delPeriodo.filter((p) => statoEffettivo(p) === 'da programmare').length;
        if (n && fine - now <= 7 * GIORNO)
          out.push({ id: `periodo-in-scadenza:${per.id}`, kind: 'periodo-in-scadenza', role: 'organizzatore', priority: 2,
            deadline: iso(fine), count: n, refs: { torneoId: tid, periodoId: per.id }, action: { type: 'navigate', to: monitoraggio(per.id) } });
      }
    }
    const soglia = now - (input.promemoriaRisultatoOre ?? 48) * ORA;
    const vecchi = partite.filter(
      (p) => p.risultato && !p.risultato.confermatoDa && p.stato !== 'contestata' && !ufficiale(p) && p.updatedAt && Date.parse(p.updatedAt) < soglia,
    ).length;
    if (vecchi)
      out.push({ id: `risultati-non-confermati:${tid}`, kind: 'risultati-non-confermati', role: 'organizzatore', priority: 2, deadline: null,
        count: vecchi, refs: { torneoId: tid }, action: { type: 'navigate', to: monitoraggio() } });
    const passo = prossimoPasso(torneo, periodi, squadre, partite);
    if (passo)
      out.push({ id: `passo-torneo:${passo.id}`, kind: 'passo-torneo', role: 'organizzatore', priority: 1, deadline: null,
        passo: passo.id, ...('n' in passo ? { count: passo.n } : {}), refs: { torneoId: tid },
        action: { type: 'navigate', to: `/t/${tid}/organizza/${passo.sezione}` } });
  }

  return ordina(out, now);
}

/** Promotion (deadline within 24 h → Urgente) and deterministic sort. */
function ordina(items: AttentionItem[], now: number): AttentionItem[] {
  const promossi = items.map((it) =>
    (it.priority === 1 || it.priority === 2) && it.deadline && Date.parse(it.deadline) - now <= GIORNO ? { ...it, priority: 0 as Priority } : it,
  );
  const dl = (it: AttentionItem) => (it.deadline ? Date.parse(it.deadline) : Infinity);
  return promossi.sort(
    (a, b) =>
      a.priority - b.priority ||
      dl(a) - dl(b) ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Tab badges: items with priority ≤ 1, per role. */
export function countByRole(items: AttentionItem[]): Record<AttentionRole, number> {
  const out: Record<AttentionRole, number> = { giocatore: 0, gestore: 0, organizzatore: 0 };
  for (const it of items) if (it.priority <= 1) out[it.role]++;
  return out;
}

// ------------------------------------------------------------------ deadline copy

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

function etichettaData(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${GIORNI[wd]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function giornoDopo(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Deadline in words: "scade tra 45 min", "scade tra 5 h", "scade domani alle 18:30", "entro sab 14/11",
 * "in ritardo dal 10/11" (past). Pure: `now` is an input.
 */
export function descriviScadenza(deadline: string, now: number): string {
  const ms = Date.parse(deadline);
  const diff = ms - now;
  const { date, ora } = dataOraRoma(ms);
  if (diff <= 0) return `in ritardo dal ${date.slice(8, 10)}/${date.slice(5, 7)}`;
  if (diff < ORA) return `scade tra ${Math.max(1, Math.round(diff / 60_000))} min`;
  const oggi = dataOraRoma(now).date;
  if (diff < GIORNO && date === oggi) return `scade tra ${Math.floor(diff / ORA)} h`;
  if (date === giornoDopo(oggi)) return ora === '23:59' ? 'scade domani' : `scade domani alle ${ora}`;
  if (diff < GIORNO) return `scade tra ${Math.floor(diff / ORA)} h`;
  return `entro ${etichettaData(date)}`;
}
