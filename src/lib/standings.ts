import type { Match, Tiebreaker, TournamentConfig } from '../types';
import { hasOfficialResult, matchStats } from './results';

export interface StandingsRow {
  teamId: string;
  group: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  position: number;
  /** Tie not resolved by the tiebreaker chain: a draw is needed. */
  tied: boolean;
}

interface Outcome {
  teamA: string;
  teamB: string;
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  pointsA: number;
  pointsB: number;
  aWins: boolean;
}

function outcomes(matches: Match[], config: TournamentConfig): Outcome[] {
  return matches
    .filter((m) => hasOfficialResult(m) && m.teamA && m.teamB)
    .map((m) => {
      const s = matchStats(m.result!.sets, config.setFormat);
      const aWins = s.winner === 'A';
      const loserPoints = config.pointsLoss + (s.decidingSet ? config.pointsLossDecidingSet ?? 0 : 0);
      return {
        teamA: m.teamA!,
        teamB: m.teamB!,
        setsA: s.setsA,
        setsB: s.setsB,
        gamesA: s.gamesA,
        gamesB: s.gamesB,
        aWins,
        pointsA: aWins ? config.pointsWin : loserPoints,
        pointsB: aWins ? loserPoints : config.pointsWin,
      };
    });
}

type Totals = Omit<StandingsRow, 'position' | 'tied' | 'group'>;

function totals(ids: string[], os: Outcome[]): Map<string, Totals> {
  const m = new Map<string, Totals>();
  for (const id of ids)
    m.set(id, { teamId: id, played: 0, won: 0, lost: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0 });
  for (const o of os) {
    const a = m.get(o.teamA);
    const b = m.get(o.teamB);
    if (!a || !b) continue;
    a.played++; b.played++;
    if (o.aWins) { a.won++; b.lost++; } else { b.won++; a.lost++; }
    a.points += o.pointsA; b.points += o.pointsB;
    a.setsWon += o.setsA; a.setsLost += o.setsB; b.setsWon += o.setsB; b.setsLost += o.setsA;
    a.gamesWon += o.gamesA; a.gamesLost += o.gamesB; b.gamesWon += o.gamesB; b.gamesLost += o.gamesA;
  }
  return m;
}

/**
 * Standings of a group, computed on the client from the official results.
 * The tiebreaker chain is applied recursively: each criterion splits the tied group
 * into subgroups, and the subgroups still tied move on to the next criterion.
 * Head-to-head is the standings of the matches between the tied teams only.
 */
export function groupStandings(
  group: string,
  teams: string[],
  matches: Match[],
  config: TournamentConfig,
  draw: Record<string, number> = {},
): StandingsRow[] {
  const os = outcomes(matches, config);
  const tot = totals(teams, os);
  const chain: Tiebreaker[] = config.tiebreakers?.length ? config.tiebreakers : ['points'];

  const ordered: { id: string; tied: boolean }[] = [];

  const key = (crit: Tiebreaker, id: string, tiedGroup: string[]): number => {
    if (crit === 'headToHead') {
      const sub = os.filter((o) => tiedGroup.includes(o.teamA) && tiedGroup.includes(o.teamB));
      return totals(tiedGroup, sub).get(id)!.points;
    }
    const t = tot.get(id)!;
    switch (crit) {
      case 'points': return t.points;
      case 'setDiff': return t.setsWon - t.setsLost;
      case 'gameDiff': return t.gamesWon - t.gamesLost;
      case 'setsWon': return t.setsWon;
      case 'gamesWon': return t.gamesWon;
      case 'draw': return id in draw ? -draw[id] : Number.NEGATIVE_INFINITY;
    }
  };

  const resolve = (tiedGroup: string[], idx: number) => {
    if (tiedGroup.length === 1) { ordered.push({ id: tiedGroup[0], tied: false }); return; }
    if (idx >= chain.length) {
      // unresolved tie: stable order, flagged for the draw
      [...tiedGroup].sort().forEach((id) => ordered.push({ id, tied: true }));
      return;
    }
    const crit = chain[idx];
    const byKey = new Map<number, string[]>();
    for (const id of tiedGroup) {
      const k = key(crit, id, tiedGroup);
      byKey.set(k, [...(byKey.get(k) ?? []), id]);
    }
    [...byKey.keys()].sort((a, b) => b - a).forEach((k) => resolve(byKey.get(k)!, idx + 1));
  };

  resolve([...teams], 0);
  return ordered.map(({ id, tied }, i) => ({ ...tot.get(id)!, group, position: i + 1, tied }));
}

/** Cross-group ranking between teams of different groups: average points, then per-match differences. */
export function compareCrossGroup(a: StandingsRow, b: StandingsRow, draw: Record<string, number> = {}): number {
  const avg = (r: StandingsRow, v: number) => (r.played ? v / r.played : 0);
  const crit = [
    (r: StandingsRow) => avg(r, r.points),
    (r: StandingsRow) => avg(r, r.setsWon - r.setsLost),
    (r: StandingsRow) => avg(r, r.gamesWon - r.gamesLost),
    (r: StandingsRow) => -(draw[r.teamId] ?? Number.MAX_SAFE_INTEGER),
  ];
  for (const c of crit) {
    const d = c(b) - c(a);
    if (Math.abs(d) > 1e-9) return d;
  }
  return a.group.localeCompare(b.group);
}
