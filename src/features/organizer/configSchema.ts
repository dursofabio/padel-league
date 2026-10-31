import { z } from 'zod';
import type { Tiebreaker, TournamentConfig } from '../../types';

const integer = (min: number, max: number, what: string) =>
  z
    .number({ error: `Inserisci ${what}` })
    .int({ error: 'Usa un numero intero' })
    .min(min, { error: `Minimo ${min}` })
    .max(max, { error: `Massimo ${max}` });

const TIEBREAKERS = ['points', 'headToHead', 'setDiff', 'gameDiff', 'setsWon', 'gamesWon', 'draw'] as const satisfies readonly Tiebreaker[];

/** Configuration form: tournament name + TournamentConfig, with Italian validation messages. */
export const configSchema = z.object({
  name: z.string().trim().min(1, { error: 'Dai un nome al torneo' }).max(80, { error: 'Massimo 80 caratteri' }),
  pointsWin: integer(0, 10, 'i punti per la vittoria'),
  pointsLoss: integer(0, 10, 'i punti per la sconfitta'),
  pointsLossDecidingSet: integer(0, 10, 'il bonus'),
  setFormat: z.object({
    setsToWin: integer(1, 3, 'i set per vincere'),
    superTieBreak: z.boolean(),
  }),
  tiebreakers: z
    .array(z.enum(TIEBREAKERS))
    .min(1)
    .refine((s) => s[0] === 'points', { error: '«Punti» deve restare il primo criterio' })
    .refine((s) => new Set(s).size === s.length, { error: 'Ogni criterio compare una volta sola' }),
  qualificationRule: z.enum(['byPosition', 'crossGroup']),
  finals: z
    .array(
      z.object({
        name: z.string().trim().min(1, { error: 'Dai un nome alla fase' }).max(30, { error: 'Massimo 30 caratteri' }),
        spots: integer(2, 32, 'i posti'),
      }),
    )
    .max(3, { error: 'Al massimo 3 fasi finali' })
    .refine((f) => new Set(f.map((x) => x.name.trim().toLowerCase())).size === f.length, {
      error: 'Due fasi non possono avere lo stesso nome',
    }),
  allowOffGrid: z.boolean(),
  offGridStep: z.union([z.literal(15), z.literal(30)]),
  requestExpiryHours: integer(1, 720, 'le ore'),
  playerCancelHours: integer(0, 168, 'le ore'),
});

export type ConfigForm = z.infer<typeof configSchema>;

export function formFromTournament(name: string, c: TournamentConfig): ConfigForm {
  return {
    name,
    pointsWin: c.pointsWin,
    pointsLoss: c.pointsLoss,
    pointsLossDecidingSet: c.pointsLossDecidingSet,
    setFormat: { ...c.setFormat },
    tiebreakers: c.tiebreakers.length && c.tiebreakers[0] === 'points' ? [...c.tiebreakers] : ['points', ...c.tiebreakers.filter((s) => s !== 'points')],
    qualificationRule: c.qualificationRule,
    finals: c.finals.map((f) => ({ ...f })),
    allowOffGrid: c.allowOffGrid,
    offGridStep: c.offGridStep,
    requestExpiryHours: c.requestExpiryHours,
    playerCancelHours: c.playerCancelHours,
  };
}

export function configFromForm(f: ConfigForm, base: TournamentConfig): { name: string; config: TournamentConfig } {
  const { name, ...rest } = f;
  return {
    name: name.trim(),
    config: { ...base, ...rest, finals: rest.finals.map((x) => ({ name: x.name.trim(), spots: x.spots })) },
  };
}

/** Reorders a tie-break chain; "points" stays first. */
export function moveTiebreaker(list: Tiebreaker[], idx: number, dir: -1 | 1): Tiebreaker[] {
  const j = idx + dir;
  if (idx <= 0 || j <= 0 || j >= list.length) return list;
  const out = [...list];
  [out[idx], out[j]] = [out[j], out[idx]];
  return out;
}
