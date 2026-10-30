import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { MatchRow } from '../../components/MatchRow';
import { PageHeader, Sezione } from '../../components/PageHeader';
import { StandingsTable } from '../../components/StandingsTable';
import { useCampi, useTorneoData } from '../../data/queries';
import { risultatoUfficiale } from '../../lib/results';
import { classificheTorneo, gironi } from '../../lib/torneo';
import type { Partita } from '../../types';
import {
  AvvisoOffline,
  faseInParole,
  InvitoAccesso,
  nomeFase,
  oggiRoma,
  RigaLink,
  RigaVincitori,
  StatoTorneoPagina,
  useMiaSquadra,
  useOnline,
} from './comune';

const quando = (p: Partita) => (p.programmazione ? `${p.programmazione.data} ${p.programmazione.inizio}` : '');

/** Tournament overview (/t/:tid): phase, next matches, latest results, links. Readable without logging in. */
export default function TorneoPage() {
  const { tid } = useParams();
  const { user } = useAuth();
  const d = useTorneoData(tid);
  const campi = useCampi();
  const online = useOnline();
  const mia = useMiaSquadra(d.squadre);
  const today = oggiRoma();

  const prossime = useMemo(
    () =>
      d.partite
        .filter((p) => p.stato === 'programmata' && p.programmazione && p.programmazione.data >= today)
        .sort((a, b) => quando(a).localeCompare(quando(b)))
        .slice(0, 5),
    [d.partite, today],
  );
  const ultimi = useMemo(
    () =>
      d.partite
        .filter(risultatoUfficiale)
        .sort((a, b) => quando(b).localeCompare(quando(a)))
        .slice(0, 5),
    [d.partite],
  );
  const classifiche = useMemo(() => (d.torneo ? classificheTorneo(d.torneo, d.squadre, d.partite) : {}), [d.torneo, d.squadre, d.partite]);

  const stato = StatoTorneoPagina({ isPending: d.isPending, error: d.error, torneo: d.torneo, refetch: d.refetch });
  if (stato || !d.torneo) return stato;
  const torneo = d.torneo;
  const href = user ? (p: Partita) => `/t/${torneo.id}/partite/${p.id}` : undefined;
  const evidenzia = mia ? [mia.id] : undefined;
  const nGironi = gironi(d.squadre).length;
  const iscritte = d.squadre.filter((s) => s.stato === 'approvata');

  // "Il tuo girone": top 4 + own row
  const mioGirone = mia?.girone ? classifiche[mia.girone] : undefined;
  const righeMie = mioGirone?.filter((r, i) => i < 4 || r.squadraId === mia?.id);

  return (
    <>
      <PageHeader titolo={torneo.nome} sottotitolo={faseInParole(torneo, d.periodi, today)} />
      {!online && <AvvisoOffline />}
      {torneo.stato === 'concluso' && <RigaVincitori torneo={torneo} partite={d.partite} squadraById={d.squadraById} />}

      <div className="grid gap-8">
        {torneo.stato === 'iscrizioni' || nGironi === 0 ? (
          <Sezione titolo="Coppie iscritte" id="iscritte">
            <p className="text-ink-muted">I gironi non sono ancora stati composti. Le coppie iscritte sono qui sotto.</p>
            {iscritte.length ? (
              <ul className="court-rule">
                {iscritte.map((s) => (
                  <li key={s.id} className="flex min-h-12 items-center py-2 text-base">
                    <span className={mia?.id === s.id ? 'font-bold' : undefined}>{s.nome}</span>
                    {mia?.id === s.id && <span className="ml-2 text-sm text-ink-muted">la tua coppia</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nessuna coppia approvata per ora.</p>
            )}
          </Sezione>
        ) : (
          <>
            <Sezione titolo="Prossime partite" id="prossime">
              {prossime.length ? (
                <ul className="court-rule">
                  {prossime.map((p) => (
                    <li key={p.id}>
                      <MatchRow p={p} squadraById={d.squadraById} campi={campi.data ?? []} href={href?.(p)} evidenzia={evidenzia} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">Nessuna partita in programma per ora. Le trovi qui appena vengono confermate dal campo.</p>
              )}
            </Sezione>

            {mia && righeMie && mia.girone && (
              <Sezione titolo="Il tuo girone" id="mio-girone" azioni={<RigaLinkBreve to={`/t/${torneo.id}/classifiche`}>Classifica completa</RigaLinkBreve>}>
                <StandingsTable
                  girone={mia.girone}
                  righe={righeMie}
                  squadraById={d.squadraById}
                  fasi={torneo.config.fasiFinali}
                  nGironi={nGironi}
                  evidenzia={mia.id}
                />
              </Sezione>
            )}

            <Sezione titolo="Ultimi risultati" id="ultimi">
              {ultimi.length ? (
                <ul className="court-rule">
                  {ultimi.map((p) => (
                    <li key={p.id}>
                      <MatchRow p={p} squadraById={d.squadraById} campi={campi.data ?? []} href={href?.(p)} evidenzia={evidenzia} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">Ancora nessun risultato ufficiale.</p>
              )}
            </Sezione>
          </>
        )}

        <Sezione titolo="Segui il torneo" id="link">
          <ul className="court-rule">
            <li>
              <RigaLink to={`/t/${torneo.id}/classifiche`} dettaglio="Punti, set e game di ogni girone">
                Classifiche
              </RigaLink>
            </li>
            <li>
              <RigaLink to={`/t/${torneo.id}/calendario`} dettaglio="Tutte le partite, giornata per giornata">
                Calendario
              </RigaLink>
            </li>
            {(torneo.fasiGenerate ?? []).map((f) => (
              <li key={f}>
                <RigaLink to={`/t/${torneo.id}/tabellone/${f}`} dettaglio="Eliminazione diretta">
                  Tabellone {nomeFase(torneo, f)}
                </RigaLink>
              </li>
            ))}
          </ul>
        </Sezione>
      </div>
      <InvitoAccesso />
    </>
  );
}

function RigaLinkBreve({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center text-sm font-semibold text-court underline dark:text-info-ink">
      {children}
    </Link>
  );
}
