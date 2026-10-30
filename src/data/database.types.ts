/**
 * Database types in the format produced by `supabase gen types typescript`.
 * Written by hand from docs/contratto-api.md: regenerate them from the real
 * project (`npx supabase gen types typescript --project-id <ref>`) and keep
 * the two in sync.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = [];

export type AppRole = 'admin' | 'organizzatore' | 'gestore' | 'giocatore';
export type StatoTorneo = 'iscrizioni' | 'gironi' | 'fasiFinali' | 'concluso';
export type StatoSquadra = 'in attesa partner' | 'da approvare' | 'approvata' | 'ritirata';
export type StatoPartita = 'da programmare' | 'richiesta' | 'programmata' | 'giocata' | 'contestata' | 'tavolino';
export type StatoRichiesta = 'attesa' | 'confermata' | 'rifiutata' | 'annullata' | 'conflitto' | 'scaduta';
export type TipoOccupazione = 'esterno' | 'lezione' | 'chiusura' | 'campionato';

interface ProfilesRow { id: string; nome: string; email: string; telefono: string | null; roles: AppRole[]; created_at: string }
interface TorneiRow { id: string; nome: string; stato: StatoTorneo; config: Json; sorteggio: Json; fasi_generate: string[]; created_at: string }
interface PeriodiRow { id: string; torneo_id: string; fase: string; turno: number | null; inizio: string; fine: string; etichetta: string }
interface SquadreRow { id: string; torneo_id: string; nome: string; girone: string | null; stato: StatoSquadra; creato_da: string; created_at: string }
interface SquadraGiocatoriRow { squadra_id: string; torneo_id: string; user_id: string; ordine: number }
interface InvitiRow { token: string; squadra_id: string; torneo_id: string; creato_da: string }
interface PartiteRow {
  id: string; torneo_id: string; codice: string; fase: string; girone: string | null; turno: number | null; posizione: number | null;
  prossima_codice: string | null; lato: string | null; squadra_a: string | null; squadra_b: string | null; periodo_id: string | null;
  stato: StatoPartita; richiesta_id: string | null; set: Json | null; inserito_da: string | null; confermato_da: string | null;
  contestato_da: string | null; nota_risultato: string | null; updated_at: string;
}
interface PartiteVRow extends PartiteRow {
  giocatori_a: string[]; giocatori_b: string[]; giocatori: string[];
  prog_campo_id: string | null; prog_data: string | null; prog_inizio: string | null; prog_fine: string | null;
}
interface CampiRow { id: string; nome: string; primo_slot: string; ultimo_slot: string; durata: number; giorni_attivi: number[]; eccezioni: string[]; ordine: number }
interface RicorrenzeRow { id: string; campo_id: string; giorno_settimana: number; inizio: string; fine: string; tipo: TipoOccupazione; nota: string; dal: string; al: string }
interface OccupazioniRow {
  id: string; campo_id: string; data: string; inizio: string; fine: string; tipo: TipoOccupazione; nota: string | null;
  partita_id: string | null; richiesta_id: string | null; torneo_id: string | null; ricorrenza_id: string | null; creato_da: string | null;
}
interface RichiesteRow {
  id: string; torneo_id: string; partita_id: string; campo_id: string; data: string; inizio: string; fine: string;
  fuori_griglia: boolean; controproposta: boolean; stato: StatoRichiesta; scadenza: string; creato_da: string;
  gestito_da: string | null; nota: string | null; created_at: string;
}
interface RichiestaGiocatoriRow { richiesta_id: string; user_id: string; accettata_at: string | null }
interface DisponibilitaRow { torneo_id: string; user_id: string; fasce: Json; updated_at: string }
interface LogRow { id: number; chi: string | null; cosa: string; riferimento: string; quando: string }

type Table<R, I = Partial<R>> = { Row: R; Insert: I; Update: Partial<R>; Relationships: Rel };
type View<R> = { Row: R; Relationships: Rel };
type Fn<A, R> = { Args: A; Returns: R };

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfilesRow>;
      tornei: Table<TorneiRow>;
      periodi: Table<PeriodiRow>;
      squadre: Table<SquadreRow>;
      squadra_giocatori: Table<SquadraGiocatoriRow>;
      inviti: Table<InvitiRow>;
      partite: Table<PartiteRow>;
      campi: Table<CampiRow>;
      ricorrenze: Table<RicorrenzeRow>;
      occupazioni: Table<OccupazioniRow>;
      richieste: Table<RichiesteRow>;
      richiesta_giocatori: Table<RichiestaGiocatoriRow>;
      disponibilita: Table<DisponibilitaRow>;
      log: Table<LogRow>;
    };
    Views: {
      partite_v: View<PartiteVRow>;
      giocatori_pubblici: View<{ id: string; nome: string }>;
    };
    Functions: {
      create_request: Fn<{ p_partita: string; p_campo: string; p_data: string; p_inizio: string; p_nota?: string | null }, string>;
      accept_request: Fn<{ p_richiesta: string }, undefined>;
      cancel_request: Fn<{ p_richiesta: string; p_nota?: string | null }, undefined>;
      confirm_request: Fn<{ p_richiesta: string }, Json>;
      reject_request: Fn<{ p_richiesta: string; p_nota?: string | null }, undefined>;
      cancel_confirmed: Fn<{ p_richiesta: string; p_nota?: string | null }, undefined>;
      counter_propose: Fn<{ p_richiesta: string; p_campo: string; p_data: string; p_inizio: string; p_nota?: string | null }, string>;
      add_occupation: Fn<{ p_campo: string; p_data: string; p_inizio: string; p_fine: string; p_tipo: TipoOccupazione; p_nota?: string | null }, Json>;
      remove_occupation: Fn<{ p_id: string }, undefined>;
      close_day: Fn<{ p_data: string; p_nota: string }, Json>;
      materialize_recurrence: Fn<{ p_ricorrenza: string; p_giorni?: number }, Json>;
      submit_result: Fn<{ p_partita: string; p_set: Json }, undefined>;
      confirm_result: Fn<{ p_partita: string }, undefined>;
      contest_result: Fn<{ p_partita: string; p_nota: string }, undefined>;
      set_official_result: Fn<{ p_partita: string; p_set: Json; p_nota?: string | null }, undefined>;
      assign_forfeit: Fn<{ p_partita: string; p_vincente: string; p_nota?: string | null }, undefined>;
      clear_result: Fn<{ p_partita: string }, undefined>;
      create_team: Fn<{ p_torneo: string; p_nome: string }, Json>;
      get_invite: Fn<{ p_token: string }, Json>;
      join_team: Fn<{ p_token: string }, string>;
      my_invite_token: Fn<{ p_squadra: string }, string | null>;
      generate_calendar: Fn<{ p_torneo: string; p_partite: Json }, number>;
      generate_finals: Fn<{ p_torneo: string; p_fase: string; p_partite: Json }, number>;
      sync_bracket: Fn<{ p_torneo: string; p_updates: Json }, number>;
      set_roles: Fn<{ p_user: string; p_roles: AppRole[] }, undefined>;
    };
    Enums: {
      app_role: AppRole;
      stato_torneo: StatoTorneo;
      stato_squadra: StatoSquadra;
      stato_partita: StatoPartita;
      stato_richiesta: StatoRichiesta;
      tipo_occupazione: TipoOccupazione;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];
