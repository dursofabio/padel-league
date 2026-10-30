import { ChevronRight, LogIn, Trophy, WifiOff } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { EmptyState, ErrorState, SkeletonRighe } from '../../components/states';
import { dataOraRoma } from '../../lib/attention';
import { derivaTabellone } from '../../lib/bracket';
import { labelDate } from '../../lib/time';
import { nomeSquadra } from '../../lib/torneo';
import type { Partita, Periodo, Squadra, StatoTorneo, Torneo } from '../../types';

export const STATO_TORNEO: Record<StatoTorneo, string> = {
  iscrizioni: 'Iscrizioni aperte',
  gironi: 'Fase a gironi',
  fasiFinali: 'Fasi finali',
  concluso: 'Concluso',
};

/** Today in Europe/Rome (yyyy-mm-dd). */
export function oggiRoma(): string {
  return dataOraRoma(Date.now()).date;
}

/** Wall clock that ticks every `ms` (deadlines and "now" without reading Date.now() in render logic). */
export function useAdesso(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function AvvisoOffline() {
  return (
    <p role="status" className="mb-4 flex items-center gap-2 text-ink-muted">
      <WifiOff className="size-5 shrink-0" aria-hidden />
      Sei offline: i dati potrebbero non essere aggiornati.
    </p>
  );
}

/** The logged-in user's pair in this tournament (not withdrawn). */
export function useMiaSquadra(squadre: Squadra[]): Squadra | undefined {
  const { user } = useAuth();
  if (!user) return undefined;
  return squadre.find((s) => s.giocatori.includes(user.id) && s.stato !== 'ritirata');
}

/** "Fase a gironi · Periodo 2, fino a dom 30/11" */
export function faseInParole(torneo: Torneo, periodi: Periodo[], today: string): string {
  const base = STATO_TORNEO[torneo.stato];
  if (torneo.stato === 'iscrizioni' || torneo.stato === 'concluso') return base;
  const fase = torneo.stato === 'gironi' ? (p: Periodo) => p.fase === 'gironi' : (p: Periodo) => p.fase !== 'gironi';
  const corrente = periodi.find((p) => fase(p) && p.inizio <= today && p.fine >= today);
  const prossimo = periodi.filter((p) => fase(p) && p.inizio > today).sort((a, b) => a.inizio.localeCompare(b.inizio))[0];
  if (corrente) return `${base} · ${corrente.etichetta}, fino a ${labelDate(corrente.fine)}`;
  if (prossimo) return `${base} · ${prossimo.etichetta} dal ${labelDate(prossimo.inizio)}`;
  return base;
}

/** Winners of each generated final phase (final match with an official result). */
export function vincitori(torneo: Torneo, partite: Partita[]): { fase: string; squadra: string }[] {
  const out: { fase: string; squadra: string }[] = [];
  for (const fase of torneo.fasiGenerate ?? []) {
    const lista = partite.filter((p) => p.fase === fase);
    if (!lista.length) continue;
    const finale = lista.find((p) => !p.prossimaPartita);
    const w = finale ? derivaTabellone(lista, torneo.config.formatoSet).get(finale.id)?.vincitore : null;
    if (w) out.push({ fase: nomeFase(torneo, fase), squadra: w });
  }
  return out;
}

export function nomeFase(torneo: Torneo, fase: string): string {
  return torneo.config.fasiFinali.find((f) => f.nome.toLowerCase() === fase)?.nome ?? fase.charAt(0).toUpperCase() + fase.slice(1);
}

export function RigaVincitori({ torneo, partite, squadraById }: { torneo: Torneo; partite: Partita[]; squadraById: Map<string, Squadra> }) {
  const v = vincitori(torneo, partite);
  if (!v.length) return null;
  return (
    <p className="mb-5 flex items-start gap-2 text-lg font-bold">
      <Trophy className="mt-1 size-5 shrink-0 text-court dark:text-ball" aria-hidden />
      <span>{v.map((x) => `Vincono il ${x.fase}: ${nomeSquadra(squadraById, x.squadra)}`).join(' · ')}</span>
    </p>
  );
}

/** Footer line for anonymous visitors, not a banner. */
export function InvitoAccesso() {
  const { user, loading } = useAuth();
  if (user || loading) return null;
  return (
    <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-ink-muted">
      <LogIn className="size-5 shrink-0" aria-hidden />
      Giochi in questo torneo?
      <Link to="/accedi" className="inline-flex min-h-11 items-center font-semibold text-court underline dark:text-info-ink">
        Accedi per programmare le tue partite.
      </Link>
    </p>
  );
}

/** Loading/not found/error for public tournament pages. Returns null when the content can render. */
export function StatoTorneoPagina({
  isPending,
  error,
  torneo,
  refetch,
  skeleton,
}: {
  isPending: boolean;
  error: unknown;
  torneo: Torneo | undefined;
  refetch: () => void;
  skeleton?: ReactNode;
}): ReactNode {
  if (isPending) return skeleton ?? <SkeletonRighe righe={5} />;
  const code = (error as { code?: string } | null)?.code;
  if (!torneo && (code === 'PGRST116' || code === '22P02' || !error))
    return (
      <EmptyState
        titolo="Torneo non trovato. Controlla il link."
        azione={
          <Link to="/" className="inline-flex min-h-11 items-center font-semibold text-court underline dark:text-info-ink">
            Vai all’elenco dei tornei
          </Link>
        }
      />
    );
  if (error) return <ErrorState errore={error} onRiprova={refetch} />;
  return null;
}

/** A link row in a court-rule list. */
export function RigaLink({ to, children, dettaglio }: { to: string; children: ReactNode; dettaglio?: ReactNode }) {
  return (
    <Link to={to} className="-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-control px-2 py-3 hover:bg-surface-2">
      <span className="grid gap-0.5">
        <span className="text-base font-semibold">{children}</span>
        {dettaglio && <span className="text-sm text-ink-muted">{dettaglio}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}
