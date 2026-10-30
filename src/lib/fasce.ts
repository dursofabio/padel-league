/**
 * Fasce di disponibilità: logica pura dell'editor (fusione, rimozione, copia sullo stesso giorno della settimana,
 * preset, validazione). Una fascia è la stringa "hh:mm-hh:mm"; `Fasce` = data -> lista ordinata e senza sovrapposizioni.
 */
import type { Fasce, Partita, Periodo, TorneoConfig } from '../types';
import { addDays, formatFascia, fromMin, parseFascia, toMin, weekday } from './time';

/** Preset fissi (ASSUNZIONE D1). */
export const PRESET_FASCE: { nome: string; da: string; a: string }[] = [
  { nome: 'Pausa pranzo', da: '12:00', a: '15:00' },
  { nome: 'Pomeriggio', da: '14:00', a: '18:30' },
  { nome: 'Sera', da: '18:00', a: '23:00' },
  { nome: 'Tutto il giorno', da: '08:00', a: '23:00' },
];

/** Limiti della giornata selezionabile (ASSUNZIONE D2). */
export const INIZIO_GIORNATA = '08:00';
export const FINE_GIORNATA = '24:00';

/** Passo delle select: 15' solo se il torneo consente il fuori griglia con passo 15, altrimenti 30'. */
export function passoOrari(config: Pick<TorneoConfig, 'consentiFuoriGriglia' | 'passoFuoriGriglia'> | undefined): 15 | 30 {
  return config?.consentiFuoriGriglia && config.passoFuoriGriglia === 15 ? 15 : 30;
}

/** Orari selezionabili da 08:00 a 24:00 inclusi, al passo dato. */
export function orariSelezionabili(passo: number): string[] {
  const out: string[] = [];
  for (let m = toMin(INIZIO_GIORNATA); m <= toMin(FINE_GIORNATA); m += passo) out.push(fromMin(m));
  return out;
}

/** Messaggio d'errore in italiano, o null se la fascia è valida. */
export function validaFascia(da: string, a: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(da) || !/^\d{2}:\d{2}$/.test(a)) return 'Scegli l’orario di inizio e di fine.';
  if (toMin(a) <= toMin(da)) return 'L’orario di fine deve venire dopo quello di inizio.';
  if (toMin(da) < toMin(INIZIO_GIORNATA) || toMin(a) > toMin(FINE_GIORNATA)) return 'Scegli un orario tra le 08:00 e le 24:00.';
  return null;
}

function aIntervalli(lista: string[]): [number, number][] {
  return lista.map(parseFascia).map(([x, y]) => [toMin(x), toMin(y)] as [number, number]);
}

function fondi(intervalli: [number, number][]): [number, number][] {
  const ordinati = [...intervalli].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const out: [number, number][] = [];
  for (const [x, y] of ordinati) {
    const last = out[out.length - 1];
    // sovrapposte o contigue (18:00-20:00 + 20:00-22:00) diventano una sola fascia
    if (last && x <= last[1]) last[1] = Math.max(last[1], y);
    else out.push([x, y]);
  }
  return out;
}

/** Ordina e fonde fasce sovrapposte o contigue. */
export function normalizzaFasce(lista: string[]): string[] {
  return fondi(aIntervalli(lista)).map(([x, y]) => formatFascia(fromMin(x), fromMin(y)));
}

/** Aggiunge una fascia fondendo quelle sovrapposte o contigue. */
export function aggiungiFascia(lista: string[], da: string, a: string): string[] {
  return normalizzaFasce([...lista, formatFascia(da, a)]);
}

/**
 * Come `aggiungiFascia`, ma dice anche se la nuova fascia si è unita ad altre:
 * `unita` è la fascia risultante che la contiene ("18:00-23:00"), null se è rimasta a sé.
 */
export function aggiungiFasciaConEsito(lista: string[], da: string, a: string): { lista: string[]; unita: string | null } {
  const nuova = aggiungiFascia(lista, da, a);
  const contenitore = nuova.find((f) => {
    const [x, y] = parseFascia(f);
    return toMin(x) <= toMin(da) && toMin(a) <= toMin(y);
  });
  const unita = contenitore && contenitore !== formatFascia(da, a) ? contenitore : null;
  return { lista: nuova, unita };
}

export function rimuoviFascia(lista: string[], fascia: string): string[] {
  return lista.filter((f) => f !== fascia);
}

/** Copia immutabile di `fasce` con il giorno impostato (giorno vuoto = chiave rimossa). */
export function impostaGiorno(fasce: Fasce, data: string, lista: string[]): Fasce {
  const n = { ...fasce };
  if (lista.length) n[data] = [...lista];
  else delete n[data];
  return n;
}

/**
 * Copia le fasce di `data` su tutti gli altri giorni con lo stesso giorno della settimana tra `giorni`
 * (i giorni visibili del periodo), sostituendo quelle esistenti (ASSUNZIONE D4).
 */
export function copiaSuStessoGiorno(fasce: Fasce, data: string, giorni: string[]): { fasce: Fasce; giorni: string[] } {
  const lista = fasce[data] ?? [];
  const wd = weekday(data);
  const destinazioni = giorni.filter((g) => g !== data && weekday(g) === wd);
  let out = fasce;
  for (const g of destinazioni) out = impostaGiorno(out, g, lista);
  return { fasce: out, giorni: destinazioni };
}

/** Solo le date da `oggi` in poi: le passate non servono più all'incrocio. */
export function soloFuture(fasce: Fasce, oggi: string): Fasce {
  return Object.fromEntries(Object.entries(fasce).filter(([d, l]) => d >= oggi && l.length > 0));
}

/** Date in cui due mappe di fasce differiscono (giorni vuoti e chiavi assenti sono equivalenti). */
export function giorniModificati(a: Fasce, b: Fasce): string[] {
  const date = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...date]
    .filter((d) => {
      const x = normalizzaFasce(a[d] ?? []);
      const y = normalizzaFasce(b[d] ?? []);
      return x.length !== y.length || x.some((f, i) => f !== y[i]);
    })
    .sort();
}

export function fasceUguali(a: Fasce, b: Fasce): boolean {
  return giorniModificati(a, b).length === 0;
}

/** "14:00-19:00" -> "14:00–19:00" (lineetta tipografica per la lettura). */
export function etichettaFascia(f: string): string {
  const [x, y] = parseFascia(f);
  return `${x}–${y}`;
}

/** Periodi ancora aperti (non finiti prima di oggi), in ordine di inizio. */
export function periodiAperti(periodi: Periodo[], oggi: string): Periodo[] {
  return periodi.filter((p) => p.fine >= oggi).sort((p, q) => p.inizio.localeCompare(q.inizio));
}

/**
 * Periodo predefinito: il primo aperto che contiene una mia partita da programmare, altrimenti il primo aperto.
 */
export function periodoPredefinito(aperti: Periodo[], partite: Partita[], uid: string | undefined): Periodo | undefined {
  const mie = new Set(
    partite.filter((p) => uid && p.giocatori.includes(uid) && p.stato === 'da programmare' && p.periodoId).map((p) => p.periodoId!),
  );
  return aperti.find((p) => mie.has(p.id)) ?? aperti[0];
}

/** Giorni del periodo da mostrare: da oggi (o dall'inizio, se futuro) alla fine. */
export function giorniDelPeriodo(periodo: Pick<Periodo, 'inizio' | 'fine'>, oggi: string): string[] {
  const out: string[] = [];
  for (let d = periodo.inizio > oggi ? periodo.inizio : oggi; d <= periodo.fine; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Raggruppa date consecutive in settimane lunedì–domenica: ogni settimana ha 7 posti (null fuori dal periodo). */
export function settimane(giorni: string[]): (string | null)[][] {
  if (!giorni.length) return [];
  const presenti = new Set(giorni);
  const primo = giorni[0];
  const lunedi = addDays(primo, -((weekday(primo) + 6) % 7));
  const ultimo = giorni[giorni.length - 1];
  const out: (string | null)[][] = [];
  for (let s = lunedi; s <= ultimo; s = addDays(s, 7)) {
    out.push(Array.from({ length: 7 }, (_, i) => addDays(s, i)).map((d) => (presenti.has(d) ? d : null)));
  }
  return out;
}

/** Posizione percentuale di un orario sulla giornata 08–24 (per la linea del tempo). */
export function percentualeGiornata(hhmm: string): number {
  const inizio = toMin(INIZIO_GIORNATA);
  const fine = toMin(FINE_GIORNATA);
  const m = Math.min(Math.max(toMin(hhmm), inizio), fine);
  return ((m - inizio) / (fine - inizio)) * 100;
}

/**
 * Compilazione veloce: aggiunge (fondendo) la fascia a tutti i giorni di `giorni` che cadono nei giorni
 * della settimana scelti (0 = domenica … 6 = sabato). Restituisce anche i giorni toccati.
 */
export function aggiungiAiGiorniSettimana(
  fasce: Fasce,
  giorni: string[],
  giorniSettimana: number[],
  da: string,
  a: string,
): { fasce: Fasce; giorni: string[] } {
  const scelti = new Set(giorniSettimana);
  const toccati = giorni.filter((g) => scelti.has(weekday(g)));
  let out = fasce;
  for (const g of toccati) out = impostaGiorno(out, g, aggiungiFascia(out[g] ?? [], da, a));
  return { fasce: out, giorni: toccati };
}
