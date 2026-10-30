/** "Strumenti organizzatore": official result, forfeit (winning pair by name), clear result. */
import { Eraser, Gavel, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { azioni } from '../../../../data/mutations';
import { Button, ConfirmDialog, Field, Input, Segmented } from '../../../../ui';
import type { ContestoPartita } from '../contesto';
import { controllaRisultato, valoriDa, type ValoreSet } from '../logica';
import { useAzionePartita } from '../useAzionePartita';
import { ScoreInput } from './ScoreInput';

export function StrumentiOrganizzatore({ ctx, primario }: { ctx: ContestoPartita; primario: boolean }) {
  const { partita } = ctx;
  const formato = ctx.torneo.config.formatoSet;
  const [valori, setValori] = useState<ValoreSet[]>(() => valoriDa(partita.risultato?.set, formato));
  const [nota, setNota] = useState('');
  const [vincente, setVincente] = useState<'A' | 'B'>('A');
  const [dialogo, setDialogo] = useState<'tavolino' | 'cancella' | null>(null);
  const ufficiale = useAzionePartita(azioni.risultatoUfficiale, 'Risultato ufficiale impostato');
  const tavolino = useAzionePartita(azioni.tavolino, 'Tavolino assegnato');
  const cancella = useAzionePartita(azioni.annullaRisultato, 'Risultato cancellato: la partita torna da giocare');
  const ctrl = controllaRisultato(valori, formato);
  const nomeVincente = vincente === 'A' ? ctx.nomeA : ctx.nomeB;
  const chiudi = { onSuccess: () => setDialogo(null), onError: () => setDialogo(null) };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h3 className="text-base font-bold">Risultato ufficiale</h3>
        <ScoreInput valori={valori} onChange={setValori} formato={formato} nomeA={ctx.nomeA} nomeB={ctx.nomeB} disabled={ufficiale.isPending} />
        <Field label="Nota (facoltativa)" hint="La vedono i giocatori sotto il risultato." className="max-w-md">
          {(p) => <Input {...p} value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} />}
        </Field>
        <Button
          variant={primario ? 'primary' : 'court'}
          className="justify-self-start"
          disabled={!ctrl.vincitore}
          loading={ufficiale.isPending}
          onClick={() => ufficiale.esegui({ partita: partita.id, set: ctrl.set, nota: nota.trim() || undefined })}
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
            value={vincente}
            onValueChange={setVincente}
            className="max-w-full flex-wrap"
            options={[
              { value: 'A', label: ctx.nomeA },
              { value: 'B', label: ctx.nomeB },
            ]}
          />
        </div>
        <ConfirmDialog
          open={dialogo === 'tavolino'}
          onOpenChange={(o) => setDialogo(o ? 'tavolino' : null)}
          title={`Assegnare il tavolino a ${nomeVincente}?`}
          description="Il risultato diventa ufficiale. Il punteggio lo decide il sistema."
          confirmLabel="Assegna tavolino"
          tone="primary"
          loading={tavolino.isPending}
          onConfirm={() => tavolino.esegui({ partita: partita.id, vincente, nota: nota.trim() || undefined }, chiudi)}
          trigger={
            <Button variant="secondary" className="justify-self-start">
              <Gavel aria-hidden /> Assegna tavolino
            </Button>
          }
        />
      </div>

      {partita.risultato && (
        <div className="grid gap-3 border-t border-line pt-4">
          <h3 className="text-base font-bold">Cancella risultato</h3>
          <p className="text-ink-muted">La partita torna da giocare; resta la programmazione se c’era.</p>
          <ConfirmDialog
            open={dialogo === 'cancella'}
            onOpenChange={(o) => setDialogo(o ? 'cancella' : null)}
            title="Cancellare il risultato?"
            description="La partita torna da giocare."
            confirmLabel="Cancella risultato"
            cancelLabel="Tieni"
            loading={cancella.isPending}
            onConfirm={() => cancella.esegui(partita.id, chiudi)}
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
