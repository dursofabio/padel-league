import type { Role, UserProfile } from '../../types';

export const RUOLI: Role[] = ['giocatore', 'gestore', 'organizzatore', 'admin'];

export const NOMI_RUOLO: Record<Role, string> = {
  giocatore: 'Giocatore',
  gestore: 'Gestore',
  organizzatore: 'Organizzatore',
  admin: 'Admin',
};

/** New role set after toggling one role: "giocatore" is always kept (roles ≥ {giocatore}), order is stable. */
export function conRuolo(ruoli: Role[], ruolo: Role, attivo: boolean): Role[] {
  const set = new Set<Role>(ruoli);
  if (attivo) set.add(ruolo);
  else set.delete(ruolo);
  set.add('giocatore');
  return RUOLI.filter((r) => set.has(r));
}

/** Case- and accent-insensitive search on name and email. */
export function cercaUtenti(utenti: UserProfile[], testo: string): UserProfile[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const t = norm(testo.trim());
  if (!t) return utenti;
  return utenti.filter((u) => norm(`${u.nome} ${u.email}`).includes(t));
}
