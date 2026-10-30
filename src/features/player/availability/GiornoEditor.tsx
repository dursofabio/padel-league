import { Copy, Eraser, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { etichettaFascia, orariSelezionabili, PRESET_FASCE, validaFascia } from '../../../lib/fasce';
import { GIORNI_LUNGHI, weekday } from '../../../lib/time';
import { Button, Field, Select } from '../../../ui';

const TUTTI_I: string[] = [
  'tutte le domeniche',
  'tutti i lunedì',
  'tutti i martedì',
  'tutti i mercoledì',
  'tutti i giovedì',
  'tutti i venerdì',
  'tutti i sabati',
];

/** "Copia su tutti i sabati" */
export function etichettaCopia(data: string): string {
  return `Copia su ${TUTTI_I[weekday(data)]}`;
}

/** Plurale del giorno della settimana: "sabati", "domeniche", "lunedì". */
export function pluraleGiorno(data: string, n: number): string {
  const wd = weekday(data);
  if (n === 1) return GIORNI_LUNGHI[wd];
  return TUTTI_I[wd].replace(/^tutt[ie] (i|le) /, '');
}

/** "14:00" -> "14", "18:30" -> "18:30" (etichette brevi dei preset). */
function breve(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
}

/** Chip delle fasce di un giorno, ognuna con il suo pulsante di rimozione (44px). */
export function ChipFasce({ fasce, onRimuovi }: { fasce: string[]; onRimuovi: (f: string) => void }) {
  if (!fasce.length) return <p className="text-ink-muted">Nessun orario</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {fasce.map((f) => (
        <li key={f} className="inline-flex min-h-11 items-center rounded-full bg-court pl-4 text-court-ink">
          <span className="tabular font-semibold">{etichettaFascia(f)}</span>
          <button
            type="button"
            onClick={() => onRimuovi(f)}
            aria-label={`${etichettaFascia(f)}, rimuovi`}
            className="grid size-11 place-items-center rounded-full hover:bg-court-deep"
          >
            <X className="size-5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Pulsanti dei preset: un tocco aggiunge l'orario. Il testo può andare a capo (testo grande). */
export function PresetFasce({ onScegli, attivo }: { onScegli: (da: string, a: string) => void; attivo?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_FASCE.map((p) => (
        <Button
          key={p.nome}
          variant="secondary"
          aria-pressed={attivo === undefined ? undefined : attivo === p.nome}
          className="h-auto py-2 text-left whitespace-normal aria-pressed:bg-court aria-pressed:text-court-ink"
          onClick={() => onScegli(p.da, p.a)}
        >
          {p.nome} <span className="tabular">{`${breve(p.da)}–${breve(p.a)}`}</span>
        </Button>
      ))}
    </div>
  );
}

/**
 * Riga "Aggiungi orario": due select dalle/alle al passo del torneo e i preset.
 * All'apertura il fuoco va sulla prima select; Esc chiude.
 * `onAggiungi` restituisce la fascia a cui la nuova si è unita (o null), per dirlo all'utente.
 */
export function AggiungiOrario({
  passo,
  onAggiungi,
  onChiudi,
  incorniciato = true,
  autoFocus = true,
}: {
  passo: number;
  incorniciato?: boolean;
  autoFocus?: boolean;
  onAggiungi: (da: string, a: string) => string | null;
  onChiudi?: () => void;
}) {
  const orari = orariSelezionabili(passo);
  const [da, setDa] = useState('18:00');
  const [a, setA] = useState('21:00');
  const [esito, setEsito] = useState('');
  const errore = validaFascia(da, a);
  const ref = useRef<HTMLDivElement>(null);

  // il pulsante che ha aperto la riga sparisce: il fuoco entra nel primo controllo della riga
  useEffect(() => {
    if (autoFocus) ref.current?.querySelector<HTMLElement>('button, select')?.focus();
  }, [autoFocus]);

  const aggiungi = (x: string, y: string) => {
    const unita = onAggiungi(x, y);
    setEsito(unita ? `Unito a ${etichettaFascia(unita)}` : `Aggiunto ${x}–${y}`);
  };

  return (
    <div
      ref={ref}
      className={incorniciato ? 'grid gap-3 rounded-panel bg-surface-2 p-3' : 'grid gap-3'}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onChiudi) {
          e.stopPropagation();
          onChiudi();
        }
      }}
    >
      <div className="grid gap-2">
        <p className="text-sm font-semibold">Tocca un orario tipico</p>
        <PresetFasce onScegli={aggiungi} />
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <Field label="oppure dalle" className="w-32">
          {(p) => (
            <Select {...p} value={da} onChange={(e) => setDa(e.target.value)}>
              {orari.slice(0, -1).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="alle" error={errore} className="w-32">
          {(p) => (
            <Select {...p} value={a} onChange={(e) => setA(e.target.value)}>
              {orari.slice(1).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-wrap gap-2 pt-[1.6rem]">
          <Button variant="court" disabled={!!errore} onClick={() => aggiungi(da, a)}>
            <Plus aria-hidden /> Aggiungi
          </Button>
          {onChiudi && (
            <Button variant="ghost" onClick={onChiudi}>
              Chiudi
            </Button>
          )}
        </div>
      </div>
      <p aria-live="polite" className="text-sm text-ink-muted empty:hidden">
        {esito}
      </p>
    </div>
  );
}

/** Azioni sul giorno: copia sullo stesso giorno della settimana e svuota (solo se il giorno ha fasce). */
export function AzioniGiorno({
  data,
  haFasce,
  puoCopiare,
  onCopia,
  onSvuota,
}: {
  data: string;
  haFasce: boolean;
  puoCopiare: boolean;
  onCopia: () => void;
  onSvuota: () => void;
}) {
  if (!haFasce) return null;
  return (
    <>
      {puoCopiare && (
        <Button variant="ghost" onClick={onCopia}>
          <Copy aria-hidden /> {etichettaCopia(data)}
        </Button>
      )}
      <Button variant="ghost" onClick={onSvuota}>
        <Eraser aria-hidden /> Svuota
      </Button>
    </>
  );
}
