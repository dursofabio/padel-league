/** Sheet of a selected slot: who is free, who is missing, and the request action (4/4 and 3/4). */
import { CircleCheck, CircleMinus, Clock3, Info, Lock, Send } from 'lucide-react';
import { useState } from 'react';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { azioni } from '../../../../data/mutations';
import type { StatoSlot } from '../../../../lib/slots';
import { labelDate } from '../../../../lib/time';
import { Button, cn, Field, Sheet, Textarea } from '../../../../ui';
import { nomeCampo, type ContestoPartita } from '../contesto';
import { descriviOccupazione, elencoNomi, etichettaSlot } from '../logica';
import { AVVOLGI, Avviso, Pill, SLOT_UI } from '../parti';
import { hintDi, useAzionePartita } from '../useAzionePartita';

const RIAPRI = ['SLOT_TAKEN', 'MATCH_HAS_REQUEST', 'OVERLAP', 'EXPIRED', 'IN_PAST', 'COURT_CLOSED'];

export function SlotSheet({
  ctx,
  stato,
  onClose,
  onProponi,
}: {
  ctx: ContestoPartita;
  stato: StatoSlot;
  onClose: () => void;
  /** Off-grid entry for occupied slots, when enabled. */
  onProponi?: () => void;
}) {
  const { slot, colore, mancanti } = stato;
  const { partita, nome } = ctx;
  const [nota, setNota] = useState('');
  const invia = useAzionePartita(azioni.creaRichiesta, 'Richiesta inviata al campo');
  const campo = nomeCampo(ctx.campi, slot.campoId);
  const quando = `${labelDate(slot.data)} alle ${slot.inizio}`;
  const ui = SLOT_UI[colore];
  const richiedibile = (colore === 'verde' || colore === 'giallo') && !!ctx.mioLato;
  const nomiMancanti = elencoNomi(mancanti.map((g) => nome(g)));
  const altriMancanti = mancanti.filter((g) => g !== ctx.uid);

  const inviaRichiesta = () =>
    invia.esegui(
      { partita: partita.id, campo: slot.campoId, data: slot.data, inizio: slot.inizio, nota: nota.trim() || undefined },
      {
        onSuccess: onClose,
        onError: (e) => {
          if (RIAPRI.includes(hintDi(e) ?? '')) onClose();
        },
      },
    );

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        <span className="tabular">
          {labelDate(slot.data)} · {slot.inizio}–{slot.fine} · {campo}
        </span>
      }
      footer={
        richiedibile ? (
          <Button variant="primary" size="lg" block className="whitespace-normal" loading={invia.isPending} onClick={inviaRichiesta}>
            <Send aria-hidden /> Invia richiesta al campo
          </Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Chiudi
          </Button>
        )
      }
    >
      <div className={cn('grid gap-5', AVVOLGI)}>
        <Pill icona={ui.icona} tono={ui.tono} className="justify-self-start">
          {colore === 'verde' ? 'Liberi tutti e 4' : etichettaSlot(stato, partita.giocatori.length)}
        </Pill>

        {(colore === 'rosso' || colore === 'blu') && (
          <div className="grid gap-3">
            {colore === 'rosso' ? (
              <Avviso icona={Lock} tono="danger">
                Il campo è occupato
                {stato.occupazioni.length ? `: ${stato.occupazioni.map(descriviOccupazione).join(', ')}` : ''}.
              </Avviso>
            ) : (
              <Avviso icona={Send} tono="info">
                Questo orario è già stato chiesto per un’altra partita.
              </Avviso>
            )}
            {onProponi && colore === 'rosso' && (
              <Button variant="link" className="justify-self-start text-base" onClick={onProponi}>
                <Clock3 aria-hidden /> Proponi un altro orario
              </Button>
            )}
          </div>
        )}

        {colore !== 'rosso' && colore !== 'blu' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  [ctx.nomeA, partita.giocatoriA],
                  [ctx.nomeB, partita.giocatoriB],
                ] as const
              ).map(([coppia, gs]) => (
                <div key={coppia} className="grid content-start gap-1">
                  <p className="font-bold">{coppia}</p>
                  <ul className="court-rule">
                    {gs.map((g) => {
                      const libero = stato.liberi.includes(g);
                      return (
                        <li key={g} className="flex items-start gap-2 py-2">
                          {libero ? (
                            <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok-ink" aria-hidden />
                          ) : (
                            <CircleMinus className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden />
                          )}
                          <span>
                            <span className="font-semibold">{g === ctx.uid ? 'Tu' : nome(g)}</span>{' '}
                            <span className="text-ink-muted">{libero ? 'libero' : 'non ha segnato questo orario'}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {colore === 'verde' && <p>Tutti e 4 sono liberi: la richiesta parte già accettata da tutti.</p>}
            {colore === 'giallo' && (
              <p>
                {mancanti[0] === ctx.uid ? 'Tu non hai segnato questo orario: inviando la richiesta lo accetti.' : `${nomiMancanti} dovrà accettare prima che il campo possa confermare.`}
              </p>
            )}
            {colore === 'grigio' && (
              <Avviso icona={Info}>
                Servono almeno 3 giocatori liberi per chiedere il campo. {nomiMancanti} non {mancanti.length === 1 ? 'ha' : 'hanno'} segnato questo orario.
              </Avviso>
            )}

            {ctx.mioLato && altriMancanti.length > 0 && (
              <WhatsAppButton
                className="justify-self-start"
                telefono={altriMancanti.length === 1 ? ctx.telefono(altriMancanti[0]) : undefined}
                testo={`${elencoNomi(altriMancanti.map((g) => nome(g)))}, ${altriMancanti.length === 1 ? 'puoi' : 'potete'} giocare ${quando} (${campo})? Segnalo nelle disponibilità → ${ctx.link}`}
              >
                {colore === 'grigio'
                  ? `Chiedi a ${elencoNomi(altriMancanti.map((g) => nome(g)))} di segnare questo orario`
                  : `Chiedi a ${elencoNomi(altriMancanti.map((g) => nome(g)))} su WhatsApp`}
              </WhatsAppButton>
            )}

            {richiedibile && (
              <Field label="Nota per il campo (facoltativa)">
                {(p) => <Textarea {...p} value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />}
              </Field>
            )}
            {!ctx.mioLato && <p className="text-ink-muted">Solo i giocatori di questa partita possono chiedere il campo.</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
