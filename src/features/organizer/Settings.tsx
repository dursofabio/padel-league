import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Monitor, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { Section } from '../../components/PageHeader';
import { actions, useAction } from '../../data/mutations';
import type { Tiebreaker } from '../../types';
import { Button, Field, Input, Label, Segmented, Select, Switch } from '../../ui';
import { configFromForm, configSchema, formFromTournament, moveTiebreaker, type ConfigForm } from './configSchema';
import { ALL_TIEBREAKERS, countResults, ordinal, TIEBREAKER_LABEL } from './logic';
import { Note } from './parts';
import type { SectionProps } from './types';

const asNumber = { valueAsNumber: true } as const;

export default function Settings({ d }: SectionProps) {
  const { tournament } = d;
  const results = countResults(d.matches);
  const form = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: formFromTournament(tournament.name, tournament.config),
    mode: 'onBlur',
  });
  const { register, control, handleSubmit, reset, formState } = form;
  const { errors, isDirty } = formState;
  const phases = useFieldArray({ control, name: 'finals' });

  // keep in sync with the server while the organizer is not editing
  useEffect(() => {
    if (!form.formState.isDirty) reset(formFromTournament(tournament.name, tournament.config));
  }, [tournament, reset, form.formState.isDirty]);

  const save = useAction(actions.updateTournament, { success: 'Configurazione salvata' });
  const onSubmit = handleSubmit((v) => {
    const { name, config } = configFromForm(v, tournament.config);
    save.mutate({ id: tournament.id, name, config }, { onSuccess: () => reset(v) });
  });

  const offGrid = useWatch({ control, name: 'allowOffGrid' });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-3xl gap-8">
      <Note tone="info" icon={Monitor} className="lg:hidden">
        Meglio da computer: qui ci sono molte impostazioni.
      </Note>
      {results > 0 && (
        <Note tone="warn">
          Ci sono già {results} risultati: cambiare il formato dei set può renderne alcuni non validi; correggili da{' '}
          <Link to={`/t/${tournament.id}/organizza/monitoraggio`} className="font-semibold underline">
            Monitoraggio
          </Link>
          .
        </Note>
      )}

      <Section title="Torneo" id="cfg-tournament">
        <Field label="Nome del torneo" error={errors.name?.message}>
          {(p) => <Input {...p} {...register('name')} autoComplete="off" />}
        </Field>
      </Section>

      <Section title="Punteggio" id="cfg-scoring">
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <Field label="Punti per la vittoria" error={errors.pointsWin?.message}>
            {(p) => <Input {...p} {...register('pointsWin', asNumber)} type="number" inputMode="numeric" min={0} max={10} />}
          </Field>
          <Field label="Punti per la sconfitta" error={errors.pointsLoss?.message}>
            {(p) => <Input {...p} {...register('pointsLoss', asNumber)} type="number" inputMode="numeric" min={0} max={10} />}
          </Field>
          <Field
            label="Bonus al set decisivo"
            hint="Punti in più a chi perde arrivando al set decisivo."
            error={errors.pointsLossDecidingSet?.message}
          >
            {(p) => <Input {...p} {...register('pointsLossDecidingSet', asNumber)} type="number" inputMode="numeric" min={0} max={10} />}
          </Field>
        </div>
        {results > 0 && <p className="text-sm text-ink-muted">Le classifiche si ricalcolano subito con le nuove regole.</p>}
      </Section>

      <Section title="Formato set" id="cfg-set-format">
        <Field label="Set per vincere la partita" error={errors.setFormat?.setsToWin?.message}>
          {(p) => (
            <Select {...p} {...register('setFormat.setsToWin', { setValueAs: Number })} className="sm:max-w-xs">
              <option value={1}>1 (set unico)</option>
              <option value={2}>2 (al meglio dei 3 set)</option>
              <option value={3}>3 (al meglio dei 5 set)</option>
            </Select>
          )}
        </Field>
        <Controller
          control={control}
          name="setFormat.superTieBreak"
          render={({ field }) => (
            <SwitchRow
              label="Set decisivo a super tie-break"
              hint="Il set decisivo si gioca come tie-break a 10 punti."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Section>

      <Section title="Spareggi" id="cfg-tiebreakers">
        <p className="max-w-prose text-ink-muted">
          Se due coppie hanno gli stessi punti, si guarda il criterio successivo, nell’ordine. «Punti» resta sempre il primo.
        </p>
        <Controller
          control={control}
          name="tiebreakers"
          render={({ field }) => <TiebreakerList value={field.value} onChange={field.onChange} />}
        />
        {(errors.tiebreakers?.message ?? errors.tiebreakers?.root?.message) && (
          <p className="text-sm font-semibold text-danger-ink">{errors.tiebreakers?.message ?? errors.tiebreakers?.root?.message}</p>
        )}
      </Section>

      <Section title="Fasi finali" id="cfg-finals">
        <Field
          label="Come si qualificano le coppie"
          hint="Per posizione: le prime di ogni girone, poi le seconde… Avulsa: a parità di posizione conta la media punti."
        >
          {(p) => (
            <Select {...p} {...register('qualificationRule')} className="sm:max-w-sm">
              <option value="byPosition">Per posizione nel girone</option>
              <option value="crossGroup">Classifica avulsa</option>
            </Select>
          )}
        </Field>
        <ul className="court-rule">
          {phases.fields.map((f, i) => (
            <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-3 py-3">
              <Field label="Nome della fase" error={errors.finals?.[i]?.name?.message}>
                {(p) => <Input {...p} {...register(`finals.${i}.name`)} autoComplete="off" />}
              </Field>
              <Field label="Posti" error={errors.finals?.[i]?.spots?.message}>
                {(p) => <Input {...p} {...register(`finals.${i}.spots`, asNumber)} type="number" inputMode="numeric" min={2} max={32} />}
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label={`Rimuovi la fase ${f.name || i + 1}`} onClick={() => phases.remove(i)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        {(errors.finals?.message ?? errors.finals?.root?.message) && (
          <p className="text-sm font-semibold text-danger-ink">{errors.finals?.message ?? errors.finals?.root?.message}</p>
        )}
        {phases.fields.length < 3 && (
          <Button
            type="button"
            variant="secondary"
            className="justify-self-start"
            onClick={() => phases.append({ name: phases.fields.length === 0 ? 'Gold' : phases.fields.length === 1 ? 'Silver' : 'Bronze', spots: 8 })}
          >
            <Plus aria-hidden /> Aggiungi fase
          </Button>
        )}
        {(tournament.generatedPhases ?? []).length > 0 && (
          <Note tone="info">Le fasi già generate ({(tournament.generatedPhases ?? []).join(', ')}) non cambiano: queste impostazioni valgono per quelle ancora da generare.</Note>
        )}
      </Section>

      <Section title="Prenotazioni" id="cfg-bookings">
        <Controller
          control={control}
          name="allowOffGrid"
          render={({ field }) => (
            <SwitchRow
              label="Consenti orari fuori griglia"
              hint="I giocatori possono proporre un orario diverso dagli slot standard; devono accettarlo tutti e quattro."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {offGrid && (
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold" id="cfg-step">
              Passo degli orari fuori griglia
            </span>
            <Controller
              control={control}
              name="offGridStep"
              render={({ field }) => (
                <Segmented
                  label="Passo degli orari fuori griglia"
                  value={String(field.value) as '15' | '30'}
                  onValueChange={(v) => field.onChange(Number(v) as 15 | 30)}
                  options={[
                    { value: '15', label: '15 minuti' },
                    { value: '30', label: '30 minuti' },
                  ]}
                  className="justify-self-start"
                />
              )}
            />
          </div>
        )}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field
            label="Scadenza delle richieste (ore)"
            hint="Se non accettano tutti entro questo tempo, la richiesta scade."
            error={errors.requestExpiryHours?.message}
          >
            {(p) => <Input {...p} {...register('requestExpiryHours', asNumber)} type="number" inputMode="numeric" min={1} max={720} />}
          </Field>
          <Field
            label="Annullamento dei giocatori (ore prima)"
            hint="Fino a quante ore prima un giocatore può annullare una partita confermata."
            error={errors.playerCancelHours?.message}
          >
            {(p) => <Input {...p} {...register('playerCancelHours', asNumber)} type="number" inputMode="numeric" min={0} max={168} />}
          </Field>
        </div>
      </Section>

      {isDirty && (
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface px-4 py-3 shadow-raised lg:bottom-4">
        <p className="text-sm font-semibold">Hai modifiche non salvate.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => reset(formFromTournament(tournament.name, tournament.config))}>
            Annulla modifiche
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            Salva configurazione
          </Button>
        </div>
      </div>
      )}
    </form>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-1">
        <Label htmlFor={id} className="text-base">
          {label}
        </Label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-ink-muted">
            {hint}
          </p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={hint ? `${id}-hint` : undefined} className="mt-1" />
    </div>
  );
}

/** Ordered tie-break chain: move up/down, remove, add; focus follows the moved item, the new position is announced. */
function TiebreakerList({ value, onChange }: { value: Tiebreaker[]; onChange: (v: Tiebreaker[]) => void }) {
  const refs = useRef(new Map<string, HTMLButtonElement | null>());
  const [focus, setFocus] = useState<{ crit: Tiebreaker; dir: 'up' | 'down' } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [toAdd, setToAdd] = useState('');
  const available = ALL_TIEBREAKERS.filter((s) => !value.includes(s));

  useEffect(() => {
    if (!focus) return;
    const el = refs.current.get(`${focus.crit}-${focus.dir}`);
    const alt = refs.current.get(`${focus.crit}-${focus.dir === 'up' ? 'down' : 'up'}`);
    (el && !el.disabled ? el : alt)?.focus();
    setFocus(null);
  }, [focus, value]);

  const move = (i: number, dir: -1 | 1) => {
    const next = moveTiebreaker(value, i, dir);
    onChange(next);
    const crit = value[i];
    setFocus({ crit, dir: dir === -1 ? 'up' : 'down' });
    setAnnouncement(`${TIEBREAKER_LABEL[crit]} ora è ${ordinal(next.indexOf(crit) + 1)}`);
  };

  return (
    <div className="grid gap-3">
      <ol className="court-rule">
        {value.map((s, i) => (
          <li key={s} className="flex min-h-12 items-center gap-2 py-1.5">
            <span className="tabular w-8 text-right font-bold text-ink-muted">{ordinal(i + 1)}</span>
            <span className="flex-1 font-semibold">{TIEBREAKER_LABEL[s]}</span>
            {i > 0 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  ref={(el) => {
                    refs.current.set(`${s}-up`, el);
                  }}
                  disabled={i <= 1}
                  aria-label={`Sposta su: ${TIEBREAKER_LABEL[s].toLowerCase()}`}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  ref={(el) => {
                    refs.current.set(`${s}-down`, el);
                  }}
                  disabled={i === value.length - 1}
                  aria-label={`Sposta giù: ${TIEBREAKER_LABEL[s].toLowerCase()}`}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Rimuovi: ${TIEBREAKER_LABEL[s].toLowerCase()}`}
                  onClick={() => {
                    onChange(value.filter((x) => x !== s));
                    setAnnouncement(`${TIEBREAKER_LABEL[s]} rimosso`);
                  }}
                >
                  <X aria-hidden />
                </Button>
              </>
            )}
            {i === 0 && <span className="text-sm text-ink-muted">sempre per primo</span>}
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {available.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Aggiungi criterio" className="min-w-56">
            {(p) => (
              <Select {...p} value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
                <option value="">Scegli un criterio</option>
                {available.map((s) => (
                  <option key={s} value={s}>
                    {TIEBREAKER_LABEL[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button
            type="button"
            variant="secondary"
            disabled={!toAdd}
            onClick={() => {
              const s = toAdd as Tiebreaker;
              onChange([...value, s]);
              setToAdd('');
              setAnnouncement(`${TIEBREAKER_LABEL[s]} aggiunto in fondo`);
            }}
          >
            <Plus aria-hidden /> Aggiungi criterio
          </Button>
        </div>
      )}
      {!value.includes('draw') && (
        <Note tone="info">Senza «Sorteggio» in fondo, i pari merito che restano non si possono risolvere a mano da Fasi finali.</Note>
      )}
    </div>
  );
}
