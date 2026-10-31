import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../lib/config';
import { configFromForm, configSchema, formFromTournament, moveTiebreaker } from '../configSchema';

describe('configSchema', () => {
  it('accepts the default configuration and round-trips it', () => {
    const f = formFromTournament('Torneo', DEFAULT_CONFIG);
    expect(configSchema.safeParse(f).success).toBe(true);
    expect(configFromForm(f, DEFAULT_CONFIG)).toEqual({ name: 'Torneo', config: DEFAULT_CONFIG });
  });
  it('rejects invalid values with Italian messages', () => {
    const f = formFromTournament('', DEFAULT_CONFIG);
    const r = configSchema.safeParse({ ...f, tiebreakers: ['setDiff', 'points'], finals: [{ name: 'Gold', spots: 8 }, { name: 'gold', spots: 4 }] });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message);
    expect(msgs).toContain('Dai un nome al torneo');
    expect(msgs).toContain('«Punti» deve restare il primo criterio');
    expect(msgs).toContain('Due fasi non possono avere lo stesso nome');
  });
  it('puts points first when the stored chain lacks it', () => {
    expect(formFromTournament('T', { ...DEFAULT_CONFIG, tiebreakers: ['setDiff'] }).tiebreakers).toEqual(['points', 'setDiff']);
  });
});

describe('moveTiebreaker', () => {
  it('never moves points', () => {
    expect(moveTiebreaker(['points', 'setDiff', 'gameDiff'], 2, -1)).toEqual(['points', 'gameDiff', 'setDiff']);
    expect(moveTiebreaker(['points', 'setDiff'], 1, -1)).toEqual(['points', 'setDiff']);
    expect(moveTiebreaker(['points', 'setDiff'], 0, 1)).toEqual(['points', 'setDiff']);
    expect(moveTiebreaker(['points', 'setDiff'], 1, 1)).toEqual(['points', 'setDiff']);
  });
});
