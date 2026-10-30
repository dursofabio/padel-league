import { describe, expect, it } from 'vitest';
import { instant } from '../../../../data/adapters';
import type { StatoSlot } from '../../../../lib/slots';
import type { Partita, Richiesta } from '../../../../types';
import {
  ariaSlot,
  controllaRisultato,
  dataLunga,
  elencoNomi,
  etichettaSlot,
  fasePartita,
  finestraSettimana,
  gruppoPartita,
  inRitardo,
  istante,
  limiteAnnullamento,
  muoviFocus,
  opzioniInizio,
  righeVisibili,
  traQuanto,
  valoriDa,
  type CellaNav,
} from '../logica';

const F = { setPerVincere: 2, superTieBreak: true };

describe('finestraSettimana', () => {
  const periodo = { inizio: '2026-11-02', fine: '2026-11-22' };

  it('starts at the period start when it is in the future', () => {
    const f = finestraSettimana(periodo, '2026-10-30', 0);
    expect([f.from, f.to]).toEqual(['2026-11-02', '2026-11-08']);
    expect(f.haPrecedente).toBe(false);
    expect(f.haSuccessiva).toBe(true);
    expect(f.periodoFinito).toBe(false);
  });

  it('starts today inside the period and clips the last week to the period end', () => {
    const f0 = finestraSettimana(periodo, '2026-11-10', 0);
    expect(f0.from).toBe('2026-11-10');
    const f1 = finestraSettimana(periodo, '2026-11-10', 1);
    expect([f1.from, f1.to]).toEqual(['2026-11-17', '2026-11-22']);
    expect(f1.giorni).toHaveLength(6);
    expect(f1.haSuccessiva).toBe(false);
    expect(f1.haPrecedente).toBe(true);
  });

  it('clamps an out-of-range week index', () => {
    expect(finestraSettimana(periodo, '2026-11-10', 9).settimana).toBe(1);
    expect(finestraSettimana(periodo, '2026-11-10', -3).settimana).toBe(0);
  });

  it('late match: next 7 days from today, flagged', () => {
    const f = finestraSettimana(periodo, '2026-11-25', 0);
    expect([f.from, f.to]).toEqual(['2026-11-25', '2026-12-01']);
    expect(f.periodoFinito).toBe(true);
    expect(f.haSuccessiva).toBe(true);
    expect(finestraSettimana(periodo, '2026-11-25', 3).haSuccessiva).toBe(false);
  });

  it('no period: from today, not flagged as late', () => {
    const f = finestraSettimana(null, '2026-11-25', 0);
    expect(f.from).toBe('2026-11-25');
    expect(f.periodoFinito).toBe(false);
  });
});

describe('labels', () => {
  it('formats long dates and name lists', () => {
    expect(dataLunga('2026-11-14')).toBe('Sabato 14 novembre');
    expect(elencoNomi(['Luca'])).toBe('Luca');
    expect(elencoNomi(['Luca', 'Marta', 'Ugo'])).toBe('Luca, Marta e Ugo');
  });

  const slot = { campoId: 'c2', data: '2026-11-14', inizio: '15:30', fine: '17:00' };
  const nome = (u: string) => ({ u1: 'Marco', u2: 'Luca', u3: 'Marta', u4: 'Ugo' })[u] ?? u;

  it('builds the full aria-label of a slot', () => {
    const s: StatoSlot = { slot, colore: 'giallo', liberi: ['u1', 'u3', 'u4'], mancanti: ['u2'], occupazioni: [] };
    expect(ariaSlot(s, 'Campo 2', nome)).toBe('Sabato 14 novembre, Campo 2, 15:30–17:00, 3 su 4 liberi, manca Luca');
    expect(etichettaSlot(s, 4)).toBe('3/4');
    const g: StatoSlot = { ...s, colore: 'grigio', liberi: ['u1', 'u4'], mancanti: ['u2', 'u3'] };
    expect(ariaSlot(g, 'Campo 2', nome)).toMatch(/2 su 4 liberi, mancano Luca e Marta$/);
    const v: StatoSlot = { ...s, colore: 'verde', liberi: ['u1', 'u2', 'u3', 'u4'], mancanti: [] };
    expect(ariaSlot(v, 'Campo 2', nome)).toMatch(/4 su 4 liberi$/);
  });

  it('describes occupied and requested slots', () => {
    const r: StatoSlot = {
      slot,
      colore: 'rosso',
      liberi: [],
      mancanti: [],
      occupazioni: [{ tipo: 'lezione', inizio: '15:00', fine: '16:30' }],
    };
    expect(ariaSlot(r, 'Campo 2', nome)).toMatch(/occupato: lezione 15:00–16:30$/);
    expect(etichettaSlot(r, 4)).toBe('Occupato');
    expect(ariaSlot({ ...r, colore: 'blu', occupazioni: [] }, 'Campo 2', nome)).toMatch(/già richiesto/);
  });
});

describe('time helpers', () => {
  it('relative time', () => {
    const now = 0;
    expect(traQuanto(20 * 3_600_000, now)).toBe('tra 20 h');
    expect(traQuanto(35 * 60_000, now)).toBe('tra 35 min');
    expect(traQuanto(72 * 3_600_000, now)).toBe('tra 3 giorni');
    expect(traQuanto(-1, now)).toBeNull();
  });

  it('player cancel deadline', () => {
    expect(istante('2026-11-14', '15:30') - limiteAnnullamento({ data: '2026-11-14', inizio: '15:30' }, 24)).toBe(24 * 3_600_000);
  });

  it('off-grid starts', () => {
    const all = opzioniInizio(30, '2026-11-14', '2026-11-13', 0);
    expect(all[0]).toBe('08:00');
    expect(all[all.length - 1]).toBe('22:30');
    expect(all).toHaveLength(30);
    expect(opzioniInizio(15, '2026-11-14', '2026-11-14', 20 * 60)[0]).toBe('20:15');
  });
});

const base: Partita = {
  id: 'p1',
  fase: 'gironi',
  squadraA: 'sa',
  squadraB: 'sb',
  giocatoriA: ['u1', 'u2'],
  giocatoriB: ['u3', 'u4'],
  giocatori: ['u1', 'u2', 'u3', 'u4'],
  stato: 'da programmare',
};
const NOW = Date.parse('2026-11-10T12:00:00');
function richiesta(acc: string[], scadenza = NOW + 3_600_000, stato: Richiesta['stato'] = 'attesa'): Richiesta {
  return {
    id: 'r1',
    torneoId: 't',
    partitaId: 'p1',
    campoId: 'c1',
    data: '2026-11-14',
    inizio: '15:00',
    fine: '16:30',
    fuoriGriglia: false,
    giocatori: base.giocatori,
    accettazioni: Object.fromEntries(base.giocatori.map((g) => [g, acc.includes(g) ? instant('2026-11-10T10:00:00Z') : null])),
    stato,
    scadenza: { toMillis: () => scadenza },
    creatoDa: 'u1',
  };
}

describe('fasePartita and gruppoPartita', () => {
  it('derives every state', () => {
    expect(fasePartita({ ...base, squadraB: null }, null, NOW)).toBe('S0');
    expect(fasePartita(base, null, NOW)).toBe('S1');
    expect(fasePartita({ ...base, stato: 'richiesta' }, richiesta(['u1']), NOW)).toBe('S2');
    expect(fasePartita({ ...base, stato: 'richiesta' }, richiesta(base.giocatori), NOW)).toBe('S3');
    // expired request behaves as "da programmare"
    expect(fasePartita({ ...base, stato: 'richiesta' }, richiesta(['u1'], NOW - 1), NOW)).toBe('S1');
    const prog = { campoId: 'c1', data: '2026-11-14', inizio: '15:00', fine: '16:30' };
    expect(fasePartita({ ...base, stato: 'programmata', programmazione: prog }, null, NOW)).toBe('S4');
    expect(fasePartita({ ...base, stato: 'programmata', programmazione: prog }, null, Date.parse('2026-11-14T16:00:00'))).toBe('S5');
    const ris = { set: [{ a: 6, b: 4 }, { a: 6, b: 3 }], inseritoDa: 'u1' };
    expect(fasePartita({ ...base, risultato: ris }, null, NOW)).toBe('S6');
    expect(fasePartita({ ...base, stato: 'contestata', risultato: ris }, null, NOW)).toBe('S7');
    expect(fasePartita({ ...base, stato: 'giocata', risultato: { ...ris, confermatoDa: 'u3' } }, null, NOW)).toBe('S8');
  });

  it('groups my matches, pending acceptances on top', () => {
    const p = { ...base, stato: 'richiesta' as const };
    expect(gruppoPartita(p, richiesta(['u1']), 'u2', NOW)).toEqual({ gruppo: 'tocca-a-te', motivo: 'accetta' });
    expect(gruppoPartita(p, richiesta(['u1']), 'u1', NOW).gruppo).toBe('in-corso');
    const ris = { set: [{ a: 6, b: 4 }, { a: 6, b: 3 }], inseritoDa: 'u1' };
    expect(gruppoPartita({ ...base, risultato: ris }, null, 'u3', NOW)).toEqual({ gruppo: 'tocca-a-te', motivo: 'conferma-risultato' });
    expect(gruppoPartita({ ...base, risultato: ris }, null, 'u2', NOW).gruppo).toBe('attesa-risultato');
  });

  it('late only for open matches after the period', () => {
    expect(inRitardo(base, { fine: '2026-11-09' }, '2026-11-10')).toBe(true);
    expect(inRitardo(base, { fine: '2026-11-10' }, '2026-11-10')).toBe(false);
    expect(inRitardo({ ...base, stato: 'programmata' }, { fine: '2026-11-09' }, '2026-11-10')).toBe(false);
  });
});

describe('muoviFocus', () => {
  const g = (d: string, ...xs: [string, string][]): CellaNav[] => xs.map(([c, t]) => ({ key: `${d}|${c}|${t}`, campoId: c, inizio: t }));
  const giorni = [
    g('1', ['c1', '13:30'], ['c2', '14:00'], ['c1', '15:00'], ['c2', '15:30']),
    [],
    g('3', ['c2', '14:00'], ['c2', '15:30']),
  ];
  const campi = ['c1', 'c2'];
  it('moves in time, across courts and days', () => {
    expect(muoviFocus(giorni, '1|c1|13:30', 'ArrowDown', campi)).toBe('1|c2|14:00');
    expect(muoviFocus(giorni, '1|c1|13:30', 'ArrowUp', campi)).toBeNull();
    expect(muoviFocus(giorni, '1|c1|15:00', 'ArrowRight', campi)).toBe('1|c2|15:30');
    expect(muoviFocus(giorni, '1|c1|13:30', 'ArrowRight', campi)).toBe('1|c2|14:00');
    expect(muoviFocus(giorni, '1|c2|15:30', 'ArrowLeft', campi)).toBe('1|c1|15:00');
    expect(muoviFocus(giorni, '1|c2|15:30', 'ArrowRight', campi)).toBeNull();
    expect(muoviFocus(giorni, '1|c2|15:30', 'PageDown', campi)).toBe('3|c2|15:30');
    expect(muoviFocus(giorni, '3|c2|14:00', 'PageUp', campi)).toBe('1|c2|14:00');
    expect(muoviFocus(giorni, '1|c2|14:00', 'End', campi)).toBe('1|c2|15:30');
    expect(muoviFocus(giorni, '1|c2|14:00', 'Home', campi)).toBe('1|c1|13:30');
  });
});

describe('score entry', () => {
  const v = (...s: [number | null, number | null][]) => s.map(([a, b]) => ({ a, b }));

  it('shows the decisive row only when the sets are split', () => {
    expect(righeVisibili(v(), F)).toBe(2);
    expect(righeVisibili(v([6, 4], [6, 3]), F)).toBe(2);
    expect(righeVisibili(v([6, 4], [3, 6]), F)).toBe(3);
    expect(righeVisibili(v(), { setPerVincere: 1, superTieBreak: false })).toBe(1);
    expect(valoriDa([{ a: 6, b: 4 }], F)).toHaveLength(3);
  });

  it('validates live and attaches messages to rows', () => {
    expect(controllaRisultato(v([6, 4], [3, 6], [10, 7]), F)).toMatchObject({ vincitore: 'A', setA: 2, setB: 1, perRiga: {} });
    expect(controllaRisultato(v([6, 5]), F).perRiga[0]).toMatch(/^Set 1: punteggio non valido/);
    expect(controllaRisultato(v([6, 4], [3, 6], [10, 9]), F).perRiga[2]).toMatch(/^Super tie-break:/);
    expect(controllaRisultato(v([6, null]), F).perRiga[0]).toMatch(/entrambe/);
    expect(controllaRisultato(v([8, 6]), F).perRiga[0]).toBe('Set 1: al massimo 7');
    expect(controllaRisultato(v([6, 4]), F).globale).toBe('La partita non è ancora conclusa');
    const vuoto = controllaRisultato(v(), F);
    expect(vuoto.perRiga).toEqual({});
    expect(vuoto.globale).toBeUndefined();
    expect(vuoto.vincitore).toBeUndefined();
  });
});

describe('erroreDaHint', () => {
  it('maps hints to the match copy', async () => {
    const { erroreDaHint } = await import('../logica');
    expect(erroreDaHint({ hint: 'SLOT_TAKEN' })).toMatch(/appena preso/);
    expect(erroreDaHint({ code: '23505' })).toMatch(/appena preso/);
    expect(erroreDaHint({ hint: 'BAD_STEP' }, 15)).toBe('Scegli un orario ogni 15 minuti.');
    expect(erroreDaHint({ hint: 'OVERLAP', message: 'Il campo è occupato: lezione 15:00–16:30' })).toBe('Il campo è occupato: lezione 15:00–16:30');
    expect(erroreDaHint({ hint: 'NOT_FOUND' })).toBeNull();
  });
});
