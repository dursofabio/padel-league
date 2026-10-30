import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PartitaRiga } from '../components/PartitaRiga';
import { Badge, Card, ErrorBox, Loading, useAction } from '../components/ui';
import { useAuth } from '../hooks/auth';
import { useCampi, useRichiesteGiocatore, useTorneo, useUtenti } from '../hooks/data';
import { richiestaAttiva } from '../lib/slots';
import { labelDate, today } from '../lib/time';
import { nomeSquadra } from '../lib/torneo';
import { appUrl, waLink } from '../lib/whatsapp';
import { accettaRichiesta, annullaRichiesta } from '../services/prenotazioni';
import { creaSquadra, tokenInvito } from '../services/torneo';
import type { Partita, Squadra } from '../types';

export default function MiePartite() {
  const { tid } = useParams();
  const { user, loading } = useAuth();
  const t = useTorneo(tid);
  const campi = useCampi();
  const utenti = useUtenti();
  const richieste = useRichiesteGiocatore(user?.uid);
  const act = useAction();

  const uid = user?.uid;
  const mia = t.squadre.find((s) => uid && s.giocatori.includes(uid));
  const mie = useMemo(
    () => t.partite.filter((p) => uid && p.giocatori.includes(uid)).sort(ordinaPartite),
    [t.partite, uid],
  );
  const periodoFine = (p: Partita) => t.periodi.find((x) => x.id === p.periodoId)?.fine;

  if (!loading && !user) return <Navigate to={`/login?next=/t/${tid}/mie`} replace />;
  if (t.loading || !t.torneo) return t.error ? <ErrorBox error={t.error} /> : <Loading />;

  const daAccettare = richieste.data.filter(
    (r) => r.torneoId === tid && r.stato === 'attesa' && richiestaAttiva(r) && !r.accettazioni?.[uid!],
  );
  const daConfermare = mie.filter(
    (p) =>
      p.risultato && !p.risultato.confermatoDa && p.stato !== 'contestata' &&
      (p.giocatoriA.includes(uid!) ? p.giocatoriB : p.giocatoriA).includes(p.risultato.inseritoDa),
  );

  return (
    <>
      <h1>Le mie partite</h1>
      <SquadraBox tid={tid!} squadra={mia} uid={uid!} nome={utenti.nome} />
      {/* fuori dalle card: la richiesta accettata sparisce dall'elenco */}
      {act.feedback}

      {daAccettare.length > 0 && (
        <Card title={<>Richieste da accettare <Badge tone="blue">{daAccettare.length}</Badge></>}>
          {daAccettare.map((r) => {
            const p = t.partite.find((x) => x.id === r.partitaId);
            return (
              <div key={r.id} className="req">
                <div>
                  <strong>{labelDate(r.data)} {r.inizio}–{r.fine}</strong> · {campi.data.find((c) => c.id === r.campoId)?.nome}
                  {r.fuoriGriglia && <Badge tone="warn">Fuori griglia</Badge>}
                  {r.controproposta && <Badge tone="blue">Controproposta del campo</Badge>}
                  <div className="muted small">
                    {p && `${nomeSquadra(t.squadraById, p.squadraA)} vs ${nomeSquadra(t.squadraById, p.squadraB)} · `}
                    accettato da {Object.keys(r.accettazioni ?? {}).length}/4
                  </div>
                </div>
                <div className="row">
                  <button disabled={act.busy} onClick={() => act.run(() => accettaRichiesta(r, uid!), 'Accettata')}>Accetta</button>
                  <button className="secondary" disabled={act.busy} onClick={() => act.run(() => annullaRichiesta(r, uid!), 'Richiesta annullata')}>
                    Rifiuta
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {daConfermare.length > 0 && (
        <Card title={<>Risultati da confermare <Badge tone="warn">{daConfermare.length}</Badge></>}>
          {daConfermare.map((p) => (
            <PartitaRiga key={p.id} p={p} squadraById={t.squadraById} campi={campi.data} tid={tid!} link />
          ))}
        </Card>
      )}

      <Card title="Calendario">
        {mie.length === 0 && <p className="muted">Nessuna partita ancora in calendario.</p>}
        {mie.map((p) => {
          const fine = periodoFine(p);
          const ritardo = fine && fine < today() && !['giocata', 'tavolino'].includes(p.stato);
          return (
            <div key={p.id} className={ritardo ? 'late' : ''}>
              <PartitaRiga p={p} squadraById={t.squadraById} campi={campi.data} tid={tid!} link />
              {ritardo && <p className="small error">In ritardo: il periodo è terminato il {labelDate(fine!)}</p>}
            </div>
          );
        })}
      </Card>
    </>
  );
}

function ordinaPartite(a: Partita, b: Partita) {
  const peso = (p: Partita) => ['richiesta', 'da programmare', 'programmata', 'contestata', 'giocata', 'tavolino'].indexOf(p.stato);
  return peso(a) - peso(b) || (a.turno ?? 0) - (b.turno ?? 0);
}

function SquadraBox({ tid, squadra, uid, nome }: { tid: string; squadra?: Squadra; uid: string; nome: (u: string) => string }) {
  const [nomeSq, setNomeSq] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const act = useAction();
  useEffect(() => {
    if (squadra?.stato === 'in attesa partner' && squadra.creatoDa === uid)
      tokenInvito(tid, squadra.id, uid).then(setToken).catch(() => setToken(null));
  }, [squadra?.id, squadra?.stato, squadra?.creatoDa, tid, uid]);

  if (!squadra)
    return (
      <Card title="Iscrivi la tua coppia">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            act.run(async () => setToken((await creaSquadra(tid, nomeSq.trim(), uid)).token), 'Coppia creata: invia il link al partner');
          }}
        >
          <input required placeholder="Nome della coppia" value={nomeSq} onChange={(e) => setNomeSq(e.target.value)} />
          <button disabled={act.busy}>Crea coppia</button>
        </form>
        {act.feedback}
      </Card>
    );

  const link = token ? appUrl(`/invito/${tid}/${token}`) : null;
  return (
    <Card title={`La tua coppia: ${squadra.nome}`} actions={<Badge tone={squadra.stato === 'approvata' ? 'ok' : 'warn'}>{squadra.stato}</Badge>}>
      <p>
        {squadra.giocatori.map(nome).join(' e ')}
        {squadra.girone && <> · Girone <strong>{squadra.girone}</strong></>}
      </p>
      {squadra.stato === 'in attesa partner' && link && (
        <div className="stack">
          <p className="small">Link d&apos;invito per il partner:</p>
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <a className="button wa" href={waLink(`Unisciti alla nostra coppia "${squadra.nome}" nel campionato di padel → ${link}`)} target="_blank" rel="noreferrer">
            Invia su WhatsApp
          </a>
        </div>
      )}
      {squadra.stato === 'da approvare' && <p className="muted small">In attesa di approvazione dell&apos;organizzatore.</p>}
      {squadra.stato === 'approvata' && <p className="small"><Link to={`/t/${tid}/disponibilita`}>Segna le tue disponibilità</Link></p>}
      {act.feedback}
    </Card>
  );
}
