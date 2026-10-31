/** Result blocks of the match state machine (S5–S8), see docs/ux/risultato.md. */
import { CircleCheck, Flag, Gavel, Hourglass, Pencil, Send, Trophy } from 'lucide-react';
import { useState } from 'react';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { actions } from '../../../../data/mutations';
import { formatScore, isDecidingSet, matchStats } from '../../../../lib/results';
import type { SetScore } from '../../../../types';
import { Button, Field, Textarea } from '../../../../ui';
import type { MatchContext } from '../context';
import { checkResult, formatWhen, sideOf, valuesFrom, type SetValue } from '../logic';
import { Notice } from '../parts';
import { useMatchAction } from '../useMatchAction';
import { ScoreInput } from './ScoreInput';

/** Entry (S5) and correction (S6b): set table, helper, live validation, "Invia risultato". */
export function EnterResult({ ctx, initial, onDone, onCancel }: { ctx: MatchContext; initial?: SetScore[] | null; onDone?: () => void; onCancel?: () => void }) {
  const format = ctx.tournament.config.setFormat;
  const [values, setValues] = useState<SetValue[]>(() => valuesFrom(initial, format));
  const submit = useMatchAction(actions.submitResult, 'Risultato inviato: ora deve confermarlo un avversario');
  const check = checkResult(values, format);
  return (
    <div className="grid gap-4">
      <p className="max-w-prose text-ink-muted">
        Scrivi i game nell’ordine: prima {ctx.nameA}, poi {ctx.nameB}. Vale dopo la conferma di un avversario.
      </p>
      <ScoreInput values={values} onChange={setValues} format={format} nameA={ctx.nameA} nameB={ctx.nameB} disabled={submit.isPending} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="lg"
          disabled={!check.winner}
          loading={submit.isPending}
          onClick={() => submit.run({ match: ctx.match.id, sets: check.sets }, { onSuccess: onDone })}
        >
          <Send aria-hidden /> Invia risultato
        </Button>
        {onCancel && (
          <Button variant="ghost" size="lg" onClick={onCancel}>
            Lascia com’era
          </Button>
        )}
      </div>
    </div>
  );
}

/** The score shown large, pair names on every column. */
export function BigScore({ ctx, sets }: { ctx: MatchContext; sets: SetScore[] }) {
  const format = ctx.tournament.config.setFormat;
  const st = matchStats(sets, format);
  return (
    <table className="w-full max-w-md text-left">
      <caption className="sr-only">Punteggio: {formatScore(sets)}</caption>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="sr-only">
            Set
          </th>
          {[ctx.nameA, ctx.nameB].map((n, i) => (
            <th key={n + i} scope="col" className={i === 1 ? 'border-l border-line py-2 pl-3 text-center' : 'py-2 text-center'}>
              <span className="inline-flex items-center gap-1.5 font-bold">
                {st.winner === (i === 0 ? 'A' : 'B') && <Trophy className="size-4" aria-label="vincitori" />}
                {n}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sets.map((s, i) => (
          <tr key={i} className="border-b border-line">
            <th scope="row" className="py-2 pr-2 text-sm font-semibold text-ink-muted">
              {format.superTieBreak && isDecidingSet(i, format) ? 'Super tie-break' : `Set ${i + 1}`}
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
function enteredBy(ctx: MatchContext): string {
  const result = ctx.match.result;
  const t = ctx.match.updatedAt ? Date.parse(ctx.match.updatedAt) : NaN;
  return `Inserito da ${ctx.name(result?.enteredBy)}${Number.isFinite(t) ? `, ${formatWhen(t)}` : ''}.`;
}

function opponentsOf(ctx: MatchContext, uid: string | null | undefined): string[] {
  const side = sideOf(ctx.match, uid);
  return side === 'A' ? ctx.match.playersB : side === 'B' ? ctx.match.playersA : [];
}

/** S6, opponent side: confirm or contest (reason required, inline). */
export function ConfirmResult({ ctx }: { ctx: MatchContext }) {
  const result = ctx.match.result!;
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const confirm = useMatchAction(actions.confirmResult, 'Risultato confermato: la classifica è aggiornata');
  const dispute = useMatchAction(actions.disputeResult, 'Contestazione inviata all’organizzatore');
  const reasonError = attempted && !reason.trim() ? 'Scrivi cosa non torna: l’organizzatore lo leggerà.' : undefined;
  return (
    <div className="grid gap-4">
      <BigScore ctx={ctx} sets={result.sets} />
      <p className="text-ink-muted">{enteredBy(ctx)}</p>
      {!disputing ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="lg" loading={confirm.isPending} onClick={() => confirm.run(ctx.match.id)}>
            <CircleCheck aria-hidden /> Conferma risultato
          </Button>
          <Button variant="danger" size="lg" onClick={() => setDisputing(true)}>
            <Flag aria-hidden /> Non è corretto
          </Button>
        </div>
      ) : (
        <div className="grid max-w-md gap-3">
          <p>Il risultato passa all’organizzatore, che deciderà.</p>
          <Field label="Motivo (obbligatorio)" error={reasonError}>
            {(p) => (
              <Textarea
                {...p}
                autoFocus
                value={reason}
                maxLength={500}
                placeholder="Es. il secondo set era 6-3"
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="lg"
              loading={dispute.isPending}
              onClick={() => {
                setAttempted(true);
                if (reason.trim()) dispute.run({ match: ctx.match.id, note: reason.trim() });
              }}
            >
              <Flag aria-hidden /> Invia contestazione
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setDisputing(false)}>
              Torna indietro
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** S6b, inserter's side: waiting, correct, nudge. Read-only for everybody else. */
export function AwaitingConfirmation({ ctx }: { ctx: MatchContext }) {
  const result = ctx.match.result!;
  const [correcting, setCorrecting] = useState(false);
  const opponents = opponentsOf(ctx, result.enteredBy);
  const opponentNames = opponents.map((p) => ctx.name(p));
  const enteredByMySide = !!ctx.mySide && ctx.mySide === sideOf(ctx.match, result.enteredBy);
  if (correcting)
    return <EnterResult ctx={ctx} initial={result.sets} onDone={() => setCorrecting(false)} onCancel={() => setCorrecting(false)} />;
  return (
    <div className="grid gap-4">
      <BigScore ctx={ctx} sets={result.sets} />
      <Notice icon={Hourglass} tone="warn">
        Aspettiamo la conferma di {opponentNames.join(' o ')}.
      </Notice>
      <p className="text-ink-muted">{enteredBy(ctx)}</p>
      {enteredByMySide && (
        <div className="flex flex-wrap gap-2">
          {opponents.map((p) => (
            <WhatsAppButton
              key={p}
              phone={ctx.phone(p)}
              text={`${ctx.name(p)}, ho inserito il risultato ${formatScore(result.sets)} di ${ctx.title}: confermalo qui → ${ctx.link}`}
            >
              Sollecita {ctx.name(p)}
            </WhatsAppButton>
          ))}
          <Button variant="secondary" onClick={() => setCorrecting(true)}>
            <Pencil aria-hidden /> Correggi risultato
          </Button>
        </div>
      )}
    </div>
  );
}

/** S7: the dispute, no actions for players. */
export function Disputed({ ctx }: { ctx: MatchContext }) {
  const result = ctx.match.result;
  return (
    <div className="grid gap-4">
      {result && <BigScore ctx={ctx} sets={result.sets} />}
      <Notice icon={Flag} tone="warn">
        {result?.disputedBy ? `Contestato da ${ctx.name(result.disputedBy)}` : 'Risultato contestato'}
        {result?.note ? `: «${result.note}».` : '.'} Ora decide l’organizzatore.
      </Notice>
      {result && <p className="text-ink-muted">Inserito da {ctx.name(result.enteredBy)}.</p>}
    </div>
  );
}

/** S8: final result with winner and who confirmed / organizer note / forfeit. */
export function Final({ ctx }: { ctx: MatchContext }) {
  const { match } = ctx;
  const result = match.result;
  if (!result?.sets?.length) return <p>Partita chiusa.</p>;
  const st = matchStats(result.sets, ctx.tournament.config.setFormat);
  const winner = st.winner === 'A' ? ctx.nameA : ctx.nameB;
  const byPlayer = !!result.confirmedBy && match.players.includes(result.confirmedBy);
  return (
    <div className="grid gap-4">
      {match.status === 'forfeit' ? (
        <Notice icon={Gavel}>
          <span className="font-bold">Tavolino: vince {winner}</span>
          {result.note && result.note !== 'Tavolino' ? ` · ${result.note}` : ''}
        </Notice>
      ) : (
        <p className="flex items-center gap-2 text-xl font-bold">
          <Trophy className="size-6 shrink-0" aria-hidden />
          <span className="tabular">
            Risultato: {formatScore(result.sets)} · vincono {winner}
          </span>
        </p>
      )}
      <BigScore ctx={ctx} sets={result.sets} />
      {match.status === 'played' &&
        (byPlayer ? (
          <p className="text-ink-muted">Confermato da {ctx.name(result.confirmedBy)}.</p>
        ) : (
          <p className="text-ink-muted">Deciso dall’organizzatore{result.note ? `: ${result.note}` : '.'}</p>
        ))}
    </div>
  );
}

