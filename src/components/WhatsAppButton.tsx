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
  className,
}: {
  testo: string;
  telefono?: string | null;
  children?: React.ReactNode;
  size?: 'md' | 'sm';
  className?: string;
}) {
  return (
    <a
      href={waLink(testo, telefono ?? undefined)}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ variant: 'secondary', size }), className)}
    >
      <MessageCircle aria-hidden />
      {children}
    </a>
  );
}
