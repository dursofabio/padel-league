/**
 * Status glossary: one label, icon and tone per state, used by every screen.
 * Tone = semantic family of the token (ok, warn, danger, info, idle); never colour alone: always icon + text.
 */
import type { ColoreSlot } from './slots';
import type { StatoPartita, StatoRichiesta, TipoOccupazione } from '../types';

export type Tono = 'ok' | 'warn' | 'danger' | 'info' | 'idle';
export type IconaStato =
  | 'calendar-clock'
  | 'send'
  | 'calendar-check'
  | 'trophy'
  | 'flag'
  | 'gavel'
  | 'hourglass'
  | 'circle-check'
  | 'circle-x'
  | 'ban'
  | 'triangle-alert'
  | 'timer-off'
  | 'check'
  | 'circle-dashed'
  | 'lock'
  | 'clock';

export interface Voce {
  label: string;
  icona: IconaStato;
  tono: Tono;
}

export const STATO_PARTITA: Record<StatoPartita, Voce> = {
  'da programmare': { label: 'Da programmare', icona: 'calendar-clock', tono: 'idle' },
  richiesta: { label: 'Richiesta inviata', icona: 'send', tono: 'info' },
  programmata: { label: 'Programmata', icona: 'calendar-check', tono: 'ok' },
  giocata: { label: 'Giocata', icona: 'trophy', tono: 'idle' },
  contestata: { label: 'Contestata', icona: 'flag', tono: 'danger' },
  tavolino: { label: 'Tavolino', icona: 'gavel', tono: 'idle' },
};

export const STATO_RICHIESTA: Record<StatoRichiesta, Voce> = {
  attesa: { label: 'In attesa', icona: 'hourglass', tono: 'info' },
  confermata: { label: 'Confermata', icona: 'circle-check', tono: 'ok' },
  rifiutata: { label: 'Rifiutata', icona: 'circle-x', tono: 'danger' },
  annullata: { label: 'Annullata', icona: 'ban', tono: 'idle' },
  conflitto: { label: 'Conflitto', icona: 'triangle-alert', tono: 'danger' },
  scaduta: { label: 'Scaduta', icona: 'timer-off', tono: 'idle' },
};

export const STATO_SLOT: Record<ColoreSlot, Voce> = {
  verde: { label: '4/4 liberi', icona: 'check', tono: 'ok' },
  giallo: { label: '3/4', icona: 'circle-dashed', tono: 'warn' },
  grigio: { label: '≤2/4', icona: 'circle-dashed', tono: 'idle' },
  rosso: { label: 'Occupato', icona: 'lock', tono: 'danger' },
  blu: { label: 'Richiesto', icona: 'clock', tono: 'info' },
};

export const TIPO_OCCUPAZIONE: Record<TipoOccupazione, string> = {
  esterno: 'Esterno',
  lezione: 'Lezione',
  chiusura: 'Chiuso',
  campionato: 'Partita del campionato',
};
