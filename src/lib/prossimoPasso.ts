import { derivaTabellone } from './bracket';
import { gironiConclusi } from './torneo';
import type { Partita, Periodo, Squadra, Torneo } from '../types';

export type PassoTorneo =
  | { id: 'periodi'; label: string; sezione: 'periodi' }
  | { id: 'approva-squadre'; label: string; sezione: 'squadre'; n: number }
  | { id: 'gironi'; label: string; sezione: 'squadre'; n: number }
  | { id: 'calendario'; label: string; sezione: 'calendario' }
  | { id: 'finali'; label: string; sezione: 'finali' }
  | { id: 'sincronizza'; label: string; sezione: 'finali'; n: number };

/**
 * The organizer's single next step (Panoramica and the Da fare feed). The first condition that matches wins;
 * null = everything in order. See docs/ux/organizzatore.md.
 */
export function prossimoPasso(torneo: Torneo, periodi: Periodo[], squadre: Squadra[], partite: Partita[]): PassoTorneo | null {
  if (torneo.stato === 'concluso') return null;
  if (!periodi.some((p) => p.fase === 'gironi')) return { id: 'periodi', label: 'Aggiungi il periodo dei gironi', sezione: 'periodi' };
  const daApprovare = squadre.filter((s) => s.stato === 'da approvare').length;
  if (daApprovare)
    return { id: 'approva-squadre', label: `Approva ${daApprovare} ${daApprovare === 1 ? 'coppia' : 'coppie'}`, sezione: 'squadre', n: daApprovare };
  const gironi = partite.filter((p) => p.fase === 'gironi');
  if (!gironi.length) {
    const senzaGirone = squadre.filter((s) => s.stato === 'approvata' && !s.girone).length;
    if (senzaGirone) return { id: 'gironi', label: 'Componi i gironi', sezione: 'squadre', n: senzaGirone };
    return { id: 'calendario', label: 'Genera il calendario', sezione: 'calendario' };
  }
  const generate = torneo.fasiGenerate ?? [];
  if (gironiConclusi(partite) && torneo.config.fasiFinali.some((f) => !generate.includes(f.nome.toLowerCase())))
    return { id: 'finali', label: 'Genera le fasi finali', sezione: 'finali' };
  if (generate.length) {
    const finali = partite.filter((p) => generate.includes(p.fase));
    const der = derivaTabellone(finali, torneo.config.formatoSet);
    const n = finali.filter((p) => {
      const d = der.get(p.id);
      return p.stato === 'da programmare' && d && (d.squadraA !== p.squadraA || d.squadraB !== p.squadraB);
    }).length;
    if (n) return { id: 'sincronizza', label: 'Aggiorna i tabelloni', sezione: 'finali', n };
  }
  return null;
}
