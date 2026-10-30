import type { useTorneoData } from '../../data/queries';
import type { Torneo } from '../../types';

/** Tournament data shared by every organizer section (loaded once by OrganizzaPage). */
export type DatiTorneo = Omit<ReturnType<typeof useTorneoData>, 'torneo'> & { torneo: Torneo };

export interface PropsSezione {
  d: DatiTorneo;
}
