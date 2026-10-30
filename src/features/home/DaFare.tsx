import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTorneoCorrente } from '../../app/torneo-corrente';
import { useAuth } from '../../auth/AuthProvider';
import { MatchRow } from '../../components/MatchRow';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../components/states';
import {
  useCampi,
  useDisponibilita,
  useNomi,
  useRichiesteConfermate,
  useRichiesteGiocatore,
  useRichiesteInAttesa,
  useTorneoData,
} from '../../data/queries';
import { countByRole, dataOraRoma, deriveAttention, istanteRoma, type AttentionItem, type AttentionRole, type Priority } from '../../lib/attention';
import type { Partita, Richiesta } from '../../types';
import { Button, buttonVariants } from '../../ui/button';
import { Segmented } from '../../ui/misc';
import { AvvisoOffline, useAdesso, useOnline } from '../public/comune';
import type { Contesto } from './contenuto';
import { RigaAttenzione } from './RigaAttenzione';

type Filtro = 'tutto' | AttentionRole;

const GRUPPI: { p: Priority; titolo: string }[] = [
  { p: 0, titolo: 'Urgente' },
  { p: 1, titolo: 'Da fare' },
  { p: 2, titolo: 'Presto' },
  { p: 3, titolo: 'Per sapere' },
];
const ETICHETTA_RUOLO: Record<AttentionRole, string> = { giocatore: 'Partite', gestore: 'Campo', organizzatore: 'Organizza' };
const MAX_PER_SAPERE = 3;
const linkCls = 'inline-flex min-h-11 items-center font-semibold text-court underline dark:text-info-ink';

const inizioPartita = (p: Partita) => (p.programmazione ? istanteRoma(p.programmazione.data, p.programmazione.inizio) : Infinity);

/** Logged-in home: the "Da fare" feed merging every role of the user. */
export function DaFare() {
  const { user, profile } = useAuth();
  const uid = user!.id;
  // roles taken literally: admin alone gives no items (ASSUNZIONE H7)
  const ruoli = useMemo(() => profile?.roles ?? [], [profile?.roles]);
  const gestore = ruoli.includes('gestore');
  const now = useAdesso(60_000);
  const today = dataOraRoma(now).date;
  const online = useOnline();

  const corrente = useTorneoCorrente();
  const tid = corrente.tid;
  const d = useTorneoData(tid);
  const mie = useRichiesteGiocatore(uid);
  const inAttesa = useRichiesteInAttesa(gestore);
  const confermate = useRichiesteConfermate(today, gestore);
  const disp = useDisponibilita(tid, [uid]);
  const campi = useCampi();
  const { nome } = useNomi();

  const richieste = useMemo(() => {
    const all = [...(mie.data ?? []), ...(inAttesa.data ?? []), ...(confermate.data ?? [])];
    return [...new Map(all.map((r) => [r.id, r])).values()];
  }, [mie.data, inAttesa.data, confermate.data]);

  const items = useMemo(
    () =>
      deriveAttention({
        now,
        today,
        uid,
        roles: ruoli,
        torneo: d.torneo ?? null,
        periodi: d.periodi,
        squadre: d.squadre,
        partite: d.partite,
        richieste,
        mieFasce: disp.data?.[uid]?.fasce ?? null,
      }),
    [now, today, uid, ruoli, d.torneo, d.periodi, d.squadre, d.partite, richieste, disp.data],
  );

  const ctx = useMemo<Contesto>(() => {
    const perPartita = new Map<string, Richiesta[]>();
    for (const r of richieste) perPartita.set(r.partitaId, [...(perPartita.get(r.partitaId) ?? []), r]);
    return {
      tid: tid ?? '',
      partitaById: new Map(d.partite.map((p) => [p.id, p])),
      richiestaById: new Map(richieste.map((r) => [r.id, r])),
      richiestePerPartita: perPartita,
      periodoById: new Map(d.periodi.map((p) => [p.id, p])),
      squadraById: d.squadraById,
      campi: campi.data ?? [],
      nome,
      uid,
    };
  }, [tid, d.partite, d.periodi, d.squadraById, richieste, campi.data, nome, uid]);

  // ---- resolved rows: keep them for ~2 s with their result, then let them go
  const [fatti, setFatti] = useState<Map<string, { it: AttentionItem; testo: string }>>(new Map());
  const [annuncio, setAnnuncio] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const onFatto = useCallback((it: AttentionItem, testo: string) => {
    setFatti((m) => new Map(m).set(it.id, { it, testo }));
    setAnnuncio(testo);
    timers.current.push(
      setTimeout(() => {
        setFatti((m) => {
          const n = new Map(m);
          n.delete(it.id);
          return n;
        });
      }, 2000),
    );
  }, []);

  // ---- realtime: one polite summary when new items arrive (not on first load)
  const visti = useRef<Set<string> | null>(null);
  const caricato = !d.isPending || !tid;
  useEffect(() => {
    if (!caricato || mie.isPending) return;
    const ids = new Set(items.map((i) => i.id));
    if (visti.current) {
      const nuovi = [...ids].filter((id) => !visti.current!.has(id)).length;
      if (nuovi) setAnnuncio(nuovi === 1 ? '1 nuova cosa da fare' : `${nuovi} nuove cose da fare`);
    }
    visti.current = ids;
  }, [items, caricato, mie.isPending]);

  // ---- role filter, only with ≥ 2 roles
  const ruoliFeed = (['giocatore', 'gestore', 'organizzatore'] as AttentionRole[]).filter((r) => ruoli.includes(r));
  const [filtro, setFiltro] = useState<Filtro>('tutto');
  const conteggi = countByRole(items);
  const mostra = (r: AttentionRole) => filtro === 'tutto' || filtro === r;

  const [espandi, setEspandi] = useState(false);

  const mia = d.squadre.find((s) => s.giocatori.includes(uid) && s.stato !== 'ritirata');
  const prossime = useMemo(
    () =>
      d.partite
        .filter((p) => p.stato === 'programmata' && p.giocatori.includes(uid) && inizioPartita(p) > now)
        .sort((a, b) => inizioPartita(a) - inizioPartita(b))
        .slice(0, 3),
    [d.partite, uid, now],
  );

  const loading =
    corrente.isPending || (!!tid && d.isPending) || mie.isLoading || inAttesa.isLoading || confermate.isLoading || disp.isLoading;
  const errore = d.error ?? mie.error ?? inAttesa.error ?? confermate.error ?? disp.error;
  const riprova = () => {
    d.refetch();
    void mie.refetch();
    if (gestore) {
      void inAttesa.refetch();
      void confermate.refetch();
    }
    if (tid) void disp.refetch();
  };

  const header = (
    <PageHeader
      titolo="Da fare"
      azioni={
        ruoliFeed.length >= 2 ? (
          <Segmented<Filtro>
            label="Mostra"
            value={filtro}
            onValueChange={setFiltro}
            options={[
              { value: 'tutto', label: 'Tutto' },
              ...ruoliFeed.map((r) => ({ value: r, label: conteggi[r] ? `${ETICHETTA_RUOLO[r]} ${conteggi[r]}` : ETICHETTA_RUOLO[r] })),
            ]}
          />
        ) : undefined
      }
    />
  );

  if (loading)
    return (
      <>
        {header}
        <SkeletonRighe righe={3} />
      </>
    );
  if (errore && !items.length && !d.torneo)
    return (
      <>
        {header}
        <ErrorState errore={errore} onRiprova={riprova} />
      </>
    );

  if (!tid && !gestore)
    return (
      <>
        {header}
        <EmptyState titolo="Non c’è ancora nessun torneo." testo="Quando l’organizzatore crea il torneo, qui trovi quello che c’è da fare." />
      </>
    );

  // merge resolved rows back in their group while they show "Fatto"
  const visibili = [
    ...[...fatti.values()].filter((f) => !items.some((i) => i.id === f.it.id)).map((f) => f.it),
    ...items,
  ].filter((i) => mostra(i.role));
  const primaId = visibili.find((i) => !fatti.has(i.id) && i.priority <= 2)?.id;

  const nonIscritto = !!d.torneo && ruoli.includes('giocatore') && !mia && mostra('giocatore');

  return (
    <>
      {header}
      {!online && <AvvisoOffline />}
      {errore && <ErrorState errore={errore} onRiprova={riprova} />}
      <p aria-live="polite" className="sr-only">
        {annuncio}
      </p>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,45rem)_minmax(0,1fr)]">
        <div className="grid content-start gap-8">
          {visibili.length === 0 ? (
            <Vuoto filtro={filtro} ruoli={ruoliFeed} tid={tid} today={today} prossima={prossime[0]} ctx={ctx} iscritto={!!mia} />
          ) : (
            GRUPPI.map(({ p, titolo }) => {
              const righe = visibili.filter((i) => i.priority === p);
              if (!righe.length) return null;
              const tagliate = p === 3 && !espandi && righe.length > MAX_PER_SAPERE;
              const lista = tagliate ? righe.slice(0, MAX_PER_SAPERE) : righe;
              const hasRichieste = righe.some((i) => i.kind === 'conferma-richiesta');
              return (
                <section key={p} aria-labelledby={`gruppo-${p}`} className="grid gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line-strong pb-1">
                    <h2 id={`gruppo-${p}`} className="text-lg font-bold">
                      {titolo}
                    </h2>
                    {hasRichieste && (
                      <Link to="/campo" className={linkCls}>
                        Apri richieste
                      </Link>
                    )}
                  </div>
                  <ul className="court-rule">
                    {lista.map((it) => (
                      <li key={it.id}>
                        <RigaAttenzione it={it} ctx={ctx} now={now} primaria={it.id === primaId} fatto={fatti.get(it.id)?.testo} onFatto={onFatto} />
                      </li>
                    ))}
                  </ul>
                  {tagliate && (
                    <Button variant="ghost" className="justify-self-start" onClick={() => setEspandi(true)}>
                      Mostra altre {righe.length - MAX_PER_SAPERE}
                    </Button>
                  )}
                </section>
              );
            })
          )}

          {nonIscritto && d.torneo && (
            <section aria-labelledby="non-iscritto" className="grid gap-2 border-t border-line pt-5">
              <h2 id="non-iscritto" className="text-lg font-bold">
                Non sei ancora iscritto a questo torneo.
              </h2>
              {d.torneo.stato === 'iscrizioni' ? (
                <Link to={`/t/${tid}/coppia`} className={buttonVariants({ variant: 'secondary', className: 'justify-self-start' })}>
                  Iscrivi la tua coppia
                </Link>
              ) : (
                <Link to={`/t/${tid}`} className={linkCls}>
                  Segui classifiche e calendario
                </Link>
              )}
            </section>
          )}
        </div>

        {ruoli.includes('giocatore') && mia && tid && (
          <aside aria-labelledby="prossime" className="hidden content-start gap-1 lg:grid">
            <h2 id="prossime" className="border-b-2 border-line-strong pb-1 text-lg font-bold">
              Prossime partite
            </h2>
            {prossime.length ? (
              <ul className="court-rule">
                {prossime.map((p) => (
                  <li key={p.id}>
                    <MatchRow p={p} squadraById={d.squadraById} campi={campi.data ?? []} href={`/t/${tid}/partite/${p.id}`} evidenzia={[mia.id]} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-ink-muted">Nessuna partita programmata.</p>
            )}
            <Link to={`/t/${tid}/partite`} className={linkCls}>
              Vedi le tue partite
            </Link>
          </aside>
        )}
      </div>
    </>
  );
}

function Vuoto({
  filtro,
  ruoli,
  tid,
  today,
  prossima,
  ctx,
  iscritto,
}: {
  iscritto: boolean;
  filtro: Filtro;
  ruoli: AttentionRole[];
  tid: string | undefined;
  today: string;
  prossima: Partita | undefined;
  ctx: Contesto;
}) {
  const vede = (r: AttentionRole) => ruoli.includes(r) && (filtro === 'tutto' || filtro === r);
  return (
    <div className="grid gap-4">
      {vede('giocatore') && tid && iscritto && (
        <EmptyState
          titolo="Niente da fare adesso."
          testo="Quando qualcuno propone un orario o inserisce un risultato lo trovi qui."
          azione={
            <Link to={`/t/${tid}/partite`} className={linkCls}>
              Vedi le tue partite
            </Link>
          }
        />
      )}
      {vede('giocatore') && prossima && (
        <section aria-labelledby="prossima" className="grid gap-1 border-t border-line pt-4">
          <h2 id="prossima" className="text-lg font-bold">
            La tua prossima partita
          </h2>
          <MatchRow p={prossima} squadraById={ctx.squadraById} campi={ctx.campi} href={`/t/${tid}/partite/${prossima.id}`} />
        </section>
      )}
      {vede('gestore') && (
        <EmptyState
          titolo="Nessuna richiesta da confermare."
          azione={
            <Link to={`/campo/giorno/${today}`} className={linkCls}>
              Apri la giornata di oggi
            </Link>
          }
        />
      )}
      {vede('organizzatore') && (
        <EmptyState titolo="Il torneo procede da solo." testo="Nessuna contestazione e nessuna partita in ritardo." />
      )}
      {ruoli.length === 0 && (
        <EmptyState
          titolo="Niente da fare qui."
          testo="Segui classifiche e calendario del torneo."
          azione={
            tid ? (
              <Link to={`/t/${tid}`} className={linkCls}>
                Apri il torneo
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
