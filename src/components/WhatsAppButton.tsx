import { MessageCircle } from 'lucide-react';
import { waLink } from '../lib/whatsapp';
import { buttonVariants } from '../ui/button';
import { cn } from '../ui/cn';

/** Every key moment has a ready message for WhatsApp. */
export function WhatsAppButton({
  text,
  phone,
  children = 'Condividi su WhatsApp',
  size = 'md',
  variant = 'secondary',
  className,
}: {
  text: string;
  phone?: string | null;
  children?: React.ReactNode;
  size?: 'md' | 'sm';
  /** 'primary' (lime) only when WhatsApp is the main action of the screen; 'ink' inside a lime or clay block. */
  variant?: 'secondary' | 'primary' | 'ink';
  className?: string;
}) {
  return (
    <a
      href={waLink(text, phone ?? undefined)}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ variant, size }), className)}
    >
      <MessageCircle aria-hidden />
      {children}
    </a>
  );
}
