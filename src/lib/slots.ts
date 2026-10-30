import type { Campo, Fasce, Occupazione, Richiesta } from '../types';
import { addMin, covers, dateKey, overlaps, parseFascia, timeKey, toMin, weekday } from './time';

export interface Slot {
  campoId: string;
  data: string;
  inizio: string;
  fine: string;
}

/** ID deterministico della richiesta: fa da lock sullo slot. */
export function richiestaId(campoId: string, data: string, inizio: string): string {
  return `${campoId}_${dateKey(data)}_${timeKey(inizio)}`;
}

export function occupazioniId(campoId: string, data: string): string {
  return `${campoId}_${dateKey(data)}`;
}

export function campoAttivo(campo: Campo, data: string): boolean {
  return campo.giorniAttivi.includes(weekday(data)) && !(campo.eccezioni ?? []).includes(data);
}

/** Gli slot non si salvano: si generano dalla regola del campo. `ultimoSlot` è l'ultimo orario di inizio. */
export function slotGriglia(campo: Campo, data: string): Slot[] {
  if (!campoAttivo(campo, data)) return [];
  const out: Slot[] = [];
  for (let t = toMin(campo.primoSlot); t <= toMin(campo.ultimoSlot); t += campo.durata) {
    const inizio = addMin('00:00', t);
    out.push({ campoId: campo.id, data, inizio, fine: addMin(inizio, campo.durata) });
  }
  return out;
}

export function isSlotDiGriglia(campo: Campo, data: string, inizio: string): boolean {
  return slotGriglia(campo, data).some((s) => s.inizio === inizio);
}

export function occupazioniSovrapposte(
  items: Record<string, Occupazione> | undefined,
  inizio: string,
  fine: string,
): [string, Occupazione][] {
  return Object.entries(items ?? {}).filter(([, o]) => overlaps(o.inizio, o.fine, inizio, fine));
}

export function fasciaCopre(fasce: Fasce | undefined, data: string, inizio: string, fine: string): boolean {
  return (fasce?.[data] ?? []).some((f) => {
    const [a, b] = parseFascia(f);
    return covers(a, b, inizio, fine);
  });
}

/** Una richiesta "attiva" occupa lo slot: in attesa e non scaduta, oppure confermata. */
export function richiestaAttiva(r: Pick<Richiesta, 'stato' | 'scadenza'>, now = Date.now()): boolean {
  if (r.stato === 'confermata') return true;
  if (r.stato !== 'attesa') return false;
  return !r.scadenza || r.scadenza.toMillis() > now;
}

export type ColoreSlot = 'verde' | 'giallo' | 'grigio' | 'rosso' | 'blu';

export interface StatoSlot {
  slot: Slot;
  colore: ColoreSlot;
  liberi: string[];
  mancanti: string[];
  occupazioni: Occupazione[];
  richiesta?: Richiesta;
}

/**
 * Incrocio (§7.1): campo libero, nessuna richiesta attiva sovrapposta,
 * e tutti i giocatori con una fascia che copre l'intero slot.
 */
export function classificaSlot(
  slot: Slot,
  giocatori: string[],
  disponibilita: Record<string, Fasce | undefined>,
  occupazioni: Record<string, Occupazione> | undefined,
  richieste: Richiesta[],
  now = Date.now(),
): StatoSlot {
  const occ = occupazioniSovrapposte(occupazioni, slot.inizio, slot.fine).map(([, o]) => o);
  const liberi = giocatori.filter((g) => fasciaCopre(disponibilita[g], slot.data, slot.inizio, slot.fine));
  const mancanti = giocatori.filter((g) => !liberi.includes(g));
  const richiesta = richieste.find(
    (r) =>
      r.campoId === slot.campoId &&
      r.data === slot.data &&
      richiestaAttiva(r, now) &&
      overlaps(r.inizio, r.fine, slot.inizio, slot.fine),
  );
  let colore: ColoreSlot;
  if (occ.length) colore = 'rosso';
  else if (richiesta) colore = 'blu';
  else if (mancanti.length === 0) colore = 'verde';
  else if (mancanti.length === 1) colore = 'giallo';
  else colore = 'grigio';
  return { slot, colore, liberi, mancanti, occupazioni: occ, richiesta };
}

/** Slot di griglia resi inutilizzabili da un intervallo (impatto di una richiesta fuori griglia). */
export function slotImpattati(campo: Campo, data: string, inizio: string, fine: string): Slot[] {
  return slotGriglia(campo, data).filter(
    (s) => overlaps(s.inizio, s.fine, inizio, fine) && !(s.inizio === inizio && s.fine === fine),
  );
}

export interface VerificaFuoriGriglia {
  bloccanti: Occupazione[];
  richiesteSovrapposte: Richiesta[];
  fuoriOrario: boolean;
}

export function verificaFuoriGriglia(
  campo: Campo,
  data: string,
  inizio: string,
  occupazioni: Record<string, Occupazione> | undefined,
  richieste: Richiesta[],
  now = Date.now(),
): VerificaFuoriGriglia {
  const fine = addMin(inizio, campo.durata);
  return {
    bloccanti: occupazioniSovrapposte(occupazioni, inizio, fine).map(([, o]) => o),
    richiesteSovrapposte: richieste.filter(
      (r) =>
        r.campoId === campo.id &&
        r.data === data &&
        r.stato === 'attesa' &&
        richiestaAttiva(r, now) &&
        overlaps(r.inizio, r.fine, inizio, fine),
    ),
    fuoriOrario: !campoAttivo(campo, data) || toMin(fine) > 24 * 60,
  };
}

/**
 * Controproposta: lo slot di griglia libero più vicino a quello richiesto,
 * cercando nei giorni candidati (in ordine di vicinanza) su tutti i campi.
 */
export function slotLiberoPiuVicino(
  origine: Slot,
  campi: Campo[],
  giorni: string[],
  occupazioniPerId: Record<string, Record<string, Occupazione> | undefined>,
  richieste: Richiesta[],
  now = Date.now(),
): Slot | null {
  const ref = (s: Slot) => Math.abs(dayDiff(s.data, origine.data)) * 24 * 60 + Math.abs(toMin(s.inizio) - toMin(origine.inizio));
  const candidati: Slot[] = [];
  for (const data of giorni) {
    for (const campo of campi) {
      for (const s of slotGriglia(campo, data)) {
        if (s.campoId === origine.campoId && s.data === origine.data && s.inizio === origine.inizio) continue;
        const occ = occupazioniPerId[occupazioniId(campo.id, data)];
        if (occupazioniSovrapposte(occ, s.inizio, s.fine).length) continue;
        const busy = richieste.some(
          (r) =>
            r.campoId === s.campoId && r.data === s.data && richiestaAttiva(r, now) && overlaps(r.inizio, r.fine, s.inizio, s.fine),
        );
        if (busy) continue;
        candidati.push(s);
      }
    }
  }
  candidati.sort((a, b) => ref(a) - ref(b));
  return candidati[0] ?? null;
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}

/** Capienza (§5.3): slot di griglia disponibili nel periodo al netto delle occupazioni note. */
export function contaSlot(
  campi: Campo[],
  giorni: string[],
  occupazioniPerId: Record<string, Record<string, Occupazione> | undefined> = {},
): number {
  let n = 0;
  for (const data of giorni)
    for (const campo of campi)
      for (const s of slotGriglia(campo, data))
        if (!occupazioniSovrapposte(occupazioniPerId[occupazioniId(campo.id, data)], s.inizio, s.fine).length) n++;
  return n;
}
