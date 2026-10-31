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
import { MATCH_STATUS, REQUEST_STATUS, type StatusEntry, type StatusIcon, type Tone } from '../lib/copy';
import type { MatchStatus, RequestStatus } from '../types';
import { cn } from '../ui/cn';

export const STATUS_ICONS: Record<StatusIcon, LucideIcon> = {
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

export const TONE_CLASSES: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok-ink',
  warn: 'bg-warn-soft text-warn-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  idle: 'bg-idle-soft text-idle-ink',
};

export function Badge({ entry, className, children }: { entry: StatusEntry; className?: string; children?: React.ReactNode }) {
  const Icon = STATUS_ICONS[entry.icon];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap',
        TONE_CLASSES[entry.tone],
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children ?? entry.label}
    </span>
  );
}

export function MatchStatusBadge({ status, className }: { status: MatchStatus; className?: string }) {
  return <Badge entry={MATCH_STATUS[status]} className={className} />;
}

export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return <Badge entry={REQUEST_STATUS[status]} className={className} />;
}
