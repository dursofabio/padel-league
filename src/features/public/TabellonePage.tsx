import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { Bracket } from '../../components/Bracket';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { useCampi, useTorneoData } from '../../data/queries';
import { derivaTabellone, generaTabellone, nomeTurno, qualifica } from '../../lib/bracket';
import { formatRisultato, risultatoUfficiale } from '../../lib/results';
import { classificheTorneo, nomeSquadra } from '../../lib/torneo';
import type { Partita, Squadra, Torneo } from '../../types';
import { cn } from '../../ui/cn';
import { Segmented } from '../../ui/misc';
import { AvvisoOffline, InvitoAccesso, nomeFase, RigaVincitori, StatoTorneoPagina, useMiaSquadra, useOnline } from './comune';

type Vista = 'tabellone' | 'elenco';

/** Knockout bracket of a final phase (/t/:tid/tabellone/:fase), plus an accessible list view. */
export default function TabellonePage() {
  const { tid, fase = '' } = useParams();
  const { user } = useAuth();
  const d = useTorneoData(tid);
  const campi = useCampi();
  const online = useOnline();
  const mia = useMiaSquadra(d.squadre);
  const [vista, setVista] = useState<Vista>('tabellone');
  const chiave = fase.toLowerCase();

  const partite = useMemo(() => d.partite.filter((p) => p.fase === chiave), [d.partite, chiave]);
  const derivate = useMemo(() => (d.torneo ? derivaTabellone(partite, d.torneo.config.formatoSet) : new Map()), [partite, d.torneo]);
  // Not generated yet: provisional crossings "if the groups ended today", computed only when needed.
  const anteprima = useMemo(
    () => (d.torneo && partite.length === 0 ? bracketProvvisorio(d.torneo, d.squadre, d.partite, chiave) : []),
    [d.torneo, d.squadre, d.partite, partite.length, chiave],
  );

  const stato = StatoTorneoPagina({ isPending: d.isPending, error: d.error, torneo: d.torneo, refetch: d.refetch });
  if (stato || !d.torneo)
    return (
      <>
        <PageHeader titolo="Tabellone" sottotitolo={d.torneo?.nome} indietro={{ to: `/t/${tid}`, label: 'Torneo' }} />
        {stato}
      </>
    );
  const torneo = d.torneo;
  const fasi = torneo.config.fasiFinali.map((f) => f.nome.toLowerCase());
  const titolo = `Tabellone ${nomeFase(torneo, chiave)}`;

  return (
    <>
      <PageHeader titolo={titolo} sottotitolo={torneo.nome} indietro={{ to: `/t/${torneo.id}`, label: 'Torneo' }} />
      {!online && <AvvisoOffline />}
      {fasi.length > 1 && (
        <nav aria-label="Fase finale" className="mb-5 flex gap-1 border-b border-line">
          {fasi.map((f) => (
            <NavLink
              key={f}
              to={`/t/${torneo.id}/tabellone/${f}`}
              className={({ isActive }) =>
                cn(
                  '-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-base font-semibold',
                  isActive ? 'border-court text-ink dark:border-ball' : 'border-transparent text-ink-muted hover:text-ink',
                )
              }
            >
              {nomeFase(torneo, f)}
            </NavLink>
          ))}
        </nav>
      )}

      {partite.length === 0 ? (
        anteprima.length ? (
          <div className="grid gap-4">
            <p className="max-w-prose text-ink-muted">
              Il tabellone si crea alla fine dei gironi. Questa è un’anteprima: gli incroci se i gironi finissero oggi.
            </p>
            <Bracket anteprima partite={anteprima} derivate={new Map()} squadraById={d.squadraById} campi={[]} evidenzia={mia ? [mia.id] : undefined} />
          </div>
        ) : (
          <EmptyState titolo="Il tabellone si crea alla fine dei gironi." testo="Quando l’organizzatore genera le fasi finali, qui trovi gli incroci e i risultati." />
        )
      ) : (
        <div className="grid gap-5">
          {torneo.stato === 'concluso' && <RigaVincitori torneo={torneo} partite={d.partite} squadraById={d.squadraById} />}
          <Segmented
            label="Vista"
            className="hidden max-w-full flex-wrap justify-self-start md:inline-flex"
            value={vista}
            onValueChange={setVista}
            options={[
              { value: 'tabellone', label: 'Tabellone' },
              { value: 'elenco', label: 'Vista elenco' },
            ]}
          />
          {/* Mobile: the bracket is already one ordered list per round with scroll-snap; desktop can switch to the list. */}
          <div className={cn(vista === 'elenco' && 'md:hidden')}>
            <Bracket
              partite={partite}
              derivate={derivate}
              squadraById={d.squadraById}
              campi={campi.data ?? []}
              hrefPartita={user ? (p) => `/t/${torneo.id}/partite/${p.id}` : undefined}
              evidenzia={mia ? [mia.id] : undefined}
            />
          </div>
          {vista === 'elenco' && (
            <div className="hidden md:block">
              <Elenco partite={partite} derivate={derivate} squadraById={d.squadraById} miaId={mia?.id} />
            </div>
          )}
        </div>
      )}
      <InvitoAccesso />
    </>
  );
}

function Elenco({
  partite,
  derivate,
  squadraById,
  miaId,
}: {
  partite: Partita[];
  derivate: Map<string, { squadraA: string | null; squadraB: string | null; vincitore: string | null }>;
  squadraById: Map<string, Squadra>;
  miaId?: string;
}) {
  const turni = Math.max(0, ...partite.map((p) => p.turno ?? 0));
  const byId = new Map(partite.map((p) => [p.id, p]));
  /** TBD side: "Vincente Quarto 1" from the feeding match. */
  const lato = (p: Partita, l: 'A' | 'B', id: string | null) => {
    if (id) return nomeSquadra(squadraById, id);
    const f = partite.find((x) => x.prossimaPartita === p.id && x.lato === l);
    return f ? `Vincente ${etichetta(f)}` : 'da definire';
  };
  const etichetta = (p: Partita) => {
    const nome = nomeTurno(p.turno ?? 1, turni);
    const quante = partite.filter((x) => x.turno === p.turno).length;
    const n = (p.posizione ?? 0) + 1;
    if (quante <= 1) return nome;
    return `${nome === 'Quarti' ? 'Quarto' : nome} ${n}`;
  };
  return (
    <ol className="grid gap-6">
      {Array.from({ length: turni }, (_, i) => i + 1).map((t) => (
        <li key={t}>
          <h2 className="mb-1 border-b-2 border-line-strong pb-1 text-base font-bold">{nomeTurno(t, turni)}</h2>
          <ol className="court-rule">
            {partite
              .filter((p) => p.turno === t)
              .sort((a, b) => (a.posizione ?? 0) - (b.posizione ?? 0))
              .map((p) => {
                const dv = derivate.get(p.id);
                const a = lato(p, 'A', dv?.squadraA ?? p.squadraA);
                const b = lato(p, 'B', dv?.squadraB ?? p.squadraB);
                const ris = risultatoUfficiale(byId.get(p.id)!) ? formatRisultato(p.risultato!.set) : null;
                const w = dv?.vincitore ? nomeSquadra(squadraById, dv.vincitore) : null;
                const mia = !!miaId && (dv?.squadraA === miaId || dv?.squadraB === miaId);
                return (
                  <li key={p.id} className={cn('flex min-h-12 items-start gap-2 py-3', mia && 'font-semibold')}>
                    {w && <Check className="mt-1 size-4 shrink-0" aria-hidden />}
                    <span>
                      {etichetta(p)}: {a} contro {b}
                      {ris && (
                        <>
                          , <span className="tabular">{ris}</span>
                        </>
                      )}
                      {w && <>, vincono <strong>{w}</strong></>}
                    </span>
                  </li>
                );
              })}
          </ol>
        </li>
      ))}
    </ol>
  );
}

/** Provisional bracket of a phase from today's standings (never saved). */
function bracketProvvisorio(torneo: Torneo, squadre: Squadra[], partite: Partita[], fase: string): Partita[] {
  if (!partite.some((p) => p.fase === 'gironi')) return [];
  const cfg = torneo.config;
  const q = qualifica(classificheTorneo(torneo, squadre, partite), cfg.fasiFinali, cfg.criterioQualificazione, torneo.sorteggio ?? {});
  const f = q.fasi.find((x) => x.nome.toLowerCase() === fase);
  if (!f || f.squadre.length < 2) return [];
  const gironeDi = new Map(f.squadre.map((s) => [s.squadraId, s.girone]));
  return generaTabellone(fase, f.squadre.map((s) => s.squadraId), (id) => gironeDi.get(id)).map((t) => ({
    ...t,
    fase,
    giocatoriA: [],
    giocatoriB: [],
    giocatori: [],
    stato: 'da programmare' as const,
  }));
}
