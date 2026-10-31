import { describe, expect, it } from 'vitest';
import { normalizePhone, profileSchema } from '../logic';

describe('profile', () => {
  it('normalizes phone numbers', () => {
    expect(normalizePhone(' +39 333-123 4567 ')).toBe('+393331234567');
    expect(normalizePhone('')).toBeNull();
  });
  it('validates name and optional phone', () => {
    expect(profileSchema.safeParse({ name: 'Luca Neri', phone: '' }).success).toBe(true);
    expect(profileSchema.safeParse({ name: 'Luca Neri', phone: '+39 333 123 4567' }).success).toBe(true);
    expect(profileSchema.safeParse({ name: 'L', phone: '' }).success).toBe(false);
    expect(profileSchema.safeParse({ name: 'Luca', phone: 'abc' }).success).toBe(false);
  });
});
