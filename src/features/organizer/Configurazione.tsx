import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Monitor, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Sezione } from '../../components/PageHeader';
import { azioni, useAzione } from '../../data/mutations';
import type { Spareggio } from '../../types';
import { Button, Field, Input, Label, Segmented, Select, Switch } from '../../ui';
import { configDaForm, formDaTorneo, schemaConfig, spostaSpareggio, type FormConfig } from './configSchema';
import { contaRisultati, NOMI_SPAREGGIO, ordinale, TUTTI_SPAREGGI } from './logic';
import { Nota } from './parti';
import type { PropsSezione } from './tipi';

const numero = { valueAsNumber: true } as const;

export default function Configurazione({ d }: PropsSezione) {
  const { torneo } = d;
  const risultati = contaRisultati(d.partite);
  const form = useForm<FormConfig>({
    resolver: zodResolver(schemaConfig),
    defaultValues: formDaTorneo(torneo.nome, torneo.config),
    mode: 'onBlur',
  });
  const { register, control, handleSubmit, reset, formState } = form;
  const { errors, isDirty } = formState;
  const fasi = useFieldArray({ control, name: 'fasiFinali' });

  // keep in sync with the server while the organizer is not editing
  useEffect(() => {
    if (!form.formState.isDirty) reset(formDaTorneo(torneo.nome, torneo.config));
  }, [torneo, reset, form.formState.isDirty]);

  const salva = useAzione(azioni.aggiornaTorneo, { successo: 'Configurazione salvata' });
  const onSubmit = handleSubmit((v) => {
    const { nome, config } = configDaForm(v, torneo.config);
    salva.mutate({ id: torneo.id, nome, config }, { onSuccess: () => reset(v) });
  });

  const fuoriGriglia = useWatch({ control, name: 'consentiFuoriGriglia' });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-3xl gap-8">
      <Nota tono="info" icon={Monitor} className="lg:hidden">
        Meglio da computer: qui ci sono molte impostazioni.
      </Nota>
      {risultati > 0 && (
        <Nota tono="warn">
          Ci sono già {risultati} risultati: cambiare il formato dei set può renderne alcuni non validi; correggili da{' '}
          <Link to={`/t/${torneo.id}/organizza/monitoraggio`} className="font-semibold underline">
            Monitoraggio
          </Link>
          .
        </Nota>
      )}

      <Sezione titolo="Torneo" id="cfg-torneo">
        <Field label="Nome del torneo" error={errors.nome?.message}>
          {(p) => <Input {...p} {...register('nome')} autoComplete="off" />}
        </Field>
      </Sezione>

      <Sezione titolo="Punteggio" id="cfg-punteggio">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Punti per la vittoria" error={errors.puntiVittoria?.message}>
            {(p) => <Input {...p} {...register('puntiVittoria', numero)} type="number" inputMode="numeric" min={0} max={10} />}
          </Field>
          <Field label="Punti per la sconfitta" error={errors.puntiSconfitta?.message}>
            {(p) => <Input {...p} {...register('puntiSconfitta', numero)} type="number" inputMode="numeric" min={0} max={10} />}
          </Field>
          <Field
            label="Bonus sconfitta al set decisivo"
            hint="Punti in più a chi perde arrivando al set decisivo."
            error={errors.puntiSconfittaSetDecisivo?.message}
          >
            {(p) => <Input {...p} {...register('puntiSconfittaSetDecisivo', numero)} type="number" inputMode="numeric" min={0} max={10} />}
          </Field>
        </div>
        {risultati > 0 && <p className="text-sm text-ink-muted">Le classifiche si ricalcolano subito con le nuove regole.</p>}
      </Sezione>

      <Sezione titolo="Formato set" id="cfg-formato">
        <Field label="Set per vincere la partita" error={errors.formatoSet?.setPerVincere?.message}>
          {(p) => (
            <Select {...p} {...register('formatoSet.setPerVincere', { setValueAs: Number })} className="sm:max-w-xs">
              <option value={1}>1 (set unico)</option>
              <option value={2}>2 (al meglio dei 3 set)</option>
              <option value={3}>3 (al meglio dei 5 set)</option>
            </Select>
          )}
        </Field>
        <Controller
          control={control}
          name="formatoSet.superTieBreak"
          render={({ field }) => (
            <RigaSwitch
              label="Set decisivo a super tie-break"
              hint="Il set decisivo si gioca come tie-break a 10 punti."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Sezione>

      <Sezione titolo="Spareggi" id="cfg-spareggi">
        <p className="max-w-prose text-ink-muted">
          Se due coppie hanno gli stessi punti, si guarda il criterio successivo, nell’ordine. «Punti» resta sempre il primo.
        </p>
        <Controller
          control={control}
          name="spareggi"
          render={({ field }) => <ListaSpareggi value={field.value} onChange={field.onChange} />}
        />
        {(errors.spareggi?.message ?? errors.spareggi?.root?.message) && (
          <p className="text-sm font-semibold text-danger-ink">{errors.spareggi?.message ?? errors.spareggi?.root?.message}</p>
        )}
      </Sezione>

      <Sezione titolo="Fasi finali" id="cfg-finali">
        <Field
          label="Come si qualificano le coppie"
          hint="Per posizione: le prime di ogni girone, poi le seconde… Avulsa: a parità di posizione conta la media punti."
        >
          {(p) => (
            <Select {...p} {...register('criterioQualificazione')} className="sm:max-w-sm">
              <option value="perPosizione">Per posizione nel girone</option>
              <option value="avulsa">Classifica avulsa</option>
            </Select>
          )}
        </Field>
        <ul className="court-rule">
          {fasi.fields.map((f, i) => (
            <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-3 py-3">
              <Field label="Nome della fase" error={errors.fasiFinali?.[i]?.nome?.message}>
                {(p) => <Input {...p} {...register(`fasiFinali.${i}.nome`)} autoComplete="off" />}
              </Field>
              <Field label="Posti" error={errors.fasiFinali?.[i]?.posti?.message}>
                {(p) => <Input {...p} {...register(`fasiFinali.${i}.posti`, numero)} type="number" inputMode="numeric" min={2} max={32} />}
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label={`Rimuovi la fase ${f.nome || i + 1}`} onClick={() => fasi.remove(i)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        {(errors.fasiFinali?.message ?? errors.fasiFinali?.root?.message) && (
          <p className="text-sm font-semibold text-danger-ink">{errors.fasiFinali?.message ?? errors.fasiFinali?.root?.message}</p>
        )}
        {fasi.fields.length < 3 && (
          <Button
            type="button"
            variant="secondary"
            className="justify-self-start"
            onClick={() => fasi.append({ nome: fasi.fields.length === 0 ? 'Gold' : fasi.fields.length === 1 ? 'Silver' : 'Bronze', posti: 8 })}
          >
            <Plus aria-hidden /> Aggiungi fase
          </Button>
        )}
        {(torneo.fasiGenerate ?? []).length > 0 && (
          <Nota tono="info">Le fasi già generate ({(torneo.fasiGenerate ?? []).join(', ')}) non cambiano: queste impostazioni valgono per quelle ancora da generare.</Nota>
        )}
      </Sezione>

      <Sezione titolo="Prenotazioni" id="cfg-prenotazioni">
        <Controller
          control={control}
          name="consentiFuoriGriglia"
          render={({ field }) => (
            <RigaSwitch
              label="Consenti orari fuori griglia"
              hint="I giocatori possono proporre un orario diverso dagli slot standard; devono accettarlo tutti e quattro."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {fuoriGriglia && (
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold" id="cfg-passo">
              Passo degli orari fuori griglia
            </span>
            <Controller
              control={control}
              name="passoFuoriGriglia"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Scadenza delle richieste (ore)"
            hint="Se non accettano tutti entro questo tempo, la richiesta scade."
            error={errors.scadenzaRichiesteOre?.message}
          >
            {(p) => <Input {...p} {...register('scadenzaRichiesteOre', numero)} type="number" inputMode="numeric" min={1} max={720} />}
          </Field>
          <Field
            label="Annullamento dei giocatori (ore prima)"
            hint="Fino a quante ore prima un giocatore può annullare una partita confermata."
            error={errors.annullamentoGiocatoreOre?.message}
          >
            {(p) => <Input {...p} {...register('annullamentoGiocatoreOre', numero)} type="number" inputMode="numeric" min={0} max={168} />}
          </Field>
        </div>
      </Sezione>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface px-4 py-3 shadow-raised lg:bottom-4">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {isDirty ? 'Hai modifiche non salvate.' : 'Nessuna modifica da salvare.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {isDirty && (
            <Button type="button" variant="ghost" onClick={() => reset(formDaTorneo(torneo.nome, torneo.config))}>
              Annulla modifiche
            </Button>
          )}
          <Button type="submit" variant="primary" loading={salva.isPending} disabled={!isDirty}>
            Salva configurazione
          </Button>
        </div>
      </div>
    </form>
  );
}

function RigaSwitch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
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
function ListaSpareggi({ value, onChange }: { value: Spareggio[]; onChange: (v: Spareggio[]) => void }) {
  const refs = useRef(new Map<string, HTMLButtonElement | null>());
  const [focus, setFocus] = useState<{ crit: Spareggio; dir: 'su' | 'giu' } | null>(null);
  const [annuncio, setAnnuncio] = useState('');
  const [aggiungi, setAggiungi] = useState('');
  const liberi = TUTTI_SPAREGGI.filter((s) => !value.includes(s));

  useEffect(() => {
    if (!focus) return;
    const el = refs.current.get(`${focus.crit}-${focus.dir}`);
    const alt = refs.current.get(`${focus.crit}-${focus.dir === 'su' ? 'giu' : 'su'}`);
    (el && !el.disabled ? el : alt)?.focus();
    setFocus(null);
  }, [focus, value]);

  const sposta = (i: number, dir: -1 | 1) => {
    const nuova = spostaSpareggio(value, i, dir);
    onChange(nuova);
    const crit = value[i];
    setFocus({ crit, dir: dir === -1 ? 'su' : 'giu' });
    setAnnuncio(`${NOMI_SPAREGGIO[crit]} ora è ${ordinale(nuova.indexOf(crit) + 1)}`);
  };

  return (
    <div className="grid gap-3">
      <ol className="court-rule">
        {value.map((s, i) => (
          <li key={s} className="flex min-h-12 items-center gap-2 py-1.5">
            <span className="tabular w-8 text-right font-bold text-ink-muted">{ordinale(i + 1)}</span>
            <span className="flex-1 font-semibold">{NOMI_SPAREGGIO[s]}</span>
            {i > 0 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  ref={(el) => {
                    refs.current.set(`${s}-su`, el);
                  }}
                  disabled={i <= 1}
                  aria-label={`Sposta su: ${NOMI_SPAREGGIO[s].toLowerCase()}`}
                  onClick={() => sposta(i, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  ref={(el) => {
                    refs.current.set(`${s}-giu`, el);
                  }}
                  disabled={i === value.length - 1}
                  aria-label={`Sposta giù: ${NOMI_SPAREGGIO[s].toLowerCase()}`}
                  onClick={() => sposta(i, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Rimuovi: ${NOMI_SPAREGGIO[s].toLowerCase()}`}
                  onClick={() => {
                    onChange(value.filter((x) => x !== s));
                    setAnnuncio(`${NOMI_SPAREGGIO[s]} rimosso`);
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
        {annuncio}
      </p>
      {liberi.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Aggiungi criterio" className="min-w-56">
            {(p) => (
              <Select {...p} value={aggiungi} onChange={(e) => setAggiungi(e.target.value)}>
                <option value="">Scegli un criterio</option>
                {liberi.map((s) => (
                  <option key={s} value={s}>
                    {NOMI_SPAREGGIO[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button
            type="button"
            variant="secondary"
            disabled={!aggiungi}
            onClick={() => {
              const s = aggiungi as Spareggio;
              onChange([...value, s]);
              setAggiungi('');
              setAnnuncio(`${NOMI_SPAREGGIO[s]} aggiunto in fondo`);
            }}
          >
            <Plus aria-hidden /> Aggiungi criterio
          </Button>
        </div>
      )}
      {!value.includes('sorteggio') && (
        <Nota tono="info">Senza «Sorteggio» in fondo, i pari merito che restano non si possono risolvere a mano da Fasi finali.</Nota>
      )}
    </div>
  );
}
