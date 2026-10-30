import { BadgeCheck, CircleCheck, CircleX, Hourglass, Info, OctagonAlert, TriangleAlert, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { TONO_CLASSI } from '../../components/StatusBadge';
import type { Tono } from '../../lib/copy';
import type { StatoSquadra } from '../../types';
import { cn } from '../../ui';

/** Team states from the glossary (docs/ux/README.md): icon + label + tone. */
export const STATO_SQUADRA: Record<StatoSquadra, { label: string; icon: LucideIcon; tono: Tono }> = {
  'in attesa partner': { label: 'Manca il compagno', icon: UserPlus, tono: 'warn' },
  'da approvare': { label: 'Da approvare', icon: Hourglass, tono: 'info' },
  approvata: { label: 'Approvata', icon: BadgeCheck, tono: 'ok' },
  ritirata: { label: 'Ritirata', icon: UserMinus, tono: 'idle' },
};

export function StatoSquadraBadge({ stato }: { stato: StatoSquadra }) {
  const v = STATO_SQUADRA[stato];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap', TONO_CLASSI[v.tono])}>
      <v.icon className="size-4" aria-hidden />
      {v.label}
    </span>
  );
}

const TESTO_TONO: Record<'ok' | 'warn' | 'danger' | 'info', string> = {
  ok: 'text-ok-ink',
  warn: 'text-warn-ink',
  danger: 'text-danger-ink',
  info: 'text-info-ink',
};
const ICONA_TONO: Record<'ok' | 'warn' | 'danger' | 'info', LucideIcon> = {
  ok: CircleCheck,
  warn: TriangleAlert,
  danger: OctagonAlert,
  info: Info,
};

/** A line of status text: icon + text in the tone's ink colour, never colour alone. */
export function Nota({ tono, children, icon, className }: { tono: 'ok' | 'warn' | 'danger' | 'info'; children: ReactNode; icon?: LucideIcon; className?: string }) {
  const Icon = icon ?? ICONA_TONO[tono];
  return (
    <p className={cn('flex items-start gap-2 text-base', TESTO_TONO[tono], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Precondition row: check or cross with its text. */
export function Precondizione({ ok, avviso, children }: { ok: boolean; avviso?: boolean; children: ReactNode }) {
  const Icon = ok ? CircleCheck : avviso ? TriangleAlert : CircleX;
  return (
    <li className={cn('flex min-h-11 items-center gap-2 py-2', ok ? 'text-ink' : avviso ? 'text-warn-ink' : 'text-danger-ink')}>
      <Icon className={cn('size-5 shrink-0', ok && 'text-ok-ink')} aria-hidden />
      <span>
        <span className="sr-only">{ok ? 'Fatto: ' : avviso ? 'Attenzione: ' : 'Manca: '}</span>
        {children}
      </span>
    </li>
  );
}
