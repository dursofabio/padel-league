import { describe, expect, it } from 'vitest';
import { matchStats, validateResult } from '../results';

const f = { setsToWin: 2, superTieBreak: true };
const S = (...xs: [number, number][]) => xs.map(([a, b]) => ({ a, b }));

describe('results', () => {
  it('validates scores', () => {
    expect(validateResult(S([6, 4], [6, 3]), f)).toEqual({ ok: true, winner: 'A' });
    expect(validateResult(S([6, 4], [3, 6], [8, 10]), f)).toEqual({ ok: true, winner: 'B' });
    expect(validateResult(S([6, 4], [3, 6], [12, 10]), f).ok).toBe(true);
    expect(validateResult(S([6, 5], [6, 3]), f).ok).toBe(false);
    expect(validateResult(S([6, 4]), f).ok).toBe(false);
    expect(validateResult(S([6, 4], [6, 3], [6, 0]), f).ok).toBe(false);
    expect(validateResult(S([6, 4], [3, 6], [10, 9]), f).ok).toBe(false);
    expect(validateResult(S([6, 4], [3, 6], [7, 5]), { setsToWin: 2, superTieBreak: false }).ok).toBe(true);
  });
  it('the super tie-break counts as one game', () => {
    expect(matchStats(S([6, 4], [3, 6], [10, 8]), f)).toMatchObject({ setsA: 2, setsB: 1, gamesA: 10, gamesB: 10, decidingSet: true });
  });
});
