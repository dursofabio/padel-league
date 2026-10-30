import { describe, expect, it } from 'vitest';
import { berger, giornataToPeriodo } from '../berger';

describe('berger', () => {
  it('10 squadre: 9 giornate, 45 partite, ognuno contro tutti una volta', () => {
    const t = Array.from({ length: 10 }, (_, i) => i);
    const cal = berger(t);
    expect(cal).toHaveLength(45);
    expect(new Set(cal.map((p) => p.giornata)).size).toBe(9);
    const coppie = new Set(cal.map((p) => [p.casa, p.ospite].sort().join('-')));
    expect(coppie.size).toBe(45);
    for (let g = 1; g <= 9; g++) {
      const gioc = cal.filter((p) => p.giornata === g).flatMap((p) => [p.casa, p.ospite]);
      expect(new Set(gioc).size).toBe(10);
    }
  });
  it('numero dispari: riposo', () => {
    const cal = berger(['a', 'b', 'c', 'd', 'e']);
    expect(cal).toHaveLength(10);
    expect(new Set(cal.map((p) => p.giornata)).size).toBe(5);
  });
  it('distribuisce le giornate nei periodi', () => {
    const f = giornataToPeriodo(9, 3);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(f)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
  });
});
