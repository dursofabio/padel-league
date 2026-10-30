import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'organizzatore' | 'gestore' | 'giocatore';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  telefono?: string;
  role: Role;
}

export type Spareggio =
  | 'punti'
  | 'scontroDiretto'
  | 'diffSet'
  | 'diffGame'
  | 'setVinti'
  | 'gameVinti'
  | 'sorteggio';

export interface FormatoSet {
  /** Set necessari per vincere (2 = due set su tre). */
  setPerVincere: number;
  /** Il set decisivo si gioca come super tie-break a 10. */
  superTieBreak: boolean;
}

export interface FaseFinaleConfig {
  nome: string; // "Gold", "Silver"
  posti: number;
}

export interface TorneoConfig {
  puntiVittoria: number;
  puntiSconfitta: number;
  /** Punti aggiuntivi alla perdente quando la partita arriva al set decisivo. */
  puntiSconfittaSetDecisivo: number;
  formatoSet: FormatoSet;
  spareggi: Spareggio[];
  criterioQualificazione: 'perPosizione' | 'avulsa';
  fasiFinali: FaseFinaleConfig[];
  consentiFuoriGriglia: boolean;
  passoFuoriGriglia: 15 | 30;
  scadenzaRichiesteOre: number;
}

export type StatoTorneo = 'iscrizioni' | 'gironi' | 'fasiFinali' | 'concluso';

export interface Torneo {
  id: string;
  nome: string;
  stato: StatoTorneo;
  config: TorneoConfig;
  /** Ordine da sorteggio per i pari merito non risolti: squadraId -> posizione (più basso = meglio). */
  sorteggio?: Record<string, number>;
  /** Fasi finali già generate (nomi in minuscolo). */
  fasiGenerate?: string[];
}

export type StatoSquadra = 'in attesa partner' | 'da approvare' | 'approvata' | 'ritirata';

export interface Squadra {
  id: string;
  nome: string;
  giocatori: string[];
  girone?: string | null;
  stato: StatoSquadra;
  creatoDa: string;
}

export interface Periodo {
  id: string;
  fase: string; // "gironi" | "gold" | "silver"
  turno?: number | null; // per le fasi finali: turno a eliminazione
  inizio: string; // yyyy-mm-dd
  fine: string; // yyyy-mm-dd
  etichetta: string;
}

export type StatoPartita =
  | 'da programmare'
  | 'richiesta'
  | 'programmata'
  | 'giocata'
  | 'contestata'
  | 'tavolino';

/** Firestore non ammette array annidati: un set è una mappa { a: game coppia A, b: game coppia B }. */
export interface SetScore {
  a: number;
  b: number;
}

export interface Risultato {
  set: SetScore[];
  inseritoDa: string;
  confermatoDa?: string | null;
  contestatoDa?: string | null;
  nota?: string | null;
}

export interface Programmazione {
  campoId: string;
  data: string; // yyyy-mm-dd
  inizio: string;
  fine: string;
}

export interface Partita {
  id: string;
  fase: string; // "gironi" | "gold" | "silver"
  girone?: string | null;
  turno?: number | null;
  posizione?: number | null;
  prossimaPartita?: string | null;
  lato?: 'A' | 'B' | null;
  squadraA: string | null;
  squadraB: string | null;
  giocatoriA: string[];
  giocatoriB: string[];
  giocatori: string[];
  periodoId?: string | null;
  stato: StatoPartita;
  richiestaId?: string | null;
  programmazione?: Programmazione | null;
  risultato?: Risultato | null;
}

export interface Campo {
  id: string;
  nome: string;
  primoSlot: string;
  ultimoSlot: string;
  durata: number;
  /** 0 = domenica … 6 = sabato */
  giorniAttivi: number[];
  /** Date (yyyy-mm-dd) in cui il campo è chiuso. */
  eccezioni: string[];
  ordine?: number;
}

export type TipoOccupazione = 'esterno' | 'lezione' | 'chiusura' | 'campionato';

export interface Occupazione {
  inizio: string;
  fine: string;
  tipo: TipoOccupazione;
  nota?: string | null;
  partitaId?: string | null;
  richiestaId?: string | null;
  torneoId?: string | null;
  ricorrenzaId?: string | null;
  creatoDa: string;
}

export interface OccupazioniGiorno {
  id: string;
  campoId: string;
  data: string;
  items: Record<string, Occupazione>;
}

export interface Ricorrenza {
  id: string;
  campoId: string;
  giornoSettimana: number;
  inizio: string;
  fine: string;
  tipo: TipoOccupazione;
  nota: string;
  dal: string;
  al: string;
}

export type StatoRichiesta =
  | 'attesa'
  | 'confermata'
  | 'rifiutata'
  | 'annullata'
  | 'conflitto'
  | 'scaduta';

export interface Richiesta {
  id: string;
  torneoId: string;
  partitaId: string;
  campoId: string;
  data: string;
  inizio: string;
  fine: string;
  fuoriGriglia: boolean;
  controproposta?: boolean;
  giocatori: string[];
  accettazioni: Record<string, Timestamp | null>;
  stato: StatoRichiesta;
  scadenza: Timestamp;
  creatoDa: string;
  nota?: string | null;
}

/**
 * fasce: data (yyyy-mm-dd) -> lista di intervalli "hh:mm-hh:mm".
 * (Firestore non ammette array annidati, quindi l'intervallo è una stringa.)
 */
export type Fasce = Record<string, string[]>;

export interface Disponibilita {
  id: string;
  torneoId: string;
  uid: string;
  fasce: Fasce;
}
