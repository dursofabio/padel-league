import { describe, expect, it } from 'vitest';
import { addMin, dateRange, labelDate, overlaps, toMin } from '../time';

describe('time', () => {
  it('converts and adds minutes', () => {
    expect(toMin('13:30')).toBe(810);
    expect(addMin('13:30', 90)).toBe('15:00');
  });
  it('half-open intervals', () => {
    expect(overlaps('15:00', '16:30', '16:30', '18:00')).toBe(false);
    expect(overlaps('15:00', '16:30', '16:00', '17:00')).toBe(true);
  });
  it('date ranges and labels', () => {
    expect(dateRange('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(labelDate('2026-11-14')).toBe('sab 14/11');
  });
});
