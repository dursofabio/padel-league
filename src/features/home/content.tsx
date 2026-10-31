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
import { formatScore } from '../../lib/results';
import { labelDate } from '../../lib/time';
import { teamName } from '../../lib/tournament';
import type { Court, Match, MatchRequest, Period, Team } from '../../types';

/** Everything a row needs to turn `kind + refs` into Italian copy. */
export interface RowContext {
  tid: string;
  matchById: Map<string, Match>;
  requestById: Map<string, MatchRequest>;
  /** Requests per match (to explain why a match is back to "da programmare"). */
  requestsByMatch: Map<string, MatchRequest[]>;
  periodById: Map<string, Period>;
  teamById: Map<string, Team>;
  courts: Court[];
  name: (uid: string | null | undefined) => string;
  uid: string;
}

export interface RowText {
  icon: LucideIcon;
  title: string;
  /** Pair names ("Rossi/Bianchi contro Verdi/Neri"). */
  teams?: string;
  /** What is missing, where and when. */
  detail?: string;
  /** Label of the main button. */
  action: string;
}

const ICON: Record<AttentionKind, LucideIcon> = {
  'accept-request': Send,
  'confirm-result': Hourglass,
  'enter-result': PenLine,
  'set-availability': CalendarRange,
  'schedule-match': CalendarPlus,
  'complete-team': UserPlus,
  'request-in-progress': Hourglass,
  'awaiting-opponents-confirmation': Hourglass,
  'team-awaiting-approval': Hourglass,
  'upcoming-match': CalendarCheck,
  'confirm-request': Inbox,
  'matches-today': ClipboardList,
  'disputed-result': MessageSquareWarning,
  'approve-team': BadgeCheck,
  'late-matches': AlarmClock,
  'period-ending': AlarmClock,
  'unconfirmed-results': Hourglass,
  'tournament-step': ListChecks,
};

const STEP: Record<NonNullable<AttentionItem['step']>, string> = {
  periods: 'Aggiungi il periodo dei gironi',
  'approve-teams': 'Approva le coppie iscritte',
  groups: 'Componi i gironi',
  schedule: 'Genera il calendario',
  finals: 'Genera le fasi finali',
  sync: 'Aggiorna i tabelloni',
};

export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function teamsOf(m: Match | undefined, ctx: RowContext): string | undefined {
  if (!m) return undefined;
  return `${teamName(ctx.teamById, m.teamA)} contro ${teamName(ctx.teamById, m.teamB)}`;
}

/** "sab 14/11 · 15:30 · Campo 2" */
export function whereWhen(x: { courtId: string; date: string; start: string }, courts: Court[]): string {
  const court = courts.find((c) => c.id === x.courtId)?.name ?? 'Campo';
  return `${labelDate(x.date)} · ${x.start} · ${court}`;
}

export function rowText(it: AttentionItem, ctx: RowContext): RowText {
  const p = it.refs.matchId ? ctx.matchById.get(it.refs.matchId) : undefined;
  const r = it.refs.requestId ? ctx.requestById.get(it.refs.requestId) : undefined;
  const per = it.refs.periodId ? ctx.periodById.get(it.refs.periodId) : undefined;
  const team = it.refs.teamId ? ctx.teamById.get(it.refs.teamId) : undefined;
  const icon = it.kind === 'schedule-match' && it.reason === 'late' ? AlarmClock : ICON[it.kind];
  const teams = teamsOf(p, ctx);
  const n = it.count ?? 0;
  const others = (it.missing ?? []).filter((u) => u !== ctx.uid).map(ctx.name);

  switch (it.kind) {
    case 'accept-request':
      return {
        icon,
        title: 'Accetta l’orario proposto',
        teams,
        detail: [r && whereWhen(r, ctx.courts), others.length ? `deve accettare anche ${listNames(others)}` : null].filter(Boolean).join(' · '),
        action: 'Accetta',
      };
    case 'confirm-result':
      return {
        icon,
        title: `Conferma il risultato ${formatScore(p?.result?.sets)}`,
        teams,
        detail: p?.result ? `Inserito da ${ctx.name(p.result.enteredBy)}` : undefined,
        action: 'Conferma',
      };
    case 'enter-result':
      return {
        icon,
        title: 'Inserisci il risultato',
        teams,
        detail: p?.schedule ? `Giocata ${whereWhen(p.schedule, ctx.courts)}` : undefined,
        action: 'Inserisci',
      };
    case 'set-availability':
      return {
        icon,
        title: `Segna le tue disponibilità per ${per?.label ?? 'questo periodo'}`,
        detail: 'Così l’app trova gli orari che vanno bene a tutti e 4.',
        action: 'Segna disponibilità',
      };
    case 'schedule-match':
      return { icon, title: 'Programma la partita', teams, detail: scheduleReason(it, p, ctx), action: 'Trova un orario' };
    case 'complete-team':
      return {
        icon,
        title: 'Invita il tuo compagno',
        detail: team ? `La coppia ${team.name} aspetta il secondo giocatore.` : undefined,
        action: 'Invia invito',
      };
    case 'request-in-progress':
      return it.missing?.length
        ? {
            icon,
            title: `Aspettiamo ${listNames(it.missing.map(ctx.name))}`,
            teams,
            detail: r ? whereWhen(r, ctx.courts) : undefined,
            action: 'Sollecita su WhatsApp',
          }
        : {
            icon,
            title: 'Avete accettato tutti e 4: aspettiamo la conferma del campo',
            teams,
            detail: r ? whereWhen(r, ctx.courts) : undefined,
            action: 'Apri',
          };
    case 'awaiting-opponents-confirmation':
      return {
        icon,
        title: 'Aspettiamo la conferma degli avversari',
        teams,
        detail: p?.result ? `Risultato ${formatScore(p.result.sets)}` : undefined,
        action: 'Apri',
      };
    case 'team-awaiting-approval':
      return {
        icon,
        title: 'La tua coppia aspetta l’approvazione',
        detail: team ? `${team.name}: la deve approvare l’organizzatore.` : undefined,
        action: 'Apri',
      };
    case 'upcoming-match':
      return {
        icon,
        title: 'Prossima partita',
        teams,
        detail: p?.schedule ? whereWhen(p.schedule, ctx.courts) : undefined,
        action: 'Apri',
      };
    case 'confirm-request': {
      const flag = [r?.offGrid && 'fuori griglia', r?.counterProposal && 'proposta dal campo'].filter(Boolean).join(', ');
      return {
        icon,
        title: 'Richiesta da confermare',
        teams,
        detail: [r && whereWhen(r, ctx.courts), flag].filter(Boolean).join(' · '),
        action: it.action.type === 'inline' ? 'Conferma' : 'Apri richiesta',
      };
    }
    case 'matches-today':
      return { icon, title: `${plural(n, 'partita', 'partite')} oggi sul campo`, action: 'Apri la giornata' };
    case 'disputed-result':
      return { icon, title: 'Contestazione da risolvere', teams, action: 'Risolvi' };
    case 'approve-team':
      return {
        icon,
        title: `Coppia da approvare: ${team?.name ?? ''}`,
        detail: team?.players.length ? listNames(team.players.map(ctx.name)) : undefined,
        action: 'Approva',
      };
    case 'late-matches':
      return { icon, title: `${plural(n, 'partita', 'partite')} in ritardo nel ${per?.label ?? 'periodo'}`, action: 'Vedi' };
    case 'period-ending':
      return {
        icon,
        title: `${plural(n, 'partita', 'partite')} ancora da programmare nel ${per?.label ?? 'periodo'}`,
        action: 'Vedi',
      };
    case 'unconfirmed-results':
      return { icon, title: `${plural(n, 'risultato', 'risultati')} non confermati da più di 48 ore`, action: 'Vedi' };
    case 'tournament-step':
      return {
        icon,
        title: it.step ? STEP[it.step] : 'Prossimo passo del torneo',
        detail: 'È il prossimo passo per far andare avanti il torneo.',
        action: 'Vai',
      };
  }
}

function scheduleReason(it: AttentionItem, p: Match | undefined, ctx: RowContext): string | undefined {
  if (it.reason === 'late') return 'In ritardo: il periodo è finito, si può ancora giocare finché decide l’organizzatore.';
  if (!it.reason || !p) return undefined;
  const latest = [...(ctx.requestsByMatch.get(p.id) ?? [])].sort((a, b) => b.expiresAt.toMillis() - a.expiresAt.toMillis())[0];
  const when = latest ? `${latest.start} di ${labelDate(latest.date)}` : 'l’orario richiesto';
  switch (it.reason) {
    case 'rejected':
      return `Il campo ha rifiutato ${when}: scegli un altro slot.`;
    case 'conflict':
      return `L’orario delle ${when} è andato in conflitto con un’altra prenotazione: scegli un altro slot.`;
    case 'expired':
      return `La richiesta per ${when} è scaduta: scegli un altro orario.`;
    case 'cancelled':
      return `La richiesta per ${when} è stata annullata: scegli un altro orario.`;
  }
}
