import type { TorneoConfig } from '../types';

/** Configurazione di default di un torneo (punti aperti delle specifiche: modificabile dall'organizzatore). */
export const CONFIG_DEFAULT: TorneoConfig = {
  puntiVittoria: 3,
  puntiSconfitta: 0,
  puntiSconfittaSetDecisivo: 1,
  formatoSet: { setPerVincere: 2, superTieBreak: true },
  spareggi: ['punti', 'scontroDiretto', 'diffSet', 'diffGame', 'sorteggio'],
  criterioQualificazione: 'perPosizione',
  fasiFinali: [
    { nome: 'Gold', posti: 8 },
    { nome: 'Silver', posti: 8 },
  ],
  consentiFuoriGriglia: true,
  passoFuoriGriglia: 30,
  scadenzaRichiesteOre: 48,
  annullamentoGiocatoreOre: 24,
};

/** Completa una configurazione salvata (anche parziale) con i default. */
export function conConfigDefault(c: Partial<TorneoConfig> | null | undefined): TorneoConfig {
  return {
    ...CONFIG_DEFAULT,
    ...(c ?? {}),
    formatoSet: { ...CONFIG_DEFAULT.formatoSet, ...(c?.formatoSet ?? {}) },
  };
}
