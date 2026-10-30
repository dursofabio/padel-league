import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Sheet: bottom on mobile, side panel from 768px. Preferred to modals for contextual tasks
 * (pick a slot, add an occupation): the context stays visible.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-[oklch(0.2_0.04_258/0.45)] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <D.Content
          className={cn(
            'fixed z-50 flex max-h-[92dvh] flex-col bg-surface text-ink shadow-raised outline-none',
            'inset-x-0 bottom-0 rounded-t-panel data-[state=open]:animate-[sheet-up_220ms_cubic-bezier(0.16,1,0.3,1)]',
            'md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[28rem] md:rounded-none md:rounded-l-panel md:data-[state=open]:animate-[sheet-left_220ms_cubic-bezier(0.16,1,0.3,1)]',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-4 pb-3">
            <div className="grid gap-1">
              <D.Title className="text-lg font-bold">{title}</D.Title>
              {description ? (
                <D.Description className="text-sm text-ink-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dettagli'}</D.Description>
              )}
            </div>
            <D.Close className="-mr-2 grid size-11 place-items-center rounded-control text-ink-muted hover:bg-surface-2" aria-label="Chiudi">
              <X className="size-5" aria-hidden />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="pb-safe flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const SheetClose = D.Close;
