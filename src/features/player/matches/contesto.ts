import type { Campo, Partita, Periodo, Torneo } from '../../../types';

/** Everything the blocks of the match page share (built once in PartitaPage). */
export interface ContestoPartita {
  tid: string;
  partita: Partita;
  torneo: Torneo;
  periodo: Periodo | null;
  campi: Campo[];
  /** Player name ("…" while loading). */
  nome: (uid: string | null | undefined) => string;
  /** Pair names. */
  nomeA: string;
  nomeB: string;
  uid: string | null;
  /** My side in this match, null if I don't play it. */
  mioLato: 'A' | 'B' | null;
  /** Phone of a player, if known (WhatsApp direct link). */
  telefono: (uid: string) => string | undefined;
  /** Phone of a court manager, if any profile has one. */
  telefonoGestore?: string;
  /** Absolute link to this match. */
  link: string;
  /** "Rossi/Bianchi – Verdi/Neri" */
  titolo: string;
}

export function nomeCampo(campi: Campo[], id: string): string {
  return campi.find((c) => c.id === id)?.nome ?? id;
}
