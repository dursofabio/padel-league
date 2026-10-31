import { describe, expect, it } from 'vitest';
import type { Match, TournamentConfig } from '../../types';
import { groupStandings } from '../standings';

const config: TournamentConfig = {
  pointsWin: 3, pointsLoss: 0, pointsLossDecidingSet: 1,
  setFormat: { setsToWin: 2, superTieBreak: true },
  tiebreakers: ['points', 'headToHead', 'setDiff', 'gameDiff', 'draw'],
  qualificationRule: 'byPosition', finals: [], allowOffGrid: true, offGridStep: 30, requestExpiryHours: 48, playerCancelHours: 24,
};
let n = 0;
const M = (a: string, b: string, sets: [number, number][], status: Match['status'] = 'played'): Match => ({
  id: `p${n++}`, phase: 'groups', group: 'A', teamA: a, teamB: b, playersA: [], playersB: [], players: [],
  status, result: { sets: sets.map(([x, y]) => ({ a: x, b: y })), enteredBy: 'u', confirmedBy: 'v' },
});

describe('standings', () => {
  it('points, point for losing in the third set, head-to-head', () => {
    const matches = [
      M('x', 'y', [[6, 0], [6, 0]]),
      M('y', 'z', [[6, 0], [6, 0]]),
      M('z', 'x', [[6, 0], [6, 0]]),
      M('x', 'w', [[6, 4], [3, 6], [10, 8]]),
      M('y', 'w', [[6, 4], [6, 4]]),
      M('z', 'w', [[6, 4], [6, 4]], 'scheduled'), // not official: does not count
    ];
    const c = groupStandings('A', ['x', 'y', 'z', 'w'], matches, config);
    // x: 6 points, y: 6 points, z: 3 points, w: 1 point. Head-to-head x-y: x wins.
    expect(c.map((r) => r.teamId)).toEqual(['x', 'y', 'z', 'w']);
    expect(c.map((r) => r.points)).toEqual([6, 6, 3, 1]);
    expect(c[3].tied).toBe(false);
  });
  it('unresolved tie -> flagged; the draw resolves it', () => {
    const matches = [M('a', 'b', [[6, 0], [6, 0]]), M('b', 'c', [[6, 0], [6, 0]]), M('c', 'a', [[6, 0], [6, 0]])];
    const c = groupStandings('A', ['a', 'b', 'c'], matches, config);
    expect(c.every((r) => r.tied)).toBe(true);
    const s = groupStandings('A', ['a', 'b', 'c'], matches, config, { c: 1, a: 2, b: 3 });
    expect(s.map((r) => r.teamId)).toEqual(['c', 'a', 'b']);
    expect(s.some((r) => r.tied)).toBe(false);
  });
});
