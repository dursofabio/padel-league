import { CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import { orariSelezionabili, PRESET_FASCE, validaFascia } from '../../../lib/fasce';
import { Button, cn, Field, Select } from '../../../ui';
import { PresetFasce } from './GiornoEditor';

/** lun … dom, con il numero di `Date.getDay()`. */
const SETTIMANA: { n: number; breve: string; lungo: string }[] = [
  { n: 1, breve: 'lun', lungo: 'lunedì' },
  { n: 2, breve: 'mar', lungo: 'martedì' },
  { n: 3, breve: 'mer', lungo: 'mercoledì' },
  { n: 4, breve: 'gio', lungo: 'giovedì' },
  { n: 5, breve: 'ven', lungo: 'venerdì' },
  { n: 6, breve: 'sab', lungo: 'sabato' },
  { n: 0, breve: 'dom', lungo: 'domenica' },
];

/**
 * Compilazione veloce: giorni della settimana abituali + un orario (preset o dalle/alle),
 * aggiunto a tutti quei giorni del periodo. Risponde a "quando giochi di solito?".
 */
export function CompilaVeloce({
  passo,
  onApplica,
}: {
  passo: number;
  onApplica: (giorniSettimana: number[], da: string, a: string) => void;
}) {
  const orari = orariSelezionabili(passo);
  const [scelti, setScelti] = useState<number[]>([]);
  const [da, setDa] = useState('18:00');
  const [a, setA] = useState('23:00');
  const [provato, setProvato] = useState(false);
  const errOrario = validaFascia(da, a);
  const errGiorni = provato && !scelti.length ? 'Scegli almeno un giorno della settimana.' : null;
  const presetAttivo = PRESET_FASCE.find((p) => p.da === da && p.a === a)?.nome ?? '';

  const toggle = (n: number) => setScelti((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">Giorni in cui giochi di solito</legend>
        <div className="flex flex-wrap gap-2">
          {SETTIMANA.map((g) => {
            const on = scelti.includes(g.n);
            return (
              <button
                key={g.n}
                type="button"
                aria-pressed={on}
                aria-label={g.lungo}
                onClick={() => toggle(g.n)}
                className={cn(
                  'min-h-11 min-w-14 rounded-control border px-3 text-base font-semibold',
                  on ? 'border-court bg-court text-court-ink' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
                )}
              >
                {g.breve}
              </button>
            );
          })}
        </div>
        {errGiorni && (
          <p role="alert" className="text-sm font-semibold text-danger-ink">
            {errGiorni}
          </p>
        )}
      </fieldset>

      <div className="grid gap-2">
        <p className="text-sm font-semibold">Orario</p>
        <PresetFasce
          attivo={presetAttivo}
          onScegli={(x, y) => {
            setDa(x);
            setA(y);
          }}
        />
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
        <Field label="alle" error={errOrario} className="w-32">
          {(p) => (
            <Select {...p} value={a} onChange={(e) => setA(e.target.value)}>
              {orari.slice(1).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="pt-[1.6rem]">
          <Button
            variant="court"
            disabled={!!errOrario}
            onClick={() => {
              setProvato(true);
              if (!scelti.length) return;
              onApplica(scelti, da, a);
            }}
          >
            <CalendarPlus aria-hidden /> Aggiungi a tutto il periodo
          </Button>
        </div>
      </div>
    </div>
  );
}
