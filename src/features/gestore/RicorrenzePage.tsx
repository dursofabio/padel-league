import { CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../components/states';
import { TONO_CLASSI } from '../../components/StatusBadge';
import { azioni, useAzione } from '../../data/mutations';
import { useCampi, useRicorrenze } from '../../data/queries';
import { addDays, GIORNI_LUNGHI, today } from '../../lib/time';
import type { Campo, Ricorrenza, TipoOccupazione } from '../../types';
import { Button, cn, ConfirmDialog, Field, Input, Segmented, Select, Sheet, Textarea } from '../../ui';
import { Esito } from './Esito';
import { GestoreNav } from './GestoreNav';
import { ASPETTO_TIPO } from './GiornoLanes';
import { MOTIVO_OFFLINE, useOnline } from './hooks';
import { dataBreve, erroreIntervallo, ETICHETTA_TIPO, messaggioMaterializza, orari, quandoRicorrenza, type EsitoMessaggio } from './logic';

type TipoManuale = Exclude<TipoOccupazione, 'campionato'>;
type Bozza = Omit<Ricorrenza, 'id' | 'tipo'> & { id?: string; tipo: TipoManuale };

const TIPI: { value: TipoManuale; label: string }[] = [
  { value: 'lezione', label: 'Lezione' },
  { value: 'esterno', label: 'Esterno' },
  { value: 'chiusura', label: 'Chiusura' },
];
const ORARI_INIZIO = orari('08:00', '23:45', 15);
const ORARI_FINE = orari('08:15', '24:00', 15);
/** Monday first, as people read a week. */
const SETTIMANA = [1, 2, 3, 4, 5, 6, 0];

/** Recurrences (/campo/ricorrenze): fixed lessons and bookings, applied to the next 60 days (G6). */
export default function RicorrenzePage() {
  const ricorrenze = useRicorrenze();
  const campi = useCampi();
  const online = useOnline();
  const offline = online ? null : MOTIVO_OFFLINE;
  const [esito, setEsito] = useState<EsitoMessaggio | null>(null);
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [daEliminare, setDaEliminare] = useState<Ricorrenza | null>(null);

  const applica = useAzione(azioni.materializzaRicorrenza, { onSuccess: (res) => setEsito(messaggioMaterializza(res)) });
  const elimina = useAzione(azioni.eliminaRicorrenza, {
    successo: 'Ricorrenza eliminata. Le occupazioni già segnate restano.',
    onSuccess: () => setDaEliminare(null),
  });

  const lista = campi.data ?? [];
  const nomeCampo = (id: string) => lista.find((c) => c.id === id)?.nome ?? id;
  const nuova = (): Bozza => {
    const oggi = today();
    return {
      campoId: lista[0]?.id ?? '',
      giornoSettimana: 2,
      inizio: '18:00',
      fine: '19:30',
      tipo: 'lezione',
      nota: '',
      dal: oggi,
      al: addDays(oggi, 120),
    };
  };

  return (
    <>
      <PageHeader
        titolo="Ricorrenze"
        sottotitolo="Lezioni e prenotazioni fisse: le segni una volta e la giornata si riempie da sola."
        azioni={
          <Button variant="primary" onClick={() => setBozza(nuova())} disabled={!lista.length || !!offline}>
            <Plus aria-hidden /> Nuova ricorrenza
          </Button>
        }
      />
      <GestoreNav />
      <Esito esito={esito} onChiudi={() => setEsito(null)} />
      {offline && <p className={cn('mb-4 rounded-panel p-3 font-semibold', TONO_CLASSI.warn)}>{offline}</p>}

      {ricorrenze.isPending || campi.isPending ? (
        <SkeletonRighe righe={3} />
      ) : ricorrenze.error || campi.error ? (
        <ErrorState errore={ricorrenze.error ?? campi.error} onRiprova={() => (ricorrenze.refetch(), campi.refetch())} />
      ) : !ricorrenze.data?.length ? (
        <EmptyState
          titolo="Nessuna ricorrenza."
          testo="Usale per lezioni e prenotazioni fisse: per esempio la scuola padel ogni martedì alle 18:00."
        />
      ) : (
        <ul className="court-rule">
          {ricorrenze.data.map((r) => {
            const a = ASPETTO_TIPO[r.tipo];
            const inApplicazione = applica.isPending && applica.variables?.ricorrenza === r.id;
            return (
              <li key={r.id} className="grid gap-2 py-4">
                <p className="tabular text-base font-bold">{quandoRicorrenza(r)}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{nomeCampo(r.campoId)}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <a.icon className="size-4" aria-hidden /> {ETICHETTA_TIPO[r.tipo]}
                  </span>
                  {r.nota && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{r.nota}</span>
                    </>
                  )}
                </p>
                <p className="tabular text-sm text-ink-muted">
                  dal {dataBreve(r.dal)} al {dataBreve(r.al)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="court"
                    size="sm"
                    loading={inApplicazione}
                    disabled={!!offline}
                    onClick={() => (setEsito(null), applica.mutate({ ricorrenza: r.id, giorni: 60 }))}
                  >
                    <CalendarPlus aria-hidden /> Applica ai prossimi 60 giorni
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!offline}
                    onClick={() => setBozza({ ...r, tipo: r.tipo === 'campionato' ? 'esterno' : r.tipo })}
                  >
                    <Pencil aria-hidden /> Modifica
                  </Button>
                  <Button variant="danger" size="sm" disabled={!!offline} onClick={() => setDaEliminare(r)}>
                    <Trash2 aria-hidden /> Elimina
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={!!bozza}
        onOpenChange={(o) => !o && setBozza(null)}
        title={bozza?.id ? 'Modifica ricorrenza' : 'Nuova ricorrenza'}
        description="Dopo il salvataggio la applico ai prossimi 60 giorni."
      >
        {bozza && (
          <FormRicorrenza
            key={bozza.id ?? 'nuova'}
            iniziale={bozza}
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
        title={daEliminare ? `Eliminare la ricorrenza ${quandoRicorrenza(daEliminare)}?` : 'Eliminare la ricorrenza?'}
        description="Le occupazioni già segnate restano: liberale dalla giornata se serve."
        confirmLabel="Elimina"
        loading={elimina.isPending}
        onConfirm={() => daEliminare && elimina.mutate(daEliminare.id)}
      />
    </>
  );
}

interface Errori {
  campoId?: string;
  fine?: string;
  al?: string;
}

function valida(b: Bozza): Errori {
  const e: Errori = {};
  if (!b.campoId) e.campoId = 'Scegli il campo.';
  const i = erroreIntervallo(b.inizio, b.fine);
  if (i) e.fine = i;
  if (!b.dal || !b.al) e.al = 'Indica da quando e fino a quando vale.';
  else if (b.al < b.dal) e.al = 'La data di fine deve venire dopo quella di inizio.';
  return e;
}

function FormRicorrenza({ iniziale, campi, onFatto }: { iniziale: Bozza; campi: Campo[]; onFatto: (e: EsitoMessaggio) => void }) {
  const [b, setB] = useState(iniziale);
  const [inviato, setInviato] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const salva = useAzione(azioni.salvaRicorrenza);
  const applica = useAzione(azioni.materializzaRicorrenza);
  const errori = valida(b);
  const mostra = (k: keyof Errori) => (inviato ? errori[k] : undefined);
  const set = <K extends keyof Bozza>(k: K, v: Bozza[K]) => setB((x) => ({ ...x, [k]: v }));

  async function invia() {
    setInviato(true);
    if (Object.keys(errori).length) return;
    setLavoro(true);
    try {
      const { id } = await salva.mutateAsync({ ...b, nota: b.nota.trim() });
      try {
        const res = await applica.mutateAsync({ ricorrenza: id, giorni: 60 });
        const m = messaggioMaterializza(res);
        onFatto({ ...m, testo: `Ricorrenza salvata. ${m.testo}` });
      } catch {
        onFatto({ tono: 'warn', testo: 'Ricorrenza salvata, ma non sono riuscito ad applicarla: usa “Applica ai prossimi 60 giorni”.' });
      }
    } catch {
      // error toast already shown by useAzione
    } finally {
      setLavoro(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void invia();
      }}
    >
      <Field label="Campo" error={mostra('campoId')}>
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
      <Field label="Giorno della settimana">
        {(p) => (
          <Select {...p} value={b.giornoSettimana} onChange={(e) => set('giornoSettimana', Number(e.target.value))}>
            {SETTIMANA.map((g) => (
              <option key={g} value={g}>
                {GIORNI_LUNGHI[g]}
              </option>
            ))}
          </Select>
        )}
      </Field>
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
        <Field label="Alle" error={mostra('fine')}>
          {(p) => (
            <Select {...p} value={b.fine} onChange={(e) => set('fine', e.target.value)}>
              {ORARI_FINE.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-semibold" aria-hidden>
          Tipo
        </span>
        <Segmented label="Tipo di occupazione" value={b.tipo} onValueChange={(v) => set('tipo', v)} options={TIPI} />
      </div>
      <Field label="Nota" hint="Facoltativa, per esempio “scuola padel”.">
        {(p) => <Textarea {...p} value={b.nota} onChange={(e) => set('nota', e.target.value)} maxLength={200} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dal">
          {(p) => <Input {...p} type="date" value={b.dal} onChange={(e) => set('dal', e.target.value)} />}
        </Field>
        <Field label="Al" error={mostra('al')}>
          {(p) => <Input {...p} type="date" value={b.al} min={b.dal} onChange={(e) => set('al', e.target.value)} />}
        </Field>
      </div>
      {b.id && (
        <p className="text-sm text-ink-muted">
          Le modifiche non cambiano le occupazioni già segnate: liberale dalla giornata se serve, poi riapplica.
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={lavoro}>
          Salva e applica
        </Button>
      </div>
    </form>
  );
}
