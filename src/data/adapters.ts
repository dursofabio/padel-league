/**
 * Database rows → domain types (src/types.ts) consumed by the pure logic in src/lib.
 * Keeping this conversion here leaves src/lib unchanged and tested.
 */
import { conConfigDefault } from '../lib/config';
import { occupazioniId } from '../lib/slots';
import type {
  Campo,
  Disponibilita,
  Fasce,
  Instant,
  Occupazione,
  OccupazioneRiga,
  Partita,
  Periodo,
  Richiesta,
  Ricorrenza,
  SetScore,
  Squadra,
  Torneo,
  TorneoConfig,
  UserProfile,
} from '../types';
import type { Tables, Views } from './database.types';

/** "18:00:00" → "18:00"; "24:00:00" → "24:00". */
export function hhmm(t: string | null | undefined): string {
  return (t ?? '').slice(0, 5);
}

export function instant(iso: string): Instant {
  const ms = Date.parse(iso);
  return { toMillis: () => ms };
}

export function toProfile(r: Tables<'profiles'>): UserProfile {
  return { id: r.id, nome: r.nome, email: r.email, telefono: r.telefono, roles: r.roles };
}

export function toTorneo(r: Tables<'tornei'>): Torneo {
  return {
    id: r.id,
    nome: r.nome,
    stato: r.stato,
    config: conConfigDefault(r.config as Partial<TorneoConfig>),
    sorteggio: (r.sorteggio as Record<string, number>) ?? {},
    fasiGenerate: r.fasi_generate ?? [],
  };
}

export function toPeriodo(r: Tables<'periodi'>): Periodo {
  return { id: r.id, fase: r.fase, turno: r.turno, inizio: r.inizio, fine: r.fine, etichetta: r.etichetta };
}

export function toSquadre(rows: Tables<'squadre'>[], membri: Tables<'squadra_giocatori'>[]): Squadra[] {
  const per = new Map<string, Tables<'squadra_giocatori'>[]>();
  for (const m of membri) per.set(m.squadra_id, [...(per.get(m.squadra_id) ?? []), m]);
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    girone: r.girone,
    stato: r.stato,
    creatoDa: r.creato_da,
    giocatori: (per.get(r.id) ?? []).sort((a, b) => a.ordine - b.ordine).map((m) => m.user_id),
  }));
}

/** Matches from the partite_v view. prossima_codice → id of the next match (for src/lib/bracket). */
export function toPartite(rows: Views<'partite_v'>[]): Partita[] {
  const idByCodice = new Map(rows.map((r) => [r.codice, r.id]));
  return rows.map((r) => ({
    id: r.id,
    codice: r.codice,
    fase: r.fase,
    girone: r.girone,
    turno: r.turno,
    posizione: r.posizione,
    prossimaPartita: r.prossima_codice ? (idByCodice.get(r.prossima_codice) ?? null) : null,
    lato: (r.lato as 'A' | 'B' | null) ?? null,
    squadraA: r.squadra_a,
    squadraB: r.squadra_b,
    giocatoriA: r.giocatori_a ?? [],
    giocatoriB: r.giocatori_b ?? [],
    giocatori: r.giocatori ?? [],
    periodoId: r.periodo_id,
    stato: r.stato,
    richiestaId: r.richiesta_id,
    programmazione:
      r.prog_campo_id && r.prog_data && r.prog_inizio && r.prog_fine
        ? { campoId: r.prog_campo_id, data: r.prog_data, inizio: hhmm(r.prog_inizio), fine: hhmm(r.prog_fine) }
        : null,
    risultato:
      r.set && r.inserito_da
        ? {
            set: r.set as unknown as SetScore[],
            inseritoDa: r.inserito_da,
            confermatoDa: r.confermato_da,
            contestatoDa: r.contestato_da,
            nota: r.nota_risultato,
          }
        : null,
    updatedAt: r.updated_at,
  }));
}

export function toCampo(r: Tables<'campi'>): Campo {
  return {
    id: r.id,
    nome: r.nome,
    primoSlot: hhmm(r.primo_slot),
    ultimoSlot: hhmm(r.ultimo_slot),
    durata: r.durata,
    giorniAttivi: r.giorni_attivi ?? [],
    eccezioni: r.eccezioni ?? [],
    ordine: r.ordine,
  };
}

export function toRicorrenza(r: Tables<'ricorrenze'>): Ricorrenza {
  return {
    id: r.id,
    campoId: r.campo_id,
    giornoSettimana: r.giorno_settimana,
    inizio: hhmm(r.inizio),
    fine: hhmm(r.fine),
    tipo: r.tipo,
    nota: r.nota ?? '',
    dal: r.dal,
    al: r.al,
  };
}

export function toOccupazione(r: Tables<'occupazioni'>): OccupazioneRiga {
  return {
    id: r.id,
    campoId: r.campo_id,
    data: r.data,
    inizio: hhmm(r.inizio),
    fine: hhmm(r.fine),
    tipo: r.tipo,
    nota: r.nota,
    partitaId: r.partita_id,
    richiestaId: r.richiesta_id,
    torneoId: r.torneo_id,
    ricorrenzaId: r.ricorrenza_id,
    creatoDa: r.creato_da,
  };
}

/** Occupations grouped as src/lib/slots expects: occupazioniId(campo, giorno) → { id → occupation }. */
export function occupazioniPerGiorno(rows: OccupazioneRiga[]): Record<string, Record<string, Occupazione>> {
  const out: Record<string, Record<string, Occupazione>> = {};
  for (const o of rows) {
    const k = occupazioniId(o.campoId, o.data);
    (out[k] ??= {})[o.id] = o;
  }
  return out;
}

export function toRichieste(rows: Tables<'richieste'>[], giocatori: Tables<'richiesta_giocatori'>[]): Richiesta[] {
  const per = new Map<string, Tables<'richiesta_giocatori'>[]>();
  for (const g of giocatori) per.set(g.richiesta_id, [...(per.get(g.richiesta_id) ?? []), g]);
  return rows.map((r) => {
    const gs = per.get(r.id) ?? [];
    return {
      id: r.id,
      torneoId: r.torneo_id,
      partitaId: r.partita_id,
      campoId: r.campo_id,
      data: r.data,
      inizio: hhmm(r.inizio),
      fine: hhmm(r.fine),
      fuoriGriglia: r.fuori_griglia,
      controproposta: r.controproposta,
      giocatori: gs.map((g) => g.user_id),
      accettazioni: Object.fromEntries(gs.map((g) => [g.user_id, g.accettata_at ? instant(g.accettata_at) : null])),
      stato: r.stato,
      scadenza: instant(r.scadenza),
      creatoDa: r.creato_da,
      nota: r.nota,
      createdAt: r.created_at,
    };
  });
}

export function toDisponibilita(r: Tables<'disponibilita'>): Disponibilita {
  return { id: `${r.torneo_id}_${r.user_id}`, torneoId: r.torneo_id, uid: r.user_id, fasce: (r.fasce as Fasce) ?? {} };
}
