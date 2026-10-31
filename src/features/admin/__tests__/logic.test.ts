import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../../../types';
import { searchUsers, withRole } from '../logic';

describe('withRole', () => {
  it('always keeps player and a stable order', () => {
    expect(withRole(['player'], 'admin', true)).toEqual(['player', 'admin']);
    expect(withRole(['admin', 'player', 'manager'], 'manager', false)).toEqual(['player', 'admin']);
    expect(withRole([], 'player', false)).toEqual(['player']);
  });
});

describe('searchUsers', () => {
  const u = (name: string, email: string): UserProfile => ({ id: name, name, email, roles: ['player'] });
  const list = [u('Niccolò Rossi', 'nr@x.it'), u('Marta Bianchi', 'marta@y.it')];
  it('matches name or email ignoring case and accents', () => {
    expect(searchUsers(list, 'niccolo').map((x) => x.id)).toEqual(['Niccolò Rossi']);
    expect(searchUsers(list, 'Y.IT').map((x) => x.id)).toEqual(['Marta Bianchi']);
    expect(searchUsers(list, '  ')).toHaveLength(2);
  });
});
