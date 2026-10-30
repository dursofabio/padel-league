import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Lime (the ball) only for the primary action of the screen; everything else is court blue or neutral.
 * Minimum height 44px: big targets for mixed-age users on phones.
 */
export const buttonVariants = cva(
  'inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-4 text-base font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ball text-ball-ink shadow-[inset_0_-2px_0_oklch(0_0_0/0.08)] hover:bg-ball-strong active:translate-y-px',
        secondary: 'border border-court bg-surface text-court hover:bg-info-soft dark:border-line-strong dark:text-ink',
        court: 'bg-court text-court-ink hover:bg-court-deep',
        ghost: 'text-ink hover:bg-surface-2',
        danger: 'border border-danger bg-surface text-danger-ink hover:bg-danger-soft',
        link: 'min-h-0 px-0 text-court underline decoration-1 hover:decoration-2 dark:text-info-ink',
      },
      size: {
        md: '',
        sm: 'min-h-9 px-3 text-sm [&_svg]:size-4',
        lg: 'min-h-12 px-5 text-lg',
        icon: 'size-11 px-0',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <LoaderCircle className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
