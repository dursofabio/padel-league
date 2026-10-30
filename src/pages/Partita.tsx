import { collection, query, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Badge, Card, ErrorBox, Loading, STATO_TONO, useAction } from '../components/ui';
import { db } from '../firebase';
import { hasRole, useAuth } from '../hooks/auth';
import { useCampi, useTorneo, useUtenti } from '../hooks/data';
import { useDoc, useDocs, useQuery } from '../hooks/firestore';
import { formatRisultato, isSetDecisivo, validaRisultato } from '../lib/results';
import {
  classificaSlot,
  fasciaCopre,
  occupazioniId,
  richiestaAttiva,
  slotGriglia,
  slotImpattati,
  verificaFuoriGriglia,
  type StatoSlot,
} from '../lib/slots';
import { addDays, addMin, dateRange, fromMin, labelDate, today, toMin } from '../lib/time';
import { nomeSquadra } from '../lib/torneo';
import { appUrl, waLink } from '../lib/whatsapp';
import { accettaRichiesta, annullaRichiesta, creaRichiesta } from '../services/prenotazioni';
import {
  annullaRisultato,
  assegnaTavolino,
  confermaRisultato,
  contestaRisultato,
  impostaRisultato,
  inserisciRisultato,
} from '../services/risultati';
import type { Campo, Disponibilita, FormatoSet, OccupazioniGiorno, Partita, Richiesta, SetScore, Torneo } from '../types';

export default function PartitaPage() {
  const { tid, pid } = useParams();
  const { user, profile, loading } = useAuth();
  const t = useTorneo(tid);
  const utenti = useUtenti();
  const campi = useCampi();
  const p = t.partite.find((x) => x.id === pid);
  const richiesta = useDoc<Richiesta>(p?.richiestaId ? `richieste/${p.richiestaId}` : null);

  if (!loading && !user) return <Navigate to={`/login?next=/t/${tid}/partita/${pid}`} replace />;
  if (t.loading) return <Loading />;
  if (!t.torneo || !p) return <ErrorBox error={t.error ?? 'Partita non trovata'} />;

  const uid = user!.uid;
  const sonoGiocatore = p.giocatori.includes(uid);
  const org = hasRole(profile, 'organizzatore');
  const periodo = t.periodi.find((x) => x.id === p.periodoId);
  const r = richiesta.data;
  const rAttiva = r && r.partitaId === p.id && r.stato === 'attesa' && richiestaAttiva(r);
  const programmabile =
    sonoGiocatore && p.squadraA && p.squadraB && p.giocatori.length === 4 &&
    (p.stato === 'da programmare' || (p.stato === 'richiesta' && !rAttiva));

  return (
    <>
      <h1>
        {nomeSquadra(t.squadraById, p.squadraA)} <span className="muted">vs</span> {nomeSquadra(t.squadraById, p.squadraB)}
      </h1>
      <p className="row">
        <Badge tone={STATO_TONO[p.stato]}>{p.stato}</Badge>
        {p.fase === 'gironi' ? `Girone ${p.girone} · giornata ${p.turno}` : `${p.fase} · turno ${p.turno}`}
        {periodo && <span className="muted small">· da giocare tra {labelDate(periodo.inizio)} e {labelDate(periodo.fine)}</span>}
      </p>
      <p className="small">
        {p.giocatoriA.map(utenti.nome).join(' e ')} <span className="muted">vs</span> {p.giocatoriB.map(utenti.nome).join(' e ')}
      </p>

      {p.programmazione && (
        <Card title="Partita programmata">
          <p>
            <strong>{labelDate(p.programmazione.data)} {p.programmazione.inizio}–{p.programmazione.fine}</strong> ·{' '}
            {campi.data.find((c) => c.id === p.programmazione!.campoId)?.nome}
          </p>
          <a className="button wa secondary" target="_blank" rel="noreferrer"
            href={waLink(`Confermata: ${nomeSquadra(t.squadraById, p.squadraA)} vs ${nomeSquadra(t.squadraById, p.squadraB)}, ${labelDate(p.programmazione.data)} alle ${p.programmazione.inizio} → ${appUrl(`/t/${tid}/partita/${p.id}`)}`)}>
            Condividi su WhatsApp
          </a>
        </Card>
      )}

      {r && r.partitaId === p.id && p.stato === 'richiesta' && (
        <RichiestaBox r={r} uid={uid} sonoGiocatore={sonoGiocatore} nome={utenti.nome} campi={campi.data} tid={tid!} p={p} />
      )}

      {programmabile && (
        <Programma torneo={t.torneo} p={p} campi={campi.data} uid={uid} nome={utenti.nome}
          giorniPeriodo={periodo ? [periodo.inizio, periodo.fine] : null} />
      )}
      {sonoGiocatore && (!p.squadraA || !p.squadraB) && (
        <p className="muted">La griglia di prenotazione si apre quando entrambe le coppie sono note.</p>
      )}

      <RisultatoBox torneo={t.torneo} p={p} uid={uid} sonoGiocatore={sonoGiocatore} org={org} nome={utenti.nome}
        nomiCoppie={[nomeSquadra(t.squadraById, p.squadraA), nomeSquadra(t.squadraById, p.squadraB)]} />
    </>
  );
}

// ------------------------------------------------------------------ richiesta in corso

function RichiestaBox({ r, uid, sonoGiocatore, nome, campi, tid, p }: {
  r: Richiesta; uid: string; sonoGiocatore: boolean; nome: (u: string) => string; campi: Campo[]; tid: string; p: Partita;
}) {
  const act = useAction();
  const scaduta = r.stato === 'attesa' && !richiestaAttiva(r);
  const campo = campi.find((c) => c.id === r.campoId)?.nome ?? r.campoId;
  return (
    <Card title="Richiesta al campo" actions={<Badge tone={STATO_TONO[scaduta ? 'scaduta' : r.stato]}>{scaduta ? 'scaduta' : r.stato}</Badge>}>
      <p>
        <strong>{labelDate(r.data)} {r.inizio}–{r.fine}</strong> · {campo}{' '}
        {r.fuoriGriglia && <Badge tone="warn">Fuori griglia</Badge>}
        {r.controproposta && <Badge tone="blue">Controproposta del campo</Badge>}
      </p>
      {r.nota && <p className="small muted">{r.nota}</p>}
      <ul className="list small">
        {r.giocatori.map((g) => (
          <li key={g}>{r.accettazioni?.[g] ? '✅' : '⏳'} {nome(g)}</li>
        ))}
      </ul>
      {r.stato === 'attesa' && !scaduta && (
        <p className="small muted">Scade il {r.scadenza.toDate().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</p>
      )}
      {sonoGiocatore && r.stato === 'attesa' && !scaduta && (
        <div className="row">
          {!r.accettazioni?.[uid] && (
            <button disabled={act.busy} onClick={() => act.run(() => accettaRichiesta(r, uid), 'Accettata')}>Accetta</button>
          )}
          <button className="secondary" disabled={act.busy} onClick={() => act.run(() => annullaRichiesta(r, uid), 'Richiesta annullata')}>
            Annulla richiesta
          </button>
          <a className="button wa secondary" target="_blank" rel="noreferrer"
            href={waLink(`Richiesta inviata al campo per ${labelDate(r.data)} alle ${r.inizio} (${campo}) → ${appUrl(`/t/${tid}/partita/${p.id}`)}`)}>
            Condividi
          </a>
        </div>
      )}
      {act.feedback}
    </Card>
  );
}

// ------------------------------------------------------------------ griglia di programmazione

function Programma({ torneo, p, campi, uid, nome, giorniPeriodo }: {
  torneo: Torneo; p: Partita; campi: Campo[]; uid: string; nome: (u: string) => string; giorniPeriodo: [string, string] | null;
}) {
  const inizioMin = giorniPeriodo && giorniPeriodo[0] > today() ? giorniPeriodo[0] : today();
  const [from, setFrom] = useState(inizioMin);
  const to = giorniPeriodo && addDays(from, 6) > giorniPeriodo[1] ? giorniPeriodo[1] : addDays(from, 6);
  const giorni = from <= to ? dateRange(from, to) : [];
  const [scelto, setScelto] = useState<StatoSlot | null>(null);
  const [fuori, setFuori] = useState(false);
  const act = useAction();

  const disp = useDocs<Disponibilita>(p.giocatori.map((g) => `disponibilita/${torneo.id}_${g}`));
  const occ = useDocs<OccupazioniGiorno>(giorni.flatMap((d) => campi.map((c) => `occupazioni/${occupazioniId(c.id, d)}`)));
  const rich = useQuery<Richiesta>(
    giorni.length ? query(collection(db, 'richieste'), where('data', '>=', from), where('data', '<=', to)) : null,
    `rich-${from}-${to}`,
  );
  const fasce = useMemo(
    () => Object.fromEntries(p.giocatori.map((g) => [g, disp.data[`${torneo.id}_${g}`]?.fasce])),
    [disp.data, p.giocatori, torneo.id],
  );
  const grid = useMemo(
    () =>
      giorni.map((d) => ({
        data: d,
        campi: campi.map((c) => ({
          campo: c,
          slots: slotGriglia(c, d).map((s) => classificaSlot(s, p.giocatori, fasce, occ.data[occupazioniId(c.id, d)]?.items, rich.data)),
        })),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [giorni.join(), campi, fasce, occ.data, rich.data, p.giocatori],
  );
  const verdi = grid.flatMap((g) => g.campi.flatMap((c) => c.slots)).filter((s) => s.colore === 'verde' && !passato(s.slot.data, s.slot.inizio));
  const senzaDisp = p.giocatori.filter((g) => !Object.keys(fasce[g] ?? {}).some((d) => d >= today()));

  const richiedi = (s: StatoSlot) =>
    act.run(
      () =>
        creaRichiesta({
          torneoId: torneo.id, partita: p, campoId: s.slot.campoId, data: s.slot.data, inizio: s.slot.inizio,
          durata: campi.find((c) => c.id === s.slot.campoId)!.durata, fuoriGriglia: false,
          // l'indicazione della disponibilità vale già come accettazione
          accettati: s.liberi, scadenzaOre: torneo.config.scadenzaRichiesteOre, uid,
        }),
      'Richiesta inviata al gestore del campo',
    ).then(() => setScelto(null));

  const link = appUrl(`/t/${torneo.id}/partita/${p.id}`);
  return (
    <Card title="Programma la partita">
      {senzaDisp.length > 0 && (
        <p className="small warn">Disponibilità non ancora indicate da: {senzaDisp.map(nome).join(', ')}</p>
      )}
      <div className="row">
        <button className="secondary sm" disabled={from <= inizioMin} onClick={() => setFrom(addDays(from, -7) < inizioMin ? inizioMin : addDays(from, -7))}>‹ Settimana prec.</button>
        <span className="small">{giorni.length ? `${labelDate(from)} – ${labelDate(to)}` : 'Periodo terminato'}</span>
        <button className="secondary sm" disabled={!!giorniPeriodo && to >= giorniPeriodo[1]} onClick={() => setFrom(addDays(from, 7))}>Settimana succ. ›</button>
      </div>
      <Legenda />
      {(disp.loading || occ.loading || rich.loading) && <Loading />}
      <ErrorBox error={disp.error ?? occ.error ?? rich.error} />
      <div className="grid-days">
        {grid.map((g) => (
          <div key={g.data} className="grid-day">
            <div className="grid-date">{labelDate(g.data)}</div>
            {g.campi.map(({ campo, slots }) => (
              <div key={campo.id} className="grid-row">
                <span className="grid-campo">{campo.nome}</span>
                {slots.length === 0 && <span className="muted small">chiuso</span>}
                {slots.map((s) => (
                  <button
                    key={s.slot.inizio}
                    className={`slot slot-${s.colore}${scelto?.slot === s.slot ? ' sel' : ''}`}
                    title={titoloSlot(s, nome)}
                    disabled={passato(s.slot.data, s.slot.inizio)}
                    onClick={() => setScelto(s)}
                  >
                    {s.slot.inizio}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      {scelto && (
        <div className="box">
          <p>
            <strong>{labelDate(scelto.slot.data)} {scelto.slot.inizio}–{scelto.slot.fine}</strong> · {campi.find((c) => c.id === scelto.slot.campoId)?.nome}
          </p>
          <p className="small">{titoloSlot(scelto, nome)}</p>
          {scelto.colore === 'verde' && !passato(scelto.slot.data, scelto.slot.inizio) && (
            <button disabled={act.busy} onClick={() => richiedi(scelto)}>Richiedi</button>
          )}
          {scelto.colore === 'giallo' && (
            <p className="small muted">Manca {scelto.mancanti.map(nome).join(', ')}: chiedi di aggiornare la disponibilità.</p>
          )}
        </div>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <a className="button wa secondary" target="_blank" rel="noreferrer"
          href={waLink(verdi.length
            ? `Abbiamo ${verdi.length} slot in comune, scegliamo? → ${link}`
            : `Non abbiamo ancora slot in comune: aggiornate le disponibilità → ${appUrl(`/t/${torneo.id}/disponibilita`)}`)}>
          {verdi.length ? `${verdi.length} slot in comune: condividi` : 'Sollecita disponibilità'}
        </a>
        {torneo.config.consentiFuoriGriglia && (
          <button className="link" onClick={() => setFuori(!fuori)}>Proponi orario fuori griglia</button>
        )}
      </div>
      {fuori && <FuoriGriglia torneo={torneo} p={p} campi={campi} uid={uid} fasce={fasce} giorni={giorni} occ={occ.data} richieste={rich.data} />}
      {act.feedback}
    </Card>
  );
}

function passato(data: string, inizio: string): boolean {
  const now = new Date();
  return data < today() || (data === today() && toMin(inizio) <= now.getHours() * 60 + now.getMinutes());
}

function titoloSlot(s: StatoSlot, nome: (u: string) => string): string {
  switch (s.colore) {
    case 'verde': return '4 su 4 liberi, campo libero';
    case 'giallo': return `3 su 4 liberi: manca ${s.mancanti.map(nome).join(', ')}`;
    case 'grigio': return `${s.liberi.length} su 4 liberi`;
    case 'rosso': return `Campo occupato (${s.occupazioni.map((o) => `${o.tipo} ${o.inizio}–${o.fine}`).join(', ')})`;
    case 'blu': return 'Slot già richiesto';
  }
}

function Legenda() {
  return (
    <div className="legenda small">
      <span><i className="slot-verde" /> 4/4 liberi</span>
      <span><i className="slot-giallo" /> 3/4</span>
      <span><i className="slot-grigio" /> ≤2/4</span>
      <span><i className="slot-rosso" /> occupato</span>
      <span><i className="slot-blu" /> richiesto</span>
    </div>
  );
}

function FuoriGriglia({ torneo, p, campi, uid, fasce, giorni, occ, richieste }: {
  torneo: Torneo; p: Partita; campi: Campo[]; uid: string; fasce: Record<string, Disponibilita['fasce'] | undefined>;
  giorni: string[]; occ: Record<string, OccupazioniGiorno | undefined>; richieste: Richiesta[];
}) {
  const [campoId, setCampoId] = useState(campi[0]?.id ?? '');
  const [data, setData] = useState(giorni.find((d) => d >= today()) ?? giorni[0] ?? today());
  const [inizio, setInizio] = useState('18:15');
  const act = useAction();
  const campo = campi.find((c) => c.id === campoId);
  const passo = torneo.config.passoFuoriGriglia;
  const orari = Array.from({ length: Math.floor((23 * 60 - 7 * 60) / passo) + 1 }, (_, i) => fromMin(7 * 60 + i * passo));
  if (!campo) return null;
  const fine = addMin(inizio, campo.durata);
  const v = verificaFuoriGriglia(campo, data, inizio, occ[occupazioniId(campo.id, data)]?.items, richieste);
  const impatto = slotImpattati(campo, data, inizio, fine);
  const accettati = [uid, ...p.giocatori.filter((g) => g !== uid && fasciaCopre(fasce[g], data, inizio, fine))];
  const bloccata = v.bloccanti.length > 0 || v.fuoriOrario || toMin(inizio) % passo !== 0 || passato(data, inizio);

  return (
    <div className="box stack">
      <div className="row">
        <select value={campoId} onChange={(e) => setCampoId(e.target.value)}>
          {campi.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={data} onChange={(e) => setData(e.target.value)}>
          {giorni.map((d) => <option key={d} value={d}>{labelDate(d)}</option>)}
        </select>
        <select value={inizio} onChange={(e) => setInizio(e.target.value)}>
          {orari.map((o) => <option key={o}>{o}</option>)}
        </select>
        <span className="small">→ {fine} ({campo.durata}′)</span>
      </div>
      {v.fuoriOrario && <p className="error small">Il campo non è attivo in quel giorno o orario.</p>}
      {v.bloccanti.length > 0 && (
        <p className="error small">Bloccata: si sovrappone a {v.bloccanti.map((o) => `${o.tipo} ${o.inizio}–${o.fine}`).join(', ')}</p>
      )}
      {v.richiesteSovrapposte.length > 0 && (
        <p className="warn small">Attenzione: si sovrappone a un&apos;altra richiesta in attesa. Il gestore potrà confermarne una sola.</p>
      )}
      {impatto.length > 0 && (
        <p className="small muted">Impatto: rende inutilizzabili gli slot delle {impatto.map((s) => s.inizio).join(' e delle ')}.</p>
      )}
      <p className="small">
        Accettati in automatico: {accettati.length}/4. Gli altri dovranno accettare prima della conferma del gestore.
      </p>
      <button
        disabled={bloccata || act.busy}
        onClick={() =>
          act.run(
            () =>
              creaRichiesta({
                torneoId: torneo.id, partita: p, campoId, data, inizio, durata: campo.durata, fuoriGriglia: true,
                accettati, scadenzaOre: torneo.config.scadenzaRichiesteOre, uid,
              }),
            'Proposta inviata: gli altri giocatori devono accettare',
          )
        }
      >
        Invia proposta fuori griglia
      </button>
      {act.feedback}
    </div>
  );
}

// ------------------------------------------------------------------ risultati

export function SetInput({ formato, value, onChange }: { formato: FormatoSet; value: SetScore[]; onChange: (v: SetScore[]) => void }) {
  const n = formato.setPerVincere * 2 - 1;
  const rows = Array.from({ length: n }, (_, i) => value[i] ?? { a: NaN, b: NaN });
  const set = (i: number, k: 'a' | 'b', x: string) => {
    const next = [...rows];
    next[i] = { ...next[i], [k]: x === '' ? NaN : Number(x) };
    onChange(next);
  };
  return (
    <div className="sets">
      {rows.map((s, i) => (
        <div key={i} className="set">
          <span className="small muted">{formato.superTieBreak && isSetDecisivo(i, formato) ? 'Super TB' : `Set ${i + 1}`}</span>
          <input type="number" min={0} max={30} inputMode="numeric" value={Number.isNaN(s.a) ? '' : s.a} onChange={(e) => set(i, 'a', e.target.value)} />
          <span>–</span>
          <input type="number" min={0} max={30} inputMode="numeric" value={Number.isNaN(s.b) ? '' : s.b} onChange={(e) => set(i, 'b', e.target.value)} />
        </div>
      ))}
    </div>
  );
}

export function setCompilati(v: SetScore[]): SetScore[] {
  return v.filter((s) => !Number.isNaN(s.a) && !Number.isNaN(s.b));
}

function RisultatoBox({ torneo, p, uid, sonoGiocatore, org, nome, nomiCoppie }: {
  torneo: Torneo; p: Partita; uid: string; sonoGiocatore: boolean; org: boolean; nome: (u: string) => string; nomiCoppie: [string, string];
}) {
  const [set, setSet] = useState<SetScore[]>([]);
  const [nota, setNota] = useState('');
  const act = useAction();
  const formato = torneo.config.formatoSet;
  const ris = p.risultato;
  const mioLato = p.giocatoriA.includes(uid) ? 'A' : p.giocatoriB.includes(uid) ? 'B' : null;
  const latoInseritore = ris ? (p.giocatoriA.includes(ris.inseritoDa) ? 'A' : 'B') : null;
  const aperta = ['da programmare', 'richiesta', 'programmata'].includes(p.stato);
  const puoInserire = sonoGiocatore && aperta && (!ris || latoInseritore === mioLato) && !!p.squadraA && !!p.squadraB;
  const puoConfermare = sonoGiocatore && aperta && !!ris && !ris.confermatoDa && latoInseritore !== mioLato;

  const invia = (fn: (s: SetScore[]) => Promise<void>) => {
    const s = setCompilati(set);
    const v = validaRisultato(s, formato);
    if (!v.ok) return act.setError(v.errore!);
    act.run(() => fn(s), 'Risultato salvato').then(() => setSet([]));
  };

  return (
    <Card title="Risultato">
      {ris && (
        <p>
          <strong>{formatRisultato(ris.set)}</strong>{' '}
          <span className="small muted">
            ({nomiCoppie[0]} – {nomiCoppie[1]}) · inserito da {nome(ris.inseritoDa)}
            {ris.confermatoDa ? `, confermato da ${nome(ris.confermatoDa)}` : ', da confermare'}
            {ris.contestatoDa && ` · contestato da ${nome(ris.contestatoDa)}`}
          </span>
          {ris.nota && <span className="small"> · {ris.nota}</span>}
        </p>
      )}
      {puoConfermare && (
        <div className="row">
          <button disabled={act.busy} onClick={() => act.run(() => confermaRisultato(torneo.id, p, uid), 'Risultato confermato')}>Conferma risultato</button>
          <input placeholder="Motivo del disaccordo" value={nota} onChange={(e) => setNota(e.target.value)} />
          <button className="danger" disabled={act.busy} onClick={() => act.run(() => contestaRisultato(torneo.id, p, uid, nota), 'Contestazione inviata all\'organizzatore')}>
            Contesta
          </button>
        </div>
      )}
      {puoInserire && (
        <>
          <p className="small muted">
            Game nell&apos;ordine <strong>{nomiCoppie[0]}</strong> – <strong>{nomiCoppie[1]}</strong>. Vale dopo la conferma di un avversario.
          </p>
          <SetInput formato={formato} value={set} onChange={setSet} />
          <button disabled={act.busy} onClick={() => invia((s) => inserisciRisultato(torneo.id, p, s, uid))}>
            {ris ? 'Correggi risultato' : 'Inserisci risultato'}
          </button>
        </>
      )}
      {!ris && !puoInserire && !org && <p className="muted small">Nessun risultato.</p>}
      {org && (
        <details className="org">
          <summary>Strumenti organizzatore</summary>
          <SetInput formato={formato} value={set} onChange={setSet} />
          <input placeholder="Nota" value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="row">
            <button disabled={act.busy} onClick={() => invia((s) => impostaRisultato(torneo.id, p, s, uid, nota))}>Imposta risultato ufficiale</button>
            <button className="secondary" disabled={act.busy} onClick={() => act.run(() => assegnaTavolino(torneo.id, p, 'A', torneo.config, uid, nota), 'Tavolino assegnato')}>
              Tavolino: vince A
            </button>
            <button className="secondary" disabled={act.busy} onClick={() => act.run(() => assegnaTavolino(torneo.id, p, 'B', torneo.config, uid, nota), 'Tavolino assegnato')}>
              Tavolino: vince B
            </button>
            {ris && (
              <button className="danger" disabled={act.busy} onClick={() => act.run(() => annullaRisultato(torneo.id, p, uid), 'Risultato annullato')}>
                Annulla risultato
              </button>
            )}
          </div>
        </details>
      )}
      {act.feedback}
    </Card>
  );
}
