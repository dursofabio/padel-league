import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PartitaRiga } from '../components/PartitaRiga';
import { Card, ErrorBox, Loading } from '../components/ui';
import { useAuth } from '../hooks/auth';
import { useCampi, useTorneo } from '../hooks/data';
import { derivaTabellone, nomeTurno } from '../lib/bracket';
import { classificheTorneo, nomeSquadra } from '../lib/torneo';

type Tab = 'classifiche' | 'calendario' | 'tabelloni';

export default function TorneoPubblico() {
  const { tid } = useParams();
  const { user } = useAuth();
  const t = useTorneo(tid);
  const campi = useCampi();
  const [tab, setTab] = useState<Tab>('classifiche');
  const classifiche = useMemo(
    () => (t.torneo ? classificheTorneo(t.torneo, t.squadre, t.partite) : {}),
    [t.torneo, t.squadre, t.partite],
  );

  if (t.loading) return <Loading />;
  if (!t.torneo) return <ErrorBox error={t.error ?? 'Torneo non trovato'} />;
  const torneo = t.torneo;
  const fasi = torneo.fasiGenerate ?? [];

  return (
    <>
      <h1>{torneo.nome}</h1>
      <div className="tabs">
        <button className={tab === 'classifiche' ? 'on' : ''} onClick={() => setTab('classifiche')}>Classifiche</button>
        <button className={tab === 'calendario' ? 'on' : ''} onClick={() => setTab('calendario')}>Calendario</button>
        {fasi.length > 0 && (
          <button className={tab === 'tabelloni' ? 'on' : ''} onClick={() => setTab('tabelloni')}>Tabelloni</button>
        )}
      </div>

      {tab === 'classifiche' &&
        (Object.keys(classifiche).length === 0 ? (
          <p className="muted">Gironi non ancora composti.</p>
        ) : (
          Object.entries(classifiche).map(([g, righe]) => (
            <Card key={g} title={`Girone ${g}`}>
              <div className="scroll-x">
                <table className="standings">
                  <thead>
                    <tr>
                      <th>#</th><th className="left">Coppia</th><th>G</th><th>V</th><th>P</th><th>Pt</th>
                      <th title="Differenza set">±S</th><th title="Differenza game">±G</th>
                    </tr>
                  </thead>
                  <tbody>
                    {righe.map((r) => (
                      <tr key={r.squadraId} className={zona(torneo.config.fasiFinali, r.posizione, Object.keys(classifiche).length)}>
                        <td>{r.posizione}{r.pariMerito && <span title="Pari merito: serve il sorteggio">*</span>}</td>
                        <td className="left">{nomeSquadra(t.squadraById, r.squadraId)}</td>
                        <td>{r.giocate}</td><td>{r.vinte}</td><td>{r.perse}</td>
                        <td><strong>{r.punti}</strong></td>
                        <td>{r.setVinti - r.setPersi}</td><td>{r.gameVinti - r.gamePersi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {righe.some((r) => r.pariMerito) && <p className="muted small">* pari merito da risolvere con sorteggio</p>}
            </Card>
          ))
        ))}

      {tab === 'calendario' && (
        <>
          {[...new Set(t.partite.filter((p) => p.fase === 'gironi').map((p) => p.girone!))].sort().map((g) => {
            const pg = t.partite.filter((p) => p.fase === 'gironi' && p.girone === g);
            const giornate = [...new Set(pg.map((p) => p.turno!))].sort((a, b) => a - b);
            return (
              <Card key={g} title={`Girone ${g}`}>
                {giornate.map((n) => (
                  <div key={n}>
                    <h3>Giornata {n}</h3>
                    {pg.filter((p) => p.turno === n).sort((a, b) => (a.posizione ?? 0) - (b.posizione ?? 0)).map((p) => (
                      <PartitaRiga key={p.id} p={p} squadraById={t.squadraById} campi={campi.data} tid={tid!} link={!!user} />
                    ))}
                  </div>
                ))}
              </Card>
            );
          })}
          {t.partite.length === 0 && <p className="muted">Calendario non ancora generato.</p>}
        </>
      )}

      {tab === 'tabelloni' &&
        fasi.map((fase) => {
          const pf = t.partite.filter((p) => p.fase === fase);
          const der = derivaTabellone(pf, torneo.config.formatoSet);
          const turni = Math.max(0, ...pf.map((p) => p.turno ?? 0));
          return (
            <Card key={fase} title={fase.charAt(0).toUpperCase() + fase.slice(1)}>
              <div className="bracket">
                {Array.from({ length: turni }, (_, i) => i + 1).map((turno) => (
                  <div key={turno} className="bracket-col">
                    <h3>{nomeTurno(turno, turni)}</h3>
                    {pf.filter((p) => p.turno === turno).sort((a, b) => (a.posizione ?? 0) - (b.posizione ?? 0)).map((p) => (
                      <PartitaRiga key={p.id} p={p} override={der.get(p.id)} squadraById={t.squadraById} campi={campi.data} tid={tid!} link={!!user} />
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
    </>
  );
}

/** Colora le righe secondo la fase finale raggiunta (per posizione). */
function zona(fasi: { nome: string; posti: number }[], pos: number, nGironi: number): string {
  let soglia = 0;
  for (const f of fasi) {
    soglia += f.posti / Math.max(1, nGironi);
    if (pos <= Math.floor(soglia)) return `zona-${f.nome.toLowerCase()}`;
  }
  return '';
}
