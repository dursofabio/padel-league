import { useLocation } from 'react-router-dom';
import { useTornei } from '../data/queries';

/**
 * Current tournament: the one in the URL (/t/:tid), otherwise the most recent not yet finished.
 * Today there is one tournament at a time, but the model does not rule out several.
 */
export function useTorneoCorrente() {
  // also works from the shell (layout), where the child route's params are not available
  const tid = useLocation().pathname.match(/^\/t\/([^/]+)/)?.[1];
  const tornei = useTornei();
  const attivo = tornei.data?.find((t) => t.stato !== 'concluso') ?? tornei.data?.[0];
  const id = tid ?? attivo?.id;
  return { tid: id, torneo: tornei.data?.find((t) => t.id === id), tornei: tornei.data ?? [], isPending: tornei.isPending };
}
