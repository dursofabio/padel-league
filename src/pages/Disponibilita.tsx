import { doc, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ErrorBox, Loading, useAction } from '../components/ui';
import { db } from '../firebase';
import { useAuth } from '../hooks/auth';
import { useTorneo } from '../hooks/data';
import { useDoc } from '../hooks/firestore';
import { dateRange, fromMin, labelDate, parseFascia, formatFascia, today, toMin, weekday, GIORNI_LUNGHI } from '../lib/time';
import { appUrl, waLink } from '../lib/whatsapp';
import type { Disponibilita as Disp, Fasce } from '../types';

const PRESET: { nome: string; da: string; a: string }[] = [
  { nome: 'Pausa pranzo', da: '12:00', a: '15:00' },
  { nome: 'Pomeriggio', da: '14:00', a: '18:30' },
  { nome: 'Tutta la sera', da: '18:00', a: '23:00' },
  { nome: 'Tutto il giorno', da: '08:00', a: '23:00' },
];

const ORARI = Array.from({ length: (24 - 7) * 4 + 1 }, (_, i) => fromMin(7 * 60 + i * 15));

/** Aggiunge una fascia fondendo quelle sovrapposte o contigue. */
export function aggiungiFascia(lista: string[], da: string, a: string): string[] {
  const intervalli = [...lista.map(parseFascia), [da, a] as [string, string]]
    .map(([x, y]) => [toMin(x), toMin(y)] as [number, number])
    .sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  for (const [x, y] of intervalli) {
    const last = out[out.length - 1];
    if (last && x <= last[1]) last[1] = Math.max(last[1], y);
    else out.push([x, y]);
  }
  return out.map(([x, y]) => formatFascia(fromMin(x), fromMin(y)));
}

export default function Disponibilita() {
  const { tid } = useParams();
  const { user, loading } = useAuth();
  const t = useTorneo(tid);
  const docId = user && tid ? `${tid}_${user.uid}` : null;
  const saved = useDoc<Disp>(docId ? `disponibilita/${docId}` : null);
  const [fasce, setFasce] = useState<Fasce>({});
  const [dirty, setDirty] = useState(false);
  const [periodoId, setPeriodoId] = useState<string>('');
  const [da, setDa] = useState('18:00');
  const [a, setA] = useState('21:00');
  const act = useAction();

  useEffect(() => {
    if (saved.data && !dirty) setFasce(saved.data.fasce ?? {});
  }, [saved.data, dirty]);

  const periodiAttivi = useMemo(() => t.periodi.filter((p) => p.fine >= today()), [t.periodi]);
  useEffect(() => {
    if (!periodoId && periodiAttivi.length) setPeriodoId(periodiAttivi[0].id);
  }, [periodiAttivi, periodoId]);

  if (!loading && !user) return <Navigate to={`/login?next=/t/${tid}/disponibilita`} replace />;
  if (t.loading || saved.loading) return <Loading />;
  const periodo = t.periodi.find((p) => p.id === periodoId);
  const giorni = periodo ? dateRange(periodo.inizio > today() ? periodo.inizio : today(), periodo.fine) : [];

  const update = (data: string, lista: string[]) => {
    setDirty(true);
    setFasce((f) => {
      const n = { ...f };
      if (lista.length) n[data] = lista;
      else delete n[data];
      return n;
    });
  };
  const aggiungi = (data: string, x: string, y: string) => {
    if (toMin(y) <= toMin(x)) return act.setError('L\'orario di fine deve seguire quello di inizio');
    update(data, aggiungiFascia(fasce[data] ?? [], x, y));
  };
  const salva = () =>
    act.run(async () => {
      // si salvano solo le date future: le passate non servono più all'incrocio
      const pulite = Object.fromEntries(Object.entries(fasce).filter(([d]) => d >= today()));
      await setDoc(doc(db, 'disponibilita', docId!), { torneoId: tid, uid: user!.uid, fasce: pulite });
      setDirty(false);
    }, 'Disponibilità salvate');

  return (
    <>
      <h1>Le mie disponibilità</h1>
      <p className="muted small">
        Indica le fasce orarie in cui puoi giocare. Valgono per tutte le tue partite del periodo: si compilano una volta sola.
        Indicare una fascia vale già come accettazione degli slot che copre.
      </p>
      <ErrorBox error={t.error ?? saved.error} />
      {periodiAttivi.length === 0 ? (
        <p className="muted">Nessun periodo di gioco aperto.</p>
      ) : (
        <div className="row">
          <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
            {periodiAttivi.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etichetta} ({labelDate(p.inizio)} – {labelDate(p.fine)})
              </option>
            ))}
          </select>
          <label className="inline">
            dalle <select value={da} onChange={(e) => setDa(e.target.value)}>{ORARI.map((o) => <option key={o}>{o}</option>)}</select>
          </label>
          <label className="inline">
            alle <select value={a} onChange={(e) => setA(e.target.value)}>{ORARI.map((o) => <option key={o}>{o}</option>)}</select>
          </label>
        </div>
      )}

      <div className="sticky-actions">
        <button disabled={!dirty || act.busy} onClick={salva}>Salva disponibilità</button>
        {periodo && (
          <a className="button wa secondary" target="_blank" rel="noreferrer"
            href={waLink(`Segna le tue disponibilità per ${periodo.etichetta} → ${appUrl(`/t/${tid}/disponibilita`)}`)}>
            Ricorda al gruppo
          </a>
        )}
        {act.feedback}
      </div>

      {giorni.map((d) => (
        <div key={d} className="day">
          <div className="day-h">
            <strong>{labelDate(d)}</strong>
            <span className="chips">
              {(fasce[d] ?? []).map((f) => (
                <span key={f} className="chip">
                  {f.replace('-', '–')}
                  <button className="x" title="Rimuovi" onClick={() => update(d, (fasce[d] ?? []).filter((x) => x !== f))}>×</button>
                </span>
              ))}
            </span>
          </div>
          <div className="row small">
            <button className="secondary sm" onClick={() => aggiungi(d, da, a)}>+ {da}–{a}</button>
            {PRESET.map((p) => (
              <button key={p.nome} className="secondary sm" onClick={() => aggiungi(d, p.da, p.a)}>{p.nome}</button>
            ))}
            {(fasce[d] ?? []).length > 0 && (
              <button
                className="link sm"
                title={`Copia su tutti i ${GIORNI_LUNGHI[weekday(d)]} del periodo`}
                onClick={() => giorni.filter((x) => x !== d && weekday(x) === weekday(d)).forEach((x) => update(x, [...fasce[d]]))}
              >
                copia su ogni {GIORNI_LUNGHI[weekday(d)]}
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
