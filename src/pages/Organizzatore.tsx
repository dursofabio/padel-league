import { collection } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PartitaRiga } from '../components/PartitaRiga';
import { Badge, Card, ErrorBox, Loading, STATO_TONO, useAction } from '../components/ui';
import { db } from '../firebase';
import { hasRole, useAuth } from '../hooks/auth';
import { useCampi, useTorneo, useUtenti } from '../hooks/data';
import { useQuery } from '../hooks/firestore';
import { generaTabellone, nomeTurno, numeroTurni, qualifica } from '../lib/bracket';
import { contaSlot, occupazioniId } from '../lib/slots';
import { dateRange, labelDate, today, weekday } from '../lib/time';
import { classificheTorneo, gironi, gironiConclusi, nomeSquadra } from '../lib/torneo';
import {
  aggiornaSquadra,
  aggiornaTorneo,
  eliminaPeriodo,
  eliminaSquadra,
  generaCalendario,
  generaFasiFinali,
  salvaPeriodo,
  sincronizzaTabellone,
} from '../services/torneo';
import type { Campo, Occupazione, Periodo, Ricorrenza, Spareggio, Torneo, TorneoConfig } from '../types';

type Tab = 'config' | 'periodi' | 'squadre' | 'monitoraggio' | 'finali';
type Dati = ReturnType<typeof useTorneo> & { torneo: Torneo };

export default function Organizzatore() {
  const { tid } = useParams();
  const { user, profile, loading } = useAuth();
  const t = useTorneo(tid);
  const [tab, setTab] = useState<Tab>('squadre');
  if (loading || t.loading) return <Loading />;
  if (!user) return <Navigate to={`/login?next=/t/${tid}/organizza`} replace />;
  if (!hasRole(profile, 'organizzatore')) return <ErrorBox error="Area riservata all'organizzatore." />;
  if (!t.torneo) return <ErrorBox error={t.error ?? 'Torneo non trovato'} />;
  const d = t as Dati;
  const contestate = t.partite.filter((p) => p.stato === 'contestata').length;
  return (
    <>
      <h1>Organizza: {t.torneo.nome}</h1>
      <div className="tabs">
        {(['squadre', 'periodi', 'monitoraggio', 'finali', 'config'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {{ config: 'Configurazione', periodi: 'Periodi e capienza', squadre: 'Squadre e calendario', monitoraggio: 'Monitoraggio', finali: 'Fasi finali' }[k]}
            {k === 'monitoraggio' && contestate > 0 && <span className="dot">{contestate}</span>}
          </button>
        ))}
      </div>
      {tab === 'config' && <Config torneo={t.torneo} />}
      {tab === 'periodi' && <Periodi d={d} />}
      {tab === 'squadre' && <Squadre d={d} uid={user.uid} />}
      {tab === 'monitoraggio' && <Monitoraggio d={d} />}
      {tab === 'finali' && <Finali d={d} uid={user.uid} />}
    </>
  );
}

// ------------------------------------------------------------------ configurazione

const SPAREGGI: Record<Spareggio, string> = {
  punti: 'Punti',
  scontroDiretto: 'Scontro diretto',
  diffSet: 'Differenza set',
  diffGame: 'Differenza game',
  setVinti: 'Set vinti',
  gameVinti: 'Game vinti',
  sorteggio: 'Sorteggio',
};

function Config({ torneo }: { torneo: Torneo }) {
  const [nome, setNome] = useState(torneo.nome);
  const [stato, setStato] = useState(torneo.stato);
  const [c, setC] = useState<TorneoConfig>(torneo.config);
  const act = useAction();
  useEffect(() => setC(torneo.config), [torneo.config]);
  const num = (k: keyof TorneoConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) });
  const sposta = (i: number, dir: -1 | 1) => {
    const s = [...c.spareggi];
    [s[i], s[i + dir]] = [s[i + dir], s[i]];
    setC({ ...c, spareggi: s });
  };
  return (
    <Card title="Configurazione del torneo">
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        act.run(() => aggiornaTorneo(torneo.id, { nome, stato, config: c }), 'Configurazione salvata');
      }}>
        <div className="row">
          <label>Nome <input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <label>Stato
            <select value={stato} onChange={(e) => setStato(e.target.value as Torneo['stato'])}>
              <option value="iscrizioni">Iscrizioni</option><option value="gironi">Gironi</option>
              <option value="fasiFinali">Fasi finali</option><option value="concluso">Concluso</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Punteggi</legend>
          <div className="row">
            <label className="inline">Vittoria <input type="number" value={c.puntiVittoria} onChange={num('puntiVittoria')} /></label>
            <label className="inline">Sconfitta <input type="number" value={c.puntiSconfitta} onChange={num('puntiSconfitta')} /></label>
            <label className="inline">Bonus sconfitta al set decisivo <input type="number" value={c.puntiSconfittaSetDecisivo ?? 0} onChange={num('puntiSconfittaSetDecisivo')} /></label>
          </div>
          <div className="row">
            <label className="inline">Set per vincere
              <input type="number" min={1} max={3} value={c.formatoSet.setPerVincere}
                onChange={(e) => setC({ ...c, formatoSet: { ...c.formatoSet, setPerVincere: Number(e.target.value) } })} />
            </label>
            <label className="inline">
              <input type="checkbox" checked={c.formatoSet.superTieBreak}
                onChange={(e) => setC({ ...c, formatoSet: { ...c.formatoSet, superTieBreak: e.target.checked } })} />
              set decisivo come super tie-break
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Catena di spareggio</legend>
          <ol>
            {c.spareggi.map((s, i) => (
              <li key={s}>
                {SPAREGGI[s]}{' '}
                <button type="button" className="link sm" disabled={i === 0} onClick={() => sposta(i, -1)}>↑</button>
                <button type="button" className="link sm" disabled={i === c.spareggi.length - 1} onClick={() => sposta(i, 1)}>↓</button>
                <button type="button" className="link sm" onClick={() => setC({ ...c, spareggi: c.spareggi.filter((x) => x !== s) })}>rimuovi</button>
              </li>
            ))}
          </ol>
          <select value="" onChange={(e) => e.target.value && setC({ ...c, spareggi: [...c.spareggi, e.target.value as Spareggio] })}>
            <option value="">+ aggiungi criterio</option>
            {(Object.keys(SPAREGGI) as Spareggio[]).filter((s) => !c.spareggi.includes(s)).map((s) => <option key={s} value={s}>{SPAREGGI[s]}</option>)}
          </select>
        </fieldset>
        <fieldset>
          <legend>Fasi finali</legend>
          <label>Criterio di qualificazione
            <select value={c.criterioQualificazione} onChange={(e) => setC({ ...c, criterioQualificazione: e.target.value as TorneoConfig['criterioQualificazione'] })}>
              <option value="perPosizione">Per posizione nel girone (incroci A1–B4…)</option>
              <option value="avulsa">Classifica avulsa (media punti)</option>
            </select>
          </label>
          {c.fasiFinali.map((f, i) => (
            <div key={i} className="row">
              <input value={f.nome} onChange={(e) => setC({ ...c, fasiFinali: c.fasiFinali.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} />
              <label className="inline">posti <input type="number" min={2} value={f.posti}
                onChange={(e) => setC({ ...c, fasiFinali: c.fasiFinali.map((x, j) => (j === i ? { ...x, posti: Number(e.target.value) } : x)) })} /></label>
              <button type="button" className="link sm" onClick={() => setC({ ...c, fasiFinali: c.fasiFinali.filter((_, j) => j !== i) })}>rimuovi</button>
            </div>
          ))}
          <button type="button" className="link sm" onClick={() => setC({ ...c, fasiFinali: [...c.fasiFinali, { nome: 'Nuova', posti: 8 }] })}>+ fase</button>
        </fieldset>
        <fieldset>
          <legend>Prenotazioni</legend>
          <div className="row">
            <label className="inline"><input type="checkbox" checked={c.consentiFuoriGriglia} onChange={(e) => setC({ ...c, consentiFuoriGriglia: e.target.checked })} /> consenti richieste fuori griglia</label>
            <label className="inline">passo
              <select value={c.passoFuoriGriglia} onChange={(e) => setC({ ...c, passoFuoriGriglia: Number(e.target.value) as 15 | 30 })}>
                <option value={15}>15 minuti</option><option value={30}>30 minuti</option>
              </select>
            </label>
            <label className="inline">scadenza richieste (ore) <input type="number" min={1} max={720} value={c.scadenzaRichiesteOre} onChange={num('scadenzaRichiesteOre')} /></label>
          </div>
        </fieldset>
        <button disabled={act.busy}>Salva</button>
      </form>
      {act.feedback}
    </Card>
  );
}

// ------------------------------------------------------------------ periodi e capienza

/** Occupazioni ricorrenti "virtuali" (dalle regole), per stimare la capienza senza leggere tutti i giorni. */
function occupazioniDaRicorrenze(ric: Ricorrenza[], giorni: string[]) {
  const out: Record<string, Record<string, Occupazione>> = {};
  for (const r of ric)
    for (const d of giorni)
      if (d >= r.dal && d <= r.al && weekday(d) === r.giornoSettimana) {
        const id = occupazioniId(r.campoId, d);
        out[id] = { ...(out[id] ?? {}), [r.id]: { inizio: r.inizio, fine: r.fine, tipo: r.tipo, creatoDa: '' } };
      }
  return out;
}

function Periodi({ d }: { d: Dati }) {
  const campi = useCampi();
  const ric = useQuery<Ricorrenza>(collection(db, 'ricorrenze'), 'ricorrenze');
  const act = useAction();
  const [f, setF] = useState<Omit<Periodo, 'id'>>({ fase: 'gironi', turno: null, inizio: today(), fine: today(), etichetta: '' });
  const fasi = ['gironi', ...d.torneo.config.fasiFinali.map((x) => x.nome.toLowerCase())];

  return (
    <>
      <Card title="Periodi">
        <p className="small muted">
          Finestre di date entro cui giocare. Per le fasi finali si può indicare un periodo per ogni turno, con scadenze più strette.
        </p>
        {d.periodi.map((p) => (
          <div key={p.id} className="req">
            <div>
              <strong>{p.etichetta}</strong> · {p.fase}{p.turno ? ` turno ${p.turno}` : ''} · {labelDate(p.inizio)} – {labelDate(p.fine)}
              <Capienza periodo={p} d={d} campi={campi.data} ric={ric.data} />
            </div>
            <button className="danger sm" disabled={act.busy} onClick={() => confirm('Eliminare il periodo?') && act.run(() => eliminaPeriodo(d.torneo.id, p.id))}>Elimina</button>
          </div>
        ))}
        <form className="row box" onSubmit={(e) => {
          e.preventDefault();
          if (f.fine < f.inizio) return act.setError('La fine deve seguire l\'inizio');
          act.run(() => salvaPeriodo(d.torneo.id, { ...f, etichetta: f.etichetta || `${f.fase} ${labelDate(f.inizio)}` }), 'Periodo aggiunto');
        }}>
          <select value={f.fase} onChange={(e) => setF({ ...f, fase: e.target.value })}>{fasi.map((x) => <option key={x}>{x}</option>)}</select>
          {f.fase !== 'gironi' && (
            <label className="inline">turno <input type="number" min={1} value={f.turno ?? ''} onChange={(e) => setF({ ...f, turno: e.target.value ? Number(e.target.value) : null })} /></label>
          )}
          <input type="date" value={f.inizio} onChange={(e) => setF({ ...f, inizio: e.target.value })} />
          <input type="date" value={f.fine} onChange={(e) => setF({ ...f, fine: e.target.value })} />
          <input placeholder="Etichetta (es. Periodo 1)" value={f.etichetta} onChange={(e) => setF({ ...f, etichetta: e.target.value })} />
          <button disabled={act.busy}>Aggiungi</button>
        </form>
        {act.feedback}
      </Card>
    </>
  );
}

function Capienza({ periodo, d, campi, ric }: { periodo: Periodo; d: Dati; campi: Campo[]; ric: Ricorrenza[] }) {
  const giorni = dateRange(periodo.inizio, periodo.fine);
  const slot = contaSlot(campi, giorni, occupazioniDaRicorrenze(ric, giorni));
  const assegnate = d.partite.filter((p) => p.periodoId === periodo.id).length;
  // stima delle partite da giocare se il calendario non è ancora generato (periodo unico dei gironi)
  const daGiocare = assegnate || (periodo.fase === 'gironi' && d.periodi.filter((p) => p.fase === 'gironi').length === 1
    ? gironi(d.squadre).reduce((acc, g) => { const k = d.squadre.filter((s) => s.girone === g).length; return acc + (k * (k - 1)) / 2; }, 0)
    : 0);
  if (!daGiocare) return <div className="small muted">{slot} slot di griglia nel periodo</div>;
  const settimane = Math.max(1, giorni.length / 7);
  const rapporto = slot / daGiocare;
  // le disponibilità dei 4 giocatori coincidono di rado: serve un margine ampio (≥ 3 slot per partita)
  const tono = rapporto >= 3 ? 'ok' : rapporto >= 1.5 ? 'warn' : 'danger';
  return (
    <div className="small">
      <Badge tone={tono}>capienza {rapporto.toFixed(1)}×</Badge> {daGiocare} partite in {giorni.length} giorni: servono almeno{' '}
      {Math.ceil(daGiocare / settimane)} slot a settimana, disponibili {Math.floor(slot / settimane)} (al netto delle ricorrenze).
      {tono !== 'ok' && <span className="warn"> Margine insufficiente: allunga il periodo o aumenta gli slot.</span>}
    </div>
  );
}

// ------------------------------------------------------------------ squadre e calendario

function Squadre({ d, uid }: { d: Dati; uid: string }) {
  const utenti = useUtenti();
  const act = useAction();
  const [nGironi, setNGironi] = useState(2);
  const calendarioFatto = d.partite.some((p) => p.fase === 'gironi');
  const approvate = d.squadre.filter((s) => s.stato === 'approvata');
  const lettere = Array.from({ length: Math.max(nGironi, gironi(d.squadre).length) }, (_, i) => String.fromCharCode(65 + i));

  const assegnaCasuale = () =>
    act.run(async () => {
      const mescolate = [...approvate].sort(() => Math.random() - 0.5);
      await Promise.all(mescolate.map((s, i) => aggiornaSquadra(d.torneo.id, s.id, { girone: String.fromCharCode(65 + (i % nGironi)) })));
    }, 'Gironi assegnati');

  const ordine = ['da approvare', 'in attesa partner', 'approvata', 'ritirata'];
  return (
    <>
      <Card title={`Squadre (${d.squadre.length})`}>
        <p className="small muted">Le coppie si iscrivono da &quot;Le mie partite&quot; e invitano il partner con un link. Qui si approvano e si assegnano ai gironi.</p>
        <table className="standings">
          <thead><tr><th className="left">Coppia</th><th className="left">Giocatori</th><th>Stato</th><th>Girone</th><th /></tr></thead>
          <tbody>
            {[...d.squadre].sort((a, b) => ordine.indexOf(a.stato) - ordine.indexOf(b.stato) || (a.girone ?? '').localeCompare(b.girone ?? '') || a.nome.localeCompare(b.nome)).map((s) => (
              <tr key={s.id}>
                <td className="left">{s.nome}</td>
                <td className="left small">{s.giocatori.map(utenti.nome).join(', ')}</td>
                <td><Badge tone={s.stato === 'approvata' ? 'ok' : s.stato === 'ritirata' ? 'danger' : 'warn'}>{s.stato}</Badge></td>
                <td>
                  <select disabled={calendarioFatto} value={s.girone ?? ''} onChange={(e) => act.run(() => aggiornaSquadra(d.torneo.id, s.id, { girone: e.target.value || null }))}>
                    <option value="">–</option>
                    {lettere.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </td>
                <td className="row">
                  {s.stato === 'da approvare' && (
                    <button className="sm" disabled={act.busy} onClick={() => act.run(() => aggiornaSquadra(d.torneo.id, s.id, { stato: 'approvata' }), 'Approvata')}>Approva</button>
                  )}
                  {s.stato === 'approvata' && calendarioFatto && (
                    <button className="secondary sm" disabled={act.busy} onClick={() => confirm('Segnare la coppia come ritirata? I risultati restano: gestisci le partite residue con il tavolino.') && act.run(() => aggiornaSquadra(d.torneo.id, s.id, { stato: 'ritirata' }))}>Ritira</button>
                  )}
                  {!calendarioFatto && (
                    <button className="danger sm" disabled={act.busy} onClick={() => confirm(`Eliminare ${s.nome}?`) && act.run(() => eliminaSquadra(d.torneo.id, s.id))}>Elimina</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {act.feedback}
      </Card>

      <Card title="Gironi e calendario">
        {calendarioFatto ? (
          <p>Calendario generato: {d.partite.filter((p) => p.fase === 'gironi').length} partite. <Link to={`/t/${d.torneo.id}`}>Vedi calendario</Link></p>
        ) : (
          <div className="stack">
            <div className="row">
              <label className="inline">Numero di gironi <input type="number" min={1} max={8} value={nGironi} onChange={(e) => setNGironi(Number(e.target.value))} /></label>
              <button className="secondary" disabled={act.busy || !approvate.length} onClick={assegnaCasuale}>Assegna gironi a sorte</button>
            </div>
            <p className="small">
              {gironi(d.squadre).map((g) => `Girone ${g}: ${approvate.filter((s) => s.girone === g).length} coppie`).join(' · ') || 'Nessun girone assegnato.'}
            </p>
            {!d.periodi.some((p) => p.fase === 'gironi') && <p className="warn small">Nessun periodo per la fase a gironi: le partite non avranno scadenza.</p>}
            <button disabled={act.busy} onClick={() =>
              confirm('Generare il calendario (algoritmo di Berger)? Dopo la generazione i gironi non si possono più modificare.') &&
              act.run(() => generaCalendario(d.torneo.id, d.squadre, d.periodi, uid), (n) => `${n} partite generate`)}>
              Genera calendario
            </button>
          </div>
        )}
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ monitoraggio

function Monitoraggio({ d }: { d: Dati }) {
  const campi = useCampi();
  const contestate = d.partite.filter((p) => p.stato === 'contestata');
  const daConfermare = d.partite.filter((p) => p.risultato && !p.risultato.confermatoDa && p.stato !== 'contestata');
  const stati = ['da programmare', 'richiesta', 'programmata', 'giocata', 'contestata', 'tavolino'] as const;
  return (
    <>
      {contestate.length > 0 && (
        <Card title={<>Contestazioni <Badge tone="danger">{contestate.length}</Badge></>}>
          <p className="small muted">Apri la partita e usa gli strumenti organizzatore per fissare il risultato ufficiale.</p>
          {contestate.map((p) => <PartitaRiga key={p.id} p={p} squadraById={d.squadraById} campi={campi.data} tid={d.torneo.id} link />)}
        </Card>
      )}
      {d.periodi.map((per) => {
        const pp = d.partite.filter((p) => p.periodoId === per.id);
        if (!pp.length) return null;
        const chiuso = per.fine < today();
        const aperte = pp.filter((p) => !['giocata', 'tavolino'].includes(p.stato));
        return (
          <Card key={per.id} title={`${per.etichetta} (${labelDate(per.inizio)} – ${labelDate(per.fine)})`}
            actions={chiuso && aperte.length ? <Badge tone="danger">{aperte.length} non giocate</Badge> : null}>
            <div className="row small">
              {stati.map((s) => {
                const n = pp.filter((p) => p.stato === s).length;
                return n ? <Badge key={s} tone={STATO_TONO[s]}>{s}: {n}</Badge> : null;
              })}
            </div>
            {aperte.filter((p) => p.stato === 'da programmare').length > 0 && (
              <details>
                <summary className="small">Partite non programmate ({aperte.filter((p) => p.stato === 'da programmare').length})</summary>
                {aperte.filter((p) => p.stato === 'da programmare').map((p) => (
                  <PartitaRiga key={p.id} p={p} squadraById={d.squadraById} campi={campi.data} tid={d.torneo.id} link />
                ))}
              </details>
            )}
            {chiuso && aperte.length > 0 && (
              <p className="small warn">Periodo terminato: decidi tavolino o rinvio dalla pagina della partita.</p>
            )}
          </Card>
        );
      })}
      {daConfermare.length > 0 && (
        <Card title="Risultati in attesa di conferma">
          {daConfermare.map((p) => <PartitaRiga key={p.id} p={p} squadraById={d.squadraById} campi={campi.data} tid={d.torneo.id} link />)}
        </Card>
      )}
    </>
  );
}

// ------------------------------------------------------------------ fasi finali

function Finali({ d, uid }: { d: Dati; uid: string }) {
  const act = useAction();
  const conclusi = gironiConclusi(d.partite);
  const [sorteggio, setSorteggio] = useState<Record<string, number>>(d.torneo.sorteggio ?? {});
  const torneoPreview = useMemo(() => ({ ...d.torneo, sorteggio }), [d.torneo, sorteggio]);
  const classifiche = useMemo(() => classificheTorneo(torneoPreview, d.squadre, d.partite), [torneoPreview, d.squadre, d.partite]);
  const q = useMemo(
    () => qualifica(classifiche, d.torneo.config.fasiFinali, d.torneo.config.criterioQualificazione, sorteggio),
    [classifiche, d.torneo.config, sorteggio],
  );
  const generate = d.torneo.fasiGenerate ?? [];
  const pariMerito = Object.values(classifiche).flat().filter((r) => r.pariMerito);

  /** Sposta una squadra in su/giù tra i pari merito: l'ordine diventa il "sorteggio". */
  const sposta = (girone: string, idx: number, dir: -1 | 1) => {
    const righe = classifiche[girone];
    const ids = righe.map((r) => r.squadraId);
    [ids[idx], ids[idx + dir]] = [ids[idx + dir], ids[idx]];
    const s = { ...sorteggio };
    ids.forEach((id, i) => (s[id] = i + 1));
    setSorteggio(s);
  };

  if (generate.length) {
    return (
      <Card title="Fasi finali generate">
        <p>Fasi: {generate.join(', ')}. <Link to={`/t/${d.torneo.id}`}>Vedi i tabelloni</Link></p>
        <p className="small muted">
          Chi avanza è derivato dai risultati confermati. Sincronizza per scrivere nelle partite del turno successivo le coppie
          qualificate: così la loro griglia di prenotazione si apre.
        </p>
        <button disabled={act.busy} onClick={() => act.run(() => sincronizzaTabellone(d.torneo, d.partite.filter((p) => generate.includes(p.fase)), d.squadre), (n) => `${n} partite aggiornate`)}>
          Sincronizza tabelloni
        </button>
        {act.feedback}
      </Card>
    );
  }

  return (
    <>
      {!conclusi && <p className="warn">I gironi non sono ancora conclusi: l&apos;anteprima è provvisoria e la generazione è bloccata.</p>}
      <Card title="Anteprima: classifiche e tagli">
        {pariMerito.length > 0 && <p className="small warn">Ci sono pari merito non risolti: ordinali a mano (sorteggio) con le frecce.</p>}
        {Object.entries(classifiche).map(([g, righe]) => (
          <div key={g}>
            <h3>Girone {g}</h3>
            <ol className="small">
              {righe.map((r, i) => (
                <li key={r.squadraId}>
                  {nomeSquadra(d.squadraById, r.squadraId)} · {r.punti} pt{r.pariMerito && <Badge tone="warn">pari merito</Badge>}
                  {r.pariMerito && i > 0 && righe[i - 1].pariMerito && <button className="link sm" onClick={() => sposta(g, i, -1)}>↑</button>}
                  {r.pariMerito && i < righe.length - 1 && righe[i + 1].pariMerito && <button className="link sm" onClick={() => sposta(g, i, 1)}>↓</button>}
                </li>
              ))}
            </ol>
          </div>
        ))}
        <button className="secondary sm" disabled={act.busy} onClick={() => act.run(() => aggiornaTorneo(d.torneo.id, { sorteggio }), 'Sorteggio salvato')}>
          Salva ordine da sorteggio
        </button>{' '}
        <button className="link sm" onClick={() => setSorteggio({})}>Azzera sorteggio</button>
      </Card>
      {q.fasi.map((f) => {
        const tab = generaTabellone(f.nome.toLowerCase(), f.squadre.map((s) => s.squadraId), (id) => d.squadraById.get(id)?.girone ?? undefined);
        const turni = numeroTurni(f.squadre.length);
        return (
          <Card key={f.nome} title={`${f.nome}: ${f.squadre.length}/${f.posti} posti`}>
            <p className="small">
              Teste di serie: {f.squadre.map((s, i) => `${i + 1}. ${s.girone}${s.posizione} ${nomeSquadra(d.squadraById, s.squadraId)}`).join(' · ')}
            </p>
            {f.squadre.length < f.posti && <p className="small warn">Posti non coperti: il tabellone usa dei bye per le teste di serie migliori.</p>}
            <div className="bracket">
              {Array.from({ length: turni }, (_, i) => i + 1).map((turno) => (
                <div key={turno} className="bracket-col">
                  <h3>{nomeTurno(turno, turni)}</h3>
                  {tab.filter((m) => m.turno === turno).map((m) => (
                    <div key={m.id} className="partita small">
                      {nomeSquadra(d.squadraById, m.squadraA)} <span className="muted">vs</span> {nomeSquadra(d.squadraById, m.squadraB)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
      {q.escluse.length > 0 && (
        <p className="small muted">Escluse: {q.escluse.map((s) => nomeSquadra(d.squadraById, s.squadraId)).join(', ')}</p>
      )}
      <button
        disabled={!conclusi || pariMerito.length > 0 || act.busy}
        title={pariMerito.length ? 'Risolvi prima i pari merito' : ''}
        onClick={() =>
          confirm('Generare le fasi finali? Le partite dei tabelloni verranno create.') &&
          act.run(async () => {
            await aggiornaTorneo(d.torneo.id, { sorteggio });
            await generaFasiFinali(d.torneo, q, d.squadre, d.periodi, uid);
          }, 'Fasi finali generate')
        }
      >
        Genera fasi finali
      </button>
      {act.feedback}
    </>
  );
}
