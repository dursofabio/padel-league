/** Small local pieces shared by the match screens. */
import { AlarmClock, Ban, CircleCheck, CircleMinus, Clock3, Hourglass, Lock, Repeat, Send, UserX, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { TONO_CLASSI } from '../../../components/StatusBadge';
import type { Tono } from '../../../lib/copy';
import type { ColoreSlot } from '../../../lib/slots';
import { cn } from '../../../ui';

/** Slot encoding from the glossary (docs/ux/README.md): icon + tone + pattern, text added by the caller. */
export const SLOT_UI: Record<ColoreSlot, { icona: LucideIcon; tono: Tono; pattern?: 'hatch' | 'dots'; nome: string }> = {
  verde: { icona: CircleCheck, tono: 'ok', nome: '4/4 liberi' },
  giallo: { icona: UserX, tono: 'warn', nome: '3/4, ne manca uno' },
  grigio: { icona: CircleMinus, tono: 'idle', nome: '2/4 o meno: non si può chiedere' },
  rosso: { icona: Lock, tono: 'danger', pattern: 'hatch', nome: 'Occupato' },
  blu: { icona: Send, tono: 'info', nome: 'Richiesto da un’altra partita' },
};

/** Icon + text badge with a semantic tone (for labels not in the shared glossary map). */
export function Pill({ icona: Icona, tono, children, className }: { icona: LucideIcon; tono: Tono; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold', TONO_CLASSI[tono], className)}>
      <Icona className="size-4" aria-hidden />
      {children}
    </span>
  );
}

export const InRitardoBadge = () => (
  <Pill icona={AlarmClock} tono="danger">
    In ritardo
  </Pill>
);
export const FuoriGrigliaBadge = () => (
  <Pill icona={Clock3} tono="info">
    Fuori griglia
  </Pill>
);
export const ControPropostaBadge = () => (
  <Pill icona={Repeat} tono="info">
    Proposta dal campo
  </Pill>
);
export const DaConfermareBadge = () => (
  <Pill icona={Hourglass} tono="warn">
    Risultato da confermare
  </Pill>
);
export const InutilizzabileIcona = Ban;

/** Lets buttons and button-links wrap at large text sizes (200% text on a 390px phone, WCAG 1.4.10). */
export const AVVOLGI = '[&_a]:whitespace-normal [&_button]:whitespace-normal';

/** Current time, refreshed every minute (expiry countdowns, past slots). */
export function useOra(intervallo = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervallo);
    return () => clearInterval(t);
  }, [intervallo]);
  return now;
}

/** Inline notice on the neutral ground: icon + text, tone carried by the icon and the text colour. */
export function Avviso({ icona: Icona, tono = 'idle', children, className }: { icona: LucideIcon; tono?: Tono; children: ReactNode; className?: string }) {
  const testo = { ok: 'text-ok-ink', warn: 'text-warn-ink', danger: 'text-danger-ink', info: 'text-info-ink', idle: 'text-ink' }[tono];
  return (
    <p className={cn('flex items-start gap-2 text-base', testo, className)}>
      <Icona className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
