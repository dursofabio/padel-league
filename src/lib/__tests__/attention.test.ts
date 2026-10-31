import { describe, expect, it } from 'vitest';
import { countByRole, deriveAttention, descriviScadenza, istanteRoma, type AttentionInput, type PartitaAttention, type RichiestaAttention } from '../attention';
import { CONFIG_DEFAULT } from '../config';
import type { Periodo, Squadra, Torneo } from '../../types';

// Thursday 12 Nov 2026, 10:00 in Rome (CET, UTC+1)
const NOW = Date.parse('2026-11-12T09:00:00Z');
const TODAY = '2026-11-12';
const ME = 'u1';
const ms = (s: string) => ({ toMillis: () => Date.parse(s) });

const torneo: Torneo = { id: 't', nome: 'T', stato: 'gironi', config: CONFIG_DEFAULT, fasiGenerate: [] };
const P1: Periodo = { id: 'p1', fase: 'gironi', inizio: '2026-11-01', fine: '2026-11-30', etichetta: 'Periodo 1' };
const PVECCHIO: Periodo = { id: 'p0', fase: 'gironi', inizio: '2026-10-01', fine: '2026-11-08', etichetta: 'Periodo 0' };
const PBREVE: Periodo = { id: 'p2', fase: 'gironi', inizio: '2026-11-01', fine: '2026-11-16', etichetta: 'Periodo 2' };

const squadre: Squadra[] = [
  { id: 'sa', nome: 'Rossi/Bianchi', giocatori: [ME, 'u2'], girone: 'A', stato: 'approvata', creatoDa: ME },
  { id: 'sb', nome: 'Verdi/Neri', giocatori: ['u3', 'u4'], girone: 'A', stato: 'approvata', creatoDa: 'u3' },
];

function partita(over: Partial<PartitaAttention> = {}): PartitaAttention {
  return {
    id: 'm1', codice: 'gA-01-1', fase: 'gironi', girone: 'A', turno: 1, squadraA: 'sa', squadraB: 'sb',
    giocatoriA: [ME, 'u2'], giocatoriB: ['u3', 'u4'], giocatori: [ME, 'u2', 'u3', 'u4'], periodoId: 'p1',
    stato: 'da programmare', richiestaId: null, programmazione: null, risultato: null, ...over,
  };
}

function richiesta(over: Partial<RichiestaAttention> = {}, acc: Record<string, boolean> = {}): RichiestaAttention {
  const giocatori = [ME, 'u2', 'u3', 'u4'];
  return {
    id: 'r1', torneoId: 't', partitaId: 'm1', campoId: 'c1', data: '2026-11-14', inizio: '15:30', fine: '17:00',
    fuoriGriglia: false, controproposta: false, giocatori,
    accettazioni: Object.fromEntries(giocatori.map((g) => [g, acc[g] ? ms('2026-11-11T10:00:00Z') : null])),
    stato: 'attesa', scadenza: ms('2026-11-14T09:00:00Z'), creatoDa: 'u3', createdAt: '2026-11-12T08:00:00Z', ...over,
  };
}

function input(over: Partial<AttentionInput> = {}): AttentionInput {
  return {
    now: NOW, today: TODAY, uid: ME, roles: ['giocatore'], torneo, periodi: [P1, PVECCHIO, PBREVE], squadre,
    partite: [], richieste: [], mieFasce: { '2026-11-20': ['18:00-21:00'] }, ...over,
  };
}

const kinds = (i: AttentionInput) => deriveAttention(i).map((x) => x.kind);

describe('deriveAttention', () => {
  it('empty input → []', () => {
    expect(deriveAttention(input({ torneo: null, periodi: [], squadre: [], mieFasce: null }))).toEqual([]);
  });

  it('accetta-richiesta: live request, my acceptance missing', () => {
    const r = richiesta({}, { u3: true });
    const [it] = deriveAttention(input({ partite: [partita({ stato: 'richiesta', richiestaId: 'r1' })], richieste: [r] }));
    expect(it).toMatchObject({ kind: 'accetta-richiesta', priority: 1, action: { type: 'inline', rpc: 'accept_request', id: 'r1' } });
    expect(it.mancanti).toEqual([ME, 'u2', 'u4']);
    expect(it.deadline).toBe('2026-11-14T09:00:00.000Z');
  });

  it('richiesta-in-corso: I accepted, others missing (2) or 4/4 waiting for the court (3)', () => {
    const p = partita({ stato: 'richiesta', richiestaId: 'r1' });
    const parziale = deriveAttention(input({ partite: [p], richieste: [richiesta({}, { [ME]: true, u3: true })] }));
    expect(parziale).toHaveLength(1);
    expect(parziale[0]).toMatchObject({ kind: 'richiesta-in-corso', priority: 2, mancanti: ['u2', 'u4'] });
    const completa = deriveAttention(input({ partite: [p], richieste: [richiesta({}, { [ME]: true, u2: true, u3: true, u4: true })] }));
    expect(completa[0]).toMatchObject({ kind: 'richiesta-in-corso', priority: 3 });
    expect(completa[0].mancanti).toBeUndefined();
  });

  it('lazy expiry: attesa past scadenza → programma-partita with motivo scaduta', () => {
    const r = richiesta({ scadenza: ms('2026-11-12T08:00:00Z') }, { u3: true });
    const [it] = deriveAttention(input({ partite: [partita({ stato: 'richiesta', richiestaId: 'r1' })], richieste: [r] }));
    expect(it).toMatchObject({ kind: 'programma-partita', motivo: 'scaduta' });
  });

  it('programma-partita: motivo from the latest request only', () => {
    const vecchia = richiesta({ id: 'r0', stato: 'rifiutata', createdAt: '2026-11-01T08:00:00Z' });
    const nuova = richiesta({ id: 'r2', stato: 'annullata', createdAt: '2026-11-10T08:00:00Z' });
    const [it] = deriveAttention(input({ partite: [partita()], richieste: [vecchia, nuova] }));
    expect(it.motivo).toBe('annullata');
    const [solo] = deriveAttention(input({ partite: [partita()], richieste: [vecchia] }));
    expect(solo.motivo).toBe('rifiutata');
  });

  it('programma-partita priority by period: 2 far, 1 within 7 days, 0 ended (in-ritardo)', () => {
    expect(deriveAttention(input({ partite: [partita()] }))[0]).toMatchObject({ kind: 'programma-partita', priority: 2 });
    expect(deriveAttention(input({ partite: [partita({ periodoId: 'p2' })], mieFasce: { '2026-11-13': ['18:00-21:00'] } }))[0]).toMatchObject({
      priority: 1,
    });
    const [late] = deriveAttention(input({ partite: [partita({ periodoId: 'p0' })] }));
    expect(late).toMatchObject({ kind: 'programma-partita', priority: 0, motivo: 'in-ritardo' });
  });

  it('programma-partita needs both pairs and 4 players; not for others’ matches', () => {
    expect(kinds(input({ partite: [partita({ squadraB: null, giocatoriB: [] })] }))).toEqual([]);
    expect(kinds(input({ partite: [partita({ giocatoriA: ['x', 'y'] , giocatori: ['x', 'y', 'u3', 'u4'] })] }))).toEqual([]);
  });

  it('conferma-risultato only when the result was entered by the other side', () => {
    const ris = (by: string) => ({ set: [{ a: 6, b: 4 }, { a: 6, b: 3 }], inseritoDa: by, confermatoDa: null });
    const loro = deriveAttention(input({ partite: [partita({ stato: 'programmata', risultato: ris('u3') })] }));
    expect(loro[0]).toMatchObject({ kind: 'conferma-risultato', priority: 1, action: { type: 'inline', rpc: 'confirm_result', id: 'm1' } });
    const mio = deriveAttention(input({ partite: [partita({ stato: 'programmata', risultato: ris('u2') })] }));
    expect(mio[0]).toMatchObject({ kind: 'attesa-conferma-avversari', priority: 3 });
    expect(kinds(input({ partite: [partita({ stato: 'contestata', risultato: { ...ris('u3'), contestatoDa: ME } })] }))).toEqual([]);
    expect(kinds(input({ partite: [partita({ stato: 'giocata', risultato: { ...ris('u3'), confermatoDa: ME } })] }))).toEqual([]);
  });

  it('inserisci-risultato after the scheduled end, not before', () => {
    const prog = (data: string) => ({ campoId: 'c1', data, inizio: '15:30', fine: '17:00' });
    const [it] = deriveAttention(input({ partite: [partita({ stato: 'programmata', programmazione: prog('2026-11-10') })] }));
    expect(it).toMatchObject({ kind: 'inserisci-risultato', action: { type: 'navigate', to: '/t/t/partite/m1#risultato' } });
    // 09:00–10:30 today in Rome is still being played at 10:00 → not yet
    const inCorso = partita({ stato: 'programmata', programmazione: { campoId: 'c1', data: TODAY, inizio: '09:00', fine: '10:30' } });
    expect(kinds(input({ partite: [inCorso] }))).toEqual([]);
  });

  it('prossima-partita within 72 h only', () => {
    const prog = (data: string) => ({ campoId: 'c1', data, inizio: '15:30', fine: '17:00' });
    expect(deriveAttention(input({ partite: [partita({ stato: 'programmata', programmazione: prog('2026-11-14') })] }))[0]).toMatchObject({
      kind: 'prossima-partita', priority: 3,
    });
    expect(kinds(input({ partite: [partita({ stato: 'programmata', programmazione: prog('2026-11-20') })] }))).toEqual([]);
  });

  it('segna-disponibilita: no future dates in the open period; ignores past dates', () => {
    const solo = (f: AttentionInput['mieFasce']) => kinds(input({ partite: [partita()], mieFasce: f }));
    expect(solo(null)).toContain('segna-disponibilita');
    expect(solo({ '2026-11-05': ['18:00-21:00'] })).toContain('segna-disponibilita'); // past date
    expect(solo({ '2026-12-05': ['18:00-21:00'] })).toContain('segna-disponibilita'); // outside the period
    expect(solo({ '2026-11-18': [] })).toContain('segna-disponibilita'); // empty day
    expect(solo({ '2026-11-18': ['18:00-21:00'] })).not.toContain('segna-disponibilita');
    // no item without matches to schedule
    expect(kinds(input({ partite: [], mieFasce: null }))).toEqual([]);
  });

  it('segna-disponibilita for a period far ahead is not urgent and stays below a result to confirm', () => {
    const PFUTURO: Periodo = { id: 'p3', fase: 'gironi', inizio: '2026-12-01', fine: '2026-12-20', etichetta: 'Periodo 3' };
    const PVICINO: Periodo = { id: 'p4', fase: 'gironi', inizio: '2026-11-18', fine: '2026-11-30', etichetta: 'Periodo 4' };
    const items = deriveAttention(
      input({
        periodi: [P1, PFUTURO, PVICINO],
        mieFasce: null,
        partite: [
          partita({ id: 'm1', stato: 'programmata', risultato: { set: [{ a: 6, b: 3 }, { a: 6, b: 4 }], inseritoDa: 'u3', confermatoDa: null } }),
          partita({ id: 'm2', periodoId: 'p3' }),
          partita({ id: 'm3', periodoId: 'p4' }),
        ],
      }),
    );
    expect(items.find((x) => x.id === 'segna-disponibilita:p3')).toMatchObject({ priority: 2 });
    expect(items.find((x) => x.id === 'segna-disponibilita:p4')).toMatchObject({ priority: 1 });
    const pos = (id: string) => items.findIndex((x) => x.id === id);
    expect(pos('conferma-risultato:m1')).toBeGreaterThanOrEqual(0);
    expect(pos('conferma-risultato:m1')).toBeLessThan(pos('segna-disponibilita:p3'));
  });

  it('completa-coppia and coppia-da-approvare', () => {
    const mie: Squadra[] = [{ id: 's1', nome: 'X', giocatori: [ME], stato: 'in attesa partner', creatoDa: ME }];
    expect(deriveAttention(input({ squadre: mie }))[0]).toMatchObject({ kind: 'completa-coppia', priority: 1 });
    expect(kinds(input({ squadre: [{ ...mie[0], creatoDa: 'altro' }] }))).toEqual([]);
    expect(deriveAttention(input({ squadre: [{ ...mie[0], giocatori: [ME, 'u2'], stato: 'da approvare' }] }))[0]).toMatchObject({
      kind: 'coppia-da-approvare', priority: 3,
    });
  });

  it('one item per match: accetta-richiesta wins over conferma-risultato', () => {
    const p = partita({ stato: 'richiesta', richiestaId: 'r1', risultato: { set: [{ a: 6, b: 4 }], inseritoDa: 'u3' } });
    const out = deriveAttention(input({ partite: [p], richieste: [richiesta({}, { u3: true })], mieFasce: { '2026-11-20': ['x'] } }));
    expect(out.map((x) => x.kind)).toEqual(['accetta-richiesta']);
  });

  it('gestore: conferma-richiesta at 4/4 (inline on grid, navigate off grid) and partite-oggi', () => {
    const tutti = { [ME]: true, u2: true, u3: true, u4: true };
    const base = { roles: ['gestore'] as AttentionInput['roles'], uid: 'g1', torneo: null };
    const [inl] = deriveAttention(input({ ...base, richieste: [richiesta({}, tutti)] }));
    expect(inl).toMatchObject({ kind: 'conferma-richiesta', role: 'gestore', action: { type: 'inline', rpc: 'confirm_request' } });
    const [fg] = deriveAttention(input({ ...base, richieste: [richiesta({ fuoriGriglia: true }, tutti)] }));
    expect(fg.action).toEqual({ type: 'navigate', to: '/campo?r=r1' });
    expect(kinds(input({ ...base, richieste: [richiesta({}, { u2: true })] }))).toEqual([]);
    const oggi = deriveAttention(input({ ...base, richieste: [richiesta({ id: 'a', stato: 'confermata', data: TODAY }), richiesta({ id: 'b', stato: 'confermata', data: TODAY })] }));
    expect(oggi[0]).toMatchObject({ kind: 'partite-oggi', count: 2, action: { to: '/campo/giorno/2026-11-12' } });
  });

  it('admin without gestore/organizzatore roles gets no gestore or organizer items', () => {
    const tutti = { [ME]: true, u2: true, u3: true, u4: true };
    const out = deriveAttention(
      input({ uid: 'adm', roles: ['admin'], richieste: [richiesta({}, tutti)], partite: [partita({ stato: 'contestata' })],
        squadre: [{ id: 'x', nome: 'X', giocatori: ['a', 'b'], stato: 'da approvare', creatoDa: 'a' }] }),
    );
    expect(out).toEqual([]);
  });

  it('organizer items', () => {
    const ris = { set: [{ a: 6, b: 4 }], inseritoDa: 'u3', confermatoDa: null };
    const org = input({
      uid: 'org', roles: ['organizzatore'],
      squadre: [...squadre, { id: 'sx', nome: 'Nuovi', giocatori: ['a', 'b'], stato: 'da approvare', creatoDa: 'a' }],
      partite: [
        partita({ id: 'c', stato: 'contestata' }),
        partita({ id: 'late', periodoId: 'p0' }),
        partita({ id: 'soon', periodoId: 'p2' }),
        partita({ id: 'far', periodoId: 'p1' }),
        partita({ id: 'old', stato: 'programmata', risultato: ris, updatedAt: '2026-11-09T09:00:00Z' }),
        partita({ id: 'fresh', stato: 'programmata', risultato: ris, updatedAt: '2026-11-12T08:00:00Z' }),
      ],
    });
    const out = deriveAttention(org);
    const by = Object.fromEntries(out.map((x) => [x.id, x]));
    expect(by['risultato-contestato:c']).toMatchObject({ priority: 1 });
    expect(by['squadra-da-approvare:sx']).toMatchObject({ action: { type: 'inline', rpc: 'approve_team', id: 'sx' } });
    expect(by['partite-in-ritardo:p0']).toMatchObject({ count: 1, action: { to: '/t/t/organizza/monitoraggio?periodo=p0' } });
    expect(by['periodo-in-scadenza:p2']).toMatchObject({ count: 1, priority: 2 });
    expect(by['periodo-in-scadenza:p1']).toBeUndefined(); // ends in 18 days
    expect(by['risultati-non-confermati:t']).toMatchObject({ count: 1 });
    expect(by['passo-torneo:approva-squadre']).toMatchObject({ passo: 'approva-squadre', count: 1, action: { to: '/t/t/organizza/squadre' } });
    expect(out.every((x) => x.role === 'organizzatore')).toBe(true);
  });

  it('24 h promotion to Urgente', () => {
    const r = richiesta({ scadenza: ms('2026-11-13T08:00:00Z') }, { u3: true }); // 23 h left
    expect(deriveAttention(input({ partite: [partita({ stato: 'richiesta', richiestaId: 'r1' })], richieste: [r] }))[0]).toMatchObject({
      kind: 'accetta-richiesta', priority: 0,
    });
    // 'Per sapere' items are never promoted
    const tutti = { [ME]: true, u2: true, u3: true, u4: true };
    const r4 = richiesta({ scadenza: ms('2026-11-12T12:00:00Z') }, tutti);
    expect(deriveAttention(input({ partite: [partita({ stato: 'richiesta', richiestaId: 'r1' })], richieste: [r4] }))[0].priority).toBe(3);
  });

  it('multi-role merge: sorted by priority, deadline, kind order, id; deterministic', () => {
    const tutti = { [ME]: true, u2: true, u3: true, u4: true };
    const gest = richiesta({ id: 'rg', partitaId: 'm9', scadenza: ms('2026-11-15T09:00:00Z') }, tutti);
    const mia = richiesta({ id: 'r1', scadenza: ms('2026-11-16T09:00:00Z') }, { u3: true });
    const i = input({
      roles: ['giocatore', 'gestore', 'organizzatore'],
      partite: [partita({ stato: 'richiesta', richiestaId: 'r1' }), partita({ id: 'm2', stato: 'contestata', giocatoriA: ['x', 'y'], giocatoriB: ['w', 'z'] })],
      richieste: [mia, gest],
    });
    const out = deriveAttention(i);
    expect(out.map((x) => x.id)).toEqual([
      'conferma-richiesta:rg', // priority 1, deadline 15/11
      'accetta-richiesta:r1', // priority 1, deadline 16/11
      'risultato-contestato:m2', // priority 1, no deadline
    ]);
    expect(deriveAttention(i)).toEqual(out);
    expect(countByRole(out)).toEqual({ giocatore: 1, gestore: 1, organizzatore: 1 });
  });
});

describe('descriviScadenza', () => {
  const at = (date: string, hhmm: string) => new Date(istanteRoma(date, hhmm)).toISOString();
  it('speaks in words', () => {
    expect(descriviScadenza(at(TODAY, '10:45'), NOW)).toBe('scade tra 45 min');
    expect(descriviScadenza(at(TODAY, '15:10'), NOW)).toBe('scade tra 5 h');
    expect(descriviScadenza(at('2026-11-13', '18:30'), NOW)).toBe('scade domani alle 18:30');
    expect(descriviScadenza(at('2026-11-14', '23:59'), NOW)).toBe('entro sab 14/11');
    expect(descriviScadenza(at('2026-11-10', '23:59'), NOW)).toBe('in ritardo dal 10/11');
  });
  it('istanteRoma handles CET and CEST', () => {
    expect(new Date(istanteRoma('2026-11-14', '15:30')).toISOString()).toBe('2026-11-14T14:30:00.000Z');
    expect(new Date(istanteRoma('2026-07-14', '15:30')).toISOString()).toBe('2026-07-14T13:30:00.000Z');
  });
});
