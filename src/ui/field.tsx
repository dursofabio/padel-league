import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const control =
  'block w-full min-h-11 rounded-control border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-muted transition-colors duration-150 hover:border-ink-muted focus-visible:border-court focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus aria-[invalid=true]:border-danger disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(control, 'tabular', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(control, 'min-h-24 py-2', className)} {...p} />
));
Textarea.displayName = 'Textarea';

/** Native select: the most familiar control on a phone. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(control, 'tabular appearance-auto pr-8', className)} {...p} />
));
Select.displayName = 'Select';

export function Label({ className, ...p }: LabelPrimitive.LabelProps) {
  return <LabelPrimitive.Root className={cn('text-sm font-semibold text-ink', className)} {...p} />;
}

/** Label + control + hint + error, wired with aria-describedby. The child receives id and aria-* via render prop. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
