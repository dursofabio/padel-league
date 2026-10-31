import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Page heading: a single h1 in poster type, an optional back link and actions. No kicker above it. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 grid gap-2">
      {back && (
        <Link to={back.to} className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-sm font-bold text-ink hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="poster text-poster break-words sm:text-poster-xl">{title}</h1>
          {subtitle && <div className="font-semibold text-ink-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Page section: poster h2 and content, separated from the next one by a 2px ink rule. */
export function Section({ title, actions, children, id }: { title: ReactNode; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="grid gap-3 border-t-2 border-line-strong pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="poster text-poster-sm">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
