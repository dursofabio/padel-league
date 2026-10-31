import { describe, expect, it } from 'vitest';
import type { Booking, Court, MatchRequest } from '../../types';
import { checkOffGrid, classifySlot, gridSlots, impactedSlots, nearestFreeSlot, requestId } from '../slots';

const all = [0, 1, 2, 3, 4, 5, 6];
const c1: Court = { id: 'c1', name: 'Campo 1', firstSlot: '13:30', lastSlot: '21:00', slotMinutes: 90, activeDays: all, closedDates: [] };
const c2: Court = { id: 'c2', name: 'Campo 2', firstSlot: '14:00', lastSlot: '20:00', slotMinutes: 90, activeDays: all, closedDates: ['2026-12-25'] };
const D = '2026-11-14';
const lesson: Booking = { start: '16:00', end: '17:00', type: 'lesson', createdBy: 'g' };
const ts = (ms: number) => ({ toMillis: () => ms }) as any;

describe('grid', () => {
  it('generates the staggered slots of the two courts', () => {
    expect(gridSlots(c1, D).map((s) => s.start)).toEqual(['13:30', '15:00', '16:30', '18:00', '19:30', '21:00']);
    expect(gridSlots(c2, D).map((s) => s.start)).toEqual(['14:00', '15:30', '17:00', '18:30', '20:00']);
    expect(gridSlots(c2, '2026-12-25')).toEqual([]);
  });
  it('deterministic request id', () => {
    expect(requestId('c1', D, '18:00')).toBe('c1_20261114_1800');
  });
  it('a 16-17 lesson blocks the 15:00 and 16:30 slots', () => {
    const items = { x: lesson };
    const colors = gridSlots(c1, D).map((s) => classifySlot(s, [], {}, items, []).color);
    expect(colors[1]).toBe('red');
    expect(colors[2]).toBe('red');
    expect(colors[0]).not.toBe('red');
  });
});

describe('availability cross-check', () => {
  const players = ['a', 'b', 'c', 'd'];
  const avail = {
    a: { [D]: ['14:00-19:00'] },
    b: { [D]: ['13:00-20:00'] },
    c: { [D]: ['15:00-22:00'] },
    d: { [D]: ['17:00-19:00', '14:30-16:30'] },
  };
  it('green, yellow, grey', () => {
    const [s1330, s1500, s1630] = gridSlots(c1, D);
    expect(classifySlot(s1500, players, avail, {}, []).color).toBe('green');
    const yellow = classifySlot(s1630, players, avail, {}, []);
    expect(yellow.color).toBe('yellow');
    expect(yellow.missing).toEqual(['d']);
    expect(classifySlot(s1330, players, avail, {}, []).color).toBe('grey');
  });
  it('blue when an active request overlaps, ignoring expired ones', () => {
    const [, s1500] = gridSlots(c1, D);
    const r = { courtId: 'c1', date: D, start: '14:30', end: '16:00', status: 'pending', expiresAt: ts(2000) } as MatchRequest;
    expect(classifySlot(s1500, players, avail, {}, [r], 1000).color).toBe('blue');
    expect(classifySlot(s1500, players, avail, {}, [r], 3000).color).toBe('green');
  });
});

describe('off-grid', () => {
  it('impact and blocks', () => {
    expect(impactedSlots(c1, D, '14:30', '16:00').map((s) => s.start)).toEqual(['13:30', '15:00']);
    const v = checkOffGrid(c1, D, '15:30', { x: lesson }, []);
    expect(v.blocking).toHaveLength(1);
    expect(checkOffGrid(c1, D, '17:00', { x: lesson }, []).blocking).toHaveLength(0);
  });
  it('counter-proposal: nearest free slot', () => {
    const s = gridSlots(c1, D)[1]; // 15:00, blocked by the lesson
    const best = nearestFreeSlot(s, [c1, c2], [D], { c1_20261114: { x: lesson } }, []);
    expect(best).toMatchObject({ courtId: 'c2', start: '15:30' });
  });
});
