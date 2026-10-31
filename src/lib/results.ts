import type { Match, SetFormat, SetScore } from '../types';

export interface ValidationOutcome {
  ok: boolean;
  /** Italian message shown to the user. */
  error?: string;
  winner?: 'A' | 'B';
}

function validRegularSet(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === 6) return lo <= 4;
  if (hi === 7) return lo === 5 || lo === 6;
  return false;
}

function validSuperTieBreak(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi < 10 || hi - lo < 2) return false;
  return hi === 10 || hi - lo === 2;
}

export function isDecidingSet(index: number, format: SetFormat): boolean {
  return index === format.setsToWin * 2 - 2;
}

export function validateResult(sets: SetScore[], format: SetFormat): ValidationOutcome {
  const max = format.setsToWin * 2 - 1;
  if (sets.length === 0) return { ok: false, error: 'Inserisci almeno un set' };
  if (sets.length > max) return { ok: false, error: `Al massimo ${max} set` };
  let wa = 0;
  let wb = 0;
  for (let i = 0; i < sets.length; i++) {
    const { a, b } = sets[i];
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0)
      return { ok: false, error: `Set ${i + 1}: punteggio non valido` };
    if (wa === format.setsToWin || wb === format.setsToWin)
      return { ok: false, error: 'La partita era già finita prima di questo set' };
    const stb = format.superTieBreak && isDecidingSet(i, format);
    const valid = stb ? validSuperTieBreak(a, b) : validRegularSet(a, b);
    if (!valid)
      return {
        ok: false,
        error: stb
          ? `Set ${i + 1}: super tie-break non valido (a 10, con 2 punti di scarto)`
          : `Set ${i + 1}: punteggio non valido (6-0…6-4, 7-5, 7-6)`,
      };
    if (a > b) wa++;
    else wb++;
  }
  if (wa < format.setsToWin && wb < format.setsToWin) return { ok: false, error: 'La partita non è conclusa' };
  return { ok: true, winner: wa > wb ? 'A' : 'B' };
}

export interface MatchStats {
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  winner: 'A' | 'B';
  decidingSet: boolean;
}

/** The super tie-break counts as one set won and one game. */
export function matchStats(sets: SetScore[], format: SetFormat): MatchStats {
  let setsA = 0, setsB = 0, gamesA = 0, gamesB = 0;
  sets.forEach(({ a, b }, i) => {
    if (a > b) setsA++;
    else setsB++;
    if (format.superTieBreak && isDecidingSet(i, format)) {
      if (a > b) gamesA++;
      else gamesB++;
    } else {
      gamesA += a;
      gamesB += b;
    }
  });
  return {
    setsA, setsB, gamesA, gamesB,
    winner: setsA > setsB ? 'A' : 'B',
    decidingSet: sets.length === format.setsToWin * 2 - 1,
  };
}

/** Only confirmed results (or forfeits) count. */
export function hasOfficialResult(m: Match): boolean {
  return (m.status === 'played' || m.status === 'forfeit') && !!m.result?.sets?.length;
}

/** Winning team id, or null without an official result. */
export function matchWinner(m: Match, format: SetFormat): string | null {
  if (!hasOfficialResult(m)) return null;
  return matchStats(m.result!.sets, format).winner === 'A' ? m.teamA : m.teamB;
}

export function formatScore(sets: SetScore[] | undefined): string {
  return (sets ?? []).map((s) => `${s.a}-${s.b}`).join(' ');
}
