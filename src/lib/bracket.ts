import type { FinalPhaseConfig, Match, QualificationRule, SetFormat } from '../types';
import { matchWinner } from './results';
import { compareCrossGroup, type StandingsRow } from './standings';

export interface QualifiedTeam {
  teamId: string;
  group: string;
  position: number;
  row: StandingsRow;
}

export interface QualificationOutcome {
  phases: { name: string; spots: number; teams: QualifiedTeam[] }[];
  excluded: QualifiedTeam[];
}

/**
 * Qualification to the final phases.
 * Positions are walked in order (all the firsts, then all the seconds, …). Within the same
 * position teams are compared by cross-group ranking (average points per match), so when spots
 * and groups don't divide exactly the remaining spots go to the best of the next position.
 * Phases fill in order (Gold, then Silver, …).
 */
export function qualify(
  standings: Record<string, StandingsRow[]>,
  phases: FinalPhaseConfig[],
  rule: QualificationRule,
  draw: Record<string, number> = {},
): QualificationOutcome {
  const all: QualifiedTeam[] = Object.entries(standings).flatMap(([group, rows]) =>
    rows.map((row) => ({ teamId: row.teamId, group, position: row.position, row })),
  );
  const maxPos = Math.max(0, ...all.map((q) => q.position));
  const ranking: QualifiedTeam[] = [];
  for (let k = 1; k <= maxPos; k++) {
    ranking.push(...all.filter((q) => q.position === k).sort((a, b) => compareCrossGroup(a.row, b.row, draw)));
  }
  let cursor = 0;
  const out: QualificationOutcome = { phases: [], excluded: [] };
  for (const f of phases) {
    let teams = ranking.slice(cursor, cursor + f.spots);
    cursor += teams.length;
    if (rule === 'byPosition') teams = [...teams].sort((a, b) => a.position - b.position || a.group.localeCompare(b.group));
    out.phases.push({ name: f.name, spots: f.spots, teams });
  }
  out.excluded = ranking.slice(cursor);
  return out;
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Standard seeding order: for 8 → [1,8,4,5,2,7,3,6]. The best seeds meet as late as possible. */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  /** Id of the next match. */
  nextCode: string | null;
  /** Side taken by the winner in the next match. */
  side: 'A' | 'B' | null;
  teamA: string | null;
  teamB: string | null;
}

/** Italian round name (UI copy): "Finale", "Semifinale", … */
export function roundName(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round;
  return ['Finale', 'Semifinale', 'Quarti', 'Ottavi', 'Sedicesimi'][fromFinal] ?? `Turno ${round}`;
}

export function roundCount(teams: number): number {
  return Math.log2(nextPow2(Math.max(2, teams)));
}

/**
 * Knockout bracket from the seeds (in order).
 * If the teams are not a power of 2 the bracket grows to the next power and the byes
 * go to the best seeds: a team with a bye is placed directly in round 2.
 * When possible, two teams from the same group don't meet in the first round.
 */
export function generateBracket(
  prefix: string,
  seeds: string[],
  groupOf: (id: string) => string | undefined = () => undefined,
): BracketMatch[] {
  if (seeds.length < 2) return [];
  const size = nextPow2(seeds.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const id = (t: number, p: number) => `${prefix}-t${t}-p${p}`;
  const team = (seed: number) => seeds[seed - 1] ?? null;

  const first: [string | null, string | null][] = [];
  for (let i = 0; i < size / 2; i++) first.push([team(order[2 * i]), team(order[2 * i + 1])]);
  avoidSameGroup(first, groupOf);

  const matches: BracketMatch[] = [];
  for (let t = 1; t <= rounds; t++) {
    const n = size / 2 ** t;
    for (let p = 0; p < n; p++)
      matches.push({
        id: id(t, p),
        round: t,
        position: p,
        nextCode: t < rounds ? id(t + 1, Math.floor(p / 2)) : null,
        side: t < rounds ? (p % 2 === 0 ? 'A' : 'B') : null,
        teamA: t === 1 ? first[p][0] : null,
        teamB: t === 1 ? first[p][1] : null,
      });
  }
  // bye: the team advances right away and the first-round match is not created
  const byId = new Map(matches.map((m) => [m.id, m]));
  return matches.filter((m) => {
    if (m.round !== 1 || (m.teamA && m.teamB) || rounds === 1) return true;
    const advancing = m.teamA ?? m.teamB;
    const next = byId.get(m.nextCode!)!;
    if (m.side === 'A') next.teamA = advancing;
    else next.teamB = advancing;
    return false;
  });
}

function avoidSameGroup(first: [string | null, string | null][], groupOf: (id: string) => string | undefined) {
  const same = (a: string | null, b: string | null) => !!a && !!b && !!groupOf(a) && groupOf(a) === groupOf(b);
  for (let i = 0; i < first.length; i++) {
    if (!same(first[i][0], first[i][1])) continue;
    for (let j = 0; j < first.length; j++) {
      if (i === j) continue;
      const [ai, bi] = first[i];
      const [aj, bj] = first[j];
      if (!same(ai, bj) && !same(aj, bi) && bi && bj) {
        first[i][1] = bj;
        first[j][1] = bi;
        break;
      }
    }
  }
}

export interface BracketState {
  teamA: string | null;
  teamB: string | null;
  winner: string | null;
}

/**
 * Progress derived on the client: the teams of later rounds come from the
 * official results of the matches feeding them.
 */
export function deriveBracket(matches: Match[], format: SetFormat): Map<string, BracketState> {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const memo = new Map<string, BracketState>();
  const feeders = new Map<string, Match[]>();
  for (const m of matches) if (m.nextCode) feeders.set(m.nextCode, [...(feeders.get(m.nextCode) ?? []), m]);

  const calc = (id: string): BracketState => {
    const cached = memo.get(id);
    if (cached) return cached;
    const m = byId.get(id)!;
    let a = m.teamA ?? null;
    let b = m.teamB ?? null;
    // a side fed by an earlier match takes its winner; otherwise (bye) the stored value
    for (const f of feeders.get(id) ?? []) {
      const w = calc(f.id).winner;
      if (f.side === 'A') a = w;
      if (f.side === 'B') b = w;
    }
    const st: BracketState = { teamA: a, teamB: b, winner: null };
    if (a && b) st.winner = matchWinner({ ...m, teamA: a, teamB: b }, format);
    memo.set(id, st);
    return st;
  };
  for (const m of matches) calc(m.id);
  return memo;
}
