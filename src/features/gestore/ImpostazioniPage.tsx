import { Info, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CourtLanes, LaneBlock, scalaDaCampi } from '../../components/CourtLanes';
import { PageHeader, Sezione } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../components/states';
import { TONO_CLASSI } from '../../components/StatusBadge';
import { azioni, useAzione } from '../../data/mutations';
import { useCampi, useRichiesteConfermate } from '../../data/queries';
import { addMin, giornoBreve, GIORNI_LUNGHI, today } from '../../lib/time';
import type { Campo } from '../../types';
import { Button, Checkbox, cn, ConfirmDialog, Field, Input, Label, Select, Sheet } from '../../ui';
import { Esito } from './Esito';
import { GestoreNav } from './GestoreNav';
import { MOTIVO_OFFLINE, useOnline } from './hooks';
import { aggiungiData, confermateFuoriGriglia, dataBreve, iniziGriglia, nuovoIdCampo, orari, validaCampo, type EsitoMessaggio } from './logic';

const SETTIMANA = [1, 2, 3, 4, 5, 6, 0];
const ORARI = orari('06:00', '23:45', 15);

function giorniTesto(g: number[]): string {
  if (g.length === 7) return 'tutti i giorni';
  if (!g.length) return 'nessun giorno';
  return SETTIMANA.filter((d) => g.includes(d)).map(giornoBreve).join(', ');
}

/** Court settings (/campo/impostazioni): grid rule per court with a live two-lane preview. */
export default function ImpostazioniPage() {
  const campi = useCampi();
  const online = useOnline();
  const offline = online ? null : MOTIVO_OFFLINE;
  const [bozza, setBozza] = useState<Campo | null>(null);
  const [nuovo, setNuovo] = useState(false);
  const [daEliminare, setDaEliminare] = useState<Campo | null>(null);
  const [esito, setEsito] = useState<EsitoMessaggio | null>(null);
  const elimina = useAzione(azioni.eliminaCampo, {
    successo: 'Campo eliminato.',
    onSuccess: () => setDaEliminare(null),
  });
  const lista = useMemo(() => campi.data ?? [], [campi.data]);

  const apriNuovo = () => {
    const n = lista.length + 1;
    setNuovo(true);
    setBozza({
      id: '',
      nome: `Campo ${n}`,
      primoSlot: '14:00',
      ultimoSlot: '21:00',
      durata: 90,
      giorniAttivi: [0, 1, 2, 3, 4, 5, 6],
      eccezioni: [],
      ordine: n,
    });
  };

  return (
    <>
      <PageHeader
        titolo="Impostazioni campi"
        sottotitolo="Orari e giorni di apertura: da qui nasce la griglia che vedono i giocatori."
        azioni={
          <Button variant="primary" onClick={apriNuovo} disabled={campi.isPending || !!offline}>
            <Plus aria-hidden /> Nuovo campo
          </Button>
        }
      />
      <GestoreNav />
      <Esito esito={esito} onChiudi={() => setEsito(null)} />
      {offline && <p className={cn('mb-4 rounded-panel p-3 font-semibold', TONO_CLASSI.warn)}>{offline}</p>}

      {campi.isPending ? (
        <SkeletonRighe righe={2} />
      ) : campi.error ? (
        <ErrorState errore={campi.error} onRiprova={() => campi.refetch()} />
      ) : !lista.length ? (
        <EmptyState
          titolo="Nessun campo."
          testo="Aggiungi i campi del circolo con primo e ultimo orario di inizio e durata della partita: la griglia si genera da sola."
        />
      ) : (
        <div className="grid gap-6">
          <Sezione titolo="Campi" id="campi">
            <ul className="court-rule">
              {lista.map((c) => (
                <li key={c.id} className="grid gap-1.5 py-4">
                  <p className="text-base font-bold">{c.nome}</p>
                  <p className="tabular text-sm">
                    Inizi: {iniziGriglia(c.primoSlot, c.ultimoSlot, c.durata).join(' · ')} ({c.durata}′)
                  </p>
                  <p className="text-sm text-ink-muted">Aperto: {giorniTesto(c.giorniAttivi)}</p>
                  {c.eccezioni.length > 0 && (
                    <p className="tabular text-sm text-ink-muted">Chiuso: {c.eccezioni.map(dataBreve).join(', ')}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="secondary" size="sm" disabled={!!offline} onClick={() => (setNuovo(false), setBozza(c))}>
                      <Pencil aria-hidden /> Modifica
                    </Button>
                    <Button variant="danger" size="sm" disabled={!!offline} onClick={() => setDaEliminare(c)}>
                      <Trash2 aria-hidden /> Elimina
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Sezione>
          <Sezione titolo="Griglia dei campi" id="anteprima">
            <p className="text-ink-muted">Così i giocatori vedono gli inizi possibili, con lo sfalsamento tra i campi.</p>
            <AnteprimaLanes campi={lista} />
          </Sezione>
        </div>
      )}

      <Sheet
        open={!!bozza}
        onOpenChange={(o) => !o && setBozza(null)}
        title={nuovo ? 'Nuovo campo' : `Modifica ${bozza?.nome ?? 'campo'}`}
      >
        {bozza && (
          <FormCampo
            key={bozza.id || 'nuovo'}
            iniziale={bozza}
            nuovo={nuovo}
            campi={lista}
            onFatto={(e) => {
              setEsito(e);
              setBozza(null);
            }}
          />
        )}
      </Sheet>

      <ConfirmDialog
        open={!!daEliminare}
        onOpenChange={(o) => !o && setDaEliminare(null)}
        title={`Eliminare ${daEliminare?.nome ?? 'il campo'}?`}
        description="Il campo sparisce dalla griglia dei giocatori e dalla giornata. Se ha partite o occupazioni collegate, l’eliminazione può essere rifiutata."
        confirmLabel="Elimina campo"
        loading={elimina.isPending}
        onConfirm={() => daEliminare && elimina.mutate(daEliminare.id)}
      />
    </>
  );
}

/** Mini two-lane preview of the grid starts (every court treated as open, to show the rule). */
function AnteprimaLanes({ campi, evidenzia }: { campi: Campo[]; evidenzia?: string }) {
  const validi = useMemo(() => campi.filter((c) => iniziGriglia(c.primoSlot, c.ultimoSlot, c.durata).length), [campi]);
  const scala = useMemo(() => scalaDaCampi(validi, 0.45), [validi]);
  if (!validi.length) return <p className="text-ink-muted">La griglia apparirà qui quando gli orari sono validi.</p>;
  return (
    <CourtLanes
      campi={validi}
      scala={scala}
      renderLane={(c) =>
        iniziGriglia(c.primoSlot, c.ultimoSlot, c.durata).map((i) => (
          <LaneBlock
            key={i}
            scala={scala}
            inizio={i}
            fine={addMin(i, c.durata)}
            tono={c.id === evidenzia ? 'court' : 'idle'}
            className={c.id === evidenzia ? undefined : 'bg-transparent'}
            ariaLabel={`${c.nome}, ${i}–${addMin(i, c.durata)}`}
          >
            <span className="tabular text-xs font-semibold">{i}</span>
          </LaneBlock>
        ))
      }
    />
  );
}

function FormCampo({
  iniziale,
  nuovo,
  campi,
  onFatto,
}: {
  iniziale: Campo;
  nuovo: boolean;
  campi: Campo[];
  onFatto: (e: EsitoMessaggio) => void;
}) {
  const [c, setC] = useState(iniziale);
  const [inviato, setInviato] = useState(false);
  const [chiusura, setChiusura] = useState('');
  const confermate = useRichiesteConfermate(today());
  const set = <K extends keyof Campo>(k: K, v: Campo[K]) => setC((x) => ({ ...x, [k]: v }));
  const errori = validaCampo(c);
  const mostra = (k: keyof typeof errori) => (inviato ? errori[k] : undefined);
  const inizi = iniziGriglia(c.primoSlot, c.ultimoSlot, c.durata);
  const id = nuovo ? nuovoIdCampo(c.nome, campi.map((x) => x.id)) : c.id;
  const anteprima = useMemo(
    () => [...campi.filter((x) => x.id !== c.id), { ...c, id: id || 'nuovo' }].sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)),
    [campi, c, id],
  );
  const orfane = nuovo ? [] : confermateFuoriGriglia(c, confermate.data ?? []);
  const salva = useAzione(azioni.salvaCampo, {
    onSuccess: () =>
      onFatto({
        tono: orfane.length ? 'warn' : 'ok',
        testo: `${c.nome.trim()} salvato.${orfane.length ? ` ${orfane.length === 1 ? '1 partita confermata non è più' : `${orfane.length} partite confermate non sono più`} su uno slot di griglia: ${orfane.length === 1 ? 'resta valida' : 'restano valide'}.` : ''}`,
      }),
  });

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setInviato(true);
        if (Object.keys(errori).length) return;
        salva.mutate({ ...c, id, nome: c.nome.trim() });
      }}
    >
      <Field label="Nome" error={mostra('nome')}>
        {(p) => <Input {...p} value={c.nome} onChange={(e) => set('nome', e.target.value)} maxLength={40} required />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primo inizio">
          {(p) => (
            <Select {...p} value={c.primoSlot} onChange={(e) => set('primoSlot', e.target.value)}>
              {ORARI.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ultimo inizio" error={mostra('ultimoSlot')}>
          {(p) => (
            <Select {...p} value={c.ultimoSlot} onChange={(e) => set('ultimoSlot', e.target.value)}>
              {ORARI.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Durata (minuti)" error={mostra('durata')}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={15}
              max={600}
              step={15}
              value={Number.isFinite(c.durata) ? c.durata : ''}
              onChange={(e) => set('durata', e.target.valueAsNumber)}
            />
          )}
        </Field>
        <Field label="Ordine" hint="1 = primo a sinistra.">
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={0}
              value={c.ordine ?? 0}
              onChange={(e) => set('ordine', Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0)}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-1.5 rounded-panel bg-surface-2 p-3" aria-live="polite">
        <p className="text-sm font-semibold">Inizi generati</p>
        <p className="tabular">{inizi.length ? inizi.join(' · ') : 'Nessun inizio: controlla gli orari.'}</p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Giorni attivi</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
          {SETTIMANA.map((g) => {
            const idg = `giorno-${g}`;
            return (
              <div key={g} className="flex min-h-11 items-center gap-2">
                <Checkbox
                  id={idg}
                  checked={c.giorniAttivi.includes(g)}
                  onCheckedChange={(v) =>
                    set('giorniAttivi', v ? [...c.giorniAttivi, g].sort((a, b) => a - b) : c.giorniAttivi.filter((x) => x !== g))
                  }
                />
                <Label htmlFor={idg} className="text-base font-normal capitalize">
                  {GIORNI_LUNGHI[g]}
                </Label>
              </div>
            );
          })}
        </div>
        {mostra('giorniAttivi') && <p className="text-sm font-semibold text-danger-ink">{mostra('giorniAttivi')}</p>}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Giorni di chiusura</legend>
        {c.eccezioni.length ? (
          <ul className="court-rule">
            {c.eccezioni.map((d) => (
              <li key={d} className="flex items-center justify-between gap-2 py-1">
                <span className="tabular">{dataBreve(d)}/{d.slice(0, 4)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Rimuovi la chiusura del ${dataBreve(d)}`}
                  onClick={() => set('eccezioni', c.eccezioni.filter((x) => x !== d))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Nessuna chiusura straordinaria.</p>
        )}
        <div className="flex items-end gap-2">
          <Field label="Aggiungi una data" className="flex-1">
            {(p) => <Input {...p} type="date" value={chiusura} min={today()} onChange={(e) => setChiusura(e.target.value)} />}
          </Field>
          <Button
            variant="secondary"
            disabled={!chiusura}
            onClick={() => {
              set('eccezioni', aggiungiData(c.eccezioni, chiusura));
              setChiusura('');
            }}
          >
            <Plus aria-hidden /> Aggiungi
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-2">
        <p className="text-sm font-semibold">Anteprima con gli altri campi</p>
        <AnteprimaLanes campi={anteprima} evidenzia={id || 'nuovo'} />
      </div>

      {orfane.length > 0 && (
        <p className={cn('flex items-start gap-2 rounded-panel p-3', TONO_CLASSI.info)}>
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          {orfane.length === 1
            ? '1 partita confermata non è più su uno slot di griglia: resta valida.'
            : `${orfane.length} partite confermate non sono più su uno slot di griglia: restano valide.`}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={salva.isPending}>
          Salva
        </Button>
      </div>
    </form>
  );
}
