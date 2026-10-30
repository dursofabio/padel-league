import { describe, expect, it } from 'vitest';
import type { Campo, Occupazione, Richiesta } from '../../types';
import { classificaSlot, richiestaId, slotGriglia, slotImpattati, slotLiberoPiuVicino, verificaFuoriGriglia } from '../slots';

const tutti = [0, 1, 2, 3, 4, 5, 6];
const c1: Campo = { id: 'c1', nome: 'Campo 1', primoSlot: '13:30', ultimoSlot: '21:00', durata: 90, giorniAttivi: tutti, eccezioni: [] };
const c2: Campo = { id: 'c2', nome: 'Campo 2', primoSlot: '14:00', ultimoSlot: '20:00', durata: 90, giorniAttivi: tutti, eccezioni: ['2026-12-25'] };
const D = '2026-11-14';
const lezione: Occupazione = { inizio: '16:00', fine: '17:00', tipo: 'lezione', creatoDa: 'g' };
const ts = (ms: number) => ({ toMillis: () => ms }) as any;

describe('griglia', () => {
  it('genera gli slot sfalsati dei due campi', () => {
    expect(slotGriglia(c1, D).map((s) => s.inizio)).toEqual(['13:30', '15:00', '16:30', '18:00', '19:30', '21:00']);
    expect(slotGriglia(c2, D).map((s) => s.inizio)).toEqual(['14:00', '15:30', '17:00', '18:30', '20:00']);
    expect(slotGriglia(c2, '2026-12-25')).toEqual([]);
  });
  it('ID deterministico della richiesta', () => {
    expect(richiestaId('c1', D, '18:00')).toBe('c1_20261114_1800');
  });
  it('una lezione 16-17 blocca gli slot delle 15:00 e delle 16:30', () => {
    const items = { x: lezione };
    const stati = slotGriglia(c1, D).map((s) => classificaSlot(s, [], {}, items, []).colore);
    expect(stati[1]).toBe('rosso');
    expect(stati[2]).toBe('rosso');
    expect(stati[0]).not.toBe('rosso');
  });
});

describe('incrocio disponibilità', () => {
  const giocatori = ['a', 'b', 'c', 'd'];
  const disp = {
    a: { [D]: ['14:00-19:00'] },
    b: { [D]: ['13:00-20:00'] },
    c: { [D]: ['15:00-22:00'] },
    d: { [D]: ['17:00-19:00', '14:30-16:30'] },
  };
  it('verde, giallo, grigio', () => {
    const [s1330, s1500, s1630] = slotGriglia(c1, D);
    expect(classificaSlot(s1500, giocatori, disp, {}, []).colore).toBe('verde');
    const giallo = classificaSlot(s1630, giocatori, disp, {}, []);
    expect(giallo.colore).toBe('giallo');
    expect(giallo.mancanti).toEqual(['d']);
    expect(classificaSlot(s1330, giocatori, disp, {}, []).colore).toBe('grigio');
  });
  it('blu se c\'è una richiesta attiva sovrapposta, ignorando le scadute', () => {
    const [, s1500] = slotGriglia(c1, D);
    const r = { campoId: 'c1', data: D, inizio: '14:30', fine: '16:00', stato: 'attesa', scadenza: ts(2000) } as Richiesta;
    expect(classificaSlot(s1500, giocatori, disp, {}, [r], 1000).colore).toBe('blu');
    expect(classificaSlot(s1500, giocatori, disp, {}, [r], 3000).colore).toBe('verde');
  });
});

describe('fuori griglia', () => {
  it('impatto e blocchi', () => {
    expect(slotImpattati(c1, D, '14:30', '16:00').map((s) => s.inizio)).toEqual(['13:30', '15:00']);
    const v = verificaFuoriGriglia(c1, D, '15:30', { x: lezione }, []);
    expect(v.bloccanti).toHaveLength(1);
    expect(verificaFuoriGriglia(c1, D, '17:00', { x: lezione }, []).bloccanti).toHaveLength(0);
  });
  it('controproposta: slot libero più vicino', () => {
    const s = slotGriglia(c1, D)[1]; // 15:00, bloccato dalla lezione
    const best = slotLiberoPiuVicino(s, [c1, c2], [D], { c1_20261114: { x: lezione } }, []);
    expect(best).toMatchObject({ campoId: 'c2', inizio: '15:30' });
  });
});
