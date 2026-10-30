import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULT } from '../../../lib/config';
import type { RigaClassifica } from '../../../lib/standings';
import type { Campo, Partita, Periodo, Ricorrenza, Squadra, Torneo } from '../../../types';
import { contaSlot } from '../../../lib/slots';
import {
  aggiornamentiTabellone,
  blocchiPari,
  eccezioni,
  occupazioniDaRicorrenze,
  oreDa,
  testoEta,
  partiteAnteprima,
  partiteNelPeriodo,
  passiTorneo,
  pianoCalendario,
  pianoFase,
  prng,
  sezioneValida,
  sorteggiaGironi,
  sorteggioConBlocco,
  spostaNelBlocco,
  statoPrecedente,
  stessoSorteggio,
  valutaCapienza,
} from '../logic';

const sq = (id: string, girone: string | null = 'A', stato: Squadra['stato'] = 'approvata'): Squadra => ({
  id,
  nome: id,
  giocatori: [],
  girone,
  stato,
  creatoDa: '',
});
const per = (id: string, fase: string, inizio: string, fine: string, turno: number | null = null): Periodo => ({
  id,
  fase,
  turno,
  inizio,
  fine,
  etichetta: id,
});
const partita = (p: Partial<Partita> & { id: string }): Partita => ({
  fase: 'gironi',
  squadraA: 'a',
  squadraB: 'b',
  giocatoriA: [],
  giocatoriB: [],
  giocatori: [],
  stato: 'da programmare',
  ...p,
});
const riga = (squadraId: string, punti: number, pariMerito: boolean, extra: Partial<RigaClassifica> = {}): RigaClassifica => ({
  squadraId,
  girone: 'A',
  giocate: 3,
  vinte: 0,
  perse: 0,
  punti,
  setVinti: 0,
  setPersi: 0,
  gameVinti: 0,
  gamePersi: 0,
  posizione: 0,
  pariMerito,
  ...extra,
});

describe('sezioneValida', () => {
  it('falls back to panoramica', () => {
    expect(sezioneValida(undefined)).toBe('panoramica');
    expect(sezioneValida('finali')).toBe('finali');
    expect(sezioneValida('boh')).toBe('panoramica');
  });
});

describe('phases', () => {
  it('marks done, current and future steps', () => {
    expect(passiTorneo('gironi').map((p) => p.passo)).toEqual(['fatto', 'corrente', 'futuro', 'futuro']);
  });
  it('computes the state to reopen to', () => {
    const t: Torneo = { id: 't', nome: 'T', stato: 'concluso', config: CONFIG_DEFAULT };
    expect(statoPrecedente(t, [])).toBe('iscrizioni');
    expect(statoPrecedente(t, [partita({ id: '1' })])).toBe('gironi');
    expect(statoPrecedente({ ...t, fasiGenerate: ['gold'] }, [])).toBe('fasiFinali');
  });
});

describe('sorteggiaGironi', () => {
  it('balances the groups and is deterministic with a seed', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `s${i}`);
    const a = sorteggiaGironi(ids, 2, prng(42));
    const b = sorteggiaGironi(ids, 2, prng(42));
    expect(a).toEqual(b);
    const conta = Object.values(a).reduce<Record<string, number>>((m, g) => ({ ...m, [g]: (m[g] ?? 0) + 1 }), {});
    expect(conta).toEqual({ A: 5, B: 4 });
  });
});

describe('pianoCalendario', () => {
  const squadre = [...['a1', 'a2', 'a3', 'a4'].map((id) => sq(id, 'A')), ...['b1', 'b2', 'b3'].map((id) => sq(id, 'B')), sq('x', null), sq('y', 'A', 'da approvare')];
  const periodi = [per('p2', 'gironi', '2026-12-01', '2026-12-31'), per('p1', 'gironi', '2026-11-01', '2026-11-30'), per('g', 'gold', '2027-01-01', '2027-01-31')];

  it('builds the generate_calendar payload with stable codes and periods in blocks', () => {
    const { partite, gironi } = pianoCalendario(squadre, periodi, prng(1));
    expect(partite).toHaveLength(6 + 3);
    expect(partite[0]).toMatchObject({ codice: 'gA-01-1', girone: 'A', turno: 1, posizione: 0, periodo_id: 'p1' });
    expect(new Set(partite.map((p) => p.codice)).size).toBe(partite.length);
    // only approved teams with a group
    expect(partite.some((p) => [p.squadra_a, p.squadra_b].includes('x') || [p.squadra_a, p.squadra_b].includes('y'))).toBe(false);
    // every pair of group A meets once
    const coppie = partite.filter((p) => p.girone === 'A').map((p) => [p.squadra_a, p.squadra_b].sort().join('-'));
    expect(new Set(coppie).size).toBe(6);
    expect(gironi[0]).toMatchObject({ girone: 'A', squadre: 4, partite: 6, giornate: 3 });
    expect(gironi[0].blocchi.map((b) => [b.periodoId, b.da, b.a])).toEqual([
      ['p1', 1, 2],
      ['p2', 3, 3],
    ]);
    expect(partite.filter((p) => p.turno === 3 && p.girone === 'A').every((p) => p.periodo_id === 'p2')).toBe(true);
  });

  it('is deterministic with the same seed and works without periods', () => {
    expect(pianoCalendario(squadre, periodi, prng(7)).partite).toEqual(pianoCalendario(squadre, periodi, prng(7)).partite);
    expect(pianoCalendario(squadre, [], prng(7)).partite.every((p) => p.periodo_id === null)).toBe(true);
  });
});

describe('capacity', () => {
  const campo: Campo = { id: 'c1', nome: 'Campo 1', primoSlot: '14:00', ultimoSlot: '20:00', durata: 90, giorniAttivi: [0, 1, 2, 3, 4, 5, 6], eccezioni: [] };
  it('subtracts recurrences from the grid slots', () => {
    const giorni = ['2026-11-02', '2026-11-03']; // Monday, Tuesday
    const ric: Ricorrenza = { id: 'r', campoId: 'c1', giornoSettimana: 1, inizio: '14:00', fine: '17:00', tipo: 'lezione', nota: '', dal: '2026-01-01', al: '2026-12-31' };
    expect(contaSlot([campo], giorni)).toBe(10);
    expect(contaSlot([campo], giorni, occupazioniDaRicorrenze([ric], giorni))).toBe(8);
  });
  it('applies the O4 thresholds', () => {
    expect(valutaCapienza(90, 30, 14)).toMatchObject({ rapporto: 3, tono: 'ok', slotSettimana: 45, servonoSettimana: 15 });
    expect(valutaCapienza(60, 30, 14).tono).toBe('warn');
    expect(valutaCapienza(40, 30, 14).tono).toBe('danger');
    expect(valutaCapienza(40, 0, 14)).toMatchObject({ rapporto: null, tono: null });
  });
  it('estimates matches per period before and after the calendar', () => {
    const squadre = ['a', 'b', 'c', 'd'].map((id) => sq(id));
    const p1 = per('p1', 'gironi', '2026-11-01', '2026-11-30');
    const p2 = per('p2', 'gironi', '2026-12-01', '2026-12-31');
    expect(partiteNelPeriodo(p1, [p1, p2], [], squadre, []) + partiteNelPeriodo(p2, [p1, p2], [], squadre, [])).toBe(6);
    expect(partiteNelPeriodo(p1, [p1], [partita({ id: '1', periodoId: 'p1' }), partita({ id: '2', periodoId: 'p2' })], squadre, [])).toBe(1);
    const fasi = [{ nome: 'Gold', posti: 6 }];
    expect(partiteNelPeriodo(per('g', 'gold', '2027-01-01', '2027-01-31'), [], [], [], fasi)).toBe(5);
    expect(partiteNelPeriodo(per('g1', 'gold', '2027-01-01', '2027-01-31', 1), [], [], [], fasi)).toBe(2);
    expect(partiteNelPeriodo(per('g2', 'gold', '2027-01-01', '2027-01-31', 2), [], [], [], fasi)).toBe(2);
  });
});

describe('finals', () => {
  const periodi = [per('t1', 'gold', '2027-01-01', '2027-01-10', 1), per('gx', 'gold', '2027-01-11', '2027-01-31')];
  it('builds the generate_finals payload with codes, next codes and periods per round', () => {
    const righe = pianoFase('Gold', ['a', 'b', 'c', 'd'], () => undefined, periodi);
    expect(righe).toHaveLength(3);
    expect(righe[0]).toMatchObject({ codice: 'gold-t1-p0', prossima_codice: 'gold-t2-p0', lato: 'A', periodo_id: 't1' });
    expect(righe[1]).toMatchObject({ codice: 'gold-t1-p1', lato: 'B' });
    expect(righe[2]).toMatchObject({ codice: 'gold-t2-p0', prossima_codice: null, lato: null, squadra_a: null, periodo_id: 'gx' });
    expect(new Set(righe.flatMap((r) => [r.squadra_a, r.squadra_b]).filter(Boolean))).toEqual(new Set(['a', 'b', 'c', 'd']));
  });
  it('turns the payload into preview matches', () => {
    const p = partiteAnteprima('gold', pianoFase('gold', ['a', 'b', 'c'], () => undefined, []));
    // bye: the best seed goes straight to the final
    expect(p.map((x) => x.id)).toEqual(['gold-t1-p1', 'gold-t2-p0']);
    expect(p[1].squadraA).toBe('a');
  });
  it('computes the sync updates only for matches still to schedule', () => {
    const vinta = { set: [{ a: 6, b: 0 }, { a: 6, b: 0 }], inseritoDa: 'x', confermatoDa: 'y' };
    const partite = [
      partita({ id: 'i1', codice: 'gold-t1-p0', fase: 'gold', turno: 1, squadraA: 'a', squadraB: 'd', prossimaPartita: 'i3', lato: 'A', stato: 'giocata', risultato: vinta }),
      partita({ id: 'i2', codice: 'gold-t1-p1', fase: 'gold', turno: 1, squadraA: 'b', squadraB: 'c', prossimaPartita: 'i3', lato: 'B', stato: 'programmata' }),
      partita({ id: 'i3', codice: 'gold-t2-p0', fase: 'gold', turno: 2, squadraA: null, squadraB: null }),
    ];
    expect(aggiornamentiTabellone(partite, CONFIG_DEFAULT.formatoSet, ['gold'])).toEqual([{ codice: 'gold-t2-p0', squadra_a: 'a', squadra_b: null }]);
    expect(aggiornamentiTabellone(partite, CONFIG_DEFAULT.formatoSet, [])).toEqual([]);
    const giaFatto = partite.map((p) => (p.id === 'i3' ? { ...p, squadraA: 'a' } : p));
    expect(aggiornamentiTabellone(giaFatto, CONFIG_DEFAULT.formatoSet, ['gold'])).toEqual([]);
  });
});

describe('ties', () => {
  it('groups adjacent tied rows with the same totals', () => {
    const righe = [riga('a', 9, false), riga('b', 6, true), riga('c', 6, true), riga('d', 3, true), riga('e', 3, true), riga('f', 0, false)];
    expect(blocchiPari(righe)).toEqual([
      ['b', 'c'],
      ['d', 'e'],
    ]);
  });
  it('moves within a block and writes the draw', () => {
    expect(spostaNelBlocco(['b', 'c', 'd'], 'c', -1)).toEqual(['c', 'b', 'd']);
    expect(spostaNelBlocco(['b', 'c'], 'b', -1)).toEqual(['b', 'c']);
    expect(sorteggioConBlocco({ z: 1 }, ['c', 'b'])).toEqual({ z: 1, c: 1, b: 2 });
    expect(stessoSorteggio({ a: 1 }, { a: 1 })).toBe(true);
    expect(stessoSorteggio({ a: 1 }, {})).toBe(false);
  });
});

describe('eccezioni', () => {
  it('sorts matches into the monitoring lists', () => {
    const periodi = [per('chiuso', 'gironi', '2026-10-01', '2026-10-20'), per('aperto', 'gironi', '2026-10-21', '2026-11-03')];
    const partite = [
      partita({ id: 'c', stato: 'contestata', periodoId: 'chiuso' }),
      partita({ id: 'r', stato: 'programmata', periodoId: 'chiuso' }),
      partita({ id: 'g', stato: 'giocata', periodoId: 'chiuso' }),
      partita({ id: 'd', stato: 'programmata', periodoId: 'aperto', risultato: { set: [{ a: 6, b: 0 }], inseritoDa: 'x' } }),
      partita({ id: 's', stato: 'da programmare', periodoId: 'aperto' }),
    ];
    const e = eccezioni(partite, periodi, '2026-10-30');
    expect(e.contestate.map((p) => p.id)).toEqual(['c']);
    expect(e.inRitardo.map((p) => p.id)).toEqual(['r']);
    expect(e.daConfermare.map((p) => p.id)).toEqual(['d']);
    expect(e.inScadenza.map((p) => p.id)).toEqual(['s']);
  });
});

describe('result age', () => {
  it('computes hours and Italian text', () => {
    const now = Date.parse('2026-10-30T12:00:00Z');
    expect(oreDa('2026-10-28T11:00:00Z', now)).toBe(49);
    expect(oreDa(undefined, now)).toBeNull();
    expect(oreDa('boh', now)).toBeNull();
    expect(testoEta(0)).toBe('da meno di un’ora');
    expect(testoEta(1)).toBe('da 1 ora');
    expect(testoEta(5)).toBe('da 5 ore');
    expect(testoEta(30)).toBe('da 1 giorno');
    expect(testoEta(49)).toBe('da 2 giorni');
  });
});
