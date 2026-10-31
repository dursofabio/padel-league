/** WhatsApp links generated on the client (free, no backend). */
export function waLink(text: string, phone?: string): string {
  const num = (phone ?? '').replace(/[^\d]/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/** Absolute URL of an app hash route. */
export function appUrl(path: string): string {
  const base = window.location.href.split('#')[0];
  return `${base}#${path.startsWith('/') ? path : `/${path}`}`;
}
