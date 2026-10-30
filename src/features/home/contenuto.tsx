import {
  AlarmClock,
  BadgeCheck,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  ClipboardList,
  Hourglass,
  Inbox,
  ListChecks,
  MessageSquareWarning,
  PenLine,
  Send,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { AttentionItem, AttentionKind } from '../../lib/attention';
import { formatRisultato } from '../../lib/results';
import { labelDate } from '../../lib/time';
import { nomeSquadra } from '../../lib/torneo';
import type { Campo, Partita, Periodo, Richiesta, Squadra } from '../../types';

/** Everything a row needs to turn `kind + refs` into Italian copy. */
export interface Contesto {
  tid: string;
  partitaById: Map<string, Partita>;
  richiestaById: Map<string, Richiesta>;
  /** Requests per match (to explain why a match is back to "da programmare"). */
  richiestePerPartita: Map<string, Richiesta[]>;
  periodoById: Map<string, Periodo>;
  squadraById: Map<string, Squadra>;
  campi: Campo[];
  nome: (uid: string | null | undefined) => string;
  uid: string;
}

export interface Testo {
  icona: LucideIcon;
  titolo: string;
  /** Pair names ("Rossi/Bianchi contro Verdi/Neri"). */
  coppie?: string;
  /** What is missing, where and when. */
  dettaglio?: string;
  /** Label of the main button. */
  azione: string;
}

const ICONA: Record<AttentionKind, LucideIcon> = {
  'accetta-richiesta': Send,
  'conferma-risultato': Hourglass,
  'inserisci-risultato': PenLine,
  'segna-disponibilita': CalendarRange,
  'programma-partita': CalendarPlus,
  'completa-coppia': UserPlus,
  'richiesta-in-corso': Hourglass,
  'attesa-conferma-avversari': Hourglass,
  'coppia-da-approvare': Hourglass,
  'prossima-partita': CalendarCheck,
  'conferma-richiesta': Inbox,
  'partite-oggi': ClipboardList,
  'risultato-contestato': MessageSquareWarning,
  'squadra-da-approvare': BadgeCheck,
  'partite-in-ritardo': AlarmClock,
  'periodo-in-scadenza': AlarmClock,
  'risultati-non-confermati': Hourglass,
  'passo-torneo': ListChecks,
};

const PASSO: Record<NonNullable<AttentionItem['passo']>, string> = {
  periodi: 'Aggiungi il periodo dei gironi',
  'approva-squadre': 'Approva le coppie iscritte',
  gironi: 'Componi i gironi',
  calendario: 'Genera il calendario',
  finali: 'Genera le fasi finali',
  sincronizza: 'Aggiorna i tabelloni',
};

export function elenco(nomi: string[]): string {
  if (nomi.length <= 1) return nomi.join('');
  return `${nomi.slice(0, -1).join(', ')} e ${nomi.at(-1)}`;
}

const plurale = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`;

export function coppieDi(p: Partita | undefined, ctx: Contesto): string | undefined {
  if (!p) return undefined;
  return `${nomeSquadra(ctx.squadraById, p.squadraA)} contro ${nomeSquadra(ctx.squadraById, p.squadraB)}`;
}

/** "sab 14/11 · 15:30 · Campo 2" */
export function doveQuando(x: { campoId: string; data: string; inizio: string }, campi: Campo[]): string {
  const campo = campi.find((c) => c.id === x.campoId)?.nome ?? 'Campo';
  return `${labelDate(x.data)} · ${x.inizio} · ${campo}`;
}

export function testoRiga(it: AttentionItem, ctx: Contesto): Testo {
  const p = it.refs.partitaId ? ctx.partitaById.get(it.refs.partitaId) : undefined;
  const r = it.refs.richiestaId ? ctx.richiestaById.get(it.refs.richiestaId) : undefined;
  const per = it.refs.periodoId ? ctx.periodoById.get(it.refs.periodoId) : undefined;
  const sq = it.refs.squadraId ? ctx.squadraById.get(it.refs.squadraId) : undefined;
  const icona = it.kind === 'programma-partita' && it.motivo === 'in-ritardo' ? AlarmClock : ICONA[it.kind];
  const coppie = coppieDi(p, ctx);
  const n = it.count ?? 0;
  const altri = (it.mancanti ?? []).filter((u) => u !== ctx.uid).map(ctx.nome);

  switch (it.kind) {
    case 'accetta-richiesta':
      return {
        icona,
        titolo: 'Accetta l’orario proposto',
        coppie,
        dettaglio: [r && doveQuando(r, ctx.campi), altri.length ? `deve accettare anche ${elenco(altri)}` : null].filter(Boolean).join(' · '),
        azione: 'Accetta',
      };
    case 'conferma-risultato':
      return {
        icona,
        titolo: `Conferma il risultato ${formatRisultato(p?.risultato?.set)}`,
        coppie,
        dettaglio: p?.risultato ? `Inserito da ${ctx.nome(p.risultato.inseritoDa)}` : undefined,
        azione: 'Conferma',
      };
    case 'inserisci-risultato':
      return {
        icona,
        titolo: 'Inserisci il risultato',
        coppie,
        dettaglio: p?.programmazione ? `Giocata ${doveQuando(p.programmazione, ctx.campi)}` : undefined,
        azione: 'Inserisci',
      };
    case 'segna-disponibilita':
      return {
        icona,
        titolo: `Segna le tue disponibilità per ${per?.etichetta ?? 'questo periodo'}`,
        dettaglio: 'Così l’app trova gli orari che vanno bene a tutti e 4.',
        azione: 'Segna disponibilità',
      };
    case 'programma-partita':
      return { icona, titolo: 'Programma la partita', coppie, dettaglio: motivoProgramma(it, p, ctx), azione: 'Trova un orario' };
    case 'completa-coppia':
      return {
        icona,
        titolo: 'Invita il tuo compagno',
        dettaglio: sq ? `La coppia ${sq.nome} aspetta il secondo giocatore.` : undefined,
        azione: 'Invia invito',
      };
    case 'richiesta-in-corso':
      return it.mancanti?.length
        ? {
            icona,
            titolo: `Aspettiamo ${elenco(it.mancanti.map(ctx.nome))}`,
            coppie,
            dettaglio: r ? doveQuando(r, ctx.campi) : undefined,
            azione: 'Sollecita su WhatsApp',
          }
        : {
            icona,
            titolo: 'Avete accettato tutti e 4: aspettiamo la conferma del campo',
            coppie,
            dettaglio: r ? doveQuando(r, ctx.campi) : undefined,
            azione: 'Apri',
          };
    case 'attesa-conferma-avversari':
      return {
        icona,
        titolo: 'Aspettiamo la conferma degli avversari',
        coppie,
        dettaglio: p?.risultato ? `Risultato ${formatRisultato(p.risultato.set)}` : undefined,
        azione: 'Apri',
      };
    case 'coppia-da-approvare':
      return {
        icona,
        titolo: 'La tua coppia aspetta l’approvazione',
        dettaglio: sq ? `${sq.nome}: la deve approvare l’organizzatore.` : undefined,
        azione: 'Apri',
      };
    case 'prossima-partita':
      return {
        icona,
        titolo: 'Prossima partita',
        coppie,
        dettaglio: p?.programmazione ? doveQuando(p.programmazione, ctx.campi) : undefined,
        azione: 'Apri',
      };
    case 'conferma-richiesta': {
      const flag = [r?.fuoriGriglia && 'fuori griglia', r?.controproposta && 'proposta dal campo'].filter(Boolean).join(', ');
      return {
        icona,
        titolo: 'Richiesta da confermare',
        coppie,
        dettaglio: [r && doveQuando(r, ctx.campi), flag].filter(Boolean).join(' · '),
        azione: it.action.type === 'inline' ? 'Conferma' : 'Apri richiesta',
      };
    }
    case 'partite-oggi':
      return { icona, titolo: `${plurale(n, 'partita', 'partite')} oggi sul campo`, azione: 'Apri la giornata' };
    case 'risultato-contestato':
      return { icona, titolo: 'Contestazione da risolvere', coppie, azione: 'Risolvi' };
    case 'squadra-da-approvare':
      return {
        icona,
        titolo: `Coppia da approvare: ${sq?.nome ?? ''}`,
        dettaglio: sq?.giocatori.length ? elenco(sq.giocatori.map(ctx.nome)) : undefined,
        azione: 'Approva',
      };
    case 'partite-in-ritardo':
      return { icona, titolo: `${plurale(n, 'partita', 'partite')} in ritardo nel ${per?.etichetta ?? 'periodo'}`, azione: 'Vedi' };
    case 'periodo-in-scadenza':
      return {
        icona,
        titolo: `${plurale(n, 'partita', 'partite')} ancora da programmare nel ${per?.etichetta ?? 'periodo'}`,
        azione: 'Vedi',
      };
    case 'risultati-non-confermati':
      return { icona, titolo: `${plurale(n, 'risultato', 'risultati')} non confermati da più di 48 ore`, azione: 'Vedi' };
    case 'passo-torneo':
      return {
        icona,
        titolo: it.passo ? PASSO[it.passo] : 'Prossimo passo del torneo',
        dettaglio: 'È il prossimo passo per far andare avanti il torneo.',
        azione: 'Vai',
      };
  }
}

function motivoProgramma(it: AttentionItem, p: Partita | undefined, ctx: Contesto): string | undefined {
  if (it.motivo === 'in-ritardo') return 'In ritardo: il periodo è finito, si può ancora giocare finché decide l’organizzatore.';
  if (!it.motivo || !p) return undefined;
  const ultima = [...(ctx.richiestePerPartita.get(p.id) ?? [])].sort((a, b) => b.scadenza.toMillis() - a.scadenza.toMillis())[0];
  const quando = ultima ? `${ultima.inizio} di ${labelDate(ultima.data)}` : 'l’orario richiesto';
  switch (it.motivo) {
    case 'rifiutata':
      return `Il campo ha rifiutato ${quando}: scegli un altro slot.`;
    case 'conflitto':
      return `L’orario delle ${quando} è andato in conflitto con un’altra prenotazione: scegli un altro slot.`;
    case 'scaduta':
      return `La richiesta per ${quando} è scaduta: scegli un altro orario.`;
    case 'annullata':
      return `La richiesta per ${quando} è stata annullata: scegli un altro orario.`;
  }
}
