import {
  Ban,
  CalendarCheck,
  CalendarClock,
  Check,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  Flag,
  Gavel,
  Hourglass,
  Lock,
  Send,
  TimerOff,
  TriangleAlert,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { STATO_PARTITA, STATO_RICHIESTA, type IconaStato, type Tono, type Voce } from '../lib/copy';
import type { StatoPartita, StatoRichiesta } from '../types';
import { cn } from '../ui/cn';

export const ICONE: Record<IconaStato, LucideIcon> = {
  'calendar-clock': CalendarClock,
  send: Send,
  'calendar-check': CalendarCheck,
  trophy: Trophy,
  flag: Flag,
  gavel: Gavel,
  hourglass: Hourglass,
  'circle-check': CircleCheck,
  'circle-x': CircleX,
  ban: Ban,
  'triangle-alert': TriangleAlert,
  'timer-off': TimerOff,
  check: Check,
  'circle-dashed': CircleDashed,
  lock: Lock,
  clock: Clock,
};

export const TONO_CLASSI: Record<Tono, string> = {
  ok: 'bg-ok-soft text-ok-ink',
  warn: 'bg-warn-soft text-warn-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  idle: 'bg-idle-soft text-idle-ink',
};

export function Badge({ voce, className, children }: { voce: Voce; className?: string; children?: React.ReactNode }) {
  const Icon = ICONE[voce.icona];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap',
        TONO_CLASSI[voce.tono],
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children ?? voce.label}
    </span>
  );
}

export function StatoPartitaBadge({ stato, className }: { stato: StatoPartita; className?: string }) {
  return <Badge voce={STATO_PARTITA[stato]} className={className} />;
}

export function StatoRichiestaBadge({ stato, className }: { stato: StatoRichiesta; className?: string }) {
  return <Badge voce={STATO_RICHIESTA[stato]} className={className} />;
}
