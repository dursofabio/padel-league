import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Sezione } from '../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../components/states';
import { azioni, useAzione } from '../../data/mutations';
import { useCampi, useRicorrenze } from '../../data/queries';
import { contaSlot } from '../../lib/slots';
import { labelDate, today } from '../../lib/time';
import type { Campo, Periodo, Ricorrenza } from '../../types';
import { Button, ConfirmDialog, Field, Input, Select, Sheet } from '../../ui';
import {
  formatRapporto,
  giorniPeriodo,
  nomeFase,
  occupazioniDaRicorrenze,
  partiteNelPeriodo,
  valutaCapienza,
  type Capienza,
} from './logic';
import { Nota } from './parti';
import type { DatiTorneo, PropsSezione } from './tipi';

const schema = z
  .object({
    fase: z.string().min(1, { error: 'Scegli la fase' }),
    turno: z.string(),
    inizio: z.string().min(1, { error: 'Scegli la data di inizio' }),
    fine: z.string().min(1, { error: 'Scegli la data di fine' }),
    etichetta: z.string().trim().max(40, { error: 'Massimo 40 caratteri' }),
  })
  .refine((v) => !v.inizio || !v.fine || v.fine >= v.inizio, { path: ['fine'], error: 'La fine deve venire dopo l’inizio' })
  .refine((v) => !v.turno || /^[1-9]$/.test(v.turno), { path: ['turno'], error: 'Turno da 1 a 9' });
type FormPeriodo = z.infer<typeof schema>;

export default function Periodi({ d }: PropsSezione) {
  const campi = useCampi();
  const ric = useRicorrenze();
  const [aperto, setAperto] = useState<Periodo | 'nuovo' | null>(null);
  const [daEliminare, setDaEliminare] = useState<Periodo | null>(null);
  const elimina = useAzione(azioni.eliminaPeriodo, { successo: 'Periodo eliminato', onSuccess: () => setDaEliminare(null) });

  const periodi = useMemo(() => [...d.periodi].sort((a, b) => a.inizio.localeCompare(b.inizio)), [d.periodi]);
  const caricamento = campi.isPending || ric.isPending;
  const errore = campi.error ?? ric.error;

  return (
    <div className="grid gap-8">
      <Sezione
        titolo="Periodi di gioco"
        id="per-lista"
        azioni={
          <Button variant="secondary" onClick={() => setAperto('nuovo')}>
            <Plus aria-hidden /> Aggiungi periodo
          </Button>
        }
      >
        <p className="max-w-prose text-ink-muted">
          Finestre di date entro cui giocare le partite. Per le fasi finali puoi indicare un periodo per ogni turno, con scadenze più strette.
        </p>
        {!periodi.length ? (
          <EmptyState
            titolo="Nessun periodo"
            testo="Aggiungine uno per dare una scadenza alle partite. Di solito basta un periodo per i gironi e uno per le fasi finali."
          />
        ) : (
          <ul className="court-rule">
            {periodi.map((p) => {
              const usato = d.partite.some((x) => x.periodoId === p.id);
              return (
                <li key={p.id} className="grid gap-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-0.5">
                      <p className="flex items-center gap-2 font-bold">
                        <CalendarRange className="size-5 text-ink-muted" aria-hidden />
                        {p.etichetta}
                      </p>
                      <p className="tabular text-ink-muted">
                        {nomeFase(p.fase)}
                        {p.turno ? ` · turno ${p.turno}` : ''} · {labelDate(p.inizio)} – {labelDate(p.fine)}
                        {p.fine < today() && ' · terminato'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Modifica ${p.etichetta}`} onClick={() => setAperto(p)}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Elimina ${p.etichetta}`}
                        disabled={usato}
                        title={usato ? 'Ci sono partite in questo periodo' : undefined}
                        onClick={() => setDaEliminare(p)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                  {caricamento ? (
                    <SkeletonRighe righe={1} />
                  ) : errore ? (
                    <ErrorState
                      errore={errore}
                      onRiprova={() => {
                        campi.refetch();
                        ric.refetch();
                      }}
                    />
                  ) : (
                    <RigaCapienza periodo={p} d={d} campi={campi.data ?? []} ric={ric.data ?? []} />
                  )}
                  {usato && <p className="text-sm text-ink-muted">Non si può eliminare: ci sono partite assegnate a questo periodo.</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Sezione>

      <SheetPeriodo d={d} periodo={aperto} onClose={() => setAperto(null)} />

      <ConfirmDialog
        open={!!daEliminare}
        onOpenChange={(o) => !o && setDaEliminare(null)}
        title={`Eliminare ${daEliminare?.etichetta ?? 'il periodo'}?`}
        description="Il periodo sparisce dal torneo. Non ci sono partite collegate."
        confirmLabel="Elimina periodo"
        loading={elimina.isPending}
        onConfirm={() => daEliminare && elimina.mutate(daEliminare.id)}
      />
    </div>
  );
}

function RigaCapienza({ periodo, d, campi, ric }: { periodo: Periodo; d: DatiTorneo; campi: Campo[]; ric: Ricorrenza[] }) {
  const c: Capienza = useMemo(() => {
    const giorni = giorniPeriodo(periodo);
    const slot = contaSlot(campi, giorni, occupazioniDaRicorrenze(ric, giorni));
    const n = partiteNelPeriodo(periodo, d.periodi, d.partite, d.squadre, d.torneo.config.fasiFinali);
    return valutaCapienza(slot, n, giorni.length);
  }, [periodo, campi, ric, d.periodi, d.partite, d.squadre, d.torneo.config.fasiFinali]);

  if (!campi.length) return <Nota tono="warn">Nessun campo configurato: il gestore deve aggiungere i campi per calcolare la capienza.</Nota>;
  if (c.rapporto === null)
    return (
      <p className="tabular text-ink-muted">
        {c.slot} slot di gioco nel periodo (al netto delle ricorrenze). Nessuna partita ancora da giocare qui.
      </p>
    );
  const dettaglio = `${c.partite} partite, servono ${c.servonoSettimana} slot a settimana, ce ne sono ${c.slotSettimana} (al netto delle ricorrenze).`;
  return (
    <div className="grid gap-1.5">
      <BarraCapienza c={c} />
      {c.tono === 'ok' && <Nota tono="ok">Capienza buona: {dettaglio}</Nota>}
      {c.tono === 'warn' && (
        <Nota tono="warn">
          Margine stretto ({formatRapporto(c.rapporto)}×): allunga il periodo o libera slot. {dettaglio}
        </Nota>
      )}
      {c.tono === 'danger' && (
        <Nota tono="danger">
          Capienza insufficiente ({formatRapporto(c.rapporto)}×): allunga il periodo o libera slot. {dettaglio}
        </Nota>
      )}
    </div>
  );
}

/** Linear bar: slots per match against the 3× target. The text next to it carries the meaning. */
function BarraCapienza({ c }: { c: Capienza }) {
  const pct = Math.min(100, ((c.rapporto ?? 0) / 3) * 100);
  const colore = c.tono === 'ok' ? 'bg-ok' : c.tono === 'warn' ? 'bg-warn' : 'bg-danger';
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={3}
      aria-valuenow={Number((c.rapporto ?? 0).toFixed(1))}
      aria-valuetext={`${formatRapporto(c.rapporto ?? 0)} slot per partita`}
      aria-label="Capienza"
      className="relative h-2 max-w-md overflow-hidden rounded-full bg-surface-2"
    >
      <div className={`h-full ${colore}`} style={{ width: `${pct}%` }} />
      <span aria-hidden className="absolute top-0 left-1/2 h-full w-px bg-ink-muted" title="1,5×" />
    </div>
  );
}

function SheetPeriodo({ d, periodo, onClose }: { d: DatiTorneo; periodo: Periodo | 'nuovo' | null; onClose: () => void }) {
  const nuovo = periodo === 'nuovo';
  const esistente = periodo && periodo !== 'nuovo' ? periodo : null;
  const fasi = ['gironi', ...d.torneo.config.fasiFinali.map((f) => f.nome.toLowerCase())];
  const valori = (): FormPeriodo => ({
    fase: esistente?.fase ?? 'gironi',
    turno: esistente?.turno ? String(esistente.turno) : '',
    inizio: esistente?.inizio ?? '',
    fine: esistente?.fine ?? '',
    etichetta: esistente?.etichetta ?? '',
  });
  const { register, handleSubmit, reset, control, formState } = useForm<FormPeriodo>({ resolver: zodResolver(schema), values: valori() });
  const fase = useWatch({ control, name: 'fase' });
  const salva = useAzione(azioni.salvaPeriodo, {
    successo: nuovo ? 'Periodo aggiunto' : 'Periodo aggiornato',
    onSuccess: () => {
      onClose();
      reset();
    },
  });
  const formId = 'form-periodo';
  const chiudi = () => {
    reset();
    onClose();
  };

  return (
    <Sheet
      open={!!periodo}
      onOpenChange={(o) => !o && chiudi()}
      title={nuovo ? 'Nuovo periodo' : `Modifica ${esistente?.etichetta ?? 'periodo'}`}
      description="Le partite di questo periodo vanno giocate entro la data di fine."
      footer={
        <>
          <Button variant="ghost" onClick={chiudi}>
            Annulla
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={salva.isPending}>
            {nuovo ? 'Aggiungi periodo' : 'Salva periodo'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="grid gap-4"
        onSubmit={handleSubmit((v) => {
          const etichetta = v.etichetta.trim() || esistente?.etichetta || `Periodo ${d.periodi.length + 1}`;
          salva.mutate({
            torneo: d.torneo.id,
            periodo: {
              id: esistente?.id,
              fase: v.fase,
              turno: v.fase !== 'gironi' && v.turno ? Number(v.turno) : null,
              inizio: v.inizio,
              fine: v.fine,
              etichetta,
            },
          });
        })}
      >
        <Field label="Fase" error={formState.errors.fase?.message}>
          {(p) => (
            <Select {...p} {...register('fase')}>
              {fasi.map((f) => (
                <option key={f} value={f}>
                  {nomeFase(f)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {fase !== 'gironi' && (
          <Field label="Turno (facoltativo)" hint="Vuoto = vale per tutta la fase. 1 = primo turno del tabellone." error={formState.errors.turno?.message}>
            {(p) => <Input {...p} {...register('turno')} type="number" inputMode="numeric" min={1} max={9} />}
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dal" error={formState.errors.inizio?.message}>
            {(p) => <Input {...p} {...register('inizio')} type="date" />}
          </Field>
          <Field label="Al" error={formState.errors.fine?.message}>
            {(p) => <Input {...p} {...register('fine')} type="date" />}
          </Field>
        </div>
        <Field label="Etichetta (facoltativa)" hint="Se la lasci vuota diventa «Periodo N»." error={formState.errors.etichetta?.message}>
          {(p) => <Input {...p} {...register('etichetta')} autoComplete="off" placeholder="Periodo 1" />}
        </Field>
      </form>
    </Sheet>
  );
}
