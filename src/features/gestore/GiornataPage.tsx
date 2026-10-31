import * as Menu from '@radix-ui/react-dropdown-menu';
import { Ban, ChevronLeft, ChevronRight, DoorClosed, EllipsisVertical, ExternalLink, Info, Plus, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { scalaDaCampi } from '../../components/CourtLanes';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState } from '../../components/states';
import { TONO_CLASSI } from '../../components/StatusBadge';
import { azioni, useAzione } from '../../data/mutations';
import { useCampi, useOccupazioni, useRichiesteFinestra } from '../../data/queries';
import { campoAttivo, richiestaAttiva, type Slot } from '../../lib/slots';
import { addDays, GIORNI_LUNGHI, labelDate, today, weekday } from '../../lib/time';
import type { Campo, OccupazioneRiga, Richiesta, TipoOccupazione } from '../../types';
import { Button, cn, ConfirmDialog, Field, Input, Label, Segmented, Select, Sheet, Skeleton, Textarea } from '../../ui';
import { usePartiteGestore } from './dati';
import { Esito } from './Esito';
import { GestoreNav } from './GestoreNav';
import { ASPETTO_TIPO, GiornoLanes } from './GiornoLanes';
import { MOTIVO_OFFLINE, useAdesso, useOnline } from './hooks';
import {
  erroreIntervallo,
  ETICHETTA_TIPO,
  fineLeggibile,
  messaggioChiusura,
  messaggioConflitti,
  minutoIniziale,
  orari,
  type EsitoMessaggio,
} from './logic';

const PX = 1;
const ORARI_INIZIO = orari('08:00', '23:45', 15);
const ORARI_FINE = orari('08:15', '24:00', 15);
type TipoManuale = Exclude<TipoOccupazione, 'campionato'>;
const TIPI: { value: TipoManuale; label: string }[] = [
  { value: 'esterno', label: 'Esterno' },
  { value: 'lezione', label: 'Lezione' },
  { value: 'chiusura', label: 'Chiusura' },
];

function valida(d: string | undefined): d is string {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

/** Day timeline (/campo/giorno/:data?): two court lanes, add/free occupations, close the day. */
export default function GiornataPage() {
  const params = useParams();
  const navigate = useNavigate();
  const oggi = today();
  const data = valida(params.data) ? params.data : oggi;
  const vai = (d: string) => navigate(`/campo/giorno/${d}`);
  const now = useAdesso();
  const online = useOnline();
  const offline = online ? null : MOTIVO_OFFLINE;

  const campi = useCampi();
  const occ = useOccupazioni(data, data);
  const fin = useRichiesteFinestra(data, data);
  const pg = usePartiteGestore();
  const inAttesa = useMemo(() => (fin.data ?? []).filter((r) => r.stato === 'attesa' && richiestaAttiva(r, now)), [fin.data, now]);

  const scala = useMemo(() => scalaDaCampi(campi.data ?? [], PX, { da: '08:00', a: '24:00' }), [campi.data]);
  const eOggi = data === oggi;
  const d = new Date(now);
  const oraMin = d.getHours() * 60 + d.getMinutes();

  const [esito, setEsito] = useState<EsitoMessaggio | null>(null);
  const [nuova, setNuova] = useState<Bozza | null>(null);
  const [dettaglio, setDettaglio] = useState<OccupazioneRiga | null>(null);
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null);
  const [chiudi, setChiudi] = useState(false);

  // open scrolled at 13:00, or now if later (G4)
  const scroller = useRef<HTMLDivElement>(null);
  const pronto = !campi.isPending && !occ.isPending;
  useLayoutEffect(() => {
    if (!pronto || !scroller.current) return;
    scroller.current.scrollTop = Math.max(0, (minutoIniziale(eOggi, oraMin) - scala.da) * scala.px);
    // only when the day changes or the data first arrives
  }, [pronto, data]);

  useEffect(() => setEsito(null), [data]);

  const lista = campi.data ?? [];
  const chiusi = lista.filter((c) => !campoAttivo(c, data));
  const errore = campi.error ?? occ.error ?? fin.error;
  const primoCampo = lista.find((c) => campoAttivo(c, data)) ?? lista[0];

  return (
    <>
      <PageHeader
        titolo="Giornata"
        sottotitolo={<span className="tabular">{GIORNI_LUNGHI[weekday(data)]} {labelDate(data).split(' ')[1]}</span>}
        azioni={
          <>
            <Button
              variant="primary"
              disabled={!primoCampo || !!offline}
              onClick={() =>
                primoCampo && setNuova({ campoId: primoCampo.id, inizio: '18:00', fine: '19:30', tipo: 'esterno', nota: '' })
              }
            >
              <Plus aria-hidden /> Segna occupazione
            </Button>
            <Menu.Root>
              <Menu.Trigger asChild>
                <Button variant="ghost" size="icon" aria-label="Altre azioni">
                  <EllipsisVertical aria-hidden />
                </Button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content
                  align="end"
                  sideOffset={4}
                  className="z-40 min-w-56 rounded-control border border-line bg-surface p-1 text-ink shadow-raised"
                >
                  <Menu.Item
                    disabled={!!offline}
                    onSelect={() => setChiudi(true)}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[6px] px-3 font-semibold text-danger-ink outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-danger-soft"
                  >
                    <DoorClosed className="size-5" aria-hidden /> Chiudi la giornata
                  </Menu.Item>
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          </>
        }
      />
      <GestoreNav />

      <nav aria-label="Scegli il giorno" className="mb-4 flex flex-wrap items-end gap-2">
        <Button variant="secondary" size="icon" aria-label={`Giorno prima: ${labelDate(addDays(data, -1))}`} onClick={() => vai(addDays(data, -1))}>
          <ChevronLeft aria-hidden />
        </Button>
        <div className="grid gap-1">
          <Label htmlFor="giorno" className="sr-only">
            Data
          </Label>
          <Input id="giorno" type="date" value={data} onChange={(e) => valida(e.target.value) && vai(e.target.value)} className="w-auto" />
        </div>
        <Button variant="secondary" size="icon" aria-label={`Giorno dopo: ${labelDate(addDays(data, 1))}`} onClick={() => vai(addDays(data, 1))}>
          <ChevronRight aria-hidden />
        </Button>
        <Button
          variant={eOggi ? 'court' : 'ghost'}
          aria-current={eOggi ? 'date' : undefined}
          onClick={() => vai(oggi)}
        >
          Oggi
        </Button>
      </nav>

      <Esito esito={esito} onChiudi={() => setEsito(null)} />
      {offline && <p className={cn('mb-4 rounded-panel p-3 font-semibold', TONO_CLASSI.warn)}>{offline}</p>}

      {errore ? (
        <ErrorState errore={errore} onRiprova={() => (campi.refetch(), occ.refetch(), fin.refetch())} />
      ) : !pronto ? (
        <div className="grid grid-cols-[2.75rem_1fr_1fr] gap-1.5" role="status" aria-label="Caricamento della giornata">
          <span />
          <Skeleton className="h-[60dvh]" />
          <Skeleton className="h-[60dvh]" />
        </div>
      ) : !lista.length ? (
        <EmptyState
          titolo="Nessun campo configurato."
          testo="Aggiungi i campi con orari e giorni di apertura: la giornata si disegna da lì."
          azione={
            <Button asChild variant="court">
              <Link to="/campo/impostazioni">Configura i campi</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {chiusi.map((c) => (
            <p key={c.id} className={cn('flex items-center gap-2 rounded-panel p-3', TONO_CLASSI.idle)}>
              <DoorClosed className="size-5 shrink-0" aria-hidden />
              {c.eccezioni.includes(data)
                ? `${c.nome} è chiuso in questa data.`
                : `${c.nome} è chiuso il ${GIORNI_LUNGHI[weekday(data)]}.`}
            </p>
          ))}
          {occ.righe.length === 0 && (
            <p className="flex items-center gap-2 text-ink-muted">
              <Info className="size-5 shrink-0" aria-hidden />
              Nessuna occupazione: tocca uno slot per segnarlo occupato.
            </p>
          )}
          <Legenda />
          <div
            ref={scroller}
            className="max-h-[70dvh] overflow-y-auto overscroll-contain rounded-panel"
            tabIndex={0}
            role="region"
            aria-label="Linea del tempo dei campi, scorri per vedere tutte le ore"
          >
            <GiornoLanes
              data={data}
              campi={lista}
              scala={scala}
              occupazioni={occ.righe}
              richieste={inAttesa}
              stickyTop="0px"
              nomePartita={pg.nomePartita}
              now={now}
              oraCorrente={eOggi ? oraMin : undefined}
              onSlotLibero={
                offline ? undefined : (c: Campo, s: Slot) => setNuova({ campoId: c.id, inizio: s.inizio, fine: s.fine, tipo: 'esterno', nota: '' })
              }
              onOccupazione={setDettaglio}
              onRichiesta={setRichiesta}
            />
          </div>
        </div>
      )}

      <NuovaOccupazione
        bozza={nuova}
        data={data}
        campi={lista}
        onOpenChange={(o) => !o && setNuova(null)}
        onEsito={setEsito}
      />
      <DettaglioOccupazione
        o={dettaglio}
        nomeCampo={lista.find((c) => c.id === dettaglio?.campoId)?.nome ?? ''}
        pg={pg}
        offline={offline}
        onOpenChange={(o) => !o && setDettaglio(null)}
      />
      <Sheet
        open={!!richiesta}
        onOpenChange={(o) => !o && setRichiesta(null)}
        title="Richiesta in attesa"
        description={
          richiesta ? `${labelDate(richiesta.data)} · ${richiesta.inizio}–${richiesta.fine} · ${lista.find((c) => c.id === richiesta.campoId)?.nome ?? ''}` : undefined
        }
        footer={
          richiesta && (
            <Button asChild variant="court">
              <Link to={`/campo?r=${richiesta.id}`}>Apri nelle richieste</Link>
            </Button>
          )
        }
      >
        {richiesta && (
          <div className="grid gap-2">
            <p className="font-semibold">{pg.nomePartita(richiesta.partitaId) ?? pg.giocatoriPartita(richiesta.partitaId, richiesta.giocatori)}</p>
            <p className="text-ink-muted">
              Non è ancora un’occupazione: se segni il campo occupato in questo orario, la richiesta passa in conflitto.
            </p>
          </div>
        )}
      </Sheet>
      <ChiudiGiornata open={chiudi} data={data} onOpenChange={setChiudi} onEsito={setEsito} />
    </>
  );
}

function Legenda() {
  const voci: { tipo: TipoOccupazione; testo: string }[] = [
    { tipo: 'campionato', testo: 'Campionato' },
    { tipo: 'esterno', testo: 'Esterno' },
    { tipo: 'lezione', testo: 'Lezione' },
    { tipo: 'chiusura', testo: 'Chiuso' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-ink-muted" aria-label="Legenda">
      {voci.map((v) => {
        const Icon = ASPETTO_TIPO[v.tipo].icon;
        return (
          <li key={v.tipo} className="inline-flex items-center gap-1">
            <Icon className="size-4" aria-hidden /> {v.testo}
          </li>
        );
      })}
      <li className="inline-flex items-center gap-1">
        <span aria-hidden className="inline-block h-3 w-4 rounded-[3px] border-2 border-dashed border-info" /> Richiesta in attesa
      </li>
      <li className="inline-flex items-center gap-1">
        <Plus className="size-4" aria-hidden /> Slot libero
      </li>
      <li className="inline-flex items-center gap-1">
        <Ban className="size-4" aria-hidden /> Inutilizzabile
      </li>
    </ul>
  );
}

interface Bozza {
  campoId: string;
  inizio: string;
  fine: string;
  tipo: TipoManuale;
  nota: string;
}

function NuovaOccupazione({
  bozza,
  data,
  campi,
  onOpenChange,
  onEsito,
}: {
  bozza: Bozza | null;
  data: string;
  campi: Campo[];
  onOpenChange: (o: boolean) => void;
  onEsito: (e: EsitoMessaggio) => void;
}) {
  return (
    <Sheet open={!!bozza} onOpenChange={onOpenChange} title="Segna occupazione" description={`${GIORNI_LUNGHI[weekday(data)]} ${labelDate(data).split(' ')[1]}`}>
      {bozza && (
        <FormOccupazione
          key={`${bozza.campoId}-${bozza.inizio}`}
          iniziale={bozza}
          data={data}
          campi={campi}
          onFatto={(e) => {
            onEsito(e);
            onOpenChange(false);
          }}
        />
      )}
    </Sheet>
  );
}

function FormOccupazione({
  iniziale,
  data,
  campi,
  onFatto,
}: {
  iniziale: Bozza;
  data: string;
  campi: Campo[];
  onFatto: (e: EsitoMessaggio) => void;
}) {
  const [b, setB] = useState(iniziale);
  const [inviato, setInviato] = useState(false);
  const errore = erroreIntervallo(b.inizio, b.fine);
  const aggiungi = useAzione(azioni.aggiungiOccupazione, {
    onSuccess: (res) =>
      onFatto({ tono: res.conflitti ? 'warn' : 'ok', testo: messaggioConflitti('Segnato.', res.conflitti) }),
  });
  const set = <K extends keyof Bozza>(k: K, v: Bozza[K]) => setB((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setInviato(true);
        if (errore) return;
        aggiungi.mutate({ campo: b.campoId, data, inizio: b.inizio, fine: b.fine, tipo: b.tipo, nota: b.nota.trim() || undefined });
      }}
    >
      <Field label="Campo">
        {(p) => (
          <Select {...p} value={b.campoId} onChange={(e) => set('campoId', e.target.value)}>
            {campi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid gap-1.5">
        <span className="text-sm font-semibold" aria-hidden>
          Tipo
        </span>
        <Segmented label="Tipo di occupazione" value={b.tipo} onValueChange={(v) => set('tipo', v)} options={TIPI} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dalle">
          {(p) => (
            <Select {...p} value={b.inizio} onChange={(e) => set('inizio', e.target.value)}>
              {ORARI_INIZIO.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Alle" error={inviato || b.fine <= b.inizio ? errore : null}>
          {(p) => (
            <Select {...p} value={b.fine} onChange={(e) => set('fine', e.target.value)}>
              {ORARI_FINE.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Nota" hint="Facoltativa, per esempio il nome di chi ha prenotato.">
        {(p) => <Textarea {...p} value={b.nota} onChange={(e) => set('nota', e.target.value)} maxLength={200} />}
      </Field>
      <p className="text-sm text-ink-muted">Le richieste in attesa che si sovrappongono passano in conflitto.</p>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={aggiungi.isPending}>
          Segna occupato
        </Button>
      </div>
    </form>
  );
}

function DettaglioOccupazione({
  o,
  nomeCampo,
  pg,
  offline,
  onOpenChange,
}: {
  o: OccupazioneRiga | null;
  nomeCampo: string;
  pg: ReturnType<typeof usePartiteGestore>;
  offline: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const [conferma, setConferma] = useState(false);
  const [nota, setNota] = useState('');
  const libera = useAzione(azioni.rimuoviOccupazione, {
    successo: 'Occupazione liberata.',
    onSuccess: () => (setConferma(false), onOpenChange(false)),
  });
  const annulla = useAzione(azioni.annullaConfermata, {
    successo: 'Partita annullata: il campo è di nuovo libero.',
    onSuccess: () => (setConferma(false), setNota(''), onOpenChange(false)),
  });
  if (!o) return null;
  const a = ASPETTO_TIPO[o.tipo];
  const orario = `${o.inizio}–${fineLeggibile(o.fine)}`;
  const campionato = o.tipo === 'campionato';
  const link = campionato ? pg.linkPartita(o.torneoId, o.partitaId) : undefined;
  return (
    <>
      <Sheet
        open
        onOpenChange={onOpenChange}
        title={
          <span className="flex items-center gap-2">
            <a.icon className="size-5" aria-hidden /> {ETICHETTA_TIPO[o.tipo]}
          </span>
        }
        description={`${labelDate(o.data)} · ${orario} · ${nomeCampo}`}
        footer={
          campionato ? (
            o.richiestaId && (
              <Button variant="danger" onClick={() => setConferma(true)} disabled={!!offline}>
                <Trash2 aria-hidden /> Annulla partita
              </Button>
            )
          ) : (
            <Button variant="danger" onClick={() => setConferma(true)} disabled={!!offline}>
              <Trash2 aria-hidden /> Libera
            </Button>
          )
        }
      >
        <dl className="court-rule grid">
          {campionato && (
            <div className="grid gap-0.5 py-2">
              <dt className="text-sm text-ink-muted">Partita</dt>
              <dd className="font-semibold">{pg.nomePartita(o.partitaId) ?? 'Partita del campionato'}</dd>
              {pg.partita(o.partitaId) && <dd className="text-ink-muted">{pg.giocatoriPartita(o.partitaId)}</dd>}
            </div>
          )}
          <div className="grid gap-0.5 py-2">
            <dt className="text-sm text-ink-muted">Orario</dt>
            <dd className="tabular font-semibold">{orario}</dd>
          </div>
          {o.nota && (
            <div className="grid gap-0.5 py-2">
              <dt className="text-sm text-ink-muted">Nota</dt>
              <dd>{o.nota}</dd>
            </div>
          )}
          {o.ricorrenzaId && (
            <div className="grid gap-0.5 py-2">
              <dt className="text-sm text-ink-muted">Origine</dt>
              <dd>
                Da una{' '}
                <Link to="/campo/ricorrenze" className="font-semibold text-court underline dark:text-info-ink">
                  ricorrenza
                </Link>
                : liberarla qui non cambia la regola.
              </dd>
            </div>
          )}
        </dl>
        {link && (
          <Link to={link} className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-court underline dark:text-info-ink">
            <ExternalLink className="size-4" aria-hidden /> Apri la partita
          </Link>
        )}
        {offline && <p className="mt-3 text-sm font-semibold text-ink-muted">{offline}</p>}
      </Sheet>
      <ConfirmDialog
        open={conferma}
        onOpenChange={setConferma}
        title={
          campionato
            ? `Annullare la partita di ${labelDate(o.data)} ${o.inizio}?`
            : `Liberare ${ETICHETTA_TIPO[o.tipo].toLowerCase()} ${orario} sul ${nomeCampo}?`
        }
        description={
          campionato ? 'Il campo si libera e i giocatori dovranno riprogrammarla.' : 'Lo spazio torna libero e i giocatori lo vedono subito.'
        }
        confirmLabel={campionato ? 'Annulla partita' : 'Libera'}
        cancelLabel={campionato ? 'Non annullare' : 'Annulla'}
        loading={libera.isPending || annulla.isPending}
        onConfirm={() =>
          campionato
            ? o.richiestaId && annulla.mutate({ richiesta: o.richiestaId, nota: nota.trim() || undefined })
            : libera.mutate(o.id)
        }
      >
        {campionato && (
          <Field label="Nota per i giocatori" hint="Facoltativa.">
            {(p) => <Textarea {...p} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />}
          </Field>
        )}
      </ConfirmDialog>
    </>
  );
}

function ChiudiGiornata({
  open,
  data,
  onOpenChange,
  onEsito,
}: {
  open: boolean;
  data: string;
  onOpenChange: (o: boolean) => void;
  onEsito: (e: EsitoMessaggio) => void;
}) {
  const [motivo, setMotivo] = useState('Chiusura');
  const [tentato, setTentato] = useState(false);
  const chiudi = useAzione(azioni.chiudiGiornata, {
    onSuccess: (res) => {
      onEsito(messaggioChiusura(res, data));
      onOpenChange(false);
    },
  });
  const errore = !motivo.trim() ? 'Scrivi il motivo: lo vedono i giocatori.' : null;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) (setTentato(false), setMotivo('Chiusura'));
        onOpenChange(o);
      }}
      title={`Chiudere tutti i campi ${labelDate(data)}?`}
      description="Segna entrambi i campi chiusi per tutto il giorno. Le richieste in attesa passano in conflitto; le partite già confermate bloccano la chiusura di quel campo."
      confirmLabel="Chiudi la giornata"
      loading={chiudi.isPending}
      onConfirm={() => {
        setTentato(true);
        if (errore) return;
        chiudi.mutate({ data, nota: motivo.trim() });
      }}
    >
      <Field label="Motivo" error={tentato ? errore : null}>
        {(p) => <Input {...p} value={motivo} onChange={(e) => setMotivo(e.target.value)} required maxLength={120} />}
      </Field>
    </ConfirmDialog>
  );
}
