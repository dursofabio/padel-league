import { useState, type ReactNode } from 'react';

export function Card({ title, children, actions }: { title?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-h">
          {title && <h2>{title}</h2>}
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Loading() {
  return <p className="muted">Caricamento…</p>;
}

export function ErrorBox({ error }: { error?: Error | string | null }) {
  if (!error) return null;
  return <p className="error">{typeof error === 'string' ? error : error.message}</p>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone.replaceAll(' ', '-')}`}>{children}</span>;
}

/** Esegue un'azione asincrona gestendo stato di attesa ed errori. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  async function run<T>(fn: () => Promise<T>, ok?: string | ((r: T) => string)): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await fn();
      if (ok) setInfo(typeof ok === 'string' ? ok : ok(r));
      return r;
    } catch (e) {
      setError(messaggioErrore(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  const feedback = (
    <>
      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
    </>
  );
  return { busy, error, info, run, feedback, setError, setInfo };
}

export function messaggioErrore(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === 'permission-denied') return 'Operazione non consentita (permessi insufficienti o dati non validi).';
  if (err?.code === 'auth/invalid-credential') return 'Credenziali non valide.';
  if (err?.code === 'auth/email-already-in-use') return 'Email già registrata.';
  if (err?.code === 'auth/weak-password') return 'Password troppo debole (minimo 6 caratteri).';
  return err?.message ?? String(e);
}

export const STATO_TONO: Record<string, string> = {
  'da programmare': 'warn',
  richiesta: 'blue',
  programmata: 'ok',
  giocata: 'neutral',
  contestata: 'danger',
  tavolino: 'neutral',
  attesa: 'blue',
  confermata: 'ok',
  rifiutata: 'danger',
  annullata: 'neutral',
  conflitto: 'danger',
  scaduta: 'neutral',
};
