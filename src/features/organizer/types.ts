import type { useTournamentData } from '../../data/queries';
import type { Tournament } from '../../types';

/** Tournament data shared by every organizer section (loaded once by OrganizerPage). */
export type TournamentData = Omit<ReturnType<typeof useTournamentData>, 'tournament'> & { tournament: Tournament };

export interface SectionProps {
  d: TournamentData;
}
