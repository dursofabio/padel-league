import { Check, Lock, Pencil, Shuffle, Trash2, UserMinus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sezione } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { azioni, useAzione } from '../../data/mutations';
import { useNomi } from '../../data/queries';
import { appUrl } from '../../lib/whatsapp';
import type { Squadra, StatoSquadra } from '../../types';
import { Button, ConfirmDialog, Field, Input, Select, Sheet, cn } from '../../ui';
import { lettereGironi, prng, sorteggiaGironi } from './logic';
import { Nota, STATO_SQUADRA, StatoSquadraBadge } from './parti';
import type { DatiTorneo, PropsSezione } from './tipi';

type Filtro = 'tutte' | StatoSquadra;
const ORDINE: StatoSquadra[] = ['da approvare', 'in attesa partner', 'approvata', 'ritirata'];

export default function Squadre({ d }: PropsSezione) {
  const { squadre, torneo } = d;
  const { nome } = useNomi();
  const calendarioFatto = d.partite.some((p) => p.fase === 'gironi');
  const [filtro, setFiltro] = useState<Filtro>('tutte');
  const [rinomina, setRinomina] = useState<Squadra | null>(null);
  const [elimina, setElimina] = useState<Squadra | null>(null);
  const [ritira, setRitira] = useState<Squadra | null>(null);
  const [componi, setComponi] = useState(false);

  const approva = useAzione(azioni.aggiornaSquadra, { successo: 'Coppia approvata' });
  const aggiorna = useAzione(azioni.aggiornaSquadra, { successo: 'Coppia aggiornata', onSuccess: () => setRinomina(null) });
  const ritiro = useAzione(azioni.aggiornaSquadra, { successo: 'Coppia ritirata', onSuccess: () => setRitira(null) });
  const cancella = useAzione(azioni.eliminaSquadra, { successo: 'Coppia eliminata', onSuccess: () => setElimina(null) });

  const conteggi = useMemo(() => {
    const c: Record<Filtro, number> = { tutte: squadre.length, 'da approvare': 0, 'in attesa partner': 0, approvata: 0, ritirata: 0 };
    for (const s of squadre) c[s.stato]++;
    return c;
  }, [squadre]);

  const lista = useMemo(
    () =>
      squadre
        .filter((s) => filtro === 'tutte' || s.stato === filtro)
        .sort(
          (a, b) =>
            ORDINE.indexOf(a.stato) - ORDINE.indexOf(b.stato) || (a.girone ?? '~').localeCompare(b.girone ?? '~') || a.nome.localeCompare(b.nome),
        ),
    [squadre, filtro],
  );
  const primaDaApprovare = lista.find((s) => s.stato === 'da approvare')?.id;
  const nGironiEsistenti = new Set(squadre.map((s) => s.girone).filter(Boolean)).size;
  const lettere = lettereGironi(Math.max(4, nGironiEsistenti));
  const busy = (m: { isPending: boolean; variables?: { id: string } | string }, id: string) =>
    m.isPending && (typeof m.variables === 'string' ? m.variables === id : m.variables?.id === id);

  if (!squadre.length)
    return (
      <EmptyState
        titolo="Nessuna coppia iscritta"
        testo="Condividi il link del torneo nel gruppo WhatsApp: ogni giocatore crea la coppia e invita il compagno."
        azione={
          <WhatsAppButton testo={`Iscrivi la tua coppia a ${torneo.nome}: ${appUrl(`/t/${torneo.id}/coppia`)}`}>Invia il link su WhatsApp</WhatsAppButton>
        }
      />
    );

  return (
    <div className="grid gap-8">
      <Sezione titolo="Coppie" id="sq-lista">
        <div role="group" aria-label="Filtra per stato" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {(['tutte', ...ORDINE] as Filtro[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={cn(
                'tabular inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold',
                filtro === f ? 'border-court bg-court text-court-ink' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
              )}
            >
              {filtro === f && <Check className="size-4" aria-hidden />}
              {f === 'tutte' ? 'Tutte' : STATO_SQUADRA[f].label} {conteggi[f]}
            </button>
          ))}
        </div>

        {!lista.length ? (
          <p className="py-4 text-ink-muted">Nessuna coppia in questo stato.</p>
        ) : (
          <ul className="court-rule">
            {lista.map((s) => (
              <li key={s.id} className="grid gap-3 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="grid min-w-0 gap-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{s.nome}</span>
                    <StatoSquadraBadge stato={s.stato} />
                  </p>
                  <p className="truncate text-ink-muted">
                    {s.giocatori.length ? s.giocatori.map((g) => nome(g)).join(' e ') : 'Nessun giocatore'}
                    {s.stato === 'in attesa partner' && ' · aspetta il compagno'}
                  </p>
                </div>
                <div>
                  {s.stato === 'approvata' || (s.stato === 'ritirata' && s.girone) ? (
                    <Field label={<span className="sr-only">Girone di {s.nome}</span>} className="max-w-48">
                      {(p) => (
                        <Select
                          {...p}
                          value={s.girone ?? ''}
                          disabled={calendarioFatto || s.stato === 'ritirata' || busy(aggiorna, s.id)}
                          onChange={(e) => aggiorna.mutate({ id: s.id, girone: e.target.value || null })}
                        >
                          <option value="">Senza girone</option>
                          {lettere.map((l) => (
                            <option key={l} value={l}>
                              Girone {l}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1 lg:justify-end">
                  {s.stato === 'da approvare' && (
                    <Button
                      variant={s.id === primaDaApprovare ? 'primary' : 'secondary'}
                      loading={busy(approva, s.id)}
                      onClick={() => approva.mutate({ id: s.id, stato: 'approvata' })}
                    >
                      <Check aria-hidden /> Approva
                    </Button>
                  )}
                  {s.stato !== 'ritirata' && (
                    <Button variant="ghost" size="icon" aria-label={`Rinomina ${s.nome}`} onClick={() => setRinomina(s)}>
                      <Pencil aria-hidden />
                    </Button>
                  )}
                  {calendarioFatto
                    ? s.stato === 'approvata' && (
                        <Button variant="ghost" onClick={() => setRitira(s)}>
                          <UserMinus aria-hidden /> Ritira
                        </Button>
                      )
                    : (
                        <Button variant="ghost" size="icon" aria-label={`Elimina ${s.nome}`} onClick={() => setElimina(s)}>
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Sezione>

      <Sezione titolo="Gironi" id="sq-gironi">
        <RiepilogoGironi squadre={squadre} />
        {calendarioFatto ? (
          <Nota tono="info" icon={Lock}>
            Gironi bloccati: il calendario è già stato generato.
          </Nota>
        ) : componi ? (
          <ComponiGironi d={d} onFine={() => setComponi(false)} nIniziale={Math.max(2, nGironiEsistenti)} />
        ) : (
          <Button
            variant={conteggi['da approvare'] === 0 && squadre.some((s) => s.stato === 'approvata' && !s.girone) ? 'primary' : 'secondary'}
            className="justify-self-start"
            disabled={!conteggi.approvata}
            onClick={() => setComponi(true)}
          >
            <Shuffle aria-hidden /> Componi i gironi
          </Button>
        )}
      </Sezione>

      <SheetRinomina squadra={rinomina} onClose={() => setRinomina(null)} loading={aggiorna.isPending} onSalva={(n) => rinomina && aggiorna.mutate({ id: rinomina.id, nome: n })} />

      <ConfirmDialog
        open={!!elimina}
        onOpenChange={(o) => !o && setElimina(null)}
        title={`Eliminare «${elimina?.nome ?? ''}»?`}
        description="La coppia e il suo link d’invito spariscono. I giocatori potranno iscriversi di nuovo."
        confirmLabel="Elimina coppia"
        loading={cancella.isPending}
        onConfirm={() => elimina && cancella.mutate(elimina.id)}
      />
      <ConfirmDialog
        open={!!ritira}
        onOpenChange={(o) => !o && setRitira(null)}
        title={`Ritirare «${ritira?.nome ?? ''}»?`}
        description="I risultati restano. Le partite residue si chiudono a tavolino dalle singole partite."
        confirmLabel="Ritira coppia"
        loading={ritiro.isPending}
        onConfirm={() => ritira && ritiro.mutate({ id: ritira.id, stato: 'ritirata' })}
      />
    </div>
  );
}

function RiepilogoGironi({ squadre }: { squadre: Squadra[] }) {
  const approvate = squadre.filter((s) => s.stato === 'approvata');
  const per = new Map<string, number>();
  for (const s of approvate) if (s.girone) per.set(s.girone, (per.get(s.girone) ?? 0) + 1);
  const senza = approvate.filter((s) => !s.girone).length;
  return (
    <p className="tabular">
      {per.size
        ? [...per.entries()]
            .sort()
            .map(([g, n]) => `Girone ${g}: ${n} coppie`)
            .join(' · ')
        : 'Nessun girone ancora composto.'}
      {senza > 0 && ` · ${senza} ${senza === 1 ? 'coppia approvata' : 'coppie approvate'} senza girone`}
    </p>
  );
}

function ComponiGironi({ d, onFine, nIniziale }: { d: DatiTorneo; onFine: () => void; nIniziale: number }) {
  const approvate = useMemo(() => d.squadre.filter((s) => s.stato === 'approvata'), [d.squadre]);
  const daApprovare = d.squadre.filter((s) => s.stato === 'da approvare').length;
  const [n, setN] = useState(Math.min(4, nIniziale));
  const [seme, setSeme] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const anteprima = useMemo(() => sorteggiaGironi(approvate.map((s) => s.id), n, prng(seme)), [approvate, n, seme]);
  const byId = new Map(approvate.map((s) => [s.id, s]));
  const conferma = useAzione(
    async (a: Record<string, string>) => {
      await Promise.all(Object.entries(a).map(([id, girone]) => azioni.aggiornaSquadra({ id, girone })));
      return Object.keys(a).length;
    },
    { successo: (k) => `Gironi composti: ${k} coppie assegnate`, onSuccess: onFine },
  );

  return (
    <div className="grid gap-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Numero di gironi" className="w-40">
          {(p) => (
            <Select {...p} value={n} onChange={(e) => setN(Number(e.target.value))}>
              {[1, 2, 3, 4].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="min-h-11 content-center text-ink-muted">Metodo: a sorte</p>
      </div>
      {daApprovare > 0 && (
        <Nota tono="warn">
          {daApprovare} {daApprovare === 1 ? 'coppia è' : 'coppie sono'} ancora da approvare e non {daApprovare === 1 ? 'entra' : 'entrano'} nel sorteggio.
        </Nota>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]" aria-live="polite">
        {lettereGironi(n).map((g) => {
          const ids = Object.entries(anteprima)
            .filter(([, x]) => x === g)
            .map(([id]) => id);
          return (
            <section key={g} aria-labelledby={`anteprima-${g}`}>
              <h3 id={`anteprima-${g}`} className="flex items-center gap-2 border-b-2 border-court pb-1 font-bold dark:border-ball">
                <Users className="size-5" aria-hidden /> Girone {g} <span className="tabular font-normal text-ink-muted">· {ids.length} coppie</span>
              </h3>
              <ul className="court-rule">
                {ids.map((id) => (
                  <li key={id} className="py-2">
                    {byId.get(id)?.nome}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={conferma.isPending} onClick={() => conferma.mutate(anteprima)}>
          <Check aria-hidden /> Conferma gironi
        </Button>
        <Button variant="secondary" onClick={() => setSeme(Math.floor(Math.random() * 2 ** 31))}>
          <Shuffle aria-hidden /> Rimescola
        </Button>
        <Button variant="ghost" onClick={onFine}>
          Annulla
        </Button>
      </div>
    </div>
  );
}

function SheetRinomina({ squadra, onClose, onSalva, loading }: { squadra: Squadra | null; onClose: () => void; onSalva: (nome: string) => void; loading: boolean }) {
  const [valore, setValore] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [per, setPer] = useState<string | null>(null);
  if (squadra && per !== squadra.id) {
    setPer(squadra.id);
    setValore(squadra.nome);
    setErrore(null);
  }
  if (!squadra && per !== null) setPer(null);
  const formId = 'form-rinomina';
  return (
    <Sheet
      open={!!squadra}
      onOpenChange={(o) => !o && onClose()}
      title="Rinomina la coppia"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={loading}>
            Salva nome
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const v = valore.trim();
          if (!v) return setErrore('Scrivi un nome per la coppia');
          if (v.length > 40) return setErrore('Massimo 40 caratteri');
          onSalva(v);
        }}
      >
        <Field label="Nome della coppia" error={errore}>
          {(p) => <Input {...p} value={valore} onChange={(e) => setValore(e.target.value)} autoComplete="off" />}
        </Field>
      </form>
    </Sheet>
  );
}
