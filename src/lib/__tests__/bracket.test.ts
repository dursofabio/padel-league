import { describe, expect, it } from 'vitest';
import type { Partita } from '../../types';
import { derivaTabellone, generaTabellone, ordineTabellone, qualifica } from '../bracket';
import type { RigaClassifica } from '../standings';

const riga = (girone: string, pos: number, punti = 30 - pos * 3, giocate = 9): RigaClassifica => ({
  squadraId: `${girone}${pos}`, girone, posizione: pos, giocate, vinte: 0, perse: 0, punti,
  setVinti: 0, setPersi: 0, gameVinti: 0, gamePersi: 0, pariMerito: false,
});
const girone = (g: string, n: number) => Array.from({ length: n }, (_, i) => riga(g, i + 1));

describe('qualificazione', () => {
  it('per posizione: Gold 1-4, Silver 5-8, escluse 9-10', () => {
    const q = qualifica({ A: girone('A', 10), B: girone('B', 10) }, [{ nome: 'Gold', posti: 8 }, { nome: 'Silver', posti: 8 }], 'perPosizione');
    expect(q.fasi[0].squadre.map((s) => s.squadraId)).toEqual(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4']);
    expect(q.fasi[1].squadre.map((s) => s.squadraId)).toEqual(['A5', 'B5', 'A6', 'B6', 'A7', 'B7', 'A8', 'B8']);
    expect(q.escluse.map((s) => s.squadraId).sort()).toEqual(['A10', 'A9', 'B10', 'B9']);
  });
  it('fallback avulsa con 3 gironi e 8 posti: le migliori terze per media punti', () => {
    const cl = { A: girone('A', 4), B: girone('B', 4), C: [riga('C', 1), riga('C', 2), riga('C', 3, 40, 9)] };
    cl.A[2].punti = 10; cl.B[2].punti = 20;
    const q = qualifica(cl, [{ nome: 'Gold', posti: 8 }], 'avulsa');
    const ids = q.fasi[0].squadre.map((s) => s.squadraId);
    expect(ids).toHaveLength(8);
    expect(ids).toContain('C3');
    expect(ids).toContain('B3');
    expect(ids).not.toContain('A3');
  });
});

describe('tabellone', () => {
  it('ordine delle teste di serie', () => {
    expect(ordineTabellone(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it('incrocio A1–B4, B2–A3 | B1–A4, A2–B3', () => {
    const teste = ['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4'];
    const t = generaTabellone('gold', teste, (id) => id[0]);
    const quarti = t.filter((p) => p.turno === 1).map((p) => `${p.squadraA}-${p.squadraB}`);
    expect(quarti).toEqual(['A1-B4', 'B2-A3', 'B1-A4', 'A2-B3']);
    expect(t).toHaveLength(7);
    expect(t.find((p) => p.turno === 3)!.prossimaPartita).toBeNull();
  });
  it('bye alle teste di serie migliori', () => {
    const t = generaTabellone('s', ['1', '2', '3', '4', '5', '6']);
    const r1 = t.filter((p) => p.turno === 1);
    expect(r1).toHaveLength(2); // 4v5, 3v6
    const semi = t.filter((p) => p.turno === 2);
    expect(semi.map((p) => p.squadraA)).toEqual(['1', '2']);
  });
  it('avanzamento derivato dai risultati', () => {
    const spec = generaTabellone('g', ['1', '2', '3', '4']);
    const partite: Partita[] = spec.map((s) => ({
      ...s, fase: 'gold', giocatoriA: [], giocatoriB: [], giocatori: [], stato: 'da programmare',
    }));
    const semi1 = partite.find((p) => p.squadraA === '1')!;
    semi1.stato = 'giocata';
    semi1.risultato = { set: [{ a: 3, b: 6 }, { a: 4, b: 6 }], inseritoDa: 'x', confermatoDa: 'y' };
    const d = derivaTabellone(partite, { setPerVincere: 2, superTieBreak: true });
    const finale = partite.find((p) => p.turno === 2)!;
    expect(d.get(finale.id)).toMatchObject({ squadraA: '4', squadraB: null });
  });
});
