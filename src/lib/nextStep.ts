import { deriveBracket } from './bracket';
import { groupsCompleted } from './tournament';
import type { Match, Period, Team, Tournament } from '../types';

/**
 * `section` is the organizer area's URL segment (/t/:tid/organizza/:section), so its values stay Italian.
 */
export type TournamentStep =
  | { id: 'periods'; label: string; section: 'periodi' }
  | { id: 'approve-teams'; label: string; section: 'squadre'; n: number }
  | { id: 'groups'; label: string; section: 'squadre'; n: number }
  | { id: 'schedule'; label: string; section: 'calendario' }
  | { id: 'finals'; label: string; section: 'finali' }
  | { id: 'sync'; label: string; section: 'finali'; n: number };

export type TournamentStepId = TournamentStep['id'];

/**
 * The organizer's single next step (overview and the to-do feed). The first condition that matches wins;
 * null = everything in order. See docs/ux/organizzatore.md.
 */
export function nextStep(tournament: Tournament, periods: Period[], teams: Team[], matches: Match[]): TournamentStep | null {
  if (tournament.status === 'completed') return null;
  if (!periods.some((p) => p.phase === 'groups')) return { id: 'periods', label: 'Aggiungi il periodo dei gironi', section: 'periodi' };
  const toApprove = teams.filter((t) => t.status === 'pending_approval').length;
  if (toApprove)
    return { id: 'approve-teams', label: `Approva ${toApprove} ${toApprove === 1 ? 'coppia' : 'coppie'}`, section: 'squadre', n: toApprove };
  const groupMatches = matches.filter((m) => m.phase === 'groups');
  if (!groupMatches.length) {
    const withoutGroup = teams.filter((t) => t.status === 'approved' && !t.group).length;
    if (withoutGroup) return { id: 'groups', label: 'Componi i gironi', section: 'squadre', n: withoutGroup };
    return { id: 'schedule', label: 'Genera il calendario', section: 'calendario' };
  }
  const generated = tournament.generatedPhases ?? [];
  if (groupsCompleted(matches) && tournament.config.finals.some((f) => !generated.includes(f.name.toLowerCase())))
    return { id: 'finals', label: 'Genera le fasi finali', section: 'finali' };
  if (generated.length) {
    const finals = matches.filter((m) => generated.includes(m.phase));
    const derived = deriveBracket(finals, tournament.config.setFormat);
    const n = finals.filter((m) => {
      const d = derived.get(m.id);
      return m.status === 'unscheduled' && d && (d.teamA !== m.teamA || d.teamB !== m.teamB);
    }).length;
    if (n) return { id: 'sync', label: 'Aggiorna i tabelloni', section: 'finali', n };
  }
  return null;
}
