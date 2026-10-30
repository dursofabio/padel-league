/** Link WhatsApp generati lato client (gratuiti, nessun backend). */
export function waLink(testo: string, telefono?: string): string {
  const num = (telefono ?? '').replace(/[^\d]/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(testo)}`;
}

/** URL assoluto di una rotta hash dell'app. */
export function appUrl(path: string): string {
  const base = window.location.href.split('#')[0];
  return `${base}#${path.startsWith('/') ? path : `/${path}`}`;
}
