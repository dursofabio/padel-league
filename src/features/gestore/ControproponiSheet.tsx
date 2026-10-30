import { Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SkeletonRighe } from '../../components/states';
import { azioni, useAzione } from '../../data/mutations';
import { useOccupazioni, useRichiesteFinestra } from '../../data/queries';
import { occupazioniId, slotGriglia, slotLiberoPiuVicino } from '../../lib/slots';
import { labelDate, today } from '../../lib/time';
import type { Campo, Periodo, Richiesta } from '../../types';
import { Button, Field, Input, Select, Sheet, Textarea } from '../../ui';
import { giorniControproposta, statoSlotGestore } from './logic';

const ETICHETTA_STATO = { libero: 'libero', occupato: 'occupato', richiesto: 'già richiesto' } as const;

/** Counter-proposal: prefilled with the nearest free grid slot (±3 days within the match period, G3), editable. */
export function ControproponiSheet({
  richiesta,
  campi,
  periodo,
  descrizione,
  onOpenChange,
  disabilitato,
}: {
  richiesta: Richiesta | null;
  campi: Campo[];
  periodo?: Periodo;
  /** "Rossi/Bianchi – Verdi/Neri" */
  descrizione?: string;
  onOpenChange: (open: boolean) => void;
  disabilitato?: string | null;
}) {
  return (
    <Sheet
      open={!!richiesta}
      onOpenChange={onOpenChange}
      title="Proponi altro orario"
      description="I giocatori dovranno accettare. La richiesta originale viene chiusa."
    >
      {richiesta && (
        <Contenuto
          key={richiesta.id}
          r={richiesta}
          campi={campi}
          periodo={periodo}
          descrizione={descrizione}
          onFatto={() => onOpenChange(false)}
          disabilitato={disabilitato}
        />
      )}
    </Sheet>
  );
}

function Contenuto({
  r,
  campi,
  periodo,
  descrizione,
  onFatto,
  disabilitato,
}: {
  r: Richiesta;
  campi: Campo[];
  periodo?: Periodo;
  descrizione?: string;
  onFatto: () => void;
  disabilitato?: string | null;
}) {
  const oggi = today();
  const giorni = useMemo(() => giorniControproposta(r.data, oggi, periodo), [r.data, oggi, periodo]);
  const [campoId, setCampoId] = useState(r.campoId);
  const [data, setData] = useState(r.data);
  const [inizio, setInizio] = useState('');
  const [nota, setNota] = useState('');
  const [prefill, setPrefill] = useState<'attesa' | 'trovato' | 'nessuno'>('attesa');

  const tutte = [...giorni, data, r.data].sort();
  const from = tutte[0];
  const to = tutte[tutte.length - 1];
  const occ = useOccupazioni(from, to);
  const fin = useRichiesteFinestra(from, to);
  const altre = useMemo(() => (fin.data ?? []).filter((x) => x.id !== r.id), [fin.data, r.id]);
  const pronto = !occ.isPending && !fin.isPending;

  // same court first, then the others
  const campiOrdinati = useMemo(
    () => [...campi.filter((c) => c.id === r.campoId), ...campi.filter((c) => c.id !== r.campoId)],
    [campi, r.campoId],
  );

  useEffect(() => {
    if (prefill !== 'attesa' || !pronto) return;
    const s = slotLiberoPiuVicino(
      { campoId: r.campoId, data: r.data, inizio: r.inizio, fine: r.fine },
      campiOrdinati,
      giorni,
      occ.perGiorno,
      altre,
    );
    if (s) {
      setCampoId(s.campoId);
      setData(s.data);
      setInizio(s.inizio);
      setPrefill('trovato');
    } else setPrefill('nessuno');
  }, [prefill, pronto, r, campiOrdinati, giorni, occ.perGiorno, altre]);

  const campo = campi.find((c) => c.id === campoId);
  const slot = useMemo(() => {
    if (!campo || !data) return [];
    return slotGriglia(campo, data).map((s) => ({
      ...s,
      stato: statoSlotGestore(s, occ.perGiorno[occupazioniId(campo.id, data)], altre),
    }));
  }, [campo, data, occ.perGiorno, altre]);
  const scelto = slot.find((s) => s.inizio === inizio);
  const errore =
    !data || !campo
      ? null
      : slot.length === 0
        ? `${campo.nome} è chiuso in questa data: scegli un altro giorno o campo.`
        : scelto?.stato === 'occupato'
          ? 'Questo orario è occupato: scegline un altro.'
          : null;

  const invia = useAzione(azioni.controproponi, {
    successo: 'Proposta inviata: i giocatori dovranno accettare.',
    onSuccess: onFatto,
  });
  const minData = periodo && periodo.inizio > oggi ? periodo.inizio : oggi;

  if (prefill === 'attesa') return <SkeletonRighe righe={3} />;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!scelto || errore || disabilitato || !pronto) return;
        invia.mutate({ richiesta: r.id, campo: campoId, data, inizio, nota: nota.trim() || undefined });
      }}
    >
      <p className="text-ink-muted">
        Richiesta originale: <span className="tabular font-semibold text-ink">{labelDate(r.data)} · {r.inizio}</span> ·{' '}
        {campi.find((c) => c.id === r.campoId)?.nome}
        {descrizione && <span className="block">{descrizione}</span>}
      </p>
      <p className="flex items-start gap-2 rounded-panel bg-info-soft p-3 text-info-ink">
        <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
        {prefill === 'trovato'
          ? 'Ti propongo l’orario libero più vicino. Puoi cambiarlo.'
          : 'Nessun orario libero vicino: scegline uno tu.'}
      </p>
      <Field label="Campo">
        {(p) => (
          <Select {...p} value={campoId} onChange={(e) => (setCampoId(e.target.value), setInizio(''))}>
            {campi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Giorno" hint={periodo ? `Periodo della partita: fino al ${labelDate(periodo.fine)}.` : undefined}>
        {(p) => (
          <Input
            {...p}
            type="date"
            value={data}
            min={minData}
            max={periodo?.fine}
            required
            onChange={(e) => (setData(e.target.value), setInizio(''))}
          />
        )}
      </Field>
      <Field label="Orario" error={errore} hint={pronto ? undefined : 'Controllo gli orari liberi…'}>
        {(p) => (
          <Select {...p} value={inizio} onChange={(e) => setInizio(e.target.value)} required disabled={!slot.length || !pronto}>
            <option value="">Scegli l’orario</option>
            {slot.map((s) => (
              <option key={s.inizio} value={s.inizio} disabled={s.stato === 'occupato'}>
                {s.inizio}–{s.fine} · {ETICHETTA_STATO[s.stato]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Nota per i giocatori" hint="Facoltativa.">
        {(p) => <Textarea {...p} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />}
      </Field>
      {scelto && !errore && (
        <p className="font-semibold">
          Proponi: <span className="tabular">{labelDate(data)} · {scelto.inizio}–{scelto.fine}</span> · {campo?.nome}
          {scelto.stato === 'richiesto' && (
            <span className="block font-normal text-warn-ink">C’è già un’altra richiesta in attesa su questo orario.</span>
          )}
        </p>
      )}
      {disabilitato && <p className="text-sm font-semibold text-ink-muted">{disabilitato}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" variant="primary" loading={invia.isPending} disabled={!scelto || !!errore || !!disabilitato || !pronto}>
          Invia proposta
        </Button>
      </div>
    </form>
  );
}
