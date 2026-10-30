import { describe, expect, it } from 'vitest';
import type { Partita, Periodo } from '../../types';
import {
  aggiungiFascia,
  aggiungiFasciaConEsito,
  copiaSuStessoGiorno,
  etichettaFascia,
  fasceUguali,
  giorniDelPeriodo,
  giorniModificati,
  impostaGiorno,
  normalizzaFasce,
  orariSelezionabili,
  passoOrari,
  percentualeGiornata,
  periodiAperti,
  periodoPredefinito,
  PRESET_FASCE,
  rimuoviFascia,
  settimane,
  soloFuture,
  validaFascia,
} from '../fasce';

describe('fusione delle fasce', () => {
  it('aggiunge in ordine senza fondere fasce separate', () => {
    expect(aggiungiFascia(['18:00-20:00'], '12:00', '14:00')).toEqual(['12:00-14:00', '18:00-20:00']);
  });
  it('fonde sovrapposte e contigue', () => {
    expect(aggiungiFascia(['18:00-20:00'], '19:00', '23:00')).toEqual(['18:00-23:00']);
    expect(aggiungiFascia(['18:00-20:00'], '20:00', '22:00')).toEqual(['18:00-22:00']);
    expect(aggiungiFascia(['12:00-15:00', '18:00-20:00'], '14:00', '19:00')).toEqual(['12:00-20:00']);
  });
  it('una fascia contenuta non cambia nulla', () => {
    expect(aggiungiFascia(['08:00-23:00'], '14:00', '18:30')).toEqual(['08:00-23:00']);
  });
  it('dice a quale fascia si è unita', () => {
    expect(aggiungiFasciaConEsito(['18:00-20:00'], '19:00', '23:00')).toEqual({ lista: ['18:00-23:00'], unita: '18:00-23:00' });
    expect(aggiungiFasciaConEsito(['18:00-20:00'], '12:00', '14:00').unita).toBeNull();
    expect(aggiungiFasciaConEsito([], '12:00', '14:00').unita).toBeNull();
  });
  it('normalizza liste disordinate', () => {
    expect(normalizzaFasce(['20:00-22:00', '18:00-20:30', '09:00-10:00'])).toEqual(['09:00-10:00', '18:00-22:00']);
  });
  it('gestisce le 24:00', () => {
    expect(aggiungiFascia(['22:00-24:00'], '21:00', '22:30')).toEqual(['21:00-24:00']);
  });
});

describe('modifiche ai giorni', () => {
  it('rimuove una fascia', () => {
    expect(rimuoviFascia(['12:00-14:00', '18:00-20:00'], '12:00-14:00')).toEqual(['18:00-20:00']);
  });
  it('imposta un giorno senza mutare e toglie i giorni vuoti', () => {
    const f = { '2026-11-14': ['18:00-20:00'] };
    const g = impostaGiorno(f, '2026-11-14', []);
    expect(g).toEqual({});
    expect(f).toEqual({ '2026-11-14': ['18:00-20:00'] });
  });
  it('copia su tutti i sabati del periodo sostituendo', () => {
    const giorni = ['2026-11-14', '2026-11-15', '2026-11-21', '2026-11-28'];
    const f = { '2026-11-14': ['18:00-23:00'], '2026-11-21': ['09:00-10:00'], '2026-11-15': ['10:00-12:00'] };
    const r = copiaSuStessoGiorno(f, '2026-11-14', giorni);
    expect(r.giorni).toEqual(['2026-11-21', '2026-11-28']);
    expect(r.fasce).toEqual({
      '2026-11-14': ['18:00-23:00'],
      '2026-11-15': ['10:00-12:00'],
      '2026-11-21': ['18:00-23:00'],
      '2026-11-28': ['18:00-23:00'],
    });
  });
  it('tiene solo le date future', () => {
    expect(soloFuture({ '2026-10-29': ['18:00-20:00'], '2026-10-30': ['18:00-20:00'], '2026-11-01': [] }, '2026-10-30')).toEqual({
      '2026-10-30': ['18:00-20:00'],
    });
  });
  it('conta i giorni modificati', () => {
    expect(giorniModificati({ a: ['18:00-20:00'], b: [] }, { a: ['18:00-20:00'] })).toEqual([]);
    expect(giorniModificati({ a: ['18:00-20:00'] }, { a: ['18:00-21:00'], c: ['09:00-10:00'] })).toEqual(['a', 'c']);
    expect(fasceUguali({}, { x: [] })).toBe(true);
  });
});

describe('orari e validazione', () => {
  it('passo 15 solo con fuori griglia a 15', () => {
    expect(passoOrari({ consentiFuoriGriglia: true, passoFuoriGriglia: 15 })).toBe(15);
    expect(passoOrari({ consentiFuoriGriglia: false, passoFuoriGriglia: 15 })).toBe(30);
    expect(passoOrari({ consentiFuoriGriglia: true, passoFuoriGriglia: 30 })).toBe(30);
    expect(passoOrari(undefined)).toBe(30);
  });
  it('orari dalle 08 alle 24', () => {
    const o = orariSelezionabili(30);
    expect(o[0]).toBe('08:00');
    expect(o[o.length - 1]).toBe('24:00');
    expect(o).toHaveLength(33);
    expect(orariSelezionabili(15)).toHaveLength(65);
  });
  it('valida inizio e fine', () => {
    expect(validaFascia('18:00', '20:00')).toBeNull();
    expect(validaFascia('20:00', '20:00')).toMatch(/fine/);
    expect(validaFascia('20:00', '18:00')).toMatch(/fine/);
    expect(validaFascia('07:00', '09:00')).toMatch(/08:00/);
  });
  it('i preset sono validi', () => {
    for (const p of PRESET_FASCE) expect(validaFascia(p.da, p.a)).toBeNull();
    expect(PRESET_FASCE.map((p) => p.nome)).toEqual(['Pausa pranzo', 'Pomeriggio', 'Sera', 'Tutto il giorno']);
  });
  it('etichetta e posizione sulla giornata', () => {
    expect(etichettaFascia('14:00-19:00')).toBe('14:00–19:00');
    expect(percentualeGiornata('08:00')).toBe(0);
    expect(percentualeGiornata('16:00')).toBe(50);
    expect(percentualeGiornata('24:00')).toBe(100);
    expect(percentualeGiornata('06:00')).toBe(0);
  });
});

describe('periodi e giorni', () => {
  const p = (id: string, inizio: string, fine: string): Periodo => ({ id, fase: 'gironi', inizio, fine, etichetta: id });
  const periodi = [p('p2', '2026-11-10', '2026-11-30'), p('p0', '2026-09-01', '2026-10-01'), p('p1', '2026-10-06', '2026-11-09')];
  it('filtra e ordina i periodi aperti', () => {
    expect(periodiAperti(periodi, '2026-10-30').map((x) => x.id)).toEqual(['p1', 'p2']);
  });
  it('sceglie il periodo con una mia partita da programmare', () => {
    const aperti = periodiAperti(periodi, '2026-10-30');
    const partita = { giocatori: ['u1', 'u2'], stato: 'da programmare', periodoId: 'p2' } as Partita;
    expect(periodoPredefinito(aperti, [partita], 'u1')?.id).toBe('p2');
    expect(periodoPredefinito(aperti, [partita], 'u9')?.id).toBe('p1');
    expect(periodoPredefinito([], [], 'u1')).toBeUndefined();
  });
  it('giorni da oggi alla fine del periodo', () => {
    expect(giorniDelPeriodo({ inizio: '2026-10-28', fine: '2026-11-01' }, '2026-10-30')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    expect(giorniDelPeriodo({ inizio: '2026-11-10', fine: '2026-11-11' }, '2026-10-30')).toEqual(['2026-11-10', '2026-11-11']);
  });
  it('settimane da lunedì a domenica', () => {
    // 2026-10-30 è venerdì
    const s = settimane(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual([null, null, null, null, '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(s[1][0]).toBe('2026-11-02');
    expect(s[1].slice(1).every((d) => d === null)).toBe(true);
  });
});
