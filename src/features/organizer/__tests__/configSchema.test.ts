import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULT } from '../../../lib/config';
import { configDaForm, formDaTorneo, schemaConfig, spostaSpareggio } from '../configSchema';

describe('schemaConfig', () => {
  it('accepts the default configuration and round-trips it', () => {
    const f = formDaTorneo('Torneo', CONFIG_DEFAULT);
    expect(schemaConfig.safeParse(f).success).toBe(true);
    expect(configDaForm(f, CONFIG_DEFAULT)).toEqual({ nome: 'Torneo', config: CONFIG_DEFAULT });
  });
  it('rejects invalid values with Italian messages', () => {
    const f = formDaTorneo('', CONFIG_DEFAULT);
    const r = schemaConfig.safeParse({ ...f, spareggi: ['diffSet', 'punti'], fasiFinali: [{ nome: 'Gold', posti: 8 }, { nome: 'gold', posti: 4 }] });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message);
    expect(msgs).toContain('Dai un nome al torneo');
    expect(msgs).toContain('«Punti» deve restare il primo criterio');
    expect(msgs).toContain('Due fasi non possono avere lo stesso nome');
  });
  it('puts punti first when the stored chain lacks it', () => {
    expect(formDaTorneo('T', { ...CONFIG_DEFAULT, spareggi: ['diffSet'] }).spareggi).toEqual(['punti', 'diffSet']);
  });
});

describe('spostaSpareggio', () => {
  it('never moves punti', () => {
    expect(spostaSpareggio(['punti', 'diffSet', 'diffGame'], 2, -1)).toEqual(['punti', 'diffGame', 'diffSet']);
    expect(spostaSpareggio(['punti', 'diffSet'], 1, -1)).toEqual(['punti', 'diffSet']);
    expect(spostaSpareggio(['punti', 'diffSet'], 0, 1)).toEqual(['punti', 'diffSet']);
    expect(spostaSpareggio(['punti', 'diffSet'], 1, 1)).toEqual(['punti', 'diffSet']);
  });
});
