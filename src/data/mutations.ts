/**
 * Writes: RPCs for anything that needs integrity, direct table writes only where RLS allows them
 * (own availability, profile, courts/recurrences for the court manager, config/periods for the organizer).
 * Features use `useAzione(azioni.x, { successo })`.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Campo, Fasce, Periodo, Ricorrenza, SetScore, StatoSquadra, TipoOccupazione, TorneoConfig } from '../types';
import type { AppRole, Json } from './database.types';
import { messaggioErrore } from './errors';
import { rpc, supabase } from './supabase';

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}

export type EsitoConferma = { esito: 'ok' | 'occupato' | 'scaduta'; conflitti: number };

export const azioni = {
  // bookings
  creaRichiesta: (a: { partita: string; campo: string; data: string; inizio: string; nota?: string }) =>
    rpc('create_request', { p_partita: a.partita, p_campo: a.campo, p_data: a.data, p_inizio: a.inizio, p_nota: a.nota ?? null }),
  accettaRichiesta: (richiesta: string) => rpc('accept_request', { p_richiesta: richiesta }),
  annullaRichiesta: (a: { richiesta: string; nota?: string }) => rpc('cancel_request', { p_richiesta: a.richiesta, p_nota: a.nota ?? null }),
  confermaRichiesta: async (richiesta: string) => (await rpc('confirm_request', { p_richiesta: richiesta })) as unknown as EsitoConferma,
  rifiutaRichiesta: (a: { richiesta: string; nota?: string }) => rpc('reject_request', { p_richiesta: a.richiesta, p_nota: a.nota ?? null }),
  annullaConfermata: (a: { richiesta: string; nota?: string }) =>
    rpc('cancel_confirmed', { p_richiesta: a.richiesta, p_nota: a.nota ?? null }),
  annullaPartitaGiocatore: (a: { richiesta: string; nota?: string }) =>
    rpc('player_cancel_confirmed', { p_richiesta: a.richiesta, p_nota: a.nota ?? null }),
  controproponi: (a: { richiesta: string; campo: string; data: string; inizio: string; nota?: string }) =>
    rpc('counter_propose', { p_richiesta: a.richiesta, p_campo: a.campo, p_data: a.data, p_inizio: a.inizio, p_nota: a.nota ?? null }),

  // occupations
  aggiungiOccupazione: async (a: { campo: string; data: string; inizio: string; fine: string; tipo: TipoOccupazione; nota?: string }) =>
    (await rpc('add_occupation', {
      p_campo: a.campo,
      p_data: a.data,
      p_inizio: a.inizio,
      p_fine: a.fine,
      p_tipo: a.tipo,
      p_nota: a.nota ?? null,
    })) as unknown as { id: string; conflitti: number },
  rimuoviOccupazione: (id: string) => rpc('remove_occupation', { p_id: id }),
  chiudiGiornata: async (a: { data: string; nota: string }) =>
    (await rpc('close_day', { p_data: a.data, p_nota: a.nota })) as unknown as { errori: string[]; conflitti: number },
  materializzaRicorrenza: async (a: { ricorrenza: string; giorni?: number }) =>
    (await rpc('materialize_recurrence', { p_ricorrenza: a.ricorrenza, p_giorni: a.giorni ?? 60 })) as unknown as {
      creati: number;
      saltati: string[];
    },

  // results
  inserisciRisultato: (a: { partita: string; set: SetScore[] }) => rpc('submit_result', { p_partita: a.partita, p_set: a.set as unknown as Json }),
  confermaRisultato: (partita: string) => rpc('confirm_result', { p_partita: partita }),
  contestaRisultato: (a: { partita: string; nota: string }) => rpc('contest_result', { p_partita: a.partita, p_nota: a.nota }),
  risultatoUfficiale: (a: { partita: string; set: SetScore[]; nota?: string }) =>
    rpc('set_official_result', { p_partita: a.partita, p_set: a.set as unknown as Json, p_nota: a.nota ?? null }),
  tavolino: (a: { partita: string; vincente: 'A' | 'B'; nota?: string }) =>
    rpc('assign_forfeit', { p_partita: a.partita, p_vincente: a.vincente, p_nota: a.nota ?? null }),
  annullaRisultato: (partita: string) => rpc('clear_result', { p_partita: partita }),

  // teams
  creaCoppia: async (a: { torneo: string; nome: string }) =>
    (await rpc('create_team', { p_torneo: a.torneo, p_nome: a.nome })) as unknown as { squadra_id: string; token: string },
  entraInCoppia: (token: string) => rpc('join_team', { p_token: token }),
  aggiornaSquadra: (a: { id: string; nome?: string; girone?: string | null; stato?: StatoSquadra }) => {
    const { id, ...patch } = a;
    return ok(supabase.from('squadre').update(patch).eq('id', id));
  },
  eliminaSquadra: (id: string) => ok(supabase.from('squadre').delete().eq('id', id)),

  // tournament (organizer)
  creaTorneo: async (a: { nome: string; config: TorneoConfig }) =>
    ok(
      supabase
        .from('tornei')
        .insert({ nome: a.nome, stato: 'iscrizioni', config: a.config as unknown as Json, sorteggio: {}, fasi_generate: [] })
        .select('id')
        .single(),
    ),
  aggiornaTorneo: (a: { id: string; nome?: string; config?: TorneoConfig; sorteggio?: Record<string, number> }) => {
    const patch: { nome?: string; config?: Json; sorteggio?: Json } = {};
    if (a.nome !== undefined) patch.nome = a.nome;
    if (a.config !== undefined) patch.config = a.config as unknown as Json;
    if (a.sorteggio !== undefined) patch.sorteggio = a.sorteggio;
    return ok(supabase.from('tornei').update(patch).eq('id', a.id));
  },
  salvaPeriodo: (a: { torneo: string; periodo: Omit<Periodo, 'id'> & { id?: string } }) => {
    const { id, ...p } = a.periodo;
    const row = { torneo_id: a.torneo, fase: p.fase, turno: p.turno ?? null, inizio: p.inizio, fine: p.fine, etichetta: p.etichetta };
    return id ? ok(supabase.from('periodi').update(row).eq('id', id)) : ok(supabase.from('periodi').insert(row));
  },
  eliminaPeriodo: (id: string) => ok(supabase.from('periodi').delete().eq('id', id)),
  generaCalendario: (a: {
    torneo: string;
    partite: { codice: string; girone: string; turno: number; posizione: number; squadra_a: string; squadra_b: string; periodo_id: string | null }[];
  }) => rpc('generate_calendar', { p_torneo: a.torneo, p_partite: a.partite as unknown as Json }),
  generaFasiFinali: (a: {
    torneo: string;
    fase: string;
    partite: {
      codice: string;
      turno: number;
      posizione: number;
      prossima_codice: string | null;
      lato: 'A' | 'B' | null;
      squadra_a: string | null;
      squadra_b: string | null;
      periodo_id: string | null;
    }[];
  }) => rpc('generate_finals', { p_torneo: a.torneo, p_fase: a.fase, p_partite: a.partite as unknown as Json }),
  sincronizzaTabellone: (a: { torneo: string; updates: { codice: string; squadra_a: string | null; squadra_b: string | null }[] }) =>
    rpc('sync_bracket', { p_torneo: a.torneo, p_updates: a.updates as unknown as Json }),

  // courts and recurrences (court manager)
  salvaCampo: (c: Campo) =>
    ok(
      supabase.from('campi').upsert({
        id: c.id,
        nome: c.nome,
        primo_slot: c.primoSlot,
        ultimo_slot: c.ultimoSlot,
        durata: c.durata,
        giorni_attivi: c.giorniAttivi,
        eccezioni: c.eccezioni,
        ordine: c.ordine ?? 0,
      }),
    ),
  eliminaCampo: (id: string) => ok(supabase.from('campi').delete().eq('id', id)),
  salvaRicorrenza: async (r: Omit<Ricorrenza, 'id'> & { id?: string }) => {
    const row = {
      campo_id: r.campoId,
      giorno_settimana: r.giornoSettimana,
      inizio: r.inizio,
      fine: r.fine,
      tipo: r.tipo,
      nota: r.nota,
      dal: r.dal,
      al: r.al,
    };
    const res = r.id
      ? await ok(supabase.from('ricorrenze').update(row).eq('id', r.id).select('id').single())
      : await ok(supabase.from('ricorrenze').insert(row).select('id').single());
    return res as { id: string };
  },
  eliminaRicorrenza: (id: string) => ok(supabase.from('ricorrenze').delete().eq('id', id)),

  // player and profile
  salvaDisponibilita: (a: { torneo: string; uid: string; fasce: Fasce }) =>
    ok(supabase.from('disponibilita').upsert({ torneo_id: a.torneo, user_id: a.uid, fasce: a.fasce as unknown as Json })),
  aggiornaProfilo: (a: { id: string; nome?: string; telefono?: string | null }) => {
    const { id, ...patch } = a;
    return ok(supabase.from('profiles').update(patch).eq('id', id));
  },
  impostaRuoli: (a: { utente: string; ruoli: AppRole[] }) => rpc('set_roles', { p_user: a.utente, p_roles: a.ruoli }),
};

/**
 * Wraps an action: pending state, Italian error toast, optional success toast, and cache invalidation
 * (realtime covers other users' changes; here we refresh our own right away).
 */
export function useAzione<A, R>(
  fn: (a: A) => Promise<R>,
  opts: { successo?: string | ((r: R) => string | null); errore?: false; onSuccess?: (r: R) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      const msg = typeof opts.successo === 'function' ? opts.successo(r) : opts.successo;
      if (msg) toast.success(msg);
      opts.onSuccess?.(r);
    },
    onError: (e) => {
      if (opts.errore !== false) toast.error(messaggioErrore(e));
    },
    onSettled: () => qc.invalidateQueries(),
  });
}
