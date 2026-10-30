import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none', className)} />;
}

export function Checkbox({ className, ...p }: CheckboxPrimitive.CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-[6px] border-2 border-line-strong bg-surface data-[state=checked]:border-court data-[state=checked]:bg-court data-[state=checked]:text-court-ink',
        className,
      )}
      {...p}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-4" strokeWidth={3} aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Switch({ className, ...p }: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full border-2 border-transparent bg-line-strong transition-colors data-[state=checked]:bg-court',
        className,
      )}
      {...p}
    >
      <SwitchPrimitive.Thumb className="block size-6 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}

/** Segmented control (radio group): for 2–4 mutually exclusive options. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn('inline-flex rounded-control border border-line-strong bg-surface p-0.5', className)}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          className="min-h-11 rounded-[6px] px-3 text-sm font-semibold text-ink-muted data-[state=checked]:bg-court data-[state=checked]:text-court-ink"
        >
          {o.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...p }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex gap-1 overflow-x-auto border-b border-line', className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px min-h-11 border-b-2 border-transparent px-3 text-base font-semibold whitespace-nowrap text-ink-muted hover:text-ink data-[state=active]:border-court data-[state=active]:text-ink dark:data-[state=active]:border-ball',
        className,
      )}
      {...p}
    />
  );
}
export const TabsContent = TabsPrimitive.Content;
