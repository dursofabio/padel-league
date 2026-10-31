import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { nextStep } from '../nextStep';
import type { Match, Period, Team, Tournament } from '../../types';

const tournament: Tournament = { id: 't', name: 'T', status: 'registration', config: { ...DEFAULT_CONFIG, finals: [{ name: 'Gold', spots: 2 }] } };
const period: Period = { id: 'p', phase: 'groups', startsOn: '2026-11-01', endsOn: '2026-11-30', label: 'P1' };
const team = (id: string, status: Team['status'], group: string | null = 'A'): Team => ({ id, name: id, players: [], group, status, createdBy: '' });
const match = (id: string, status: Match['status']): Match => ({
  id, phase: 'groups', group: 'A', teamA: 'a', teamB: 'b', playersA: [], playersB: [], players: [], status,
  result: status === 'played' ? { sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }], enteredBy: 'x', confirmedBy: 'y' } : null,
});

describe('nextStep', () => {
  it('follows the tournament sequence', () => {
    expect(nextStep(tournament, [], [], [])?.id).toBe('periods');
    expect(nextStep(tournament, [period], [team('a', 'pending_approval')], [])).toMatchObject({ id: 'approve-teams', label: 'Approva 1 coppia' });
    expect(nextStep(tournament, [period], [team('a', 'approved', null)], [])?.id).toBe('groups');
    expect(nextStep(tournament, [period], [team('a', 'approved')], [])?.id).toBe('schedule');
    expect(nextStep(tournament, [period], [team('a', 'approved')], [match('1', 'unscheduled')])).toBeNull();
    expect(nextStep(tournament, [period], [team('a', 'approved')], [match('1', 'played')])?.id).toBe('finals');
    expect(nextStep({ ...tournament, status: 'completed' }, [], [], [])).toBeNull();
  });
});
