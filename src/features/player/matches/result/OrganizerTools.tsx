/** "Strumenti organizzatore": official result, forfeit (winning pair by name), clear result. */
import { Eraser, Gavel, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { actions } from '../../../../data/mutations';
import { Button, ConfirmDialog, Field, Input, Segmented } from '../../../../ui';
import type { MatchContext } from '../context';
import { checkResult, valuesFrom, type SetValue } from '../logic';
import { useMatchAction } from '../useMatchAction';
import { ScoreInput } from './ScoreInput';

export function OrganizerTools({ ctx, primary }: { ctx: MatchContext; primary: boolean }) {
  const { match } = ctx;
  const format = ctx.tournament.config.setFormat;
  const [values, setValues] = useState<SetValue[]>(() => valuesFrom(match.result?.sets, format));
  const [note, setNote] = useState('');
  const [winner, setWinner] = useState<'A' | 'B'>('A');
  const [dialog, setDialog] = useState<'forfeit' | 'clear' | null>(null);
  const official = useMatchAction(actions.setOfficialResult, 'Risultato ufficiale impostato');
  const forfeit = useMatchAction(actions.assignForfeit, 'Tavolino assegnato');
  const clear = useMatchAction(actions.clearResult, 'Risultato cancellato: la partita torna da giocare');
  const check = checkResult(values, format);
  const winnerName = winner === 'A' ? ctx.nameA : ctx.nameB;
  const close = { onSuccess: () => setDialog(null), onError: () => setDialog(null) };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h3 className="text-base font-bold">Risultato ufficiale</h3>
        <ScoreInput values={values} onChange={setValues} format={format} nameA={ctx.nameA} nameB={ctx.nameB} disabled={official.isPending} />
        <Field label="Nota (facoltativa)" hint="La vedono i giocatori sotto il risultato." className="max-w-md">
          {(p) => <Input {...p} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <Button
          variant={primary ? 'primary' : 'court'}
          className="justify-self-start"
          disabled={!check.winner}
          loading={official.isPending}
          onClick={() => official.run({ match: match.id, sets: check.sets, note: note.trim() || undefined })}
        >
          <ShieldCheck aria-hidden /> Imposta risultato ufficiale
        </Button>
      </div>

      <div className="grid gap-3 border-t border-line pt-4">
        <h3 className="text-base font-bold">Tavolino</h3>
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">Coppia vincente</span>
          <Segmented
            label="Coppia vincente"
            value={winner}
            onValueChange={setWinner}
            className="max-w-full flex-wrap"
            options={[
              { value: 'A', label: ctx.nameA },
              { value: 'B', label: ctx.nameB },
            ]}
          />
        </div>
        <ConfirmDialog
          open={dialog === 'forfeit'}
          onOpenChange={(o) => setDialog(o ? 'forfeit' : null)}
          title={`Assegnare il tavolino a ${winnerName}?`}
          description="Il risultato diventa ufficiale. Il punteggio lo decide il sistema."
          confirmLabel="Assegna tavolino"
          tone="primary"
          loading={forfeit.isPending}
          onConfirm={() => forfeit.run({ match: match.id, winner, note: note.trim() || undefined }, close)}
          trigger={
            <Button variant="secondary" className="justify-self-start">
              <Gavel aria-hidden /> Assegna tavolino
            </Button>
          }
        />
      </div>

      {match.result && (
        <div className="grid gap-3 border-t border-line pt-4">
          <h3 className="text-base font-bold">Cancella risultato</h3>
          <p className="text-ink-muted">La partita torna da giocare; resta la programmazione se c’era.</p>
          <ConfirmDialog
            open={dialog === 'clear'}
            onOpenChange={(o) => setDialog(o ? 'clear' : null)}
            title="Cancellare il risultato?"
            description="La partita torna da giocare."
            confirmLabel="Cancella risultato"
            cancelLabel="Tieni"
            loading={clear.isPending}
            onConfirm={() => clear.run(match.id, close)}
            trigger={
              <Button variant="danger" className="justify-self-start">
                <Eraser aria-hidden /> Cancella risultato
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
