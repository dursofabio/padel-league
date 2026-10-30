/** Result blocks of the match state machine (S5–S8), see docs/ux/risultato.md. */
import { CircleCheck, Flag, Gavel, Hourglass, Pencil, Send, Trophy } from 'lucide-react';
import { useState } from 'react';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { azioni } from '../../../../data/mutations';
import { formatRisultato, isSetDecisivo, statistiche } from '../../../../lib/results';
import type { SetScore } from '../../../../types';
import { Button, Field, Textarea } from '../../../../ui';
import type { ContestoPartita } from '../contesto';
import { controllaRisultato, latoDi, quando, valoriDa, type ValoreSet } from '../logica';
import { Avviso } from '../parti';
import { useAzionePartita } from '../useAzionePartita';
import { ScoreInput } from './ScoreInput';

/** Entry (S5) and correction (S6b): set table, helper, live validation, "Invia risultato". */
export function InserisciRisultato({ ctx, iniziale, onFatto, onAnnulla }: { ctx: ContestoPartita; iniziale?: SetScore[] | null; onFatto?: () => void; onAnnulla?: () => void }) {
  const formato = ctx.torneo.config.formatoSet;
  const [valori, setValori] = useState<ValoreSet[]>(() => valoriDa(iniziale, formato));
  const invia = useAzionePartita(azioni.inserisciRisultato, 'Risultato inviato: ora deve confermarlo un avversario');
  const ctrl = controllaRisultato(valori, formato);
  return (
    <div className="grid gap-4">
      <p className="max-w-prose text-ink-muted">
        Scrivi i game nell’ordine: prima {ctx.nomeA}, poi {ctx.nomeB}. Vale dopo la conferma di un avversario.
      </p>
      <ScoreInput valori={valori} onChange={setValori} formato={formato} nomeA={ctx.nomeA} nomeB={ctx.nomeB} disabled={invia.isPending} />
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-10 -mx-1 flex flex-wrap gap-2 bg-bg px-1 py-2 lg:static lg:bg-transparent">
        <Button
          variant="primary"
          size="lg"
          disabled={!ctrl.vincitore}
          loading={invia.isPending}
          onClick={() => invia.esegui({ partita: ctx.partita.id, set: ctrl.set }, { onSuccess: onFatto })}
        >
          <Send aria-hidden /> Invia risultato
        </Button>
        {onAnnulla && (
          <Button variant="ghost" size="lg" onClick={onAnnulla}>
            Lascia com’era
          </Button>
        )}
      </div>
    </div>
  );
}

/** The score shown large, pair names on every column. */
export function PunteggioGrande({ ctx, set }: { ctx: ContestoPartita; set: SetScore[] }) {
  const formato = ctx.torneo.config.formatoSet;
  const st = statistiche(set, formato);
  return (
    <table className="w-full max-w-md text-left">
      <caption className="sr-only">Punteggio: {formatRisultato(set)}</caption>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="sr-only">
            Set
          </th>
          {[ctx.nomeA, ctx.nomeB].map((n, i) => (
            <th key={n + i} scope="col" className={i === 1 ? 'border-l border-line py-2 pl-3 text-center' : 'py-2 text-center'}>
              <span className="inline-flex items-center gap-1.5 font-bold">
                {st.vincitore === (i === 0 ? 'A' : 'B') && <Trophy className="size-4" aria-label="vincitori" />}
                {n}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {set.map((s, i) => (
          <tr key={i} className="border-b border-line">
            <th scope="row" className="py-2 pr-2 text-sm font-semibold text-ink-muted">
              {formato.superTieBreak && isSetDecisivo(i, formato) ? 'Super tie-break' : `Set ${i + 1}`}
            </th>
            <td className={`tabular py-2 text-center text-2xl ${s.a > s.b ? 'font-bold' : 'text-ink-muted'}`}>{s.a}</td>
            <td className={`tabular border-l border-line py-2 pl-3 text-center text-2xl ${s.b > s.a ? 'font-bold' : 'text-ink-muted'}`}>{s.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "Inserito da Marco Rossi, sab 14/11 alle 19:10" (time = last update of the match, i.e. the insertion while unconfirmed). */
function inseritoDa(ctx: ContestoPartita): string {
  const ris = ctx.partita.risultato;
  const t = ctx.partita.updatedAt ? Date.parse(ctx.partita.updatedAt) : NaN;
  return `Inserito da ${ctx.nome(ris?.inseritoDa)}${Number.isFinite(t) ? `, ${quando(t)}` : ''}.`;
}

function avversariDi(ctx: ContestoPartita, uid: string | null | undefined): string[] {
  const lato = latoDi(ctx.partita, uid);
  return lato === 'A' ? ctx.partita.giocatoriB : lato === 'B' ? ctx.partita.giocatoriA : [];
}

/** S6, opponent side: confirm or contest (reason required, inline). */
export function ConfermaRisultato({ ctx }: { ctx: ContestoPartita }) {
  const ris = ctx.partita.risultato!;
  const [contesta, setContesta] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [tentato, setTentato] = useState(false);
  const conferma = useAzionePartita(azioni.confermaRisultato, 'Risultato confermato: la classifica è aggiornata');
  const contestazione = useAzionePartita(azioni.contestaRisultato, 'Contestazione inviata all’organizzatore');
  const erroreMotivo = tentato && !motivo.trim() ? 'Scrivi cosa non torna: l’organizzatore lo leggerà.' : undefined;
  return (
    <div className="grid gap-4">
      <PunteggioGrande ctx={ctx} set={ris.set} />
      <p className="text-ink-muted">{inseritoDa(ctx)}</p>
      {!contesta ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="lg" loading={conferma.isPending} onClick={() => conferma.esegui(ctx.partita.id)}>
            <CircleCheck aria-hidden /> Conferma risultato
          </Button>
          <Button variant="danger" size="lg" onClick={() => setContesta(true)}>
            <Flag aria-hidden /> Non è corretto
          </Button>
        </div>
      ) : (
        <div className="grid max-w-md gap-3">
          <p>Il risultato passa all’organizzatore, che deciderà.</p>
          <Field label="Motivo (obbligatorio)" error={erroreMotivo}>
            {(p) => (
              <Textarea
                {...p}
                autoFocus
                value={motivo}
                maxLength={500}
                placeholder="Es. il secondo set era 6-3"
                onChange={(e) => setMotivo(e.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="lg"
              loading={contestazione.isPending}
              onClick={() => {
                setTentato(true);
                if (motivo.trim()) contestazione.esegui({ partita: ctx.partita.id, nota: motivo.trim() });
              }}
            >
              <Flag aria-hidden /> Invia contestazione
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setContesta(false)}>
              Torna indietro
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** S6b, inserter's side: waiting, correct, nudge. Read-only for everybody else. */
export function AttesaConferma({ ctx }: { ctx: ContestoPartita }) {
  const ris = ctx.partita.risultato!;
  const [correggi, setCorreggi] = useState(false);
  const avversari = avversariDi(ctx, ris.inseritoDa);
  const nomiAvv = avversari.map((g) => ctx.nome(g));
  const mioLatoInserito = !!ctx.mioLato && ctx.mioLato === latoDi(ctx.partita, ris.inseritoDa);
  if (correggi)
    return <InserisciRisultato ctx={ctx} iniziale={ris.set} onFatto={() => setCorreggi(false)} onAnnulla={() => setCorreggi(false)} />;
  return (
    <div className="grid gap-4">
      <PunteggioGrande ctx={ctx} set={ris.set} />
      <Avviso icona={Hourglass} tono="warn">
        Aspettiamo la conferma di {nomiAvv.join(' o ')}.
      </Avviso>
      <p className="text-ink-muted">{inseritoDa(ctx)}</p>
      {mioLatoInserito && (
        <div className="flex flex-wrap gap-2">
          {avversari.map((g) => (
            <WhatsAppButton
              key={g}
              telefono={ctx.telefono(g)}
              testo={`${ctx.nome(g)}, ho inserito il risultato ${formatRisultato(ris.set)} di ${ctx.titolo}: confermalo qui → ${ctx.link}`}
            >
              Sollecita {ctx.nome(g)}
            </WhatsAppButton>
          ))}
          <Button variant="secondary" onClick={() => setCorreggi(true)}>
            <Pencil aria-hidden /> Correggi risultato
          </Button>
        </div>
      )}
    </div>
  );
}

/** S7: the dispute, no actions for players. */
export function Contestato({ ctx }: { ctx: ContestoPartita }) {
  const ris = ctx.partita.risultato;
  return (
    <div className="grid gap-4">
      {ris && <PunteggioGrande ctx={ctx} set={ris.set} />}
      <Avviso icona={Flag} tono="warn">
        {ris?.contestatoDa ? `Contestato da ${ctx.nome(ris.contestatoDa)}` : 'Risultato contestato'}
        {ris?.nota ? `: «${ris.nota}».` : '.'} Ora decide l’organizzatore.
      </Avviso>
      {ris && <p className="text-ink-muted">Inserito da {ctx.nome(ris.inseritoDa)}.</p>}
    </div>
  );
}

/** S8: final result with winner and who confirmed / organizer note / forfeit. */
export function Finale({ ctx }: { ctx: ContestoPartita }) {
  const { partita } = ctx;
  const ris = partita.risultato;
  if (!ris?.set?.length) return <p>Partita chiusa.</p>;
  const st = statistiche(ris.set, ctx.torneo.config.formatoSet);
  const vincente = st.vincitore === 'A' ? ctx.nomeA : ctx.nomeB;
  const dalCampo = !!ris.confermatoDa && partita.giocatori.includes(ris.confermatoDa);
  return (
    <div className="grid gap-4">
      {partita.stato === 'tavolino' ? (
        <Avviso icona={Gavel}>
          <span className="font-bold">Tavolino: vince {vincente}</span>
          {ris.nota && ris.nota !== 'Tavolino' ? ` · ${ris.nota}` : ''}
        </Avviso>
      ) : (
        <p className="flex items-center gap-2 text-xl font-bold">
          <Trophy className="size-6 shrink-0" aria-hidden />
          <span className="tabular">
            Risultato: {formatRisultato(ris.set)} · vincono {vincente}
          </span>
        </p>
      )}
      <PunteggioGrande ctx={ctx} set={ris.set} />
      {partita.stato === 'giocata' &&
        (dalCampo ? (
          <p className="text-ink-muted">Confermato da {ctx.nome(ris.confermatoDa)}.</p>
        ) : (
          <p className="text-ink-muted">Deciso dall’organizzatore{ris.nota ? `: ${ris.nota}` : '.'}</p>
        ))}
    </div>
  );
}

