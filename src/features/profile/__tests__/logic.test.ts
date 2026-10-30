import { describe, expect, it } from 'vitest';
import { normalizzaTelefono, schemaProfilo } from '../logic';

describe('profile', () => {
  it('normalizes phone numbers', () => {
    expect(normalizzaTelefono(' +39 333-123 4567 ')).toBe('+393331234567');
    expect(normalizzaTelefono('')).toBeNull();
  });
  it('validates name and optional phone', () => {
    expect(schemaProfilo.safeParse({ nome: 'Luca Neri', telefono: '' }).success).toBe(true);
    expect(schemaProfilo.safeParse({ nome: 'Luca Neri', telefono: '+39 333 123 4567' }).success).toBe(true);
    expect(schemaProfilo.safeParse({ nome: 'L', telefono: '' }).success).toBe(false);
    expect(schemaProfilo.safeParse({ nome: 'Luca', telefono: 'abc' }).success).toBe(false);
  });
});
