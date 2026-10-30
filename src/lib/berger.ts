export interface Accoppiamento<T> {
  giornata: number; // 1-based
  casa: T;
  ospite: T;
}

/**
 * Calendario round-robin con l'algoritmo di Berger (metodo del poligono).
 * Con un numero dispari di squadre si aggiunge un riposo, e la squadra che riposa salta la giornata.
 * Restituisce n-1 giornate (n pari) da n/2 partite.
 */
export function berger<T>(squadre: T[]): Accoppiamento<T>[] {
  const items: (T | null)[] = [...squadre];
  if (items.length < 2) return [];
  if (items.length % 2 === 1) items.push(null);
  const n = items.length;
  const fisso = items[n - 1];
  let rotanti = items.slice(0, n - 1);
  const out: Accoppiamento<T>[] = [];

  for (let g = 0; g < n - 1; g++) {
    const giornata = g + 1;
    // la squadra fissa alterna casa/ospite
    const primo = rotanti[0];
    const pair: [T | null, T | null] = g % 2 === 0 ? [primo, fisso] : [fisso, primo];
    push(pair);
    for (let i = 1; i < n / 2; i++) push([rotanti[i], rotanti[n - 1 - i]]);
    // rotazione: l'ultimo dei rotanti va in testa
    rotanti = [rotanti[n - 2], ...rotanti.slice(0, n - 2)];

    function push([a, b]: [T | null, T | null]) {
      if (a !== null && b !== null) out.push({ giornata, casa: a, ospite: b });
    }
  }
  return out;
}

/** Distribuisce le giornate tra i periodi, in blocchi consecutivi il più possibile uniformi. */
export function giornataToPeriodo(giornate: number, periodi: number): (g: number) => number {
  return (g: number) => (periodi <= 1 ? 0 : Math.min(periodi - 1, Math.floor(((g - 1) * periodi) / giornate)));
}
