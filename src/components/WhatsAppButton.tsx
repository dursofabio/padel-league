import { MessageCircle } from 'lucide-react';
import { waLink } from '../lib/whatsapp';
import { buttonVariants } from '../ui/button';
import { cn } from '../ui/cn';

/** Every key moment has a ready message for WhatsApp. */
export function WhatsAppButton({
  testo,
  telefono,
  children = 'Condividi su WhatsApp',
  size = 'md',
  variant = 'secondary',
  className,
}: {
  testo: string;
  telefono?: string | null;
  children?: React.ReactNode;
  size?: 'md' | 'sm';
  /** 'primary' (lime) only when WhatsApp is the main action of the screen. */
  variant?: 'secondary' | 'primary';
  className?: string;
}) {
  return (
    <a
      href={waLink(testo, telefono ?? undefined)}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ variant, size }), className)}
    >
      <MessageCircle aria-hidden />
      {children}
    </a>
  );
}
