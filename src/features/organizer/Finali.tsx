import { ArrowDown, ArrowRight, ArrowUp, Equal, Monitor, RefreshCw, RotateCcw, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Bracket } from '../../components/Bracket';
import { Sezione } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { StandingsTable } from '../../components/StandingsTable';
import { azioni, useAzione } from '../../data/mutations';
import { useCampi } from '../../data/queries';
import { derivaTabellone, qualifica } from '../../lib/bracket';
import { classificheTorneo, gironiConclusi, nomeSquadra } from '../../lib/torneo';
import { Button, ConfirmDialog } from '../../ui';
import {
  aggiornamentiTabellone,
  blocchiPari,
  ordinale,
  partiteAnteprima,
  pianoFase,
  sorteggioConBlocco,
  spostaNelBlocco,
  stessoSorteggio,
} from './logic';
import { Nota } from './parti';
import type { PropsSezione } from './tipi';

export default function Finali({ d }: PropsSezione) {
  const { torneo, squadre, partite, periodi, squadraById } = d;
  const campi = useCampi();
  const cfg = torneo.config;
  const generate = torneo.fasiGenerate ?? [];
  const pg = partite.filter((p) => p.fase === 'gironi');
  const mancanti = pg.filter((p) => p.stato !== 'giocata' && p.stato !== 'tavolino').length;
  const conclusi = gironiConclusi(partite);
  const salvato = useMemo(() => torneo.sorteggio ?? {}, [torneo.sorteggio]);
  const [bozza, setBozza] = useState<Record<string, number>>(salvato);
  const [annuncio, setAnnuncio] = useState('');
  const [conferma, setConferma] = useState(false);
  const conSorteggio = cfg.spareggi.includes('sorteggio');

  // tie blocks come from the standings without any draw, so they stay put while the organizer reorders
  const blocchi = useMemo(() => {
    const base = classificheTorneo({ ...torneo, sorteggio: {} }, squadre, partite);
    return Object.fromEntries(Object.entries(base).map(([g, righe]) => [g, blocchiPari(righe)]));
  }, [torneo, squadre, partite]);
  const classifiche = useMemo(() => classificheTorneo({ ...torneo, sorteggio: bozza }, squadre, partite), [torneo, squadre, partite, bozza]);
  const q = useMemo(() => qualifica(classifiche, cfg.fasiFinali, cfg.criterioQualificazione, bozza), [classifiche, cfg, bozza]);
  const irrisolti = Object.values(classifiche)
    .flat()
    .filter((r) => r.pariMerito).length;
  const nonSalvato = !stessoSorteggio(bozza, salvato);
  const nGironi = Object.keys(classifiche).length;

  const salvaOrdine = useAzione(azioni.aggiornaTorneo, { successo: 'Ordine dei pari merito salvato' });
  const salva = () => {
    let s = { ...bozza };
    for (const [g, bl] of Object.entries(blocchi))
      for (const b of bl) {
        const ordine = classifiche[g].map((r) => r.squadraId).filter((id) => b.includes(id));
        if (ordine.some((id) => !(id in s))) s = sorteggioConBlocco(s, ordine);
      }
    setBozza(s);
    salvaOrdine.mutate({ id: torneo.id, sorteggio: s });
  };

  const daGenerare = useMemo(
    () =>
      q.fasi
        .filter((f) => !generate.includes(f.nome.toLowerCase()))
        .map((f) => ({
          fase: f,
          righe: pianoFase(
            f.nome,
            f.squadre.map((s) => s.squadraId),
            (id) => squadraById.get(id)?.girone ?? undefined,
            periodi,
          ),
        })),
    [q, generate, squadraById, periodi],
  );
  const totale = daGenerare.reduce((n, f) => n + f.righe.length, 0);
  const genera = useAzione(
    async (fasi: typeof daGenerare) => {
      let n = 0;
      for (const f of fasi)
        if (f.righe.length) n += Number((await azioni.generaFasiFinali({ torneo: torneo.id, fase: f.fase.nome.toLowerCase(), partite: f.righe })) ?? 0);
      return n;
    },
    { successo: (n) => `${n} partite dei tabelloni create`, onSuccess: () => setConferma(false) },
  );

  const updates = useMemo(() => aggiornamentiTabellone(partite, cfg.formatoSet, generate), [partite, cfg.formatoSet, generate]);
  const [esitoSync, setEsitoSync] = useState<string | null>(null);
  const sync = useAzione(azioni.sincronizzaTabellone, {
    successo: (n) => `${n} partite aggiornate`,
    onSuccess: (n) => setEsitoSync(`${n} partite aggiornate: ora si possono programmare.`),
  });

  if (!pg.length)
    return (
      <EmptyState
        titolo="Prima servono i gironi"
        testo="Le fasi finali partono dalle classifiche dei gironi. Genera il calendario e fai giocare le partite."
        azione={
          <Button asChild variant="secondary">
            <Link to={`/t/${torneo.id}/organizza/calendario`}>Vai al calendario</Link>
          </Button>
        }
      />
    );

  const motivoBlocco = !conclusi
    ? `Mancano ${mancanti} partite dei gironi.`
    : irrisolti
      ? 'Risolvi prima i pari merito.'
      : nonSalvato
        ? 'Salva l’ordine dei pari merito.'
        : null;

  return (
    <div className="grid gap-8">
      <Nota tono="info" icon={Monitor} className="lg:hidden">
        Meglio da computer: tabelloni e classifiche sono larghi.
      </Nota>

      {generate.length > 0 && (
        <Sezione titolo="Tabelloni generati" id="fin-generati">
          <p className="max-w-prose text-ink-muted">
            Chi avanza si ricava dai risultati confermati. «Aggiorna i tabelloni» scrive le coppie qualificate nelle partite del turno dopo, così si
            possono programmare.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={updates.length ? 'primary' : 'secondary'}
              disabled={!updates.length}
              loading={sync.isPending}
              onClick={() => sync.mutate({ torneo: torneo.id, updates })}
            >
              <RefreshCw aria-hidden /> Aggiorna i tabelloni
            </Button>
            <p className="text-ink-muted" aria-live="polite">
              {esitoSync ?? (updates.length ? `${updates.length} partite da aggiornare.` : 'I tabelloni sono già aggiornati.')}
            </p>
          </div>
          {generate.map((fase) => {
            const pf = partite.filter((p) => p.fase === fase);
            return (
              <section key={fase} aria-labelledby={`fin-${fase}`} className="grid gap-2">
                <h3 id={`fin-${fase}`} className="flex flex-wrap items-center justify-between gap-2 font-bold">
                  <span className="inline-flex items-center gap-2">
                    <Trophy className="size-5" aria-hidden /> {fase.charAt(0).toUpperCase() + fase.slice(1)}
                  </span>
                  <Link to={`/t/${torneo.id}/tabellone/${fase}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-court underline dark:text-info-ink">
                    Tabellone pubblico <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </h3>
                <div className="[&>[role=region]]:scroll-px-4 md:[&>[role=region]]:scroll-px-0">
                <Bracket
                  partite={pf}
                  derivate={derivaTabellone(pf, cfg.formatoSet)}
                  squadraById={squadraById}
                  campi={campi.data ?? []}
                  hrefPartita={(p) => `/t/${torneo.id}/partite/${p.id}`}
                />
                </div>
              </section>
            );
          })}
        </Sezione>
      )}

      {daGenerare.length > 0 && (
        <>
          {!conclusi && <Nota tono="warn">L’anteprima è provvisoria: mancano {mancanti} partite dei gironi.</Nota>}

          <Sezione titolo="Classifiche finali dei gironi" id="fin-classifiche">
            {Object.entries(classifiche).map(([g, righe]) => (
              <div key={g} className="grid gap-3">
                <h3 className="font-bold">Girone {g}</h3>
                <StandingsTable girone={g} righe={righe} squadraById={squadraById} fasi={cfg.fasiFinali} nGironi={nGironi} />
                {conclusi && (blocchi[g] ?? []).map((b, bi) => {
                  const ordine = righe.map((r) => r.squadraId).filter((id) => b.includes(id));
                  const pos = righe.findIndex((r) => r.squadraId === ordine[0]) + 1;
                  return (
                    <div key={bi} className="grid gap-2 border-t border-line pt-3">
                      <p className="flex items-center gap-2 font-semibold text-warn-ink">
                        <Equal className="size-5" aria-hidden />
                        Pari merito dal {ordinale(pos)} posto: {conSorteggio ? 'decidi tu l’ordine (sorteggio).' : 'non risolvibile a mano.'}
                      </p>
                      {conSorteggio ? (
                        <ol className="court-rule">
                          {ordine.map((id, i) => {
                            const nome = nomeSquadra(squadraById, id);
                            const muovi = (dir: -1 | 1) => {
                              const nuovo = spostaNelBlocco(ordine, id, dir);
                              setBozza((s) => sorteggioConBlocco(s, nuovo));
                              setAnnuncio(`${nome} ora è ${ordinale(pos + nuovo.indexOf(id))} nel girone ${g}`);
                            };
                            return (
                              <li key={id} className="flex min-h-12 items-center gap-2 py-1">
                                <span className="tabular w-8 text-right font-bold text-ink-muted">{pos + i}</span>
                                <span className="flex-1">{nome}</span>
                                <Button variant="ghost" size="icon" disabled={i === 0} aria-label={`Sposta su: ${nome}`} onClick={() => muovi(-1)}>
                                  <ArrowUp aria-hidden />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={i === ordine.length - 1}
                                  aria-label={`Sposta giù: ${nome}`}
                                  onClick={() => muovi(1)}
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
                          <Link to={`/t/${torneo.id}/organizza/configurazione`} className="font-semibold underline">
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
              {annuncio}
            </p>
            {!conclusi && (
              <p className="text-ink-muted">Classifiche provvisorie. Gli eventuali pari merito si risolvono qui quando i gironi sono conclusi.</p>
            )}
            {conclusi && conSorteggio && Object.values(blocchi).some((b) => b.length) && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" loading={salvaOrdine.isPending} disabled={!nonSalvato && irrisolti === 0} onClick={salva}>
                  Salva ordine
                </Button>
                <Button variant="ghost" disabled={!Object.keys(bozza).length} onClick={() => setBozza({})}>
                  <RotateCcw aria-hidden /> Azzera
                </Button>
                {nonSalvato && <span className="text-sm text-warn-ink">Ordine non ancora salvato.</span>}
              </div>
            )}
          </Sezione>

          {daGenerare.map(({ fase, righe }) => (
            <Sezione key={fase.nome} titolo={`${fase.nome}: ${fase.squadre.length}/${fase.posti} posti`} id={`fin-${fase.nome}`}>
              {fase.squadre.length < 2 ? (
                <Nota tono="warn">Non ci sono abbastanza coppie per questo tabellone.</Nota>
              ) : (
                <>
                  <ol className="tabular grid gap-1 sm:grid-cols-2">
                    {fase.squadre.map((s, i) => (
                      <li key={s.squadraId}>
                        {i + 1}. {s.girone}
                        {s.posizione} {nomeSquadra(squadraById, s.squadraId)}
                      </li>
                    ))}
                  </ol>
                  {fase.squadre.length < fase.posti && (
                    <Nota tono="info">Posti non coperti: le teste di serie migliori passano direttamente al turno dopo (bye).</Nota>
                  )}
                  <h3 className="font-bold">Anteprima del tabellone</h3>
                  {/* scroll-padding keeps the page gutter when the rounds snap (shared Bracket uses snap-start) */}
                  <div className="[&>[role=region]]:scroll-px-4 md:[&>[role=region]]:scroll-px-0">
                    <Bracket anteprima partite={partiteAnteprima(fase.nome.toLowerCase(), righe)} derivate={new Map()} squadraById={squadraById} campi={[]} />
                  </div>
                </>
              )}
            </Sezione>
          ))}

          {q.escluse.length > 0 && (
            <Sezione titolo="Coppie escluse" id="fin-escluse">
              <p>{q.escluse.map((s) => nomeSquadra(squadraById, s.squadraId)).join(', ')}</p>
            </Sezione>
          )}

          <div className="grid justify-items-start gap-2">
            <ConfirmDialog
              open={conferma}
              onOpenChange={setConferma}
              title="Generare le fasi finali?"
              description={`${totale} partite: ${daGenerare
                .filter((f) => f.righe.length)
                .map((f) => `${f.fase.nome} ${f.righe.length}`)
                .join(', ')}. Dopo non potrai cambiare chi è qualificato.`}
              confirmLabel="Genera le fasi finali"
              tone="primary"
              loading={genera.isPending}
              onConfirm={() => genera.mutate(daGenerare)}
              trigger={
                <Button variant="primary" size="lg" disabled={!!motivoBlocco || totale === 0}>
                  <Trophy aria-hidden /> Genera le fasi finali
                </Button>
              }
            />
            {motivoBlocco && <p className="text-warn-ink">{motivoBlocco}</p>}
          </div>
        </>
      )}
    </div>
  );
}
