import { describe, expect, it } from 'vitest';
import { statistiche, validaRisultato } from '../results';

const f = { setPerVincere: 2, superTieBreak: true };
const S = (...xs: [number, number][]) => xs.map(([a, b]) => ({ a, b }));

describe('risultati', () => {
  it('valida i punteggi', () => {
    expect(validaRisultato(S([6, 4], [6, 3]), f)).toEqual({ ok: true, vincitore: 'A' });
    expect(validaRisultato(S([6, 4], [3, 6], [8, 10]), f)).toEqual({ ok: true, vincitore: 'B' });
    expect(validaRisultato(S([6, 4], [3, 6], [12, 10]), f).ok).toBe(true);
    expect(validaRisultato(S([6, 5], [6, 3]), f).ok).toBe(false);
    expect(validaRisultato(S([6, 4]), f).ok).toBe(false);
    expect(validaRisultato(S([6, 4], [6, 3], [6, 0]), f).ok).toBe(false);
    expect(validaRisultato(S([6, 4], [3, 6], [10, 9]), f).ok).toBe(false);
    expect(validaRisultato(S([6, 4], [3, 6], [7, 5]), { setPerVincere: 2, superTieBreak: false }).ok).toBe(true);
  });
  it('il super tie-break vale un game', () => {
    expect(statistiche(S([6, 4], [3, 6], [10, 8]), f)).toMatchObject({ setA: 2, setB: 1, gameA: 10, gameB: 10, setDecisivo: true });
  });
});
