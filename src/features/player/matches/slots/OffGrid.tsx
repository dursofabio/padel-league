/**
 * Off-grid proposal (only when config.consentiFuoriGriglia): court, day, start in passoFuoriGriglia steps,
 * computed end, live checks, mini lanes preview of the grid slots it makes unusable, who must accept.
 * The server computes fuori_griglia and the acceptances; it stays the authority.
 */
import { Ban, CircleCheck, Hourglass, Send, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CourtLanes, LaneBlock, type LanesScala } from '../../../../components/CourtLanes';
import { azioni } from '../../../../data/mutations';
import { fasciaCopre, isSlotDiGriglia, occupazioniId, slotGriglia, slotImpattati, verificaFuoriGriglia } from '../../../../lib/slots';
import { addMin, labelDate, overlaps, toMin, today } from '../../../../lib/time';
import type { Campo, Fasce, Occupazione, Richiesta } from '../../../../types';
import { Button, Field, Segmented, Select, Sheet } from '../../../../ui';
import type { ContestoPartita } from '../contesto';
import { descriviOccupazione, elencoNomi, opzioniInizio } from '../logica';
import { Avviso, useOra } from '../parti';
import { useAzionePartita } from '../useAzionePartita';

export function OffGrid({
  ctx,
  giorni,
  campi,
  occupazioni,
  richieste,
  fasce,
  iniziale,
  onClose,
}: {
  ctx: ContestoPartita;
  giorni: string[];
  campi: Campo[];
  occupazioni: Record<string, Record<string, Occupazione>>;
  richieste: Richiesta[];
  fasce: Record<string, Fasce | undefined>;
  iniziale: { campoId?: string; data?: string };
  onClose: () => void;
}) {
  const passo = ctx.torneo.config.passoFuoriGriglia;
  const now = useOra();
  const oggi = today();
  const [campoId, setCampoId] = useState(iniziale.campoId ?? campi[0]?.id ?? '');
  const [data, setData] = useState(iniziale.data && giorni.includes(iniziale.data) ? iniziale.data : giorni[0]);
  const oraMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const opzioni = useMemo(() => opzioniInizio(passo, data, oggi, oraMin), [passo, data, oggi, oraMin]);
  const [inizioScelto, setInizio] = useState('');
  const inizio = opzioni.includes(inizioScelto) ? inizioScelto : (opzioni.find((o) => o >= '15:00') ?? opzioni[0] ?? '');
  const campo = campi.find((c) => c.id === campoId) ?? campi[0];
  const invia = useAzionePartita(azioni.creaRichiesta, 'Proposta inviata al campo', passo);

  const fine = campo && inizio ? addMin(inizio, campo.durata) : '';
  const occ = campo ? occupazioni[occupazioniId(campo.id, data)] : undefined;
  const verifica = campo && inizio ? verificaFuoriGriglia(campo, data, inizio, occ, richieste, now) : null;
  const stessoInizio = verifica?.richiesteSovrapposte.some((r) => r.inizio === inizio);
  const impattati = campo && inizio ? slotImpattati(campo, data, inizio, fine) : [];
  const diGriglia = campo && inizio ? isSlotDiGriglia(campo, data, inizio) : false;

  const errori: string[] = [];
  if (!campo) errori.push('Non ci sono campi configurati.');
  else if (!inizio) errori.push('Non ci sono più orari disponibili in questo giorno: scegline un altro.');
  if (verifica?.fuoriOrario) errori.push('Il campo è chiuso a quell’ora.');
  if (verifica?.bloccanti.length) errori.push(`Si sovrappone a: ${verifica.bloccanti.map(descriviOccupazione).join(', ')}.`);
  if (stessoInizio) errori.push('Questo orario è già stato chiesto per un’altra partita.');
  const avvisoRichieste = !stessoInizio && !!verifica?.richiesteSovrapposte.length;

  const subito = ctx.partita.giocatori.filter((g) => g === ctx.uid || (fine && fasciaCopre(fasce[g], data, inizio, fine)));
  const devono = ctx.partita.giocatori.filter((g) => !subito.includes(g));
  const chi = (g: string) => (g === ctx.uid ? 'tu' : ctx.nome(g));

  // mini lanes: ± 2 h around the proposal
  const scala: LanesScala | null = fine
    ? { da: Math.max(0, Math.floor((toMin(inizio) - 120) / 30) * 30), a: Math.min(24 * 60, Math.ceil((toMin(fine) + 120) / 30) * 30), px: 0.7 }
    : null;

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Proponi un orario fuori griglia"
      description="Per un orario diverso da quelli della griglia: devono accettare tutti e 4, poi decide il campo."
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          disabled={errori.length > 0}
          loading={invia.isPending}
          onClick={() => invia.esegui({ partita: ctx.partita.id, campo: campo.id, data, inizio }, { onSuccess: onClose })}
        >
          <Send aria-hidden /> Invia proposta
        </Button>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">Campo</span>
          <Segmented label="Campo" value={campoId} onValueChange={setCampoId} options={campi.map((c) => ({ value: c.id, label: c.nome }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giorno">
            {(p) => (
              <Select {...p} value={data} onChange={(e) => setData(e.target.value)}>
                {giorni.map((g) => (
                  <option key={g} value={g}>
                    {labelDate(g)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Inizio" hint={fine ? `fine ${fine}, ${campo.durata} minuti` : undefined}>
            {(p) => (
              <Select {...p} value={inizio} onChange={(e) => setInizio(e.target.value)} disabled={!opzioni.length}>
                {opzioni.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div aria-live="polite" className="grid gap-2">
          {errori.map((e) => (
            <Avviso key={e} icona={TriangleAlert} tono="danger">
              {e}
            </Avviso>
          ))}
          {avvisoRichieste && (
            <Avviso icona={TriangleAlert} tono="warn">
              Si sovrappone a un’altra richiesta in attesa: il campo potrà confermarne una sola.
            </Avviso>
          )}
          {diGriglia && <Avviso icona={CircleCheck}>Questo è un orario della griglia: la richiesta sarà normale.</Avviso>}
          {!errori.length && impattati.length > 0 && (
            <Avviso icona={Ban}>
              Rende inutilizzabili gli slot delle {elencoNomi(impattati.map((s) => s.inizio))} sul {campo.nome}.
            </Avviso>
          )}
        </div>

        {scala && campo && (
          <CourtLanes
            caption={<span className="tabular">{labelDate(data)}: anteprima</span>}
            campi={campi}
            scala={scala}
            renderLane={(c) => {
              const slots = slotGriglia(c, data).filter((s) => overlaps(s.inizio, s.fine, addMin('00:00', scala.da), addMin('00:00', scala.a)));
              const occs = Object.values(occupazioni[occupazioniId(c.id, data)] ?? {});
              const impatto = c.id === campo.id ? impattati.map((s) => s.inizio) : [];
              return (
                <>
                  {slots.map((s) =>
                    impatto.includes(s.inizio) ? (
                      <LaneBlock key={s.inizio} scala={scala} inizio={s.inizio} fine={s.fine} tono="idle" pattern="hatch" ariaLabel={`${c.nome} ${s.inizio}, inutilizzabile`}>
                        <span className="tabular flex items-center gap-1 text-xs font-semibold">
                          <Ban className="size-3.5" aria-hidden /> {s.inizio} inutilizzabile
                        </span>
                      </LaneBlock>
                    ) : (
                      <LaneBlock key={s.inizio} scala={scala} inizio={s.inizio} fine={s.fine} tono="idle" ariaLabel={`${c.nome} ${s.inizio}, slot di griglia`}>
                        <span className="tabular text-xs">{s.inizio}</span>
                      </LaneBlock>
                    ),
                  )}
                  {occs.map((o, i) => (
                    <LaneBlock key={`o${i}`} scala={scala} inizio={o.inizio} fine={o.fine} tono="danger" pattern="hatch" sfalsato ariaLabel={descriviOccupazione(o)}>
                      <span className="text-xs font-semibold">{descriviOccupazione(o)}</span>
                    </LaneBlock>
                  ))}
                  {c.id === campo.id && fine && (
                    <LaneBlock scala={scala} inizio={inizio} fine={fine} tono="info" sfalsato className="z-10 border-2" ariaLabel={`Proposta ${inizio}–${fine}`}>
                      <span className="tabular flex items-center gap-1 text-xs font-bold">
                        <Send className="size-3.5" aria-hidden /> Proposta {inizio}–{fine}
                      </span>
                    </LaneBlock>
                  )}
                </>
              );
            }}
          />
        )}

        {fine && (
          <div className="grid gap-1">
            <Avviso icona={CircleCheck} tono="ok">
              Accettano subito: {elencoNomi(subito.map(chi))}.
            </Avviso>
            {devono.length > 0 && (
              <Avviso icona={Hourglass} tono="warn">
                {devono.length === 1 ? 'Deve' : 'Devono'} accettare: {elencoNomi(devono.map(chi))}.
              </Avviso>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
