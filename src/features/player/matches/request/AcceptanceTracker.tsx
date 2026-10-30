/**
 * Request status (S2/S3): two-step progress, the 4 acceptances in text, expiry, Accetta / Annulla richiesta,
 * per-player WhatsApp nudge, counter-proposal display. Realtime changes are announced politely.
 */
import { AlarmClock, Check, CircleCheck, Hourglass, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { StatoRichiestaBadge } from '../../../../components/StatusBadge';
import { WhatsAppButton } from '../../../../components/WhatsAppButton';
import { azioni } from '../../../../data/mutations';
import { labelDate } from '../../../../lib/time';
import type { Richiesta } from '../../../../types';
import { Button, cn, ConfirmDialog } from '../../../../ui';
import { nomeCampo, type ContestoPartita } from '../contesto';
import { accettate, elencoNomi, quando, scadenzaEffettiva, traQuanto } from '../logica';
import { Avviso, ControPropostaBadge, FuoriGrigliaBadge, useOra } from '../parti';
import { useAzionePartita } from '../useAzionePartita';

export function AcceptanceTracker({ ctx, richiesta }: { ctx: ContestoPartita; richiesta: Richiesta }) {
  const { partita, nome } = ctx;
  const now = useOra(30_000);
  const [conferma, setConferma] = useState(false);
  const accetta = useAzionePartita(azioni.accettaRichiesta, 'Hai accettato la richiesta');
  const annulla = useAzionePartita(azioni.annullaRichiesta, 'Richiesta annullata');
  const tot = richiesta.giocatori.length;
  const n = accettate(richiesta);
  const completa = n >= tot;
  const mancanti = richiesta.giocatori.filter((g) => !richiesta.accettazioni[g]);
  const devoAccettare = !!ctx.uid && mancanti.includes(ctx.uid);
  const giocatore = !!ctx.mioLato;
  const campo = nomeCampo(ctx.campi, richiesta.campoId);
  const orario = `${labelDate(richiesta.data)} alle ${richiesta.inizio}`;
  // the earlier of the server expiry and the slot start (critique M1)
  const scad = scadenzaEffettiva(richiesta);
  const tra = traQuanto(scad, now);
  const urgente = scad - now < 2 * 3_600_000;

  // polite announcement of realtime changes ("Marta ha accettato: 4 su 4")
  const prima = useRef<Record<string, boolean> | null>(null);
  const [annuncio, setAnnuncio] = useState('');
  useEffect(() => {
    const ora = Object.fromEntries(richiesta.giocatori.map((g) => [g, !!richiesta.accettazioni[g]]));
    const prev = prima.current;
    prima.current = ora;
    if (!prev) return;
    const nuovi = richiesta.giocatori.filter((g) => ora[g] && !prev[g] && g !== ctx.uid);
    if (nuovi.length) setAnnuncio(`${elencoNomi(nuovi.map((g) => nome(g)))} ${nuovi.length === 1 ? 'ha' : 'hanno'} accettato: ${n} su ${tot}`);
  }, [richiesta, n, tot, nome, ctx.uid]);

  const scadenza = (
    <Avviso icona={AlarmClock} tono={urgente ? 'danger' : 'idle'}>
      <span className="tabular">
        {tra ? `Scade ${tra}` : 'Scade a momenti'} ({quando(scad)})
      </span>
    </Avviso>
  );

  return (
    <div className="grid gap-4">
      <p className="sr-only" aria-live="polite">
        {annuncio}
      </p>
      {urgente && scadenza}
      <div className="grid gap-2">
        <p className="tabular text-xl font-bold">
          Richiesta per {labelDate(richiesta.data)} · {richiesta.inizio}–{richiesta.fine} · {campo}
        </p>
        <div className="flex flex-wrap gap-2">
          <StatoRichiestaBadge stato="attesa" />
          {richiesta.fuoriGriglia && <FuoriGrigliaBadge />}
          {richiesta.controproposta && <ControPropostaBadge />}
        </div>
        {richiesta.controproposta && (
          <p>
            Il campo propone questo orario al posto di quello che avevate chiesto.
            {richiesta.nota ? ` Nota del campo: «${richiesta.nota}».` : ''}
          </p>
        )}
        {!richiesta.controproposta && richiesta.nota && <p className="text-ink-muted">Nota per il campo: «{richiesta.nota}»</p>}
      </div>

      <ol className="grid gap-2 sm:grid-cols-2" aria-label="Avanzamento">
        <Passo numero={1} attivo={!completa} fatto={completa}>
          Accettazioni {n} su {tot}
        </Passo>
        <Passo numero={2} attivo={completa} fatto={false}>
          Conferma del campo
        </Passo>
      </ol>

      {completa && (
        <Avviso icona={Hourglass} tono="info">
          Aspettiamo la conferma del campo.
        </Avviso>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            [ctx.nomeA, partita.giocatoriA],
            [ctx.nomeB, partita.giocatoriB],
          ] as const
        ).map(([coppia, gs]) => (
          <div key={coppia} className="grid content-start gap-1">
            <p className="font-bold">{coppia}</p>
            <ul className="court-rule">
              {gs
                .filter((g) => richiesta.giocatori.includes(g))
                .map((g) => {
                  const ok = !!richiesta.accettazioni[g];
                  const stato = g === richiesta.creatoDa ? 'ha chiesto' : ok ? 'ha accettato' : 'deve accettare';
                  return (
                    <li key={g} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-1.5">
                      <span className="flex items-center gap-2">
                        {ok ? <CircleCheck className="size-5 shrink-0 text-ok-ink" aria-hidden /> : <Hourglass className="size-5 shrink-0 text-warn-ink" aria-hidden />}
                        <span>
                          <span className="font-semibold">{g === ctx.uid ? 'Tu' : nome(g)}</span>{' '}
                          <span className={ok ? 'text-ink-muted' : 'font-semibold text-warn-ink'}>· {g === ctx.uid && !ok ? 'devi accettare' : stato}</span>
                        </span>
                      </span>
                      {!ok && giocatore && g !== ctx.uid && (
                        <WhatsAppButton
                          size="sm"
                          telefono={ctx.telefono(g)}
                          testo={`${nome(g)}, manca solo la tua conferma per ${orario} (${campo}) → ${ctx.link}`}
                        >
                          Sollecita
                        </WhatsAppButton>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      {!urgente && scadenza}

      {giocatore && (
        <div className="flex flex-wrap items-center gap-2">
          {devoAccettare && (
            <Button variant="primary" size="lg" loading={accetta.isPending} onClick={() => accetta.esegui(richiesta.id)}>
              <Check aria-hidden /> Accetta
            </Button>
          )}
          <WhatsAppButton
            testo={
              mancanti.length
                ? `Ho chiesto il campo per ${orario} (${campo}). ${elencoNomi(mancanti.map((g) => nome(g)))}: accettate qui → ${ctx.link}`
                : `Abbiamo chiesto il campo per ${orario} (${campo}) per ${ctx.titolo}: aspettiamo la conferma → ${ctx.link}`
            }
          >
            Condividi su WhatsApp
          </WhatsAppButton>
          <ConfirmDialog
            open={conferma}
            onOpenChange={setConferma}
            title="Annullare la richiesta per tutti?"
            description="Il campo non la vedrà più. Potrete sceglierne un’altra subito dopo."
            confirmLabel="Annulla richiesta"
            cancelLabel="Tieni"
            loading={annulla.isPending}
            onConfirm={() => annulla.esegui({ richiesta: richiesta.id }, { onSuccess: () => setConferma(false), onError: () => setConferma(false) })}
            trigger={<Button variant="danger">Annulla richiesta</Button>}
          />
        </div>
      )}
      {devoAccettare && (
        <p className="text-sm text-ink-muted">
          Se l’orario non ti va bene, annulla la richiesta: si annulla per tutti e potrete sceglierne un altro.
        </p>
      )}
      {!giocatore && (
        <Avviso icona={Send} tono="info">
          {mancanti.length ? `Manca ancora: ${elencoNomi(mancanti.map((g) => nome(g)))}.` : 'Tutti e 4 hanno accettato.'}
        </Avviso>
      )}
    </div>
  );
}

function Passo({ numero, attivo, fatto, children }: { numero: number; attivo: boolean; fatto: boolean; children: React.ReactNode }) {
  return (
    <li
      aria-current={attivo ? 'step' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-control px-3 py-2 font-semibold',
        attivo ? 'bg-court text-court-ink' : 'border border-line text-ink-muted',
        fatto && 'text-ink',
      )}
    >
      {fatto ? <Check className="size-5 text-ok-ink" strokeWidth={3} aria-hidden /> : <span className="tabular">{numero}.</span>}
      <span className="tabular">{children}</span>
      {fatto && <span className="sr-only">(fatto)</span>}
    </li>
  );
}
