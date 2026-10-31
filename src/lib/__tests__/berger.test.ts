import { describe, expect, it } from 'vitest';
import { berger, matchdayToPeriod } from '../berger';

describe('berger', () => {
  it('10 teams: 9 matchdays, 45 matches, everyone plays everyone once', () => {
    const t = Array.from({ length: 10 }, (_, i) => i);
    const cal = berger(t);
    expect(cal).toHaveLength(45);
    expect(new Set(cal.map((p) => p.matchday)).size).toBe(9);
    const pairs = new Set(cal.map((p) => [p.home, p.away].sort().join('-')));
    expect(pairs.size).toBe(45);
    for (let g = 1; g <= 9; g++) {
      const playing = cal.filter((p) => p.matchday === g).flatMap((p) => [p.home, p.away]);
      expect(new Set(playing).size).toBe(10);
    }
  });
  it('odd number: bye', () => {
    const cal = berger(['a', 'b', 'c', 'd', 'e']);
    expect(cal).toHaveLength(10);
    expect(new Set(cal.map((p) => p.matchday)).size).toBe(5);
  });
  it('spreads the matchdays over the periods', () => {
    const f = matchdayToPeriod(9, 3);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(f)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
  });
});
