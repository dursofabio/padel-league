import { describe, expect, it } from 'vitest';
import type { Match, Period } from '../../types';
import {
  addToWeekdays,
  addWindow,
  addWindowWithOutcome,
  changedDays,
  copyToSameWeekday,
  dayPercent,
  defaultPeriod,
  futureOnly,
  normalizeWindows,
  openPeriods,
  periodDays,
  removeWindow,
  selectableTimes,
  setDay,
  timeStep,
  validateWindow,
  weeks,
  WINDOW_PRESETS,
  windowLabel,
  windowsEqual,
} from '../windows';

describe('merging windows', () => {
  it('adds in order without merging separate windows', () => {
    expect(addWindow(['18:00-20:00'], '12:00', '14:00')).toEqual(['12:00-14:00', '18:00-20:00']);
  });
  it('merges overlapping and adjacent windows', () => {
    expect(addWindow(['18:00-20:00'], '19:00', '23:00')).toEqual(['18:00-23:00']);
    expect(addWindow(['18:00-20:00'], '20:00', '22:00')).toEqual(['18:00-22:00']);
    expect(addWindow(['12:00-15:00', '18:00-20:00'], '14:00', '19:00')).toEqual(['12:00-20:00']);
  });
  it('a contained window changes nothing', () => {
    expect(addWindow(['08:00-23:00'], '14:00', '18:30')).toEqual(['08:00-23:00']);
  });
  it('tells which window it merged into', () => {
    expect(addWindowWithOutcome(['18:00-20:00'], '19:00', '23:00')).toEqual({ list: ['18:00-23:00'], mergedInto: '18:00-23:00' });
    expect(addWindowWithOutcome(['18:00-20:00'], '12:00', '14:00').mergedInto).toBeNull();
    expect(addWindowWithOutcome([], '12:00', '14:00').mergedInto).toBeNull();
  });
  it('normalizes unsorted lists', () => {
    expect(normalizeWindows(['20:00-22:00', '18:00-20:30', '09:00-10:00'])).toEqual(['09:00-10:00', '18:00-22:00']);
  });
  it('handles 24:00', () => {
    expect(addWindow(['22:00-24:00'], '21:00', '22:30')).toEqual(['21:00-24:00']);
  });
});

describe('changes to days', () => {
  it('removes a window', () => {
    expect(removeWindow(['12:00-14:00', '18:00-20:00'], '12:00-14:00')).toEqual(['18:00-20:00']);
  });
  it('sets a day without mutating and drops empty days', () => {
    const f = { '2026-11-14': ['18:00-20:00'] };
    const g = setDay(f, '2026-11-14', []);
    expect(g).toEqual({});
    expect(f).toEqual({ '2026-11-14': ['18:00-20:00'] });
  });
  it('copies onto every Saturday of the period, replacing', () => {
    const days = ['2026-11-14', '2026-11-15', '2026-11-21', '2026-11-28'];
    const f = { '2026-11-14': ['18:00-23:00'], '2026-11-21': ['09:00-10:00'], '2026-11-15': ['10:00-12:00'] };
    const r = copyToSameWeekday(f, '2026-11-14', days);
    expect(r.days).toEqual(['2026-11-21', '2026-11-28']);
    expect(r.windows).toEqual({
      '2026-11-14': ['18:00-23:00'],
      '2026-11-15': ['10:00-12:00'],
      '2026-11-21': ['18:00-23:00'],
      '2026-11-28': ['18:00-23:00'],
    });
  });
  it('keeps only future dates', () => {
    expect(futureOnly({ '2026-10-29': ['18:00-20:00'], '2026-10-30': ['18:00-20:00'], '2026-11-01': [] }, '2026-10-30')).toEqual({
      '2026-10-30': ['18:00-20:00'],
    });
  });
  it('counts the changed days', () => {
    expect(changedDays({ a: ['18:00-20:00'], b: [] }, { a: ['18:00-20:00'] })).toEqual([]);
    expect(changedDays({ a: ['18:00-20:00'] }, { a: ['18:00-21:00'], c: ['09:00-10:00'] })).toEqual(['a', 'c']);
    expect(windowsEqual({}, { x: [] })).toBe(true);
  });
});

describe('times and validation', () => {
  it('step 15 only with off-grid at 15', () => {
    expect(timeStep({ allowOffGrid: true, offGridStep: 15 })).toBe(15);
    expect(timeStep({ allowOffGrid: false, offGridStep: 15 })).toBe(30);
    expect(timeStep({ allowOffGrid: true, offGridStep: 30 })).toBe(30);
    expect(timeStep(undefined)).toBe(30);
  });
  it('times from 08 to 24', () => {
    const o = selectableTimes(30);
    expect(o[0]).toBe('08:00');
    expect(o[o.length - 1]).toBe('24:00');
    expect(o).toHaveLength(33);
    expect(selectableTimes(15)).toHaveLength(65);
  });
  it('validates start and end', () => {
    expect(validateWindow('18:00', '20:00')).toBeNull();
    expect(validateWindow('20:00', '20:00')).toMatch(/fine/);
    expect(validateWindow('20:00', '18:00')).toMatch(/fine/);
    expect(validateWindow('07:00', '09:00')).toMatch(/08:00/);
  });
  it('the presets are valid', () => {
    for (const p of WINDOW_PRESETS) expect(validateWindow(p.from, p.to)).toBeNull();
    expect(WINDOW_PRESETS.map((p) => p.name)).toEqual(['Pausa pranzo', 'Pomeriggio', 'Sera', 'Tutto il giorno']);
  });
  it('label and position on the day', () => {
    expect(windowLabel('14:00-19:00')).toBe('14:00–19:00');
    expect(dayPercent('08:00')).toBe(0);
    expect(dayPercent('16:00')).toBe(50);
    expect(dayPercent('24:00')).toBe(100);
    expect(dayPercent('06:00')).toBe(0);
  });
});

describe('periods and days', () => {
  const p = (id: string, startsOn: string, endsOn: string): Period => ({ id, phase: 'groups', startsOn, endsOn, label: id });
  const periods = [p('p2', '2026-11-10', '2026-11-30'), p('p0', '2026-09-01', '2026-10-01'), p('p1', '2026-10-06', '2026-11-09')];
  it('filters and sorts the open periods', () => {
    expect(openPeriods(periods, '2026-10-30').map((x) => x.id)).toEqual(['p1', 'p2']);
  });
  it('picks the period with one of my matches to schedule', () => {
    const open = openPeriods(periods, '2026-10-30');
    const match = { players: ['u1', 'u2'], status: 'unscheduled', periodId: 'p2' } as Match;
    expect(defaultPeriod(open, [match], 'u1')?.id).toBe('p2');
    expect(defaultPeriod(open, [match], 'u9')?.id).toBe('p1');
    expect(defaultPeriod([], [], 'u1')).toBeUndefined();
  });
  it('days from today to the end of the period', () => {
    expect(periodDays({ startsOn: '2026-10-28', endsOn: '2026-11-01' }, '2026-10-30')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    expect(periodDays({ startsOn: '2026-11-10', endsOn: '2026-11-11' }, '2026-10-30')).toEqual(['2026-11-10', '2026-11-11']);
  });
  it('weeks from Monday to Sunday', () => {
    // 2026-10-30 is a Friday
    const s = weeks(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual([null, null, null, null, '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(s[1][0]).toBe('2026-11-02');
    expect(s[1].slice(1).every((d) => d === null)).toBe(true);
  });
});

describe('quick fill', () => {
  it('adds to every chosen weekday, merging', () => {
    // 2026-11-14 Sat, 15 Sun, 16 Mon, 21 Sat
    const days = ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-21'];
    const r = addToWeekdays({ '2026-11-14': ['20:00-22:00'] }, days, [6, 0], '18:00', '21:00');
    expect(r.days).toEqual(['2026-11-14', '2026-11-15', '2026-11-21']);
    expect(r.windows).toEqual({
      '2026-11-14': ['18:00-22:00'],
      '2026-11-15': ['18:00-21:00'],
      '2026-11-21': ['18:00-21:00'],
    });
  });
  it('no weekday chosen: nothing changes', () => {
    const f = { '2026-11-14': ['20:00-22:00'] };
    expect(addToWeekdays(f, ['2026-11-14'], [], '18:00', '21:00')).toEqual({ windows: f, days: [] });
  });
});
