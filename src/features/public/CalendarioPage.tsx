import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { MatchRow } from '../../components/MatchRow';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { useCampi, useTorneoData } from '../../data/queries';
import { labelDate } from '../../lib/time';
import type { Partita, Periodo } from '../../types';
import { Segmented, Switch } from '../../ui/misc';
import { AvvisoOffline, InvitoAccesso, StatoTorneoPagina, useMiaSquadra, useOnline } from './comune';

type Filtro = 'tutte' | 'da-giocare' | 'giocate';
const giocata = (p: Partita) => p.stato === 'giocata' || p.stato === 'tavolino';

interface Giornata {
  turno: number;
  partite: Partita[];
  periodo?: Periodo;
}

/** Group-phase calendar (/t/:tid/calendario): per group and matchday, opens on the first matchday still to play. */
export default function CalendarioPage() {
  const { tid } = useParams();
  const { user } = useAuth();
  const d = useTorneoData(tid);
  const campi = useCampi();
  const online = useOnline();
  const mia = useMiaSquadra(d.squadre);
  const [scelto, setScelto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('tutte');
  const [soloMia, setSoloMia] = useState(false);

  const perGirone = useMemo(() => {
    const periodoById = new Map(d.periodi.map((p) => [p.id, p]));
    const out = new Map<string, Giornata[]>();
    for (const p of d.partite) {
      if (p.fase !== 'gironi' || !p.girone) continue;
      const giornate = out.get(p.girone) ?? [];
      let g = giornate.find((x) => x.turno === (p.turno ?? 0));
      if (!g) giornate.push((g = { turno: p.turno ?? 0, partite: [] }));
      g.partite.push(p);
      if (!g.periodo && p.periodoId) g.periodo = periodoById.get(p.periodoId);
      out.set(p.girone, giornate);
    }
    for (const gs of out.values()) {
      gs.sort((a, b) => a.turno - b.turno);
      for (const g of gs) g.partite.sort((a, b) => (a.posizione ?? 0) - (b.posizione ?? 0) || (a.codice ?? '').localeCompare(b.codice ?? ''));
    }
    return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [d.partite, d.periodi]);

  const nomi = [...perGirone.keys()];
  const attivo = scelto && nomi.includes(scelto) ? scelto : mia?.girone && nomi.includes(mia.girone) ? mia.girone : nomi[0];

  // default scroll: first matchday of the active group with unplayed matches (only once, on arrival)
  const scrollato = useRef(false);
  useEffect(() => {
    if (scrollato.current || !attivo) return;
    const prima = perGirone.get(attivo)?.find((g) => g.partite.some((p) => !giocata(p)));
    if (!prima || prima.turno === perGirone.get(attivo)?.[0]?.turno) {
      if (perGirone.size) scrollato.current = true;
      return;
    }
    scrollato.current = true;
    document.getElementById(`giornata-${attivo}-${prima.turno}`)?.scrollIntoView({ block: 'start' });
  }, [attivo, perGirone]);

  const stato = StatoTorneoPagina({ isPending: d.isPending, error: d.error, torneo: d.torneo, refetch: d.refetch });
  // the heading renders before the data (it is the first meaningful paint)
  if (stato || !d.torneo)
    return (
      <>
        <PageHeader titolo="Calendario" sottotitolo={d.torneo?.nome} indietro={{ to: `/t/${tid}`, label: 'Torneo' }} />
        {stato}
      </>
    );
  const torneo = d.torneo;

  const visibile = (p: Partita) =>
    (filtro === 'tutte' || (filtro === 'giocate' ? giocata(p) : !giocata(p))) &&
    (!soloMia || !mia || p.squadraA === mia.id || p.squadraB === mia.id);
  const href = user ? (p: Partita) => `/t/${torneo.id}/partite/${p.id}` : undefined;

  return (
    <>
      <PageHeader titolo="Calendario" sottotitolo={torneo.nome} indietro={{ to: `/t/${torneo.id}`, label: 'Torneo' }} />
      {!online && <AvvisoOffline />}
      {nomi.length === 0 ? (
        <EmptyState titolo="Il calendario non è ancora pronto." testo="L’organizzatore lo genera dopo aver composto i gironi: le partite compaiono qui." />
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-3">
            {nomi.length > 1 && (
              <Segmented
                label="Girone"
                className="lg:hidden"
                value={attivo}
                onValueChange={setScelto}
                options={nomi.map((g) => ({ value: g, label: `Girone ${g}` }))}
              />
            )}
            <Segmented
              label="Quali partite"
              value={filtro}
              onValueChange={setFiltro}
              options={[
                { value: 'tutte', label: 'Tutte' },
                { value: 'da-giocare', label: 'Da giocare' },
                { value: 'giocate', label: 'Giocate' },
              ]}
            />
            {mia && (
              <label className="inline-flex min-h-11 items-center gap-2 text-base font-semibold">
                <Switch checked={soloMia} onCheckedChange={setSoloMia} />
                Solo la mia coppia
              </label>
            )}
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            {nomi.map((g) => {
              const giornate = perGirone.get(g)!.map((x) => ({ ...x, partite: x.partite.filter(visibile) })).filter((x) => x.partite.length);
              return (
                <section key={g} aria-labelledby={`cal-${g}`} className={g === attivo ? 'grid content-start gap-6' : 'hidden content-start gap-6 lg:grid'}>
                  <h2 id={`cal-${g}`} className="text-lg font-bold">
                    Girone {g}
                  </h2>
                  {giornate.length === 0 && <p className="text-ink-muted">Nessuna partita con questi filtri.</p>}
                  {giornate.map((x) => (
                    <section key={x.turno} id={`giornata-${g}-${x.turno}`} aria-labelledby={`giornata-${g}-${x.turno}-h`} className="grid scroll-mt-20 gap-1">
                      <h3 id={`giornata-${g}-${x.turno}-h`} className="flex flex-wrap items-baseline gap-x-2 border-b-2 border-line-strong pb-1 text-base font-bold">
                        Giornata {x.turno}
                        {x.periodo && (
                          <span className="tabular text-sm font-normal text-ink-muted">
                            <span className="sr-only">, </span>entro {labelDate(x.periodo.fine)}
                          </span>
                        )}
                      </h3>
                      <ul className="court-rule">
                        {x.partite.map((p) => (
                          <li key={p.id}>
                            <MatchRow p={p} squadraById={d.squadraById} campi={campi.data ?? []} href={href?.(p)} evidenzia={mia ? [mia.id] : undefined} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      )}
      <InvitoAccesso />
    </>
  );
}
