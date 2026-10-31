import { ArrowDown, ArrowRight, ArrowUp, Equal, Monitor, RefreshCw, RotateCcw, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Bracket } from '../../components/Bracket';
import { Section } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { StandingsTable } from '../../components/StandingsTable';
import { actions, useAction } from '../../data/mutations';
import { useCourts } from '../../data/queries';
import { deriveBracket, qualify } from '../../lib/bracket';
import { groupsCompleted, teamName, tournamentStandings } from '../../lib/tournament';
import { Button, ConfirmDialog } from '../../ui';
import { bracketUpdates, drawWithBlock, moveInBlock, ordinal, planPhase, previewMatches, sameDraw, tiedBlocks } from './logic';
import { Note } from './parts';
import type { SectionProps } from './types';

export default function Finals({ d }: SectionProps) {
  const { tournament, teams, matches, periods, teamById } = d;
  const courts = useCourts();
  const cfg = tournament.config;
  const generated = tournament.generatedPhases ?? [];
  const groupMatches = matches.filter((m) => m.phase === 'groups');
  const missing = groupMatches.filter((m) => m.status !== 'played' && m.status !== 'forfeit').length;
  const completed = groupsCompleted(matches);
  const saved = useMemo(() => tournament.draw ?? {}, [tournament.draw]);
  const [draft, setDraft] = useState<Record<string, number>>(saved);
  const [announcement, setAnnouncement] = useState('');
  const [confirming, setConfirming] = useState(false);
  const withDraw = cfg.tiebreakers.includes('draw');

  // tie blocks come from the standings without any draw, so they stay put while the organizer reorders
  const blocks = useMemo(() => {
    const base = tournamentStandings({ ...tournament, draw: {} }, teams, matches);
    return Object.fromEntries(Object.entries(base).map(([g, rows]) => [g, tiedBlocks(rows)]));
  }, [tournament, teams, matches]);
  const standings = useMemo(() => tournamentStandings({ ...tournament, draw: draft }, teams, matches), [tournament, teams, matches, draft]);
  const q = useMemo(() => qualify(standings, cfg.finals, cfg.qualificationRule, draft), [standings, cfg, draft]);
  const unresolved = Object.values(standings)
    .flat()
    .filter((r) => r.tied).length;
  const unsaved = !sameDraw(draft, saved);
  const groupCount = Object.keys(standings).length;

  const saveOrder = useAction(actions.updateTournament, { success: 'Ordine dei pari merito salvato' });
  const save = () => {
    let s = { ...draft };
    for (const [g, bl] of Object.entries(blocks))
      for (const b of bl) {
        const order = standings[g].map((r) => r.teamId).filter((id) => b.includes(id));
        if (order.some((id) => !(id in s))) s = drawWithBlock(s, order);
      }
    setDraft(s);
    saveOrder.mutate({ id: tournament.id, draw: s });
  };

  const toGenerate = useMemo(
    () =>
      q.phases
        .filter((f) => !generated.includes(f.name.toLowerCase()))
        .map((f) => ({
          phase: f,
          rows: planPhase(
            f.name,
            f.teams.map((t) => t.teamId),
            (id) => teamById.get(id)?.group ?? undefined,
            periods,
          ),
        })),
    [q, generated, teamById, periods],
  );
  const total = toGenerate.reduce((n, f) => n + f.rows.length, 0);
  const generate = useAction(
    async (phases: typeof toGenerate) => {
      let n = 0;
      for (const f of phases)
        if (f.rows.length) n += Number((await actions.generateFinals({ tournament: tournament.id, phase: f.phase.name.toLowerCase(), matches: f.rows })) ?? 0);
      return n;
    },
    { success: (n) => `${n} partite dei tabelloni create`, onSuccess: () => setConfirming(false) },
  );

  const updates = useMemo(() => bracketUpdates(matches, cfg.setFormat, generated), [matches, cfg.setFormat, generated]);
  const [syncOutcome, setSyncOutcome] = useState<string | null>(null);
  const sync = useAction(actions.syncBracket, {
    success: (n) => `${n} partite aggiornate`,
    onSuccess: (n) => setSyncOutcome(`${n} partite aggiornate: ora si possono programmare.`),
  });

  if (!groupMatches.length)
    return (
      <EmptyState
        title="Prima servono i gironi"
        text="Le fasi finali partono dalle classifiche dei gironi. Genera il calendario e fai giocare le partite."
        action={
          <Button asChild variant="secondary">
            <Link to={`/t/${tournament.id}/organizza/calendario`}>Vai al calendario</Link>
          </Button>
        }
      />
    );

  const blockReason = !completed
    ? `Mancano ${missing} partite dei gironi.`
    : unresolved
      ? 'Risolvi prima i pari merito.'
      : unsaved
        ? 'Salva l’ordine dei pari merito.'
        : null;

  return (
    <div className="grid gap-8">
      <Note tone="info" icon={Monitor} className="lg:hidden">
        Meglio da computer: tabelloni e classifiche sono larghi.
      </Note>

      {generated.length > 0 && (
        <Section title="Tabelloni generati" id="fin-generated">
          <p className="max-w-prose text-ink-muted">
            Chi avanza si ricava dai risultati confermati. «Aggiorna i tabelloni» scrive le coppie qualificate nelle partite del turno dopo, così si
            possono programmare.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={updates.length ? 'primary' : 'secondary'}
              disabled={!updates.length}
              loading={sync.isPending}
              onClick={() => sync.mutate({ tournament: tournament.id, updates })}
            >
              <RefreshCw aria-hidden /> Aggiorna i tabelloni
            </Button>
            <p className="text-ink-muted" aria-live="polite">
              {syncOutcome ?? (updates.length ? `${updates.length} partite da aggiornare.` : 'I tabelloni sono già aggiornati.')}
            </p>
          </div>
          {generated.map((phase) => {
            const phaseMatches = matches.filter((m) => m.phase === phase);
            return (
              <section key={phase} aria-labelledby={`fin-${phase}`} className="grid gap-2">
                <h3 id={`fin-${phase}`} className="flex flex-wrap items-center justify-between gap-2 font-bold">
                  <span className="inline-flex items-center gap-2">
                    <Trophy className="size-5" aria-hidden /> {phase.charAt(0).toUpperCase() + phase.slice(1)}
                  </span>
                  <Link to={`/t/${tournament.id}/tabellone/${phase}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink underline">
                    Tabellone pubblico <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </h3>
                <div className="[&>[role=region]]:scroll-px-4 md:[&>[role=region]]:scroll-px-0">
                <Bracket
                  matches={phaseMatches}
                  derived={deriveBracket(phaseMatches, cfg.setFormat)}
                  teamById={teamById}
                  courts={courts.data ?? []}
                  matchHref={(m) => `/t/${tournament.id}/partite/${m.id}`}
                />
                </div>
              </section>
            );
          })}
        </Section>
      )}

      {toGenerate.length > 0 && (
        <>
          {!completed && <Note tone="warn">L’anteprima è provvisoria: mancano {missing} partite dei gironi.</Note>}

          <Section title="Classifiche finali dei gironi" id="fin-standings">
            {Object.entries(standings).map(([g, rows]) => (
              <div key={g} className="grid gap-3">
                <h3 className="font-bold">Girone {g}</h3>
                <StandingsTable group={g} rows={rows} teamById={teamById} phases={cfg.finals} groupCount={groupCount} />
                {completed && (blocks[g] ?? []).map((b, bi) => {
                  const order = rows.map((r) => r.teamId).filter((id) => b.includes(id));
                  const pos = rows.findIndex((r) => r.teamId === order[0]) + 1;
                  return (
                    <div key={bi} className="grid gap-2 border-t border-line pt-3">
                      <p className="flex items-center gap-2 font-semibold text-warn-ink">
                        <Equal className="size-5" aria-hidden />
                        Pari merito dal {ordinal(pos)} posto: {withDraw ? 'decidi tu l’ordine (sorteggio).' : 'non risolvibile a mano.'}
                      </p>
                      {withDraw ? (
                        <ol className="court-rule">
                          {order.map((id, i) => {
                            const name = teamName(teamById, id);
                            const move = (dir: -1 | 1) => {
                              const next = moveInBlock(order, id, dir);
                              setDraft((s) => drawWithBlock(s, next));
                              setAnnouncement(`${name} ora è ${ordinal(pos + next.indexOf(id))} nel girone ${g}`);
                            };
                            return (
                              <li key={id} className="flex min-h-12 items-center gap-2 py-1">
                                <span className="tabular w-8 text-right font-bold text-ink-muted">{pos + i}</span>
                                <span className="flex-1">{name}</span>
                                <Button variant="ghost" size="icon" disabled={i === 0} aria-label={`Sposta su: ${name}`} onClick={() => move(-1)}>
                                  <ArrowUp aria-hidden />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={i === order.length - 1}
                                  aria-label={`Sposta giù: ${name}`}
                                  onClick={() => move(1)}
                                >
                                  <ArrowDown aria-hidden />
                                </Button>
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <p className="text-ink-muted">
                          Aggiungi «Sorteggio» in fondo agli spareggi in{' '}
                          <Link to={`/t/${tournament.id}/organizza/configurazione`} className="font-semibold underline">
                            Configurazione
                          </Link>
                          .
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <p className="sr-only" aria-live="polite">
              {announcement}
            </p>
            {!completed && (
              <p className="text-ink-muted">Classifiche provvisorie. Gli eventuali pari merito si risolvono qui quando i gironi sono conclusi.</p>
            )}
            {completed && withDraw && Object.values(blocks).some((b) => b.length) && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" loading={saveOrder.isPending} disabled={!unsaved && unresolved === 0} onClick={save}>
                  Salva ordine
                </Button>
                <Button variant="ghost" disabled={!Object.keys(draft).length} onClick={() => setDraft({})}>
                  <RotateCcw aria-hidden /> Azzera
                </Button>
                {unsaved && <span className="text-sm text-warn-ink">Ordine non ancora salvato.</span>}
              </div>
            )}
          </Section>

          {toGenerate.map(({ phase, rows }) => (
            <Section key={phase.name} title={`${phase.name}: ${phase.teams.length}/${phase.spots} posti`} id={`fin-${phase.name}`}>
              {phase.teams.length < 2 ? (
                <Note tone="warn">Non ci sono abbastanza coppie per questo tabellone.</Note>
              ) : (
                <>
                  <ol className="tabular grid gap-1 sm:grid-cols-2">
                    {phase.teams.map((t, i) => (
                      <li key={t.teamId}>
                        {i + 1}. {t.group}
                        {t.position} {teamName(teamById, t.teamId)}
                      </li>
                    ))}
                  </ol>
                  {phase.teams.length < phase.spots && (
                    <Note tone="info">Posti non coperti: le teste di serie migliori passano direttamente al turno dopo (bye).</Note>
                  )}
                  <h3 className="font-bold">Anteprima del tabellone</h3>
                  {/* scroll-padding keeps the page gutter when the rounds snap (shared Bracket uses snap-start) */}
                  <div className="[&>[role=region]]:scroll-px-4 md:[&>[role=region]]:scroll-px-0">
                    <Bracket preview matches={previewMatches(phase.name.toLowerCase(), rows)} derived={new Map()} teamById={teamById} courts={[]} />
                  </div>
                </>
              )}
            </Section>
          ))}

          {q.excluded.length > 0 && (
            <Section title="Coppie escluse" id="fin-excluded">
              <p>{q.excluded.map((t) => teamName(teamById, t.teamId)).join(', ')}</p>
            </Section>
          )}

          <div className="grid justify-items-start gap-2">
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title="Generare le fasi finali?"
              description={`${total} partite: ${toGenerate
                .filter((f) => f.rows.length)
                .map((f) => `${f.phase.name} ${f.rows.length}`)
                .join(', ')}. Dopo non potrai cambiare chi è qualificato.`}
              confirmLabel="Genera le fasi finali"
              tone="primary"
              loading={generate.isPending}
              onConfirm={() => generate.mutate(toGenerate)}
              trigger={
                <Button variant="primary" size="lg" disabled={!!blockReason || total === 0}>
                  <Trophy aria-hidden /> Genera le fasi finali
                </Button>
              }
            />
            {blockReason && <p className="text-warn-ink">{blockReason}</p>}
          </div>
        </>
      )}
    </div>
  );
}
