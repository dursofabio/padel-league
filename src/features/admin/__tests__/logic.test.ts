import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../../../types';
import { cercaUtenti, conRuolo } from '../logic';

describe('conRuolo', () => {
  it('always keeps giocatore and a stable order', () => {
    expect(conRuolo(['giocatore'], 'admin', true)).toEqual(['giocatore', 'admin']);
    expect(conRuolo(['admin', 'giocatore', 'gestore'], 'gestore', false)).toEqual(['giocatore', 'admin']);
    expect(conRuolo([], 'giocatore', false)).toEqual(['giocatore']);
  });
});

describe('cercaUtenti', () => {
  const u = (nome: string, email: string): UserProfile => ({ id: nome, nome, email, roles: ['giocatore'] });
  const lista = [u('Niccolò Rossi', 'nr@x.it'), u('Marta Bianchi', 'marta@y.it')];
  it('matches name or email ignoring case and accents', () => {
    expect(cercaUtenti(lista, 'niccolo').map((x) => x.id)).toEqual(['Niccolò Rossi']);
    expect(cercaUtenti(lista, 'Y.IT').map((x) => x.id)).toEqual(['Marta Bianchi']);
    expect(cercaUtenti(lista, '  ')).toHaveLength(2);
  });
});
