import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULT } from '../config';
import { prossimoPasso } from '../prossimoPasso';
import type { Partita, Periodo, Squadra, Torneo } from '../../types';

const torneo: Torneo = { id: 't', nome: 'T', stato: 'iscrizioni', config: { ...CONFIG_DEFAULT, fasiFinali: [{ nome: 'Gold', posti: 2 }] } };
const periodo: Periodo = { id: 'p', fase: 'gironi', inizio: '2026-11-01', fine: '2026-11-30', etichetta: 'P1' };
const sq = (id: string, stato: Squadra['stato'], girone: string | null = 'A'): Squadra => ({ id, nome: id, giocatori: [], girone, stato, creatoDa: '' });
const partita = (id: string, stato: Partita['stato']): Partita => ({
  id, fase: 'gironi', girone: 'A', squadraA: 'a', squadraB: 'b', giocatoriA: [], giocatoriB: [], giocatori: [], stato,
  risultato: stato === 'giocata' ? { set: [{ a: 6, b: 0 }, { a: 6, b: 0 }], inseritoDa: 'x', confermatoDa: 'y' } : null,
});

describe('prossimoPasso', () => {
  it('segue la sequenza del torneo', () => {
    expect(prossimoPasso(torneo, [], [], [])?.id).toBe('periodi');
    expect(prossimoPasso(torneo, [periodo], [sq('a', 'da approvare')], [])).toMatchObject({ id: 'approva-squadre', label: 'Approva 1 coppia' });
    expect(prossimoPasso(torneo, [periodo], [sq('a', 'approvata', null)], [])?.id).toBe('gironi');
    expect(prossimoPasso(torneo, [periodo], [sq('a', 'approvata')], [])?.id).toBe('calendario');
    expect(prossimoPasso(torneo, [periodo], [sq('a', 'approvata')], [partita('1', 'da programmare')])).toBeNull();
    expect(prossimoPasso(torneo, [periodo], [sq('a', 'approvata')], [partita('1', 'giocata')])?.id).toBe('finali');
    expect(prossimoPasso({ ...torneo, stato: 'concluso' }, [], [], [])).toBeNull();
  });
});
