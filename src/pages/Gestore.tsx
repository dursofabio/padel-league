import { addDoc, collection, deleteDoc, doc, getDoc, query, setDoc, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge, Card, ErrorBox, Loading, useAction } from '../components/ui';
import { db } from '../firebase';
import { hasRole, useAuth } from '../hooks/auth';
import { useCampi, useUtenti } from '../hooks/data';
import { useDocs, useQuery } from '../hooks/firestore';
import { occupazioniId, richiestaAttiva, slotGriglia, slotImpattati, type Slot } from '../lib/slots';
import { addDays, fromMin, giornoBreve, labelDate, today, toMin, GIORNI_LUNGHI } from '../lib/time';
import { chiudiGiornata, aggiungiOccupazione, materializzaRicorrenza, rimuoviOccupazione } from '../services/occupazioni';
import {
  annullaConfermata,
  confermaRichiesta,
  creaRichiesta,
  rifiutaRichiesta,
  trovaControproposta,
} from '../services/prenotazioni';
import type { Campo, OccupazioniGiorno, Partita, Richiesta, Ricorrenza, TipoOccupazione, Torneo } from '../types';

type Tab = 'richieste' | 'timeline' | 'ricorrenze' | 'campi';

export default function Gestore() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('richieste');
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login?next=/gestore" replace />;
  if (!hasRole(profile, 'gestore')) return <ErrorBox error="Area riservata al gestore del campo." />;
  return (
    <>
      <h1>Gestione campi</h1>
      <div className="tabs">
        {(['richieste', 'timeline', 'ricorrenze', 'campi'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {{ richieste: 'Richieste', timeline: 'Timeline', ricorrenze: 'Ricorrenze', campi: 'Campi' }[t]}
          </button>
        ))}
      </div>
      {tab === 'richieste' && <Richieste uid={user.uid} />}
      {tab === 'timeline' && <Timeline uid={user.uid} />}
      {tab === 'ricorrenze' && <Ricorrenze uid={user.uid} />}
      {tab === 'campi' && <Campi />}
    </>
  );
}

// ------------------------------------------------------------------ richieste

function Richieste({ uid }: { uid: string }) {
  const campi = useCampi();
  const utenti = useUtenti();
  const attesa = useQuery<Richiesta>(query(collection(db, 'richieste'), where('stato', '==', 'attesa')), 'g-attesa');
  const confermate = useQuery<Richiesta>(query(collection(db, 'richieste'), where('stato', '==', 'confermata')), 'g-conf');
  const ordina = (a: Richiesta, b: Richiesta) => a.data.localeCompare(b.data) || a.inizio.localeCompare(b.inizio);
  const pendenti = attesa.data.filter((r) => richiestaAttiva(r)).sort(ordina);
  const prossime = confermate.data.filter((r) => r.data >= today()).sort(ordina);
  // l'esito si mostra qui: la riga della richiesta sparisce appena cambia stato
  const [esito, setEsito] = useState<string | null>(null);

  return (
    <>
      <Card title={<>Richieste in attesa <Badge tone="blue">{pendenti.length}</Badge></>}>
        {esito && <p className="info">{esito}</p>}
        {attesa.loading && <Loading />}
        <ErrorBox error={attesa.error} />
        {!attesa.loading && pendenti.length === 0 && <p className="muted">Nessuna richiesta in attesa.</p>}
        {pendenti.map((r) => (
          <RichiestaGestore key={r.id} r={r} uid={uid} campi={campi.data} nome={utenti.nome} onEsito={setEsito} />
        ))}
      </Card>
      <Card title="Prossime partite confermate">
        {prossime.length === 0 && <p className="muted">Nessuna.</p>}
        {prossime.map((r) => (
          <ConfermataRiga key={r.id} r={r} uid={uid} campi={campi.data} nome={utenti.nome} />
        ))}
      </Card>
    </>
  );
}

function RichiestaGestore({ r, uid, campi, nome, onEsito }: {
  r: Richiesta; uid: string; campi: Campo[]; nome: (u: string) => string; onEsito: (msg: string) => void;
}) {
  const act = useAction();
  const [nota, setNota] = useState('');
  const [proposta, setProposta] = useState<{ slot: Slot; accettati: string[] } | null | undefined>(undefined);
  const campo = campi.find((c) => c.id === r.campoId);
  const accettati = r.giocatori.filter((g) => r.accettazioni?.[g]);
  const completa = accettati.length === r.giocatori.length;
  const impatto = r.fuoriGriglia && campo ? slotImpattati(campo, r.data, r.inizio, r.fine) : [];

  const controproponi = async (s: { slot: Slot; accettati: string[] }) => {
    const [t, p] = await Promise.all([
      getDoc(doc(db, 'tornei', r.torneoId)),
      getDoc(doc(db, 'tornei', r.torneoId, 'partite', r.partitaId)),
    ]);
    const torneo = t.data() as Torneo;
    const c = campi.find((x) => x.id === s.slot.campoId)!;
    await creaRichiesta({
      torneoId: r.torneoId, partita: { id: p.id, ...p.data() } as Partita, campoId: s.slot.campoId, data: s.slot.data,
      inizio: s.slot.inizio, durata: c.durata, fuoriGriglia: false, accettati: s.accettati,
      scadenzaOre: torneo.config.scadenzaRichiesteOre, uid, controproposta: true, sostituisce: r.id,
      nota: nota || `Controproposta del campo a ${labelDate(r.data)} ${r.inizio}`,
    });
    setProposta(undefined);
  };

  return (
    <div className="req">
      <div>
        <strong>{labelDate(r.data)} {r.inizio}–{r.fine}</strong> · {campo?.nome ?? r.campoId}{' '}
        {r.fuoriGriglia && <Badge tone="warn">Fuori griglia</Badge>}
        {r.controproposta && <Badge tone="blue">Controproposta</Badge>}
        <div className="small">{r.giocatori.slice(0, 2).map(nome).join(' / ')} <span className="muted">vs</span> {r.giocatori.slice(2).map(nome).join(' / ')}</div>
        <div className="small muted">
          Accettazioni {accettati.length}/{r.giocatori.length}
          {!completa && ` · mancano: ${r.giocatori.filter((g) => !r.accettazioni?.[g]).map(nome).join(', ')}`}
          {' · '}scade {r.scadenza.toDate().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
        {impatto.length > 0 && (
          <div className="small warn">
            Impatto: {r.inizio}–{r.fine} su {campo?.nome} rende inutilizzabili gli slot delle {impatto.map((s) => s.inizio).join(' e delle ')}
          </div>
        )}
        {proposta && (
          <div className="box small">
            Proposta: <strong>{labelDate(proposta.slot.data)} {proposta.slot.inizio}</strong> su {campi.find((c) => c.id === proposta.slot.campoId)?.nome}
            {' '}({proposta.accettati.length}/4 già disponibili)
            <div className="row">
              <button className="sm" disabled={act.busy} onClick={() => act.run(async () => { await controproponi(proposta); return true; }).then((ok) => ok && onEsito('Controproposta inviata ai giocatori'))}>Invia controproposta</button>
              <button className="link sm" onClick={() => setProposta(undefined)}>Annulla</button>
            </div>
          </div>
        )}
        {proposta === null && <div className="small error">Nessuno slot libero nei giorni vicini.</div>}
      </div>
      <div className="stack">
        <button disabled={!completa || act.busy} title={completa ? '' : 'Si conferma solo con 4 accettazioni su 4'}
          onClick={() => act.run(() => confermaRichiesta(r, uid)).then((e) => e && onEsito(`Confermata: ${labelDate(r.data)} ${r.inizio}${e.conflitti ? `; ${e.conflitti} richieste sovrapposte passate in conflitto` : ''}`))}>
          Conferma
        </button>
        <input className="sm" placeholder="Nota (facoltativa)" value={nota} onChange={(e) => setNota(e.target.value)} />
        <div className="row">
          <button className="danger sm" disabled={act.busy} onClick={() => act.run(async () => { await rifiutaRichiesta(r, uid, nota); return true; }).then((ok) => ok && onEsito(`Rifiutata: ${labelDate(r.data)} ${r.inizio}`))}>Rifiuta</button>
          <button className="secondary sm" disabled={act.busy}
            onClick={() => act.run(async () => setProposta(await trovaControproposta(r, campi)))}>
            Controproponi
          </button>
        </div>
      </div>
      {act.feedback}
    </div>
  );
}

function ConfermataRiga({ r, uid, campi, nome }: { r: Richiesta; uid: string; campi: Campo[]; nome: (u: string) => string }) {
  const act = useAction();
  return (
    <div className="req">
      <div>
        <strong>{labelDate(r.data)} {r.inizio}–{r.fine}</strong> · {campi.find((c) => c.id === r.campoId)?.nome}
        <div className="small">{r.giocatori.slice(0, 2).map(nome).join(' / ')} <span className="muted">vs</span> {r.giocatori.slice(2).map(nome).join(' / ')}</div>
      </div>
      <button className="danger sm" disabled={act.busy}
        onClick={() => confirm('Annullare la partita confermata e liberare il campo?') && act.run(() => annullaConfermata(r, uid), 'Annullata')}>
        Annulla
      </button>
      {act.feedback}
    </div>
  );
}

// ------------------------------------------------------------------ timeline

const TL_START = 8 * 60;
const TL_END = 24 * 60;
const PX = 0.75; // pixel per minuto

function Timeline({ uid }: { uid: string }) {
  const campi = useCampi();
  const [data, setData] = useState(today());
  const occ = useDocs<OccupazioniGiorno>(campi.data.map((c) => `occupazioni/${occupazioniId(c.id, data)}`));
  const [form, setForm] = useState({ campoId: '', inizio: '16:00', fine: '17:00', tipo: 'esterno' as TipoOccupazione, nota: '' });
  const act = useAction();
  const orari = useMemo(() => Array.from({ length: (TL_END - TL_START) / 15 + 1 }, (_, i) => fromMin(TL_START + i * 15)), []);
  const campoId = form.campoId || campi.data[0]?.id || '';

  if (campi.loading) return <Loading />;
  if (!campi.data.length) return <p className="muted">Configura prima i campi.</p>;

  return (
    <>
      <div className="row">
        <button className="secondary sm" onClick={() => setData(addDays(data, -1))}>‹</button>
        <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
        <button className="secondary sm" onClick={() => setData(addDays(data, 1))}>›</button>
        <strong>{labelDate(data)}</strong>
        <button className="danger sm" disabled={act.busy}
          onClick={() => {
            const nota = prompt('Motivo della chiusura (festività, manutenzione…)', 'Chiusura');
            if (nota !== null)
              act.run(() => chiudiGiornata(campi.data, data, nota, uid), (e) =>
                e.errori.length ? `Non chiusi: ${e.errori.join('; ')}` : `Giornata chiusa${e.conflitti ? `; ${e.conflitti} richieste in conflitto` : ''}`);
          }}>
          Chiudi giornata
        </button>
      </div>

      <Card title="Segna occupazione">
        <form className="row" onSubmit={(e) => {
          e.preventDefault();
          act.run(() => aggiungiOccupazione(campoId, data, { inizio: form.inizio, fine: form.fine, tipo: form.tipo, nota: form.nota || null }, uid),
            (r) => (r.conflitti ? `Salvata. Attenzione: ${r.conflitti} richieste in attesa sono passate in conflitto.` : 'Salvata'));
        }}>
          <select value={campoId} onChange={(e) => setForm({ ...form, campoId: e.target.value })}>
            {campi.data.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={form.inizio} onChange={(e) => setForm({ ...form, inizio: e.target.value })}>{orari.map((o) => <option key={o}>{o}</option>)}</select>
          <select value={form.fine} onChange={(e) => setForm({ ...form, fine: e.target.value })}>{orari.map((o) => <option key={o}>{o}</option>)}</select>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoOccupazione })}>
            <option value="esterno">Prenotazione esterna</option>
            <option value="lezione">Lezione</option>
            <option value="chiusura">Chiusura</option>
          </select>
          <input placeholder="Nota" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
          <button disabled={act.busy}>Aggiungi</button>
        </form>
        {act.feedback}
      </Card>

      <div className="timeline">
        <div className="tl-axis" style={{ height: (TL_END - TL_START) * PX }}>
          {Array.from({ length: (TL_END - TL_START) / 60 }, (_, i) => (
            <span key={i} style={{ top: i * 60 * PX }}>{fromMin(TL_START + i * 60)}</span>
          ))}
        </div>
        {campi.data.map((c) => {
          const items = occ.data[occupazioniId(c.id, data)]?.items ?? {};
          return (
            <div key={c.id} className="tl-col">
              <div className="tl-h">{c.nome}</div>
              <div className="tl-body" style={{ height: (TL_END - TL_START) * PX }}>
                {slotGriglia(c, data).map((s) => (
                  <div key={s.inizio} className="tl-slot" style={pos(s.inizio, s.fine)}
                    title={`Slot ${s.inizio}–${s.fine}: tocca per segnarlo occupato`}
                    onClick={() => setForm({ ...form, campoId: c.id, inizio: s.inizio, fine: s.fine })}>
                    {s.inizio}
                  </div>
                ))}
                {Object.entries(items).map(([id, o]) => (
                  <div key={id} className={`tl-occ tl-${o.tipo}`} style={pos(o.inizio, o.fine)}
                    title={`${o.tipo} ${o.inizio}–${o.fine}${o.nota ? ` · ${o.nota}` : ''}`}
                    onClick={() => {
                      if (o.tipo === 'campionato') return alert('Partita del campionato: si annulla da "Prossime partite confermate".');
                      if (confirm(`Liberare ${o.tipo} ${o.inizio}–${o.fine}?`)) act.run(() => rimuoviOccupazione(c.id, data, id, uid), 'Liberato');
                    }}>
                    <strong>{o.inizio}–{o.fine}</strong> {o.tipo}{o.nota ? ` · ${o.nota}` : ''}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function pos(inizio: string, fine: string) {
  const a = Math.max(TL_START, toMin(inizio));
  const b = Math.min(TL_END, toMin(fine));
  return { top: (a - TL_START) * PX, height: Math.max(12, (b - a) * PX) };
}

// ------------------------------------------------------------------ ricorrenze

function Ricorrenze({ uid }: { uid: string }) {
  const campi = useCampi();
  const ric = useQuery<Ricorrenza>(collection(db, 'ricorrenze'), 'ricorrenze');
  const act = useAction();
  const [f, setF] = useState({ campoId: '', giornoSettimana: 2, inizio: '18:00', fine: '19:00', tipo: 'lezione' as TipoOccupazione, nota: '', dal: today(), al: addDays(today(), 60) });
  const campoId = f.campoId || campi.data[0]?.id || '';
  return (
    <>
      <Card title="Nuova ricorrenza">
        <form className="row" onSubmit={(e) => {
          e.preventDefault();
          if (toMin(f.fine) <= toMin(f.inizio)) return act.setError('Orario non valido');
          act.run(async () => {
            const r = await addDoc(collection(db, 'ricorrenze'), { ...f, campoId, giornoSettimana: Number(f.giornoSettimana) });
            return materializzaRicorrenza({ id: r.id, ...f, campoId, giornoSettimana: Number(f.giornoSettimana) }, uid);
          }, (e) => `Ricorrenza salvata: ${e.giorni - e.saltati.length}/${e.giorni} giorni segnati${e.saltati.length ? `. Saltati: ${e.saltati.join('; ')}` : ''}`);
        }}>
          <select value={campoId} onChange={(e) => setF({ ...f, campoId: e.target.value })}>
            {campi.data.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={f.giornoSettimana} onChange={(e) => setF({ ...f, giornoSettimana: Number(e.target.value) })}>
            {GIORNI_LUNGHI.map((g, i) => <option key={i} value={i}>ogni {g}</option>)}
          </select>
          <input type="time" step={900} value={f.inizio} onChange={(e) => setF({ ...f, inizio: e.target.value })} />
          <input type="time" step={900} value={f.fine} onChange={(e) => setF({ ...f, fine: e.target.value })} />
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoOccupazione })}>
            <option value="lezione">Lezione</option>
            <option value="esterno">Prenotazione esterna</option>
            <option value="chiusura">Chiusura</option>
          </select>
          <input placeholder="Nota (es. scuola padel)" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} />
          <label className="inline">dal <input type="date" value={f.dal} onChange={(e) => setF({ ...f, dal: e.target.value })} /></label>
          <label className="inline">al <input type="date" value={f.al} onChange={(e) => setF({ ...f, al: e.target.value })} /></label>
          <button disabled={act.busy}>Salva e applica</button>
        </form>
        {act.feedback}
      </Card>
      <Card title="Ricorrenze">
        {ric.data.length === 0 && <p className="muted">Nessuna ricorrenza.</p>}
        {ric.data.map((r) => (
          <div key={r.id} className="req">
            <div>
              <strong>ogni {GIORNI_LUNGHI[r.giornoSettimana]} {r.inizio}–{r.fine}</strong> · {campi.data.find((c) => c.id === r.campoId)?.nome}
              <div className="small muted">{r.tipo}{r.nota ? ` · ${r.nota}` : ''} · dal {labelDate(r.dal)} al {labelDate(r.al)}</div>
            </div>
            <div className="row">
              <button className="secondary sm" disabled={act.busy}
                onClick={() => act.run(() => materializzaRicorrenza(r, uid), (e) => `${e.giorni - e.saltati.length}/${e.giorni} giorni segnati${e.saltati.length ? `. Saltati: ${e.saltati.join('; ')}` : ''}`)}>
                Applica
              </button>
              <button className="danger sm" disabled={act.busy}
                onClick={() => confirm('Eliminare la regola? Le occupazioni già segnate restano e si liberano dalla timeline.') && act.run(() => deleteDoc(doc(db, 'ricorrenze', r.id)), 'Eliminata')}>
                Elimina
              </button>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ campi

const NUOVO: Omit<Campo, 'id'> = { nome: '', primoSlot: '13:30', ultimoSlot: '21:00', durata: 90, giorniAttivi: [0, 1, 2, 3, 4, 5, 6], eccezioni: [], ordine: 1 };

function Campi() {
  const campi = useCampi();
  const [edit, setEdit] = useState<(Omit<Campo, 'id'> & { id?: string }) | null>(null);
  const act = useAction();
  return (
    <Card title="Campi e griglia" actions={<button className="sm" onClick={() => setEdit({ ...NUOVO, ordine: campi.data.length + 1 })}>+ Campo</button>}>
      <p className="small muted">Gli slot non si salvano: si generano dalla regola di ogni campo (primo slot, ultimo inizio, durata).</p>
      {campi.data.map((c) => (
        <div key={c.id} className="req">
          <div>
            <strong>{c.nome}</strong> <span className="small muted">({c.id})</span>
            <div className="small">
              {slotGriglia(c, nextActive(c)).map((s) => s.inizio).join(' · ')} · {c.durata}′ · {c.giorniAttivi.map(giornoBreve).join(' ')}
            </div>
            {c.eccezioni?.length > 0 && <div className="small muted">Chiuso: {c.eccezioni.map(labelDate).join(', ')}</div>}
          </div>
          <button className="secondary sm" onClick={() => setEdit({ ...c })}>Modifica</button>
        </div>
      ))}
      {edit && (
        <form className="stack box" onSubmit={(e) => {
          e.preventDefault();
          const { id, ...data } = edit;
          const cid = id || edit.nome.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || `campo${Date.now()}`;
          act.run(() => setDoc(doc(db, 'campi', cid), data), 'Salvato').then(() => setEdit(null));
        }}>
          <label>Nome <input required value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></label>
          <div className="row">
            <label className="inline">Primo slot <input type="time" step={900} value={edit.primoSlot} onChange={(e) => setEdit({ ...edit, primoSlot: e.target.value })} /></label>
            <label className="inline">Ultimo inizio <input type="time" step={900} value={edit.ultimoSlot} onChange={(e) => setEdit({ ...edit, ultimoSlot: e.target.value })} /></label>
            <label className="inline">Durata (min) <input type="number" min={30} step={15} value={edit.durata} onChange={(e) => setEdit({ ...edit, durata: Number(e.target.value) })} /></label>
            <label className="inline">Ordine <input type="number" value={edit.ordine ?? 0} onChange={(e) => setEdit({ ...edit, ordine: Number(e.target.value) })} /></label>
          </div>
          <div className="row">
            {GIORNI_LUNGHI.map((g, i) => (
              <label key={i} className="inline">
                <input type="checkbox" checked={edit.giorniAttivi.includes(i)}
                  onChange={(e) => setEdit({ ...edit, giorniAttivi: e.target.checked ? [...edit.giorniAttivi, i].sort() : edit.giorniAttivi.filter((x) => x !== i) })} />
                {g}
              </label>
            ))}
          </div>
          <label>
            Date di chiusura (yyyy-mm-dd, separate da virgola)
            <input value={edit.eccezioni.join(', ')} onChange={(e) => setEdit({ ...edit, eccezioni: e.target.value.split(/[,\s]+/).filter(Boolean) })} />
          </label>
          <div className="row">
            <button disabled={act.busy}>Salva</button>
            <button type="button" className="link" onClick={() => setEdit(null)}>Annulla</button>
          </div>
        </form>
      )}
      {act.feedback}
    </Card>
  );
}

function nextActive(c: Campo): string {
  for (let i = 0; i < 7; i++) {
    const d = addDays(today(), i);
    if (slotGriglia(c, d).length) return d;
  }
  return today();
}
