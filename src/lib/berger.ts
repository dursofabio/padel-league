export interface Pairing<T> {
  matchday: number; // 1-based
  home: T;
  away: T;
}

/**
 * Round-robin schedule with Berger's algorithm (polygon method).
 * With an odd number of teams a bye is added, and the team facing it sits out that matchday.
 * Returns n-1 matchdays (n even) of n/2 matches.
 */
export function berger<T>(teams: T[]): Pairing<T>[] {
  const items: (T | null)[] = [...teams];
  if (items.length < 2) return [];
  if (items.length % 2 === 1) items.push(null);
  const n = items.length;
  const fixed = items[n - 1];
  let rotating = items.slice(0, n - 1);
  const out: Pairing<T>[] = [];

  for (let g = 0; g < n - 1; g++) {
    const matchday = g + 1;
    // the fixed team alternates home/away
    const first = rotating[0];
    const pair: [T | null, T | null] = g % 2 === 0 ? [first, fixed] : [fixed, first];
    push(pair);
    for (let i = 1; i < n / 2; i++) push([rotating[i], rotating[n - 1 - i]]);
    // rotation: the last rotating team moves to the front
    rotating = [rotating[n - 2], ...rotating.slice(0, n - 2)];

    function push([a, b]: [T | null, T | null]) {
      if (a !== null && b !== null) out.push({ matchday, home: a, away: b });
    }
  }
  return out;
}

/** Spreads the matchdays over the periods, in consecutive blocks as even as possible. */
export function matchdayToPeriod(matchdays: number, periods: number): (g: number) => number {
  return (g: number) => (periods <= 1 ? 0 : Math.min(periods - 1, Math.floor(((g - 1) * periods) / matchdays)));
}
