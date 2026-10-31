import { BadgeCheck, CircleCheck, CircleX, Hourglass, Info, OctagonAlert, TriangleAlert, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { TONE_CLASSES } from '../../components/StatusBadge';
import type { Tone } from '../../lib/copy';
import type { TeamStatus } from '../../types';
import { cn } from '../../ui';

/** Team states from the glossary (docs/ux/README.md): icon + label + tone. */
export const TEAM_STATUS: Record<TeamStatus, { label: string; icon: LucideIcon; tone: Tone }> = {
  awaiting_partner: { label: 'Manca il compagno', icon: UserPlus, tone: 'warn' },
  pending_approval: { label: 'Da approvare', icon: Hourglass, tone: 'info' },
  approved: { label: 'Approvata', icon: BadgeCheck, tone: 'ok' },
  withdrawn: { label: 'Ritirata', icon: UserMinus, tone: 'idle' },
};

export function TeamStatusBadge({ status }: { status: TeamStatus }) {
  const v = TEAM_STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap', TONE_CLASSES[v.tone])}>
      <v.icon className="size-4" aria-hidden />
      {v.label}
    </span>
  );
}

const TONE_TEXT: Record<'ok' | 'warn' | 'danger' | 'info', string> = {
  ok: 'text-ok-ink',
  warn: 'text-warn-ink',
  danger: 'text-danger-ink',
  info: 'text-info-ink',
};
const TONE_ICON: Record<'ok' | 'warn' | 'danger' | 'info', LucideIcon> = {
  ok: CircleCheck,
  warn: TriangleAlert,
  danger: OctagonAlert,
  info: Info,
};

/** A line of status text: icon + text in the tone's ink colour, never colour alone. */
export function Note({ tone, children, icon, className }: { tone: 'ok' | 'warn' | 'danger' | 'info'; children: ReactNode; icon?: LucideIcon; className?: string }) {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <p className={cn('flex items-start gap-2 text-base', TONE_TEXT[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Precondition row: check or cross with its text. */
export function Precondition({ ok, warning, children }: { ok: boolean; warning?: boolean; children: ReactNode }) {
  const Icon = ok ? CircleCheck : warning ? TriangleAlert : CircleX;
  return (
    <li className={cn('flex min-h-11 items-center gap-2 py-2', ok ? 'text-ink' : warning ? 'text-warn-ink' : 'text-danger-ink')}>
      <Icon className={cn('size-5 shrink-0', ok && 'text-ok-ink')} aria-hidden />
      <span>
        <span className="sr-only">{ok ? 'Fatto: ' : warning ? 'Attenzione: ' : 'Manca: '}</span>
        {children}
      </span>
    </li>
  );
}
