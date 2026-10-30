import { describe, expect, it } from 'vitest';
import type { Partita, TorneoConfig } from '../../types';
import { classificaGirone } from '../standings';

const config: TorneoConfig = {
  puntiVittoria: 3, puntiSconfitta: 0, puntiSconfittaSetDecisivo: 1,
  formatoSet: { setPerVincere: 2, superTieBreak: true },
  spareggi: ['punti', 'scontroDiretto', 'diffSet', 'diffGame', 'sorteggio'],
  criterioQualificazione: 'perPosizione', fasiFinali: [], consentiFuoriGriglia: true, passoFuoriGriglia: 30, scadenzaRichiesteOre: 48,
};
let n = 0;
const P = (a: string, b: string, set: [number, number][], stato: Partita['stato'] = 'giocata'): Partita => ({
  id: `p${n++}`, fase: 'gironi', girone: 'A', squadraA: a, squadraB: b, giocatoriA: [], giocatoriB: [], giocatori: [],
  stato, risultato: { set: set.map(([x, y]) => ({ a: x, b: y })), inseritoDa: 'u', confermatoDa: 'v' },
});

describe('classifica', () => {
  it('punti, punto alla sconfitta al terzo set, scontro diretto', () => {
    const partite = [
      P('x', 'y', [[6, 0], [6, 0]]),
      P('y', 'z', [[6, 0], [6, 0]]),
      P('z', 'x', [[6, 0], [6, 0]]),
      P('x', 'w', [[6, 4], [3, 6], [10, 8]]),
      P('y', 'w', [[6, 4], [6, 4]]),
      P('z', 'w', [[6, 4], [6, 4]], 'programmata'), // non ufficiale: non conta
    ];
    const c = classificaGirone('A', ['x', 'y', 'z', 'w'], partite, config);
    // x: 6 punti, y: 6 punti, z: 3 punti, w: 1 punto. Scontro diretto x-y: vince x.
    expect(c.map((r) => r.squadraId)).toEqual(['x', 'y', 'z', 'w']);
    expect(c.map((r) => r.punti)).toEqual([6, 6, 3, 1]);
    expect(c[3].pariMerito).toBe(false);
  });
  it('pari merito non risolto -> segnalato; il sorteggio lo risolve', () => {
    const partite = [P('a', 'b', [[6, 0], [6, 0]]), P('b', 'c', [[6, 0], [6, 0]]), P('c', 'a', [[6, 0], [6, 0]])];
    const c = classificaGirone('A', ['a', 'b', 'c'], partite, config);
    expect(c.every((r) => r.pariMerito)).toBe(true);
    const s = classificaGirone('A', ['a', 'b', 'c'], partite, config, { c: 1, a: 2, b: 3 });
    expect(s.map((r) => r.squadraId)).toEqual(['c', 'a', 'b']);
    expect(s.some((r) => r.pariMerito)).toBe(false);
  });
});
