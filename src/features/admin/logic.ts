import type { Role, UserProfile } from '../../types';

export const ROLES: Role[] = ['player', 'manager', 'organizer', 'admin'];

/** Capitalized role names for the users screen (ROLE_LABEL in lib/copy is lowercase). */
export const ROLE_NAMES: Record<Role, string> = {
  player: 'Giocatore',
  manager: 'Gestore',
  organizer: 'Organizzatore',
  admin: 'Admin',
};

/** New role set after toggling one role: "player" is always kept (roles ≥ {player}), order is stable. */
export function withRole(roles: Role[], role: Role, active: boolean): Role[] {
  const set = new Set<Role>(roles);
  if (active) set.add(role);
  else set.delete(role);
  set.add('player');
  return ROLES.filter((r) => set.has(r));
}

/** Case- and accent-insensitive search on name and email. */
export function searchUsers(users: UserProfile[], text: string): UserProfile[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const t = norm(text.trim());
  if (!t) return users;
  return users.filter((u) => norm(`${u.name} ${u.email}`).includes(t));
}
