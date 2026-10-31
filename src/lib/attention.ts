/**
 * To-do feed ("Da fare"): what needs the user now, derived only from server data.
 * Pure and synchronous: time is an input (`now`, `today`), never read here. See docs/ux/home-da-fare.md §6.
 *
 * Inputs use the domain types returned by src/data (Tournament, Match, MatchRequest, …) so the page passes the
 * query results as they are. Two fields are optional: `Match.updatedAt` (needed by `unconfirmed-results`)
 * and `MatchRequest.createdAt` (latest request of a match; falls back to `expiresAt`, which grows with creation time).
 *
 * URLs in `action.to` are app routes, so their paths stay Italian.
 */
import { nextStep, type TournamentStepId } from './nextStep';
import type { Match, MatchRequest, Period, Role, Team, Tournament, Windows } from '../types';

export type AttentionRole = 'player' | 'manager' | 'organizer';
/** 0 Urgente, 1 Da fare, 2 Presto, 3 Per sapere */
export type Priority = 0 | 1 | 2 | 3;

export type AttentionKind =
  // player
  | 'accept-request'
  | 'confirm-result'
  | 'enter-result'
  | 'set-availability'
  | 'schedule-match'
  | 'complete-team'
  | 'request-in-progress'
  | 'awaiting-opponents-confirmation'
  | 'team-awaiting-approval'
  | 'upcoming-match'
  // manager
  | 'confirm-request'
  | 'matches-today'
  // organizer
  | 'disputed-result'
  | 'approve-team'
  | 'late-matches'
  | 'period-ending'
  | 'unconfirmed-results'
  | 'tournament-step';

/** Table order of the brief: the tie-break after priority and deadline. */
export const KIND_ORDER: AttentionKind[] = [
  'accept-request',
  'confirm-result',
  'enter-result',
  'set-availability',
  'schedule-match',
  'complete-team',
  'request-in-progress',
  'awaiting-opponents-confirmation',
  'team-awaiting-approval',
  'upcoming-match',
  'confirm-request',
  'matches-today',
  'disputed-result',
  'approve-team',
  'late-matches',
  'period-ending',
  'unconfirmed-results',
  'tournament-step',
];

export type InlineRpc = 'accept_request' | 'confirm_result' | 'confirm_request' | 'approve_team';
/** Why a match is back to be scheduled: the outcome of its latest request, or `late` (period over). */
export type Reason = 'rejected' | 'conflict' | 'expired' | 'cancelled' | 'late';

export interface AttentionItem {
  /** `${kind}:${refId}`: stable across renders, used as React key. */
  id: string;
  kind: AttentionKind;
  role: AttentionRole;
  priority: Priority;
  /** ISO instant (UTC); date-only deadlines are 23:59 Europe/Rome of that day. */
  deadline: string | null;
  refs: { tournamentId: string; matchId?: string; requestId?: string; teamId?: string; periodId?: string };
  count?: number;
  /** Players who have not accepted yet. */
  missing?: string[];
  reason?: Reason;
  step?: TournamentStepId;
  action: { type: 'inline'; rpc: InlineRpc; id: string } | { type: 'navigate'; to: string };
}

export type AttentionMatch = Match & { updatedAt?: string | null };
export type AttentionRequest = MatchRequest & { createdAt?: string | null };

export interface AttentionInput {
  now: number;
  /** yyyy-mm-dd, Europe/Rome (passed in, not computed). */
  today: string;
  uid: string;
  /** Own roles, literally: admin is NOT implicitly organizer/manager here (ASSUMPTION H7). */
  roles: Role[];
  tournament: Tournament | null;
  periods: Period[];
  teams: Team[];
  /** matches_v rows of the tournament. */
  matches: AttentionMatch[];
  /** Player: requests of own matches; manager: all 'pending' + upcoming 'confirmed'. Duplicates by id are fine. */
  requests: AttentionRequest[];
  /** Own availability windows for this tournament; null = no row. */
  myWindows: Windows | null;
  /** Organizer "results not confirmed" threshold, default 48 (ASSUMPTION H6). */
  resultReminderHours?: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ------------------------------------------------------------------ Europe/Rome time (deterministic, via Intl)

let romeFmt: Intl.DateTimeFormat | null = null;
const romeOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'Europe/Rome',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

function romeParts(ms: number) {
  romeFmt ??= new Intl.DateTimeFormat('en-US', romeOptions);
  const parts = romeFmt.formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute'), s: get('second') };
}

function romeOffset(ms: number): number {
  const p = romeParts(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Wall-clock time in Rome → epoch ms. Accepts "24:00" (= midnight of the next day). */
export function romeInstant(date: string, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let ms = wall - romeOffset(wall);
  ms = wall - romeOffset(ms);
  return ms;
}

/** Epoch ms → { date: 'yyyy-mm-dd', time: 'hh:mm' } in Rome. */
export function romeDateTime(ms: number): { date: string; time: string } {
  const p = romeParts(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` };
}

const iso = (ms: number) => new Date(ms).toISOString();
const endOfDay = (date: string) => romeInstant(date, '23:59');

// ------------------------------------------------------------------ helpers

/** Pending and not expired yet. */
export function isRequestLive(r: Pick<MatchRequest, 'status' | 'expiresAt'>, now: number): boolean {
  return r.status === 'pending' && r.expiresAt.toMillis() > now;
}

function accepted(r: MatchRequest): string[] {
  return r.players.filter((p) => !!r.acceptances[p]);
}

function createdMs(r: AttentionRequest): number {
  return r.createdAt ? Date.parse(r.createdAt) : r.expiresAt.toMillis();
}

const official = (m: Match) => m.status === 'played' || m.status === 'forfeit';

// ------------------------------------------------------------------ derive

export function deriveAttention(input: AttentionInput): AttentionItem[] {
  const { now, today, uid, roles, tournament, periods, teams, matches, myWindows } = input;
  const tid = tournament?.id ?? '';
  const out: AttentionItem[] = [];

  // requests: dedupe by id, group by match
  const requests = [...new Map(input.requests.map((r) => [r.id, r])).values()];
  const byMatch = new Map<string, AttentionRequest[]>();
  for (const r of requests) byMatch.set(r.matchId, [...(byMatch.get(r.matchId) ?? []), r]);
  const periodById = new Map(periods.map((p) => [p.id, p]));
  const matchUrl = (mid: string) => `/t/${tid}/partite/${mid}`;

  /** The live request of a match (its current one first). */
  const live = (m: Match): AttentionRequest | undefined => {
    const rs = byMatch.get(m.id) ?? [];
    const current = rs.find((r) => r.id === m.requestId);
    if (current && isRequestLive(current, now)) return current;
    return rs.find((r) => isRequestLive(r, now));
  };

  /** Effective status with lazy expiry: a `requested` match without a live request is `unscheduled`. */
  const effectiveStatus = (m: Match) => {
    if (m.status !== 'requested') return m.status;
    const rs = byMatch.get(m.id) ?? [];
    if (!rs.length) return m.status; // no data on the request: trust the server
    return live(m) ? 'requested' : 'unscheduled';
  };

  const requestReason = (m: Match): Reason | undefined => {
    const rs = [...(byMatch.get(m.id) ?? [])].sort((a, b) => createdMs(b) - createdMs(a));
    const latest = rs[0];
    if (!latest) return undefined;
    if (latest.status === 'pending') return isRequestLive(latest, now) ? undefined : 'expired';
    if (latest.status === 'rejected' || latest.status === 'conflict' || latest.status === 'expired' || latest.status === 'cancelled')
      return latest.status;
    return undefined;
  };

  // ---------------------------------------------------------------- player
  if (tournament) {
    for (const m of matches) {
      const side = m.playersA.includes(uid) ? 'A' : m.playersB.includes(uid) ? 'B' : null;
      if (!side) continue;
      const refs = { tournamentId: tid, matchId: m.id };
      const per = m.periodId ? periodById.get(m.periodId) : undefined;
      const periodEnd = per ? endOfDay(per.endsOn) : null;
      const r = live(m);
      const myAcceptance = r && r.players.includes(uid) ? !!r.acceptances[uid] : null;
      const res = m.result;
      const unconfirmed = !!res && !res.confirmedBy && m.status !== 'disputed' && !official(m);
      const enteredByMySide = !!res && (side === 'A' ? m.playersA : m.playersB).includes(res.enteredBy);
      const enteredByOthers = !!res && (side === 'A' ? m.playersB : m.playersA).includes(res.enteredBy);
      const status = effectiveStatus(m);

      if (r && myAcceptance === false) {
        out.push({ id: `accept-request:${r.id}`, kind: 'accept-request', role: 'player', priority: 1,
          deadline: iso(r.expiresAt.toMillis()), refs: { ...refs, requestId: r.id },
          missing: r.players.filter((p) => !r.acceptances[p]),
          action: { type: 'inline', rpc: 'accept_request', id: r.id } });
        continue;
      }
      if (unconfirmed && enteredByOthers) {
        out.push({ id: `confirm-result:${m.id}`, kind: 'confirm-result', role: 'player', priority: 1, deadline: null, refs,
          action: { type: 'inline', rpc: 'confirm_result', id: m.id } });
        continue;
      }
      if (m.status === 'scheduled' && !res && m.schedule && romeInstant(m.schedule.date, m.schedule.end) < now) {
        out.push({ id: `enter-result:${m.id}`, kind: 'enter-result', role: 'player', priority: 1,
          deadline: periodEnd !== null ? iso(periodEnd) : null, refs, action: { type: 'navigate', to: `${matchUrl(m.id)}#risultato` } });
        continue;
      }
      if (r && myAcceptance === true) {
        const missing = r.players.filter((p) => !r.acceptances[p]);
        const complete = accepted(r).length >= 4 || (missing.length === 0 && r.players.length > 0);
        out.push({ id: `request-in-progress:${r.id}`, kind: 'request-in-progress', role: 'player', priority: complete ? 3 : 2,
          deadline: iso(r.expiresAt.toMillis()), refs: { ...refs, requestId: r.id },
          ...(complete ? {} : { missing }), action: { type: 'navigate', to: matchUrl(m.id) } });
        continue;
      }
      if (unconfirmed && enteredByMySide) {
        out.push({ id: `awaiting-opponents-confirmation:${m.id}`, kind: 'awaiting-opponents-confirmation', role: 'player', priority: 3,
          deadline: null, refs, action: { type: 'navigate', to: matchUrl(m.id) } });
        continue;
      }
      const four = m.playersA.length + m.playersB.length === 4;
      if (status === 'unscheduled' && m.teamA && m.teamB && four && !res) {
        let priority: Priority = 2;
        let reason = requestReason(m);
        if (per && per.endsOn < today) {
          priority = 0;
          reason = 'late';
        } else if (periodEnd !== null && periodEnd - now <= 7 * DAY) priority = 1;
        out.push({ id: `schedule-match:${m.id}`, kind: 'schedule-match', role: 'player', priority,
          deadline: periodEnd !== null ? iso(periodEnd) : null, refs, ...(reason ? { reason } : {}),
          action: { type: 'navigate', to: matchUrl(m.id) } });
        continue;
      }
      if (m.status === 'scheduled' && m.schedule) {
        const start = romeInstant(m.schedule.date, m.schedule.start);
        if (start > now && start <= now + 72 * HOUR)
          out.push({ id: `upcoming-match:${m.id}`, kind: 'upcoming-match', role: 'player', priority: 3,
            deadline: iso(start), refs, action: { type: 'navigate', to: matchUrl(m.id) } });
      }
    }

    // availability: one item per open period with my matches still to schedule
    for (const per of periods) {
      if (per.endsOn < today) continue;
      const mine = matches.some(
        (m) => m.periodId === per.id && (m.playersA.includes(uid) || m.playersB.includes(uid)) && effectiveStatus(m) === 'unscheduled',
      );
      if (!mine) continue;
      const from = per.startsOn > today ? per.startsOn : today;
      const covered = Object.entries(myWindows ?? {}).some(([d, w]) => d >= from && d <= per.endsOn && w.length > 0);
      if (covered) continue;
      // a period that starts more than a week from now is not urgent yet: it must not push down
      // results to confirm or requests to accept
      const future = Date.parse(per.startsOn) - now > 7 * DAY;
      out.push({ id: `set-availability:${per.id}`, kind: 'set-availability', role: 'player', priority: future ? 2 : 1,
        deadline: iso(endOfDay(per.endsOn)), refs: { tournamentId: tid, periodId: per.id },
        action: { type: 'navigate', to: `/t/${tid}/disponibilita?periodo=${per.id}` } });
    }

    for (const t of teams) {
      if (t.status === 'awaiting_partner' && t.createdBy === uid)
        out.push({ id: `complete-team:${t.id}`, kind: 'complete-team', role: 'player', priority: 1, deadline: null,
          refs: { tournamentId: tid, teamId: t.id }, action: { type: 'navigate', to: `/t/${tid}/coppia` } });
      if (t.status === 'pending_approval' && t.players.includes(uid))
        out.push({ id: `team-awaiting-approval:${t.id}`, kind: 'team-awaiting-approval', role: 'player', priority: 3, deadline: null,
          refs: { tournamentId: tid, teamId: t.id }, action: { type: 'navigate', to: `/t/${tid}/coppia` } });
    }
  }

  // ---------------------------------------------------------------- manager
  if (roles.includes('manager')) {
    for (const r of requests) {
      if (!isRequestLive(r, now) || r.players.length < 4 || accepted(r).length < r.players.length) continue;
      const inline = !r.offGrid && !r.counterProposal;
      out.push({ id: `confirm-request:${r.id}`, kind: 'confirm-request', role: 'manager', priority: 1,
        deadline: iso(r.expiresAt.toMillis()), refs: { tournamentId: r.tournamentId, matchId: r.matchId, requestId: r.id },
        action: inline ? { type: 'inline', rpc: 'confirm_request', id: r.id } : { type: 'navigate', to: `/campo?r=${r.id}` } });
    }
    const todayCount = requests.filter((r) => r.status === 'confirmed' && r.date === today).length;
    if (todayCount)
      out.push({ id: `matches-today:${today}`, kind: 'matches-today', role: 'manager', priority: 3, deadline: null, count: todayCount,
        refs: { tournamentId: tid }, action: { type: 'navigate', to: `/campo/giorno/${today}` } });
  }

  // ---------------------------------------------------------------- organizer
  if (roles.includes('organizer') && tournament) {
    const monitoring = (pid?: string) => `/t/${tid}/organizza/monitoraggio${pid ? `?periodo=${pid}` : ''}`;
    for (const m of matches)
      if (m.status === 'disputed')
        out.push({ id: `disputed-result:${m.id}`, kind: 'disputed-result', role: 'organizer', priority: 1, deadline: null,
          refs: { tournamentId: tid, matchId: m.id }, action: { type: 'navigate', to: matchUrl(m.id) } });
    for (const t of teams)
      if (t.status === 'pending_approval')
        out.push({ id: `approve-team:${t.id}`, kind: 'approve-team', role: 'organizer', priority: 1, deadline: null,
          refs: { tournamentId: tid, teamId: t.id }, action: { type: 'inline', rpc: 'approve_team', id: t.id } });
    for (const per of periods) {
      const ofPeriod = matches.filter((m) => m.periodId === per.id);
      if (per.endsOn < today) {
        const n = ofPeriod.filter((m) => !official(m)).length;
        if (n)
          out.push({ id: `late-matches:${per.id}`, kind: 'late-matches', role: 'organizer', priority: 1, deadline: null,
            count: n, refs: { tournamentId: tid, periodId: per.id }, action: { type: 'navigate', to: monitoring(per.id) } });
      } else {
        const end = endOfDay(per.endsOn);
        const n = ofPeriod.filter((m) => effectiveStatus(m) === 'unscheduled').length;
        if (n && end - now <= 7 * DAY)
          out.push({ id: `period-ending:${per.id}`, kind: 'period-ending', role: 'organizer', priority: 2,
            deadline: iso(end), count: n, refs: { tournamentId: tid, periodId: per.id }, action: { type: 'navigate', to: monitoring(per.id) } });
      }
    }
    const threshold = now - (input.resultReminderHours ?? 48) * HOUR;
    const stale = matches.filter(
      (m) => m.result && !m.result.confirmedBy && m.status !== 'disputed' && !official(m) && m.updatedAt && Date.parse(m.updatedAt) < threshold,
    ).length;
    if (stale)
      out.push({ id: `unconfirmed-results:${tid}`, kind: 'unconfirmed-results', role: 'organizer', priority: 2, deadline: null,
        count: stale, refs: { tournamentId: tid }, action: { type: 'navigate', to: monitoring() } });
    const step = nextStep(tournament, periods, teams, matches);
    if (step)
      out.push({ id: `tournament-step:${step.id}`, kind: 'tournament-step', role: 'organizer', priority: 1, deadline: null,
        step: step.id, ...('n' in step ? { count: step.n } : {}), refs: { tournamentId: tid },
        action: { type: 'navigate', to: `/t/${tid}/organizza/${step.section}` } });
  }

  return sortItems(out, now);
}

/** Promotion (deadline within 24 h → Urgente) and deterministic sort. */
function sortItems(items: AttentionItem[], now: number): AttentionItem[] {
  const promoted = items.map((it) =>
    (it.priority === 1 || it.priority === 2) && it.deadline && Date.parse(it.deadline) - now <= DAY ? { ...it, priority: 0 as Priority } : it,
  );
  const dl = (it: AttentionItem) => (it.deadline ? Date.parse(it.deadline) : Infinity);
  return promoted.sort(
    (a, b) =>
      a.priority - b.priority ||
      dl(a) - dl(b) ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Tab badges: items with priority ≤ 1, per role. */
export function countByRole(items: AttentionItem[]): Record<AttentionRole, number> {
  const out: Record<AttentionRole, number> = { player: 0, manager: 0, organizer: 0 };
  for (const it of items) if (it.priority <= 1) out[it.role]++;
  return out;
}

// ------------------------------------------------------------------ deadline copy

const SHORT_DAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${SHORT_DAYS[wd]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Deadline in Italian words: "scade tra 45 min", "scade tra 5 h", "scade domani alle 18:30", "entro sab 14/11",
 * "in ritardo dal 10/11" (past). Pure: `now` is an input.
 */
export function describeDeadline(deadline: string, now: number): string {
  const ms = Date.parse(deadline);
  const diff = ms - now;
  const { date, time } = romeDateTime(ms);
  if (diff <= 0) return `in ritardo dal ${date.slice(8, 10)}/${date.slice(5, 7)}`;
  if (diff < HOUR) return `scade tra ${Math.max(1, Math.round(diff / 60_000))} min`;
  const todayRome = romeDateTime(now).date;
  if (diff < DAY && date === todayRome) return `scade tra ${Math.floor(diff / HOUR)} h`;
  if (date === nextDay(todayRome)) return time === '23:59' ? 'scade domani' : `scade domani alle ${time}`;
  if (diff < DAY) return `scade tra ${Math.floor(diff / HOUR)} h`;
  return `entro ${dateLabel(date)}`;
}
