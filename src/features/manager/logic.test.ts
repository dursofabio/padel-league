import { describe, expect, it } from 'vitest';
import type { BookingRow, Court, MatchRequest } from '../../types';
import {
  acceptanceState,
  addDate,
  closeDayMessage,
  confirmBlockReason,
  confirmedOffGrid,
  confirmMessage,
  conflictingBookings,
  conflictsMessage,
  counterProposalDays,
  deadlineText,
  effectiveDeadline,
  gridStarts,
  initialMinute,
  isComplete,
  joinList,
  managerSlotState,
  materializeMessage,
  newCourtId,
  overlappingRequests,
  rangeError,
  recurrenceWhen,
  skippedLabel,
  sortByDeadline,
  times,
  validateCourt,
} from './logic';

const NOW = Date.parse('2026-11-10T10:00:00Z');
const ts = (ms: number) => ({ toMillis: () => ms });
const allDays = [0, 1, 2, 3, 4, 5, 6];
const c1: Court = { id: 'c1', name: 'Campo 1', firstSlot: '13:30', lastSlot: '21:00', slotMinutes: 90, activeDays: allDays, closedDates: [] };

function req(p: Partial<MatchRequest> = {}): MatchRequest {
  return {
    id: 'r1',
    tournamentId: 't',
    matchId: 'p',
    courtId: 'c1',
    date: '2026-11-14',
    start: '15:00',
    end: '16:30',
    offGrid: false,
    players: ['a', 'b', 'c', 'd'],
    acceptances: { a: ts(1), b: ts(1), c: ts(1), d: ts(1) },
    status: 'pending',
    expiresAt: ts(NOW + 5 * 3600_000),
    createdBy: 'a',
    ...p,
  };
}

const booking = (p: Partial<BookingRow>): BookingRow => ({
  id: 'o',
  courtId: 'c1',
  date: '2026-11-14',
  start: '16:00',
  end: '17:00',
  type: 'lesson',
  ...p,
});

describe('acceptanceState', () => {
  it('counts who accepted and who is missing', () => {
    const r = req({ acceptances: { a: ts(1), b: null, c: ts(1), d: ts(1) } });
    expect(acceptanceState(r)).toEqual({ given: 3, total: 4, missing: ['b'] });
    expect(isComplete(r)).toBe(false);
    expect(isComplete(req())).toBe(true);
  });
});

describe('deadline', () => {
  it('text and urgency', () => {
    expect(deadlineText(NOW + 40 * 60_000, NOW)).toEqual({ text: 'scade tra 40 min', urgent: true, expired: false });
    expect(deadlineText(NOW + 5 * 3600_000, NOW)).toEqual({ text: 'scade tra 5 h', urgent: false, expired: false });
    expect(deadlineText(NOW + 72 * 3600_000, NOW).text).toBe('scade tra 3 g');
    expect(deadlineText(NOW - 1, NOW).expired).toBe(true);
  });
  it('sorts by deadline', () => {
    const a = req({ id: 'a', expiresAt: ts(3) });
    const b = req({ id: 'b', expiresAt: ts(1) });
    expect(sortByDeadline([a, b]).map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('effective deadline', () => {
  it('never goes past the slot start', () => {
    const r = req({ date: '2026-11-10', start: '14:00', expiresAt: ts(Date.parse('2026-11-12T10:00:00')) });
    expect(effectiveDeadline(r)).toBe(new Date(2026, 10, 10, 14, 0).getTime());
    const early = req({ date: '2026-11-20', expiresAt: ts(5) });
    expect(effectiveDeadline(early)).toBe(5);
  });
  it('blocks confirming a time already past', () => {
    const r = req({ date: '2026-11-09' });
    expect(confirmBlockReason(r, [], (u) => u, NOW)).toMatch(/già passato/);
  });
});

describe('conflicts', () => {
  it('finds overlapping requests on the same court', () => {
    const r = req();
    const other = req({ id: 'r2', start: '16:00', end: '17:30' });
    const otherCourt = req({ id: 'r3', courtId: 'c2' });
    const expired = req({ id: 'r4', expiresAt: ts(NOW - 1) });
    expect(overlappingRequests(r, [r, other, otherCourt, expired], NOW).map((x) => x.id)).toEqual(['r2']);
  });
  it('finds blocking bookings, ignoring its own', () => {
    const r = req();
    expect(
      conflictingBookings(r, [booking({}), booking({ id: 'x', start: '16:30', end: '17:00' }), booking({ id: 'y', requestId: 'r1' })]).map((o) => o.id),
    ).toEqual(['o']);
  });
  it('reason the confirmation is blocked', () => {
    const name = (u: string) => u.toUpperCase();
    expect(confirmBlockReason(req(), [], name, NOW)).toBeNull();
    expect(confirmBlockReason(req({ acceptances: { a: ts(1), b: null, c: null, d: ts(1) } }), [], name, NOW)).toBe(
      'Mancano accettazioni (2/4): deve accettare B e C.',
    );
    expect(confirmBlockReason(req(), [booking({})], name, NOW)).toBe('Il campo è occupato: Lezione 16:00–17:00.');
    expect(confirmBlockReason(req({ expiresAt: ts(NOW) }), [], name, NOW)).toMatch(/scaduta/);
  });
  it('Italian list', () => {
    expect(joinList(['A'])).toBe('A');
    expect(joinList(['A', 'B', 'C'])).toBe('A, B e C');
  });
});

describe('messages', () => {
  it('confirmation outcome', () => {
    const r = { date: '2026-11-14', start: '15:30' };
    expect(confirmMessage({ outcome: 'ok', conflicts: 0 }, r, 'Campo 2')).toEqual({ tone: 'ok', text: 'Confermata sab 14/11 15:30 · Campo 2.' });
    expect(confirmMessage({ outcome: 'ok', conflicts: 1 }, r, 'Campo 2').text).toBe(
      'Confermata sab 14/11 15:30 · Campo 2; 1 richiesta sovrapposta è passata in conflitto.',
    );
    expect(confirmMessage({ outcome: 'taken', conflicts: 0 }, r, 'Campo 2').tone).toBe('danger');
    expect(confirmMessage({ outcome: 'expired', conflicts: 0 }, r, 'Campo 2').text).toMatch(/scaduta nel frattempo/);
  });
  it('conflicts after a booking', () => {
    expect(conflictsMessage('Segnato.', 0)).toBe('Segnato.');
    expect(conflictsMessage('Segnato.', 2)).toBe('Segnato. 2 richieste in attesa sono passate in conflitto.');
  });
  it('recurrences and closing the day', () => {
    expect(skippedLabel('2026-11-18: Campo occupato')).toBe('mer 18/11 (Campo occupato)');
    expect(materializeMessage({ created: 8, skipped: [] })).toEqual({ tone: 'ok', text: 'Segnati 8 giorni.' });
    expect(materializeMessage({ created: 1, skipped: ['2026-11-18: x'] }).text).toBe('Segnato 1 giorno. Saltati: mer 18/11 (x).');
    expect(closeDayMessage({ errors: [], conflicts: 1 }, '2026-11-14').text).toBe(
      'Giornata di sab 14/11 chiusa. 1 richiesta in attesa è passata in conflitto.',
    );
    expect(closeDayMessage({ errors: ['Campo 1: partita confermata'], conflicts: 0 }, '2026-11-14')).toEqual({
      tone: 'warn',
      text: 'Chiusura parziale di sab 14/11. Non chiusi: Campo 1: partita confermata.',
    });
    expect(recurrenceWhen({ weekday: 2, start: '18:00', end: '19:30' })).toBe('ogni martedì 18:00–19:30');
  });
});

describe('counter-proposal', () => {
  it('days ±3 by distance, inside the period and from today', () => {
    expect(counterProposalDays('2026-11-14', '2026-11-01')).toEqual([
      '2026-11-14',
      '2026-11-13',
      '2026-11-15',
      '2026-11-12',
      '2026-11-16',
      '2026-11-11',
      '2026-11-17',
    ]);
    expect(counterProposalDays('2026-11-14', '2026-11-13', { startsOn: '2026-11-01', endsOn: '2026-11-15' })).toEqual([
      '2026-11-14',
      '2026-11-13',
      '2026-11-15',
    ]);
  });
  it('court-side state of a slot', () => {
    const s = { courtId: 'c1', date: '2026-11-14', start: '15:00', end: '16:30' };
    expect(managerSlotState(s, { o: booking({}) }, [], NOW)).toBe('booked');
    expect(managerSlotState(s, {}, [req()], NOW)).toBe('requested');
    expect(managerSlotState(s, {}, [req({ expiresAt: ts(NOW - 1) })], NOW)).toBe('free');
  });
});

describe('times and courts', () => {
  it('times in steps', () => {
    expect(times('08:00', '09:00', 30)).toEqual(['08:00', '08:30', '09:00']);
    expect(times('23:30', '24:00', 15)).toEqual(['23:30', '23:45', '24:00']);
  });
  it('valid range', () => {
    expect(rangeError('10:00', '11:00')).toBeNull();
    expect(rangeError('11:00', '11:00')).toBe('L’orario di fine deve venire dopo quello di inizio.');
  });
  it('initial minute of the day', () => {
    expect(initialMinute(false, 20 * 60)).toBe(780);
    expect(initialMinute(true, 9 * 60)).toBe(780);
    expect(initialMinute(true, 18 * 60 + 40)).toBe(18 * 60);
  });
  it('grid preview', () => {
    expect(gridStarts('13:30', '21:00', 90)).toEqual(['13:30', '15:00', '16:30', '18:00', '19:30', '21:00']);
    expect(gridStarts('14:00', '13:00', 90)).toEqual([]);
  });
  it('court validation', () => {
    expect(validateCourt(c1)).toEqual({});
    expect(validateCourt({ ...c1, name: ' ', lastSlot: '23:00', activeDays: [] })).toEqual({
      name: 'Dai un nome al campo.',
      lastSlot: 'L’ultima partita finirebbe dopo mezzanotte.',
      activeDays: 'Scegli almeno un giorno in cui il campo è aperto.',
    });
    expect(validateCourt({ ...c1, slotMinutes: 5 }).slotMinutes).toBeDefined();
  });
  it('new court id', () => {
    expect(newCourtId('Campo Centrale', [])).toBe('campo-centrale');
    expect(newCourtId('Più bello!', ['piu-bello'])).toBe('piu-bello-2');
    expect(newCourtId('***', [])).toBe('campo');
  });
  it('confirmed matches no longer on the grid', () => {
    const r = req({ status: 'confirmed', start: '13:30', end: '15:00' });
    expect(confirmedOffGrid(c1, [r])).toEqual([]);
    expect(confirmedOffGrid({ ...c1, firstSlot: '14:00' }, [r]).map((x) => x.id)).toEqual(['r1']);
  });
  it('closure dates sorted and unique', () => {
    expect(addDate(['2026-12-25'], '2026-12-08')).toEqual(['2026-12-08', '2026-12-25']);
    expect(addDate(['2026-12-25'], '2026-12-25')).toEqual(['2026-12-25']);
  });
});
