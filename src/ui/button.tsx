import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Lime (the ball) only for the primary action of the screen; everything else is ink on paper.
 * Every filled or outlined button carries the poster's 2px ink border. Minimum height 44px.
 */
export const buttonVariants = cva(
  'inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-4 text-center text-base font-semibold text-balance transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'border-2 border-edge bg-ball font-bold text-ball-ink hover:bg-ball-strong active:translate-y-px',
        secondary: 'border-2 border-line-strong bg-surface text-ink hover:bg-surface-2 active:translate-y-px',
        court: 'border-2 border-court bg-court text-court-ink hover:border-court-deep hover:bg-court-deep active:translate-y-px',
        /** Action inside a lime or clay block: fixed ink, the fills don't invert in the dark theme. */
        ink: 'border-2 border-edge bg-edge font-bold text-paper hover:bg-edge/85 active:translate-y-px',
        ghost: 'text-ink hover:bg-surface-2',
        danger: 'border-2 border-danger bg-surface text-danger-ink hover:bg-danger-soft',
        link: 'min-h-0 px-0 text-ink underline decoration-2 hover:bg-ball hover:text-ball-ink',
      },
      size: {
        md: '',
        sm: 'min-h-11 px-3 text-sm [&_svg]:size-4',
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
            {loading && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
