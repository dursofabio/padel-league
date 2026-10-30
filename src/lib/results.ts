import type { FormatoSet, Partita, SetScore } from '../types';

export interface EsitoValidazione {
  ok: boolean;
  errore?: string;
  vincitore?: 'A' | 'B';
}

function setNormaleValido(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === 6) return lo <= 4;
  if (hi === 7) return lo === 5 || lo === 6;
  return false;
}

function superTieBreakValido(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi < 10 || hi - lo < 2) return false;
  return hi === 10 || hi - lo === 2;
}

export function isSetDecisivo(index: number, formato: FormatoSet): boolean {
  return index === formato.setPerVincere * 2 - 2;
}

export function validaRisultato(set: SetScore[], formato: FormatoSet): EsitoValidazione {
  const max = formato.setPerVincere * 2 - 1;
  if (set.length === 0) return { ok: false, errore: 'Inserisci almeno un set' };
  if (set.length > max) return { ok: false, errore: `Al massimo ${max} set` };
  let va = 0;
  let vb = 0;
  for (let i = 0; i < set.length; i++) {
    const { a, b } = set[i];
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0)
      return { ok: false, errore: `Set ${i + 1}: punteggio non valido` };
    if (va === formato.setPerVincere || vb === formato.setPerVincere)
      return { ok: false, errore: 'La partita era già finita prima di questo set' };
    const stb = formato.superTieBreak && isSetDecisivo(i, formato);
    const valido = stb ? superTieBreakValido(a, b) : setNormaleValido(a, b);
    if (!valido)
      return {
        ok: false,
        errore: stb
          ? `Set ${i + 1}: super tie-break non valido (a 10, con 2 punti di scarto)`
          : `Set ${i + 1}: punteggio non valido (6-0…6-4, 7-5, 7-6)`,
      };
    if (a > b) va++;
    else vb++;
  }
  if (va < formato.setPerVincere && vb < formato.setPerVincere)
    return { ok: false, errore: 'La partita non è conclusa' };
  return { ok: true, vincitore: va > vb ? 'A' : 'B' };
}

export interface Stat {
  setA: number;
  setB: number;
  gameA: number;
  gameB: number;
  vincitore: 'A' | 'B';
  setDecisivo: boolean;
}

/** Il super tie-break conta come un set vinto e un game. */
export function statistiche(set: SetScore[], formato: FormatoSet): Stat {
  let setA = 0, setB = 0, gameA = 0, gameB = 0;
  set.forEach(({ a, b }, i) => {
    if (a > b) setA++;
    else setB++;
    if (formato.superTieBreak && isSetDecisivo(i, formato)) {
      if (a > b) gameA++;
      else gameB++;
    } else {
      gameA += a;
      gameB += b;
    }
  });
  return {
    setA, setB, gameA, gameB,
    vincitore: setA > setB ? 'A' : 'B',
    setDecisivo: set.length === formato.setPerVincere * 2 - 1,
  };
}

/** Solo i risultati confermati (o assegnati a tavolino) contano. */
export function risultatoUfficiale(p: Partita): boolean {
  return (p.stato === 'giocata' || p.stato === 'tavolino') && !!p.risultato?.set?.length;
}

export function vincitore(p: Partita, formato: FormatoSet): string | null {
  if (!risultatoUfficiale(p)) return null;
  return statistiche(p.risultato!.set, formato).vincitore === 'A' ? p.squadraA : p.squadraB;
}

export function formatRisultato(set: SetScore[] | undefined): string {
  return (set ?? []).map((s) => `${s.a}-${s.b}`).join(' ');
}
