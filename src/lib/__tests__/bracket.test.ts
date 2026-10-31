import { describe, expect, it } from 'vitest';
import type { Match } from '../../types';
import { deriveBracket, generateBracket, qualify, seedOrder } from '../bracket';
import type { StandingsRow } from '../standings';

const row = (group: string, pos: number, points = 30 - pos * 3, played = 9): StandingsRow => ({
  teamId: `${group}${pos}`, group, position: pos, played, won: 0, lost: 0, points,
  setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, tied: false,
});
const group = (g: string, n: number) => Array.from({ length: n }, (_, i) => row(g, i + 1));

describe('qualification', () => {
  it('by position: Gold 1-4, Silver 5-8, excluded 9-10', () => {
    const q = qualify({ A: group('A', 10), B: group('B', 10) }, [{ name: 'Gold', spots: 8 }, { name: 'Silver', spots: 8 }], 'byPosition');
    expect(q.phases[0].teams.map((s) => s.teamId)).toEqual(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4']);
    expect(q.phases[1].teams.map((s) => s.teamId)).toEqual(['A5', 'B5', 'A6', 'B6', 'A7', 'B7', 'A8', 'B8']);
    expect(q.excluded.map((s) => s.teamId).sort()).toEqual(['A10', 'A9', 'B10', 'B9']);
  });
  it('cross-group fallback with 3 groups and 8 spots: the best thirds by average points', () => {
    const st = { A: group('A', 4), B: group('B', 4), C: [row('C', 1), row('C', 2), row('C', 3, 40, 9)] };
    st.A[2].points = 10; st.B[2].points = 20;
    const q = qualify(st, [{ name: 'Gold', spots: 8 }], 'crossGroup');
    const ids = q.phases[0].teams.map((s) => s.teamId);
    expect(ids).toHaveLength(8);
    expect(ids).toContain('C3');
    expect(ids).toContain('B3');
    expect(ids).not.toContain('A3');
  });
});

describe('bracket', () => {
  it('seed order', () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it('crossing A1–B4, B2–A3 | B1–A4, A2–B3', () => {
    const seeds = ['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4'];
    const t = generateBracket('gold', seeds, (id) => id[0]);
    const quarters = t.filter((m) => m.round === 1).map((m) => `${m.teamA}-${m.teamB}`);
    expect(quarters).toEqual(['A1-B4', 'B2-A3', 'B1-A4', 'A2-B3']);
    expect(t).toHaveLength(7);
    expect(t.find((m) => m.round === 3)!.nextCode).toBeNull();
  });
  it('byes go to the best seeds', () => {
    const t = generateBracket('s', ['1', '2', '3', '4', '5', '6']);
    const r1 = t.filter((m) => m.round === 1);
    expect(r1).toHaveLength(2); // 4v5, 3v6
    const semis = t.filter((m) => m.round === 2);
    expect(semis.map((m) => m.teamA)).toEqual(['1', '2']);
  });
  it('progress derived from results', () => {
    const spec = generateBracket('g', ['1', '2', '3', '4']);
    const matches: Match[] = spec.map((s) => ({
      ...s, phase: 'gold', playersA: [], playersB: [], players: [], status: 'unscheduled',
    }));
    const semi1 = matches.find((m) => m.teamA === '1')!;
    semi1.status = 'played';
    semi1.result = { sets: [{ a: 3, b: 6 }, { a: 4, b: 6 }], enteredBy: 'x', confirmedBy: 'y' };
    const d = deriveBracket(matches, { setsToWin: 2, superTieBreak: true });
    const final = matches.find((m) => m.round === 2)!;
    expect(d.get(final.id)).toMatchObject({ teamA: '4', teamB: null });
  });
});
