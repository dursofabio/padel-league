import type { Match, Team, Tournament } from '../types';
import { groupStandings, type StandingsRow } from './standings';

/** Group names in use, sorted. */
export function groups(teams: Team[]): string[] {
  return [...new Set(teams.map((t) => t.group).filter((g): g is string => !!g))].sort();
}

/** Standings of every group, derived from official results (never stored). */
export function tournamentStandings(tournament: Tournament, teams: Team[], matches: Match[]): Record<string, StandingsRow[]> {
  const out: Record<string, StandingsRow[]> = {};
  for (const g of groups(teams)) {
    const ids = teams
      .filter((t) => t.group === g && t.status !== 'pending_approval' && t.status !== 'awaiting_partner')
      .map((t) => t.id);
    const gm = matches.filter((m) => m.phase === 'groups' && m.group === g);
    out[g] = groupStandings(g, ids, gm, tournament.config, tournament.draw ?? {});
  }
  return out;
}

export function groupsCompleted(matches: Match[]): boolean {
  const gm = matches.filter((m) => m.phase === 'groups');
  return gm.length > 0 && gm.every((m) => m.status === 'played' || m.status === 'forfeit');
}

export function teamName(byId: Map<string, Team>, id: string | null | undefined): string {
  if (!id) return 'da definire';
  return byId.get(id)?.name ?? '…';
}
