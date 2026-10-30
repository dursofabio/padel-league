import {
  AlarmClock,
  Ban,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock3,
  Hourglass,
  Lock,
  Repeat,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { scalaDaCampi } from '../../components/CourtLanes';
import { PageHeader, Sezione } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../components/states';
import { TONO_CLASSI } from '../../components/StatusBadge';
import { azioni, useAzione } from '../../data/mutations';
import { useCampi, useOccupazioni, useRichiesteConfermate, useRichiesteInAttesa } from '../../data/queries';
import { richiestaAttiva, slotImpattati } from '../../lib/slots';
import { addDays, labelDate, today } from '../../lib/time';
import type { Campo, OccupazioneRiga, Richiesta } from '../../types';
import { Button, cn, ConfirmDialog, Field, Sheet, Skeleton, Textarea } from '../../ui';
import { ControproponiSheet } from './ControproponiSheet';
import { usePartiteGestore } from './dati';
import { Esito } from './Esito';
import { GestoreNav } from './GestoreNav';
import { GiornoLanes } from './GiornoLanes';
import { DUE_PANNELLI, MOTIVO_OFFLINE, useAdesso, useMediaQuery, useOnline } from './hooks';
import {
  accettazioni,
  completa,
  descriviOccupazione,
  elenco,
  messaggioConferma,
  motivoBloccoConferma,
  occupazioniInConflitto,
  ordinaPerScadenza,
  richiesteSovrapposte,
  scadenzaTesto,
  type EsitoMessaggio,
} from './logic';

const GIORNI_CONFERMATE = 14;
const NOTE_RAPIDE = ['Campo occupato', 'Manutenzione', 'Orario non disponibile'];

/** Court manager inbox (/campo): confirm, reject, counter-propose; upcoming confirmed matches with cancel. */
export default function RichiestePage() {
  const now = useAdesso();
  const online = useOnline();
  const dueSchermi = useMediaQuery(DUE_PANNELLI);
  const oggi = today();
  const [params, setParams] = useSearchParams();

  const campi = useCampi();
  const inAttesa = useRichiesteInAttesa();
  const confermate = useRichiesteConfermate(oggi);
  const pg = usePartiteGestore();

  const live = useMemo(() => (inAttesa.data ?? []).filter((r) => richiestaAttiva(r, now)), [inAttesa.data, now]);
  const prossime = useMemo(
    () => (confermate.data ?? []).filter((r) => r.data <= addDays(oggi, GIORNI_CONFERMATE)),
    [confermate.data, oggi],
  );

  // occupations over the whole window of the listed requests (conflict preview + timeline)
  const date = [...live, ...prossime].map((r) => r.data).sort();
  const from = date[0] ?? oggi;
  const to = date[date.length - 1] ?? oggi;
  const occ = useOccupazioni(from, to, !inAttesa.isPending);

  const pronte = useMemo(() => ordinaPerScadenza(live.filter(completa)), [live]);
  const incomplete = useMemo(() => ordinaPerScadenza(live.filter((r) => !completa(r))), [live]);

  const selezionataId = params.get('r') ?? pronte[0]?.id ?? incomplete[0]?.id ?? prossime[0]?.id ?? null;
  const seleziona = (id: string) => setParams({ r: id }, { replace: true });
  const selezionata = [...live, ...prossime].find((r) => r.id === selezionataId) ?? null;

  const [esito, setEsito] = useState<EsitoMessaggio | null>(null);
  const [daRifiutare, setDaRifiutare] = useState<Richiesta | null>(null);
  const [daControproporre, setDaControproporre] = useState<Richiesta | null>(null);
  const [daAnnullare, setDaAnnullare] = useState<Richiesta | null>(null);
  const [aperteIncomplete, setAperteIncomplete] = useState(false);

  const nomeCampo = (id: string) => campi.data?.find((c) => c.id === id)?.nome ?? id;
  const conferma = useAzione(azioni.confermaRichiesta);

  const caricamento = inAttesa.isPending || campi.isPending;
  const errore = inAttesa.error ?? campi.error;
  const primaria = pronte.find((r) => r.id === selezionataId)?.id ?? pronte[0]?.id;
  const offline = online ? null : MOTIVO_OFFLINE;

  const riga = (r: Richiesta) => (
    <RichiestaRiga
      key={r.id}
      r={r}
      campo={campi.data?.find((c) => c.id === r.campoId)}
      tutte={live}
      occupazioni={occ.righe}
      now={now}
      pg={pg}
      primaria={r.id === primaria}
      selezionata={dueSchermi && r.id === selezionataId}
      dueSchermi={dueSchermi}
      onSeleziona={() => seleziona(r.id)}
      inConferma={conferma.isPending && conferma.variables === r.id}
      offline={offline}
      onConferma={() => {
        setEsito(null);
        conferma.mutate(r.id, { onSuccess: (res) => setEsito(messaggioConferma(res, r, nomeCampo(r.campoId))) });
      }}
      onRifiuta={() => setDaRifiutare(r)}
      onControproponi={() => setDaControproporre(r)}
    />
  );

  return (
    <>
      <PageHeader titolo="Richieste" sottotitolo="Conferma le partite del campionato e tieni d’occhio i campi." />
      <GestoreNav />
      <Esito esito={esito} onChiudi={() => setEsito(null)} />
      {offline && (
        <p className={cn('mb-5 rounded-panel p-3 font-semibold', TONO_CLASSI.warn)}>{offline}</p>
      )}

      <div className="grid gap-6 min-[820px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] min-[820px]:items-start">
        <div className="grid gap-6">
          {caricamento ? (
            <SkeletonRighe righe={4} />
          ) : errore ? (
            <ErrorState errore={errore} onRiprova={() => (inAttesa.refetch(), campi.refetch())} />
          ) : (
            <>
              <Sezione titolo={`Da confermare${pronte.length ? ` (${pronte.length})` : ''}`} id="da-confermare">
                {pronte.length ? (
                  <ul className="court-rule">{pronte.map(riga)}</ul>
                ) : (
                  <EmptyState
                    titolo="Nessuna richiesta da confermare."
                    testo="Le nuove arrivano qui da sole, appena tutti e 4 i giocatori hanno accettato."
                  />
                )}
              </Sezione>

              {incomplete.length > 0 && (
                <Sezione
                  titolo={`In attesa dei giocatori (${incomplete.length})`}
                  id="in-attesa"
                  azioni={
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={aperteIncomplete || dueSchermi}
                      aria-controls="lista-incomplete"
                      onClick={() => setAperteIncomplete((v) => !v)}
                      className={dueSchermi ? 'hidden' : undefined}
                    >
                      {aperteIncomplete ? 'Nascondi' : 'Mostra'}
                      <ChevronDown className={cn('transition-transform', aperteIncomplete && 'rotate-180')} aria-hidden />
                    </Button>
                  }
                >
                  <p className="text-ink-muted">
                    Si confermano solo a 4 su 4. Puoi già rifiutarle o proporre un altro orario.
                  </p>
                  {(aperteIncomplete || dueSchermi) && (
                    <ul id="lista-incomplete" className="court-rule">
                      {incomplete.map(riga)}
                    </ul>
                  )}
                </Sezione>
              )}

              <Sezione titolo="Confermate nei prossimi giorni" id="confermate">
                {confermate.isPending ? (
                  <SkeletonRighe righe={2} />
                ) : confermate.error ? (
                  <ErrorState errore={confermate.error} onRiprova={() => confermate.refetch()} />
                ) : prossime.length ? (
                  <ul className="court-rule">
                    {prossime.map((r) => (
                      <li key={r.id} className={cn('grid gap-2 py-3', dueSchermi && r.id === selezionataId && 'bg-surface-2 px-2')}>
                        <Intestazione
                          r={r}
                          nomeCampo={nomeCampo(r.campoId)}
                          dueSchermi={dueSchermi}
                          selezionata={dueSchermi && r.id === selezionataId}
                          onSeleziona={() => seleziona(r.id)}
                        />
                        <p className="font-semibold">{pg.nomePartita(r.partitaId) ?? pg.giocatoriPartita(r.partitaId, r.giocatori)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold', TONO_CLASSI.ok)}>
                            <CircleCheck className="size-4" aria-hidden /> Confermata
                          </span>
                          <Button variant="danger" size="sm" onClick={() => setDaAnnullare(r)} disabled={!!offline}>
                            <Ban aria-hidden /> Annulla partita
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    titolo="Nessuna partita confermata nei prossimi 14 giorni."
                    testo="Quando confermi una richiesta, la partita compare qui e nella giornata."
                  />
                )}
              </Sezione>
            </>
          )}
        </div>

        {dueSchermi && (
          <aside aria-label="Giornata della richiesta selezionata" className="sticky top-4 grid gap-3">
            {caricamento ? (
              <Skeleton className="h-[28rem] w-full" />
            ) : selezionata && campi.data?.length ? (
              <PannelloGiornata
                r={selezionata}
                campi={campi.data}
                occupazioni={occ.righe.filter((o) => o.data === selezionata.data)}
                richieste={live.filter((x) => x.data === selezionata.data)}
                caricando={occ.isPending}
                nomePartita={pg.nomePartita}
                now={now}
              />
            ) : (
              <p className="text-ink-muted">Seleziona una richiesta per vedere la sua giornata sui due campi.</p>
            )}
          </aside>
        )}
      </div>

      <RifiutaSheet
        richiesta={daRifiutare}
        descrizione={daRifiutare ? descrivi(daRifiutare, nomeCampo(daRifiutare.campoId)) : ''}
        onOpenChange={(o) => !o && setDaRifiutare(null)}
        offline={offline}
      />
      <ControproponiSheet
        richiesta={daControproporre}
        campi={campi.data ?? []}
        periodo={daControproporre ? pg.periodoPartita(daControproporre.partitaId) : undefined}
        descrizione={daControproporre ? pg.giocatoriPartita(daControproporre.partitaId, daControproporre.giocatori) : undefined}
        onOpenChange={(o) => !o && setDaControproporre(null)}
        disabilitato={offline}
      />
      <AnnullaConfermata
        richiesta={daAnnullare}
        nomeCampo={daAnnullare ? nomeCampo(daAnnullare.campoId) : ''}
        onOpenChange={(o) => !o && setDaAnnullare(null)}
      />
    </>
  );
}

function descrivi(r: Richiesta, nomeCampo: string) {
  return `${labelDate(r.data)} · ${r.inizio}–${r.fine} · ${nomeCampo}`;
}

/** Date/time/court line: on tablet it selects the request (timeline on the right), on phone it opens the day. */
function Intestazione({
  r,
  nomeCampo,
  dueSchermi,
  selezionata,
  onSeleziona,
}: {
  r: Richiesta;
  nomeCampo: string;
  dueSchermi: boolean;
  selezionata: boolean;
  onSeleziona: () => void;
}) {
  const testo = (
    <>
      <CalendarDays className="size-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="tabular">
        {labelDate(r.data)} · {r.inizio}–{r.fine}
      </span>
      <span>· {nomeCampo}</span>
    </>
  );
  const cls = 'inline-flex min-h-11 items-center gap-1.5 justify-self-start text-left text-base font-bold';
  return dueSchermi ? (
    <button type="button" className={cn(cls, 'hover:underline')} aria-pressed={selezionata} onClick={onSeleziona}>
      {testo}
    </button>
  ) : (
    <Link to={`/campo/giorno/${r.data}`} className={cn(cls, 'underline decoration-line-strong underline-offset-4')} aria-label={`${descrivi(r, nomeCampo)}: apri la giornata`}>
      {testo}
    </Link>
  );
}

function Pill({ tono, icon: Icon, children }: { tono: keyof typeof TONO_CLASSI; icon: typeof Clock3; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold', TONO_CLASSI[tono])}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

function RichiestaRiga({
  r,
  campo,
  tutte,
  occupazioni,
  now,
  pg,
  primaria,
  selezionata,
  dueSchermi,
  onSeleziona,
  inConferma,
  offline,
  onConferma,
  onRifiuta,
  onControproponi,
}: {
  r: Richiesta;
  campo?: Campo;
  tutte: Richiesta[];
  occupazioni: OccupazioneRiga[];
  now: number;
  pg: ReturnType<typeof usePartiteGestore>;
  primaria: boolean;
  selezionata: boolean;
  dueSchermi: boolean;
  onSeleziona: () => void;
  inConferma: boolean;
  offline: string | null;
  onConferma: () => void;
  onRifiuta: () => void;
  onControproponi: () => void;
}) {
  const acc = accettazioni(r);
  const scad = scadenzaTesto(r.scadenza.toMillis(), now);
  const conflitti = occupazioniInConflitto(r, occupazioni);
  const sovrapposte = richiesteSovrapposte(r, tutte, now);
  const impatto = r.fuoriGriglia && campo ? slotImpattati(campo, r.data, r.inizio, r.fine) : [];
  const blocco = offline ?? motivoBloccoConferma(r, conflitti, pg.nome, now);
  const motivoId = `motivo-${r.id}`;
  const nomeCampo = campo?.nome ?? r.campoId;
  const squadre = pg.nomePartita(r.partitaId);

  return (
    <li className={cn('grid gap-2 py-4', selezionata && 'bg-surface-2 px-2 outline-2 -outline-offset-2 outline-ball')}>
      <Intestazione r={r} nomeCampo={nomeCampo} dueSchermi={dueSchermi} selezionata={selezionata} onSeleziona={onSeleziona} />
      <div>
        {squadre && <p className="font-semibold">{squadre}</p>}
        <p className={squadre ? 'text-ink-muted' : 'font-semibold'}>{pg.giocatoriPartita(r.partitaId, r.giocatori)}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {acc.mancanti.length ? (
          <Pill tono="warn" icon={Hourglass}>
            <span className="tabular">{acc.date}/4</span> · manca {elenco(acc.mancanti.map(pg.nome))}
          </Pill>
        ) : (
          <Pill tono="ok" icon={CircleCheck}>
            <span className="tabular">4/4</span> hanno accettato
          </Pill>
        )}
        <Pill tono={scad.urgente ? 'danger' : 'idle'} icon={AlarmClock}>
          {scad.testo}
        </Pill>
        {r.fuoriGriglia && (
          <Pill tono="info" icon={Clock3}>
            Fuori griglia
          </Pill>
        )}
        {r.controproposta && (
          <Pill tono="info" icon={Repeat}>
            Proposta dal campo
          </Pill>
        )}
        {sovrapposte.length > 0 && (
          <Pill tono="warn" icon={TriangleAlert}>
            Sovrapposta
          </Pill>
        )}
        {conflitti.length > 0 && (
          <Pill tono="danger" icon={Lock}>
            Campo occupato
          </Pill>
        )}
      </div>

      {impatto.length > 0 && (
        <p className="text-sm">
          Rende inutilizzabili gli slot delle <span className="tabular">{elenco(impatto.map((s) => s.inizio))}</span> sul {nomeCampo}.
        </p>
      )}
      {sovrapposte.length > 0 && (
        <p className="text-sm">
          Sovrapposta a{' '}
          {sovrapposte
            .map((x) => `${x.inizio} ${nomeCampo}${pg.nomePartita(x.partitaId) ? ` (${pg.nomePartita(x.partitaId)})` : ''}`)
            .join(', ')}
          : confermandola, l’altra passa in conflitto.
        </p>
      )}
      {r.nota && <p className="text-sm text-ink-muted">Nota: {r.nota}</p>}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          variant={primaria ? 'primary' : 'court'}
          onClick={onConferma}
          loading={inConferma}
          disabled={!!blocco}
          aria-describedby={blocco ? motivoId : undefined}
        >
          <CircleCheck aria-hidden /> Conferma
        </Button>
        <Button variant="secondary" onClick={onRifiuta} disabled={!!offline}>
          <X aria-hidden /> Rifiuta
        </Button>
        <Button variant="ghost" onClick={onControproponi} disabled={!!offline}>
          <Repeat aria-hidden /> Proponi altro orario
        </Button>
      </div>
      {blocco && (
        <p id={motivoId} className="text-sm font-semibold text-ink-muted">
          {blocco}
        </p>
      )}
      {conflitti.length > 0 && !offline && acc.mancanti.length === 0 && (
        <p className="text-sm text-ink-muted">Occupazioni: {conflitti.map(descriviOccupazione).join(', ')}.</p>
      )}
    </li>
  );
}

function PannelloGiornata({
  r,
  campi,
  occupazioni,
  richieste,
  caricando,
  nomePartita,
  now,
}: {
  r: Richiesta;
  campi: Campo[];
  occupazioni: OccupazioneRiga[];
  richieste: Richiesta[];
  caricando: boolean;
  nomePartita: (id: string | null | undefined) => string | undefined;
  now: number;
}) {
  const scala = useMemo(() => scalaDaCampi(campi, 0.75, { da: r.inizio, a: r.fine }), [campi, r.inizio, r.fine]);
  const campo = campi.find((c) => c.id === r.campoId);
  const impattati = r.fuoriGriglia && campo ? slotImpattati(campo, r.data, r.inizio, r.fine) : [];
  const ric = r.stato === 'attesa' && !richieste.some((x) => x.id === r.id) ? [...richieste, r] : richieste;
  const eOggi = r.data === today();
  const d = new Date(now);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Giornata di {labelDate(r.data)}</h2>
        <Link to={`/campo/giorno/${r.data}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-court underline dark:text-info-ink">
          Apri la giornata
        </Link>
      </div>
      {caricando ? (
        <Skeleton className="h-[28rem] w-full" />
      ) : (
        <GiornoLanes
          data={r.data}
          campi={campi}
          scala={scala}
          occupazioni={occupazioni}
          richieste={ric}
          evidenziata={r.id}
          impattati={impattati}
          nomePartita={nomePartita}
          oraCorrente={eOggi ? d.getHours() * 60 + d.getMinutes() : undefined}
          now={now}
        />
      )}
    </>
  );
}

function RifiutaSheet({
  richiesta,
  descrizione,
  onOpenChange,
  offline,
}: {
  richiesta: Richiesta | null;
  descrizione: string;
  onOpenChange: (o: boolean) => void;
  offline: string | null;
}) {
  const [nota, setNota] = useState('');
  const rifiuta = useAzione(azioni.rifiutaRichiesta, {
    successo: 'Richiesta rifiutata: i giocatori possono sceglierne un altro orario.',
    onSuccess: () => {
      setNota('');
      onOpenChange(false);
    },
  });
  return (
    <Sheet
      open={!!richiesta}
      onOpenChange={(o) => {
        if (!o) setNota('');
        onOpenChange(o);
      }}
      title="Rifiuta la richiesta"
      description={descrizione}
      footer={
        <Button
          variant="danger"
          loading={rifiuta.isPending}
          disabled={!!offline}
          onClick={() => richiesta && rifiuta.mutate({ richiesta: richiesta.id, nota: nota.trim() || undefined })}
        >
          <X aria-hidden /> Rifiuta
        </Button>
      }
    >
      <div className="grid gap-4">
        <p className="text-ink-muted">Il campo non cambia. I giocatori vedono il rifiuto e la tua nota.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Note rapide">
          {NOTE_RAPIDE.map((n) => (
            <Button key={n} variant="secondary" size="sm" aria-pressed={nota === n} onClick={() => setNota(n)}>
              {n}
            </Button>
          ))}
        </div>
        <Field label="Nota per i giocatori" hint="Facoltativa.">
          {(p) => <Textarea {...p} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />}
        </Field>
        {offline && <p className="text-sm font-semibold text-ink-muted">{offline}</p>}
      </div>
    </Sheet>
  );
}

function AnnullaConfermata({
  richiesta,
  nomeCampo,
  onOpenChange,
}: {
  richiesta: Richiesta | null;
  nomeCampo: string;
  onOpenChange: (o: boolean) => void;
}) {
  const [nota, setNota] = useState('');
  const annulla = useAzione(azioni.annullaConfermata, {
    successo: 'Partita annullata: il campo è di nuovo libero.',
    onSuccess: () => {
      setNota('');
      onOpenChange(false);
    },
  });
  return (
    <ConfirmDialog
      open={!!richiesta}
      onOpenChange={onOpenChange}
      title={richiesta ? `Annullare la partita di ${labelDate(richiesta.data)} ${richiesta.inizio}?` : 'Annullare la partita?'}
      description={`Il ${nomeCampo || 'campo'} si libera e i giocatori dovranno riprogrammarla.`}
      confirmLabel="Annulla partita"
      cancelLabel="Non annullare"
      loading={annulla.isPending}
      onConfirm={() => richiesta && annulla.mutate({ richiesta: richiesta.id, nota: nota.trim() || undefined })}
    >
      <Field label="Nota per i giocatori" hint="Facoltativa.">
        {(p) => <Textarea {...p} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />}
      </Field>
    </ConfirmDialog>
  );
}
