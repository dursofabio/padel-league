import { z } from 'zod';
import type { Spareggio, TorneoConfig } from '../../types';

const intero = (min: number, max: number, cosa: string) =>
  z
    .number({ error: `Inserisci ${cosa}` })
    .int({ error: 'Usa un numero intero' })
    .min(min, { error: `Minimo ${min}` })
    .max(max, { error: `Massimo ${max}` });

const SPAREGGI = ['punti', 'scontroDiretto', 'diffSet', 'diffGame', 'setVinti', 'gameVinti', 'sorteggio'] as const satisfies readonly Spareggio[];

/** Configuration form: tournament name + TorneoConfig, with Italian validation messages. */
export const schemaConfig = z.object({
  nome: z.string().trim().min(1, { error: 'Dai un nome al torneo' }).max(80, { error: 'Massimo 80 caratteri' }),
  puntiVittoria: intero(0, 10, 'i punti per la vittoria'),
  puntiSconfitta: intero(0, 10, 'i punti per la sconfitta'),
  puntiSconfittaSetDecisivo: intero(0, 10, 'il bonus'),
  formatoSet: z.object({
    setPerVincere: intero(1, 3, 'i set per vincere'),
    superTieBreak: z.boolean(),
  }),
  spareggi: z
    .array(z.enum(SPAREGGI))
    .min(1)
    .refine((s) => s[0] === 'punti', { error: '«Punti» deve restare il primo criterio' })
    .refine((s) => new Set(s).size === s.length, { error: 'Ogni criterio compare una volta sola' }),
  criterioQualificazione: z.enum(['perPosizione', 'avulsa']),
  fasiFinali: z
    .array(
      z.object({
        nome: z.string().trim().min(1, { error: 'Dai un nome alla fase' }).max(30, { error: 'Massimo 30 caratteri' }),
        posti: intero(2, 32, 'i posti'),
      }),
    )
    .max(3, { error: 'Al massimo 3 fasi finali' })
    .refine((f) => new Set(f.map((x) => x.nome.trim().toLowerCase())).size === f.length, {
      error: 'Due fasi non possono avere lo stesso nome',
    }),
  consentiFuoriGriglia: z.boolean(),
  passoFuoriGriglia: z.union([z.literal(15), z.literal(30)]),
  scadenzaRichiesteOre: intero(1, 720, 'le ore'),
  annullamentoGiocatoreOre: intero(0, 168, 'le ore'),
});

export type FormConfig = z.infer<typeof schemaConfig>;

export function formDaTorneo(nome: string, c: TorneoConfig): FormConfig {
  return {
    nome,
    puntiVittoria: c.puntiVittoria,
    puntiSconfitta: c.puntiSconfitta,
    puntiSconfittaSetDecisivo: c.puntiSconfittaSetDecisivo,
    formatoSet: { ...c.formatoSet },
    spareggi: c.spareggi.length && c.spareggi[0] === 'punti' ? [...c.spareggi] : ['punti', ...c.spareggi.filter((s) => s !== 'punti')],
    criterioQualificazione: c.criterioQualificazione,
    fasiFinali: c.fasiFinali.map((f) => ({ ...f })),
    consentiFuoriGriglia: c.consentiFuoriGriglia,
    passoFuoriGriglia: c.passoFuoriGriglia,
    scadenzaRichiesteOre: c.scadenzaRichiesteOre,
    annullamentoGiocatoreOre: c.annullamentoGiocatoreOre,
  };
}

export function configDaForm(f: FormConfig, base: TorneoConfig): { nome: string; config: TorneoConfig } {
  const { nome, ...resto } = f;
  return {
    nome: nome.trim(),
    config: { ...base, ...resto, fasiFinali: resto.fasiFinali.map((x) => ({ nome: x.nome.trim(), posti: x.posti })) },
  };
}

/** Reorders a tie-break chain; "punti" stays first. */
export function spostaSpareggio(lista: Spareggio[], idx: number, dir: -1 | 1): Spareggio[] {
  const j = idx + dir;
  if (idx <= 0 || j <= 0 || j >= lista.length) return lista;
  const out = [...lista];
  [out[idx], out[j]] = [out[j], out[idx]];
  return out;
}
