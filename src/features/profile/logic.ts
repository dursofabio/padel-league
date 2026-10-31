import { z } from 'zod';

/** "+39 333 123 4567" → "+393331234567"; empty → null. */
export function normalizePhone(t: string | null | undefined): string | null {
  const s = (t ?? '').replace(/[\s.\-/()]/g, '');
  return s ? s : null;
}

export const profileSchema = z.object({
  name: z.string().trim().min(2, { error: 'Scrivi nome e cognome' }).max(60, { error: 'Massimo 60 caratteri' }),
  phone: z.string().refine((t) => {
    const n = normalizePhone(t);
    return n === null || /^\+?\d{6,15}$/.test(n);
  }, { error: 'Numero non valido: usa solo cifre, con il prefisso (es. +39 333 123 4567)' }),
});

export type ProfileForm = z.infer<typeof profileSchema>;
