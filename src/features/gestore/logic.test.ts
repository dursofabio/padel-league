import { describe, expect, it } from 'vitest';
import type { Campo, OccupazioneRiga, Richiesta } from '../../types';
import {
  accettazioni,
  aggiungiData,
  completa,
  confermateFuoriGriglia,
  elenco,
  erroreIntervallo,
  etichettaSaltato,
  giorniControproposta,
  iniziGriglia,
  messaggioChiusura,
  messaggioConferma,
  messaggioConflitti,
  messaggioMaterializza,
  minutoIniziale,
  motivoBloccoConferma,
  nuovoIdCampo,
  occupazioniInConflitto,
  orari,
  ordinaPerScadenza,
  quandoRicorrenza,
  richiesteSovrapposte,
  scadenzaTesto,
  statoSlotGestore,
  validaCampo,
} from './logic';

const NOW = Date.parse('2026-11-10T10:00:00Z');
const ts = (ms: number) => ({ toMillis: () => ms });
const tutti = [0, 1, 2, 3, 4, 5, 6];
const c1: Campo = { id: 'c1', nome: 'Campo 1', primoSlot: '13:30', ultimoSlot: '21:00', durata: 90, giorniAttivi: tutti, eccezioni: [] };

function req(p: Partial<Richiesta> = {}): Richiesta {
  return {
    id: 'r1',
    torneoId: 't',
    partitaId: 'p',
    campoId: 'c1',
    data: '2026-11-14',
    inizio: '15:00',
    fine: '16:30',
    fuoriGriglia: false,
    giocatori: ['a', 'b', 'c', 'd'],
    accettazioni: { a: ts(1), b: ts(1), c: ts(1), d: ts(1) },
    stato: 'attesa',
    scadenza: ts(NOW + 5 * 3600_000),
    creatoDa: 'a',
    ...p,
  };
}

const occ = (p: Partial<OccupazioneRiga>): OccupazioneRiga => ({
  id: 'o',
  campoId: 'c1',
  data: '2026-11-14',
  inizio: '16:00',
  fine: '17:00',
  tipo: 'lezione',
  ...p,
});

describe('accettazioni', () => {
  it('conta chi ha accettato e chi manca', () => {
    const r = req({ accettazioni: { a: ts(1), b: null, c: ts(1), d: ts(1) } });
    expect(accettazioni(r)).toEqual({ date: 3, totale: 4, mancanti: ['b'] });
    expect(completa(r)).toBe(false);
    expect(completa(req())).toBe(true);
  });
});

describe('scadenza', () => {
  it('testo e urgenza', () => {
    expect(scadenzaTesto(NOW + 40 * 60_000, NOW)).toEqual({ testo: 'scade tra 40 min', urgente: true, scaduta: false });
    expect(scadenzaTesto(NOW + 5 * 3600_000, NOW)).toEqual({ testo: 'scade tra 5 h', urgente: false, scaduta: false });
    expect(scadenzaTesto(NOW + 72 * 3600_000, NOW).testo).toBe('scade tra 3 g');
    expect(scadenzaTesto(NOW - 1, NOW).scaduta).toBe(true);
  });
  it('ordina per scadenza', () => {
    const a = req({ id: 'a', scadenza: ts(3) });
    const b = req({ id: 'b', scadenza: ts(1) });
    expect(ordinaPerScadenza([a, b]).map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('conflitti', () => {
  it('trova le richieste sovrapposte sullo stesso campo', () => {
    const r = req();
    const altra = req({ id: 'r2', inizio: '16:00', fine: '17:30' });
    const altroCampo = req({ id: 'r3', campoId: 'c2' });
    const scaduta = req({ id: 'r4', scadenza: ts(NOW - 1) });
    expect(richiesteSovrapposte(r, [r, altra, altroCampo, scaduta], NOW).map((x) => x.id)).toEqual(['r2']);
  });
  it('trova le occupazioni che bloccano, ignorando la propria', () => {
    const r = req();
    expect(occupazioniInConflitto(r, [occ({}), occ({ id: 'x', inizio: '16:30', fine: '17:00' }), occ({ id: 'y', richiestaId: 'r1' })]).map((o) => o.id)).toEqual(['o']);
  });
  it('motivo del blocco della conferma', () => {
    const nome = (u: string) => u.toUpperCase();
    expect(motivoBloccoConferma(req(), [], nome, NOW)).toBeNull();
    expect(motivoBloccoConferma(req({ accettazioni: { a: ts(1), b: null, c: null, d: ts(1) } }), [], nome, NOW)).toBe(
      'Mancano accettazioni (2/4): deve accettare B e C.',
    );
    expect(motivoBloccoConferma(req(), [occ({})], nome, NOW)).toBe('Il campo è occupato: Lezione 16:00–17:00.');
    expect(motivoBloccoConferma(req({ scadenza: ts(NOW) }), [], nome, NOW)).toMatch(/scaduta/);
  });
  it('elenco in italiano', () => {
    expect(elenco(['A'])).toBe('A');
    expect(elenco(['A', 'B', 'C'])).toBe('A, B e C');
  });
});

describe('messaggi', () => {
  it('esito della conferma', () => {
    const r = { data: '2026-11-14', inizio: '15:30' };
    expect(messaggioConferma({ esito: 'ok', conflitti: 0 }, r, 'Campo 2')).toEqual({ tono: 'ok', testo: 'Confermata sab 14/11 15:30 · Campo 2.' });
    expect(messaggioConferma({ esito: 'ok', conflitti: 1 }, r, 'Campo 2').testo).toBe(
      'Confermata sab 14/11 15:30 · Campo 2; 1 richiesta sovrapposta è passata in conflitto.',
    );
    expect(messaggioConferma({ esito: 'occupato', conflitti: 0 }, r, 'Campo 2').tono).toBe('danger');
    expect(messaggioConferma({ esito: 'scaduta', conflitti: 0 }, r, 'Campo 2').testo).toMatch(/scaduta nel frattempo/);
  });
  it('conflitti dopo un’occupazione', () => {
    expect(messaggioConflitti('Segnato.', 0)).toBe('Segnato.');
    expect(messaggioConflitti('Segnato.', 2)).toBe('Segnato. 2 richieste in attesa sono passate in conflitto.');
  });
  it('ricorrenze e chiusura', () => {
    expect(etichettaSaltato('2026-11-18: Campo occupato')).toBe('mer 18/11 (Campo occupato)');
    expect(messaggioMaterializza({ creati: 8, saltati: [] })).toEqual({ tono: 'ok', testo: 'Segnati 8 giorni.' });
    expect(messaggioMaterializza({ creati: 1, saltati: ['2026-11-18: x'] }).testo).toBe('Segnato 1 giorno. Saltati: mer 18/11 (x).');
    expect(messaggioChiusura({ errori: [], conflitti: 1 }, '2026-11-14').testo).toBe(
      'Giornata di sab 14/11 chiusa. 1 richiesta in attesa è passata in conflitto.',
    );
    expect(messaggioChiusura({ errori: ['Campo 1: partita confermata'], conflitti: 0 }, '2026-11-14')).toEqual({
      tono: 'warn',
      testo: 'Chiusura parziale di sab 14/11. Non chiusi: Campo 1: partita confermata.',
    });
    expect(quandoRicorrenza({ giornoSettimana: 2, inizio: '18:00', fine: '19:30' })).toBe('ogni martedì 18:00–19:30');
  });
});

describe('controproposta', () => {
  it('giorni ±3 in ordine di vicinanza, dentro il periodo e da oggi', () => {
    expect(giorniControproposta('2026-11-14', '2026-11-01')).toEqual([
      '2026-11-14',
      '2026-11-13',
      '2026-11-15',
      '2026-11-12',
      '2026-11-16',
      '2026-11-11',
      '2026-11-17',
    ]);
    expect(giorniControproposta('2026-11-14', '2026-11-13', { inizio: '2026-11-01', fine: '2026-11-15' })).toEqual([
      '2026-11-14',
      '2026-11-13',
      '2026-11-15',
    ]);
  });
  it('stato di uno slot lato campo', () => {
    const s = { campoId: 'c1', data: '2026-11-14', inizio: '15:00', fine: '16:30' };
    expect(statoSlotGestore(s, { o: occ({}) }, [], NOW)).toBe('occupato');
    expect(statoSlotGestore(s, {}, [req()], NOW)).toBe('richiesto');
    expect(statoSlotGestore(s, {}, [req({ scadenza: ts(NOW - 1) })], NOW)).toBe('libero');
  });
});

describe('orari e campi', () => {
  it('orari a passi', () => {
    expect(orari('08:00', '09:00', 30)).toEqual(['08:00', '08:30', '09:00']);
    expect(orari('23:30', '24:00', 15)).toEqual(['23:30', '23:45', '24:00']);
  });
  it('intervallo valido', () => {
    expect(erroreIntervallo('10:00', '11:00')).toBeNull();
    expect(erroreIntervallo('11:00', '11:00')).toBe('L’orario di fine deve venire dopo quello di inizio.');
  });
  it('minuto iniziale della giornata', () => {
    expect(minutoIniziale(false, 20 * 60)).toBe(780);
    expect(minutoIniziale(true, 9 * 60)).toBe(780);
    expect(minutoIniziale(true, 18 * 60 + 40)).toBe(18 * 60);
  });
  it('anteprima della griglia', () => {
    expect(iniziGriglia('13:30', '21:00', 90)).toEqual(['13:30', '15:00', '16:30', '18:00', '19:30', '21:00']);
    expect(iniziGriglia('14:00', '13:00', 90)).toEqual([]);
  });
  it('validazione del campo', () => {
    expect(validaCampo(c1)).toEqual({});
    expect(validaCampo({ ...c1, nome: ' ', ultimoSlot: '23:00', giorniAttivi: [] })).toEqual({
      nome: 'Dai un nome al campo.',
      ultimoSlot: 'L’ultima partita finirebbe dopo mezzanotte.',
      giorniAttivi: 'Scegli almeno un giorno in cui il campo è aperto.',
    });
    expect(validaCampo({ ...c1, durata: 5 }).durata).toBeDefined();
  });
  it('id del nuovo campo', () => {
    expect(nuovoIdCampo('Campo Centrale', [])).toBe('campo-centrale');
    expect(nuovoIdCampo('Più bello!', ['piu-bello'])).toBe('piu-bello-2');
    expect(nuovoIdCampo('***', [])).toBe('campo');
  });
  it('partite confermate non più sulla griglia', () => {
    const r = req({ stato: 'confermata', inizio: '13:30', fine: '15:00' });
    expect(confermateFuoriGriglia(c1, [r])).toEqual([]);
    expect(confermateFuoriGriglia({ ...c1, primoSlot: '14:00' }, [r]).map((x) => x.id)).toEqual(['r1']);
  });
  it('date di chiusura ordinate e uniche', () => {
    expect(aggiungiData(['2026-12-25'], '2026-12-08')).toEqual(['2026-12-08', '2026-12-25']);
    expect(aggiungiData(['2026-12-25'], '2026-12-25')).toEqual(['2026-12-25']);
  });
});
