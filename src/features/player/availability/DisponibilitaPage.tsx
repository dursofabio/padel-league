import { CalendarRange, List, Plus, TriangleAlert, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useBlocker, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../../auth/AuthProvider';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../../components/states';
import { WhatsAppButton } from '../../../components/WhatsAppButton';
import { azioni, useAzione } from '../../../data/mutations';
import { useCampi, useDisponibilita, useTorneoData } from '../../../data/queries';
import {
  aggiungiFasciaConEsito,
  copiaSuStessoGiorno,
  fasceUguali,
  giorniDelPeriodo,
  giorniModificati,
  impostaGiorno,
  passoOrari,
  periodiAperti,
  periodoPredefinito,
  rimuoviFascia,
  soloFuture,
} from '../../../lib/fasce';
import { labelDate, today, weekday } from '../../../lib/time';
import { appUrl } from '../../../lib/whatsapp';
import type { Campo, Disponibilita, Fasce, Periodo } from '../../../types';
import { Button, ConfirmDialog, Field, Segmented, Select, Sheet } from '../../../ui';
import { AggiungiOrario, AzioniGiorno, ChipFasce, pluraleGiorno } from './GiornoEditor';
import { LineaTempo } from './LineaTempo';
import { SettimanaStrip } from './SettimanaStrip';

const VUOTO: Fasce = {};

/** "2026-11-10" -> "10/11" */
function ggmm(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

function etichettaPeriodo(p: Periodo): string {
  return `${p.etichetta} · ${ggmm(p.inizio)} – ${ggmm(p.fine)}`;
}

function iscriviOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function useOnline() {
  return useSyncExternalStore(
    iscriviOnline,
    () => navigator.onLine,
    () => true,
  );
}

export default function DisponibilitaPage() {
  const { tid } = useParams();
  const { user } = useAuth();
  const uid = user?.id;
  const td = useTorneoData(tid);
  const disp = useDisponibilita(tid, uid ? [uid] : []);
  const campi = useCampi();

  if (td.isPending || disp.isPending)
    return (
      <>
        <PageHeader titolo="Le mie disponibilità" />
        <SkeletonRighe righe={6} />
      </>
    );
  const errore = td.error ?? disp.error;
  if (errore)
    return (
      <>
        <PageHeader titolo="Le mie disponibilità" />
        <ErrorState
          errore={errore}
          onRiprova={() => {
            td.refetch();
            disp.refetch();
          }}
        />
      </>
    );

  return (
    <Editor
      key={`${tid}-${uid}`}
      tid={tid!}
      uid={uid!}
      salvata={disp.data?.[uid!]}
      datiServer={disp.data}
      td={td}
      campi={campi.data ?? []}
    />
  );
}

function Editor({
  tid,
  uid,
  salvata,
  datiServer,
  td,
  campi,
}: {
  tid: string;
  uid: string;
  salvata: Disponibilita | undefined;
  datiServer: unknown;
  td: ReturnType<typeof useTorneoData>;
  campi: Campo[];
}) {
  const oggi = today();
  const online = useOnline();
  const serverFasce = salvata?.fasce ?? VUOTO;

  // base = ultima versione salvata che conosciamo; bozza = quello che l'utente sta modificando
  const [base, setBase] = useState<Fasce>(serverFasce);
  const [bozza, setBozza] = useState<Fasce>(serverFasce);
  const [visto, setVisto] = useState(datiServer);
  const [conflitto, setConflitto] = useState<Fasce | null>(null);
  const modificati = useMemo(() => giorniModificati(bozza, base), [bozza, base]);
  const dirty = modificati.length > 0;

  // arriva una versione nuova dal server (realtime, altro dispositivo, dopo il salvataggio)
  if (datiServer !== visto) {
    setVisto(datiServer);
    if (!dirty) {
      setBase(serverFasce);
      setBozza(serverFasce);
      setConflitto(null);
    } else if (!fasceUguali(serverFasce, base)) {
      setConflitto(serverFasce);
    }
  }

  const aperti = useMemo(() => periodiAperti(td.periodi, oggi), [td.periodi, oggi]);
  const [periodoId, setPeriodoId] = useState<string | undefined>(() => periodoPredefinito(aperti, td.partite, uid)?.id);
  const periodo = aperti.find((p) => p.id === periodoId) ?? aperti[0];
  const giorni = useMemo(() => (periodo ? giorniDelPeriodo(periodo, oggi) : []), [periodo, oggi]);
  const passo = passoOrari(td.torneo?.config);

  const [aperto, setAperto] = useState<string | null>(null); // riga "Aggiungi orario" aperta (elenco)
  const [inSheet, setInSheet] = useState<string | null>(null); // giorno aperto dalla vista settimana
  const [vista, setVista] = useState<'settimana' | 'elenco'>('settimana');
  const [erroreSalva, setErroreSalva] = useState<string | null>(null);

  const salva = useAzione(azioni.salvaDisponibilita, { successo: 'Disponibilità salvate.', errore: false });

  // chiudere la scheda con modifiche non salvate: avviso del browser
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  const cambia = (n: Fasce) => {
    setBozza(n);
    setErroreSalva(null);
  };

  const aggiungi = (data: string, da: string, a: string) => {
    const r = aggiungiFasciaConEsito(bozza[data] ?? [], da, a);
    cambia(impostaGiorno(bozza, data, r.lista));
    return r.unita;
  };
  const rimuovi = (data: string, f: string) => cambia(impostaGiorno(bozza, data, rimuoviFascia(bozza[data] ?? [], f)));

  const conAnnulla = (prima: Fasce, messaggio: string) =>
    toast(messaggio, { action: { label: 'Annulla', onClick: () => cambia(prima) } });

  const copia = (data: string) => {
    const prima = bozza;
    const r = copiaSuStessoGiorno(bozza, data, giorni);
    cambia(r.fasce);
    conAnnulla(prima, `Copiato su ${r.giorni.length} ${pluraleGiorno(data, r.giorni.length)}.`);
  };
  const svuota = (data: string) => {
    const prima = bozza;
    cambia(impostaGiorno(bozza, data, []));
    conAnnulla(prima, `${labelDate(data)} svuotato.`);
  };

  const onSalva = () => {
    if (!online) {
      setErroreSalva('Sei offline: salva quando torna la connessione.');
      return;
    }
    const pulite = soloFuture(bozza, oggi);
    salva.mutate(
      { torneo: tid, uid, fasce: pulite },
      {
        onSuccess: () => {
          setBase(pulite);
          setBozza(pulite);
          setConflitto(null);
          setErroreSalva(null);
        },
        onError: () => setErroreSalva('Non sono riuscito a salvare. Le modifiche sono ancora qui: riprova.'),
      },
    );
  };

  const header = (
    <PageHeader
      titolo="Le mie disponibilità"
      sottotitolo="Segna quando puoi giocare. Vale per tutte le tue partite del periodo e conta già come accettazione degli orari che copre."
      azioni={
        periodo && (
          <WhatsAppButton
            testo={`Segna le tue disponibilità per ${periodo.etichetta} (${ggmm(periodo.inizio)}–${ggmm(periodo.fine)}), così troviamo subito un orario: ${appUrl(`/t/${tid}/disponibilita`)}`}
          >
            Ricorda al gruppo
          </WhatsAppButton>
        )
      }
    />
  );

  if (!periodo)
    return (
      <>
        {header}
        <EmptyState
          titolo="Nessun periodo aperto"
          testo="Non c'è un periodo di gioco aperto. Quando l'organizzatore apre il prossimo, lo trovi qui."
        />
      </>
    );

  const altriStessoGiorno = (d: string) => giorni.some((g) => g !== d && weekday(g) === weekday(d));

  return (
    <>
      {header}

      <div className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {aperti.length <= 3 ? (
            <div className="grid gap-1.5">
              <span className="text-sm font-semibold">Periodo</span>
              <Segmented
                label="Periodo"
                value={periodo.id}
                onValueChange={setPeriodoId}
                options={aperti.map((p) => ({ value: p.id, label: <span className="tabular">{etichettaPeriodo(p)}</span> }))}
                className="flex-wrap"
              />
            </div>
          ) : (
            <Field label="Periodo" className="w-full sm:w-80">
              {(p) => (
                <Select {...p} value={periodo.id} onChange={(e) => setPeriodoId(e.target.value)}>
                  {aperti.map((x) => (
                    <option key={x.id} value={x.id}>
                      {etichettaPeriodo(x)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Segmented
            label="Vista"
            value={vista}
            onValueChange={setVista}
            className="hidden lg:inline-flex"
            options={[
              {
                value: 'settimana',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="size-4" aria-hidden /> Vista settimana
                  </span>
                ),
              },
              {
                value: 'elenco',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <List className="size-4" aria-hidden /> Vista elenco
                  </span>
                ),
              },
            ]}
          />
        </div>

        {conflitto && (
          <div role="status" className="grid gap-3 rounded-panel bg-warn-soft p-4 text-warn-ink">
            <p className="flex items-start gap-2 font-semibold">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              Hai modificato le disponibilità da un altro dispositivo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setBase(conflitto);
                  setBozza(conflitto);
                  setConflitto(null);
                }}
              >
                Usa quelle salvate
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setBase(conflitto);
                  setConflitto(null);
                }}
              >
                Tieni le mie
              </Button>
            </div>
          </div>
        )}

        {!salvata && !dirty && (
          <p className="max-w-prose text-ink-muted">Inizia dai giorni in cui giochi di solito, poi usa «Copia su tutti i …».</p>
        )}

        <section aria-labelledby="giorni-h" className="grid gap-2">
          <h2 id="giorni-h" className="sr-only">
            Giorni del periodo
          </h2>
          {giorni.length === 0 ? (
            <EmptyState titolo="Il periodo è finito" testo="Non restano giorni da segnare in questo periodo." />
          ) : (
            <>
              <div className={vista === 'settimana' ? 'hidden lg:block' : 'hidden'}>
                <SettimanaStrip giorni={giorni} fasce={bozza} campi={campi} oggi={oggi} selezionato={inSheet} onApri={setInSheet} />
              </div>
              <ul className={vista === 'settimana' ? 'court-rule lg:hidden' : 'court-rule'}>
                {giorni.map((d) => {
                  const lista = bozza[d] ?? [];
                  return (
                    <li key={d} className="grid gap-3 py-4">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="tabular text-lg font-bold">{labelDate(d)}</h3>
                        {d === oggi && <span className="text-sm font-semibold text-court dark:text-info-ink">oggi</span>}
                        {modificati.includes(d) && <span className="text-sm text-ink-muted">modificato</span>}
                      </div>
                      <ChipFasce fasce={lista} onRimuovi={(f) => rimuovi(d, f)} />
                      <LineaTempo data={d} fasce={lista} campi={campi} />
                      <div className="flex flex-wrap gap-2">
                        {aperto !== d && (
                          <Button variant="secondary" onClick={() => setAperto(d)}>
                            <Plus aria-hidden /> Aggiungi orario
                          </Button>
                        )}
                        <AzioniGiorno
                          data={d}
                          haFasce={lista.length > 0}
                          puoCopiare={altriStessoGiorno(d)}
                          onCopia={() => copia(d)}
                          onSvuota={() => svuota(d)}
                        />
                      </div>
                      {aperto === d && (
                        <AggiungiOrario passo={passo} onAggiungi={(da, a) => aggiungi(d, da, a)} onChiudi={() => setAperto(null)} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <p aria-live="polite" className="sr-only">
          {dirty ? 'Hai modifiche non salvate.' : ''}
        </p>

        {dirty && (
          <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 grid gap-2 rounded-panel border border-line bg-surface p-3 shadow-raised lg:bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold">
                Modifiche non salvate ({modificati.length} {modificati.length === 1 ? 'giorno' : 'giorni'})
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => cambia(base)} disabled={salva.isPending}>
                  Annulla modifiche
                </Button>
                <Button variant="primary" onClick={onSalva} loading={salva.isPending}>
                  Salva
                </Button>
              </div>
            </div>
            {(erroreSalva || !online) && (
              <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-danger-ink">
                {!online ? <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
                {!online ? 'Sei offline: salva quando torna la connessione.' : erroreSalva}
              </p>
            )}
          </div>
        )}
      </div>

      <Sheet
        open={!!inSheet}
        onOpenChange={(o) => !o && setInSheet(null)}
        title={inSheet ? labelDate(inSheet) : ''}
        description="Le modifiche restano in bozza finché non tocchi «Salva»."
      >
        {inSheet && (
          <div className="grid gap-4">
            <ChipFasce fasce={bozza[inSheet] ?? []} onRimuovi={(f) => rimuovi(inSheet, f)} />
            <div className="flex flex-wrap gap-2">
              <AzioniGiorno
                data={inSheet}
                haFasce={(bozza[inSheet] ?? []).length > 0}
                puoCopiare={altriStessoGiorno(inSheet)}
                onCopia={() => copia(inSheet)}
                onSvuota={() => svuota(inSheet)}
              />
            </div>
            <div className="border-t border-line pt-4">
              <AggiungiOrario key={inSheet} passo={passo} incorniciato={false} onAggiungi={(da, a) => aggiungi(inSheet, da, a)} />
            </div>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset();
        }}
        title="Esci senza salvare?"
        description={`Hai modifiche non salvate su ${modificati.length} ${modificati.length === 1 ? 'giorno' : 'giorni'}. Se esci le perdi.`}
        cancelLabel="Resta qui"
        confirmLabel="Esci senza salvare"
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}
