/** Small local pieces shared by the match screens. */
import { AlarmClock, Ban, CircleCheck, CircleMinus, Clock3, Hourglass, Lock, Repeat, Send, UserX, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { TONE_CLASSES } from '../../../components/StatusBadge';
import type { Tone } from '../../../lib/copy';
import type { SlotColor } from '../../../lib/slots';
import { cn } from '../../../ui';

/** Slot encoding from the glossary (docs/ux/README.md): icon + tone + pattern, text added by the caller. */
export const SLOT_UI: Record<SlotColor, { icon: LucideIcon; tone: Tone; pattern?: 'hatch' | 'dots'; name: string }> = {
  green: { icon: CircleCheck, tone: 'ok', name: '4/4 liberi' },
  yellow: { icon: UserX, tone: 'warn', name: '3/4, ne manca uno' },
  grey: { icon: CircleMinus, tone: 'idle', name: '2/4 o meno: non si può chiedere' },
  red: { icon: Lock, tone: 'danger', pattern: 'hatch', name: 'Occupato' },
  blue: { icon: Send, tone: 'info', name: 'Richiesto da un’altra partita' },
};

/** Icon + text badge with a semantic tone (for labels not in the shared glossary map). */
export function Pill({ icon: Icon, tone, children, className }: { icon: LucideIcon; tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border border-current px-2.5 py-0.5 text-sm font-bold', TONE_CLASSES[tone], className)}>
      <Icon className="size-4" aria-hidden />
      {children}
    </span>
  );
}

export const LateBadge = () => (
  <Pill icon={AlarmClock} tone="danger">
    In ritardo
  </Pill>
);
export const OffGridBadge = () => (
  <Pill icon={Clock3} tone="info">
    Fuori griglia
  </Pill>
);
export const CounterProposalBadge = () => (
  <Pill icon={Repeat} tone="info">
    Proposta dal campo
  </Pill>
);
export const AwaitingConfirmationBadge = () => (
  <Pill icon={Hourglass} tone="warn">
    Risultato da confermare
  </Pill>
);
export const UnusableIcon = Ban;

/** Lets buttons and button-links wrap at large text sizes (200% text on a 390px phone, WCAG 1.4.10). */
export const WRAP = '[&_a]:whitespace-normal [&_button]:whitespace-normal';

/** Current time, refreshed every minute (expiry countdowns, past slots). */
export function useNowTick(interval = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

/** Inline notice on the neutral ground: icon + text, tone carried by the icon and the text colour. */
export function Notice({ icon: Icon, tone = 'idle', children, className }: { icon: LucideIcon; tone?: Tone; children: ReactNode; className?: string }) {
  const text = { ok: 'text-ok-ink', warn: 'text-warn-ink', danger: 'text-danger-ink', info: 'text-info-ink', idle: 'text-ink' }[tone];
  return (
    <p className={cn('flex items-start gap-2 text-base', text, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
