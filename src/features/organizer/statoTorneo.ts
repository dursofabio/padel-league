import { rpc } from '../../data/supabase';
import type { StatoTorneo } from '../../types';

/**
 * Local wrapper of the set_tournament_state RPC (docs/contratto-api.md), not yet in src/data/mutations.ts.
 * TODO(lead): move to `azioni.impostaStatoTorneo` and import it from there.
 */
export const impostaStatoTorneo = (a: { torneo: string; stato: StatoTorneo }) =>
  rpc('set_tournament_state', { p_torneo: a.torneo, p_stato: a.stato });
