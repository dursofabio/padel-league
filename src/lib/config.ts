import type { TournamentConfig } from '../types';

/** Default tournament configuration (open points of the spec: the organizer can change it). */
export const DEFAULT_CONFIG: TournamentConfig = {
  pointsWin: 3,
  pointsLoss: 0,
  pointsLossDecidingSet: 1,
  setFormat: { setsToWin: 2, superTieBreak: true },
  tiebreakers: ['points', 'headToHead', 'setDiff', 'gameDiff', 'draw'],
  qualificationRule: 'byPosition',
  finals: [
    { name: 'Gold', spots: 8 },
    { name: 'Silver', spots: 8 },
  ],
  allowOffGrid: true,
  offGridStep: 30,
  requestExpiryHours: 48,
  playerCancelHours: 24,
};

/** Completes a saved (possibly partial) configuration with the defaults. */
export function withDefaultConfig(c: Partial<TournamentConfig> | null | undefined): TournamentConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(c ?? {}),
    setFormat: { ...DEFAULT_CONFIG.setFormat, ...(c?.setFormat ?? {}) },
  };
}
