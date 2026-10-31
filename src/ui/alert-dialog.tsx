import * as A from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
import { Button } from './button';

/** Confirmation only for destructive or irreversible actions (replaces window.confirm). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annulla',
  tone = 'danger',
  onConfirm,
  loading,
  children,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  loading?: boolean;
  children?: ReactNode;
  trigger?: ReactNode;
}) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <A.Trigger asChild>{trigger}</A.Trigger>}
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-40 bg-edge/50" />
        <A.Content className="fixed top-1/2 left-1/2 z-50 grid w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-panel bg-surface p-5 text-ink shadow-raised">
          <A.Title className="text-lg font-bold">{title}</A.Title>
          {description && <A.Description className="text-base text-ink-muted">{description}</A.Description>}
          {children}
          <div className="flex flex-wrap justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="ghost">{cancelLabel}</Button>
            </A.Cancel>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              loading={loading}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
