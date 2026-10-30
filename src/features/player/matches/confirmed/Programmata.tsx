/**
 * S4: confirmed match. Day, time, court; WhatsApp share; player cancellation until
 * config.annullamentoGiocatoreOre hours before the start (decision P4 changed), otherwise "Scrivi al gestore".
 */
import { CalendarCheck, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { azioni } from '../../../../data/mutations';
import { labelDate } from '../../../../lib/time';
import { Button, ConfirmDialog } from '../../../../ui';
import { nomeCampo, type ContestoPartita } from '../contesto';
import { limiteAnnullamento, quando } from '../logica';
import { Avviso, useOra } from '../parti';
import { useAzionePartita } from '../useAzionePartita';

export function Programmata({ ctx }: { ctx: ContestoPartita }) {
  const { partita } = ctx;
  const prog = partita.programmazione!;
  const now = useOra();
  const [conferma, setConferma] = useState(false);
  const annulla = useAzionePartita(azioni.annullaPartitaGiocatore, 'Partita annullata: il campo è di nuovo libero');
  const campo = nomeCampo(ctx.campi, prog.campoId);
  const ore = ctx.torneo.config.annullamentoGiocatoreOre;
  const limite = limiteAnnullamento(prog, ore);
  const puoAnnullare = !!ctx.mioLato && !!partita.richiestaId && now < limite;
  const quandoGioca = `${labelDate(prog.data)} alle ${prog.inizio}`;

  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-2 text-xl font-bold">
        <CalendarCheck className="mt-1 size-6 shrink-0 text-ok-ink" aria-hidden />
        <span className="tabular">
          Si gioca {quandoGioca} · {campo}
        </span>
      </p>
      <p className="tabular text-ink-muted">
        Dalle {prog.inizio} alle {prog.fine}. Dopo la partita potrai inserire il risultato qui.
      </p>
      {ctx.mioLato && (
        <div className="flex flex-wrap gap-2">
          <WhatsAppButton testo={`Confermata: ${ctx.titolo}, ${quandoGioca}, ${campo} → ${ctx.link}`} />
        </div>
      )}
      {ctx.mioLato &&
        (puoAnnullare ? (
          <div className="grid gap-2 border-t border-line pt-4">
            <p className="text-ink-muted">
              Non potete più giocare? Puoi annullarla fino a <span className="tabular">{quando(limite)}</span>.
            </p>
            <ConfirmDialog
              open={conferma}
              onOpenChange={setConferma}
              title="Annullare la partita?"
              description="Il campo torna libero per tutti e la partita torna da programmare."
              confirmLabel="Annulla partita"
              cancelLabel="Tieni"
              loading={annulla.isPending}
              onConfirm={() =>
                annulla.esegui({ richiesta: partita.richiestaId! }, { onSuccess: () => setConferma(false), onError: () => setConferma(false) })
              }
              trigger={
                <Button variant="danger" className="justify-self-start">
                  Annulla partita
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-2 border-t border-line pt-4">
            <Avviso icona={MessageCircle}>
              Per spostarla o annullarla scrivi al gestore del campo: mancano meno di {ore} ore all’inizio.
            </Avviso>
            <WhatsAppButton
              className="justify-self-start"
              telefono={ctx.telefonoGestore}
              testo={`Ciao, per la partita ${ctx.titolo} di ${quandoGioca} (${campo}) …`}
            >
              Scrivi al gestore
            </WhatsAppButton>
          </div>
        ))}
    </div>
  );
}
