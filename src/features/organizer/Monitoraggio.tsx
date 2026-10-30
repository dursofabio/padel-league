import { useMemo, useState } from 'react';
import { MatchRow } from '../../components/MatchRow';
import { Sezione } from '../../components/PageHeader';
import { ICONE } from '../../components/StatusBadge';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { useCampi } from '../../data/queries';
import { STATO_PARTITA } from '../../lib/copy';
import { labelDate, today } from '../../lib/time';
import { gironi, nomeSquadra } from '../../lib/torneo';
import { appUrl } from '../../lib/whatsapp';
import type { Partita, StatoPartita } from '../../types';
import { Field, Select } from '../../ui';
import { eccezioni } from './logic';
import type { PropsSezione } from './tipi';

const STATI: StatoPartita[] = ['da programmare', 'richiesta', 'programmata', 'giocata', 'contestata', 'tavolino'];

export default function Monitoraggio({ d }: PropsSezione) {
  const { torneo, periodi, partite, squadre, squadraById } = d;
  const campi = useCampi();
  const [periodo, setPeriodo] = useState('');
  const [girone, setGirone] = useState('');
  const oggi = today();

  const filtrate = useMemo(
    () => partite.filter((p) => (!periodo || p.periodoId === periodo) && (!girone || p.girone === girone)),
    [partite, periodo, girone],
  );
  const e = useMemo(() => eccezioni(filtrate, periodi, oggi), [filtrate, periodi, oggi]);
  const perId = new Map(periodi.map((p) => [p.id, p]));
  const href = (p: Partita) => `/t/${torneo.id}/partite/${p.id}`;
  const riga = (p: Partita, nota?: React.ReactNode) => (
    <li key={p.id}>
      <MatchRow p={p} squadraById={squadraById} campi={campi.data ?? []} href={href(p)} nota={nota} />
    </li>
  );
  const fine = (p: Partita) => (p.periodoId ? perId.get(p.periodoId) : undefined);
  const nessuna = !e.contestate.length && !e.inRitardo.length && !e.daConfermare.length && !e.inScadenza.length;
  const periodiAperti = periodi.filter((p) => p.inizio <= oggi && filtrate.some((x) => x.periodoId === p.id));

  if (!partite.length)
    return <p className="text-ink-muted">Le partite compaiono qui dopo aver generato il calendario. Nessuna partita in ritardo e nessuna contestazione.</p>;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap gap-3">
        <Field label="Periodo" className="min-w-48">
          {(p) => (
            <Select {...p} value={periodo} onChange={(ev) => setPeriodo(ev.target.value)}>
              <option value="">Tutti i periodi</option>
              {periodi.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.etichetta}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Girone" className="min-w-40">
          {(p) => (
            <Select {...p} value={girone} onChange={(ev) => setGirone(ev.target.value)}>
              <option value="">Tutti i gironi</option>
              {gironi(squadre).map((g) => (
                <option key={g} value={g}>
                  Girone {g}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {nessuna && <p className="text-ink-muted">Nessuna partita in ritardo e nessuna contestazione.</p>}

      {e.contestate.length > 0 && (
        <Sezione titolo={`Contestazioni (${e.contestate.length})`} id="mon-contestate">
          <p className="text-ink-muted">Apri la partita: da lì fissi il risultato ufficiale o assegni il tavolino.</p>
          <ul className="court-rule">{e.contestate.map((p) => riga(p, p.risultato?.nota ? `«${p.risultato.nota}»` : undefined))}</ul>
        </Sezione>
      )}

      {e.inRitardo.length > 0 && (
        <Sezione titolo={`Partite in ritardo (${e.inRitardo.length})`} id="mon-ritardo">
          <p className="text-ink-muted">Il periodo è finito e la partita non è stata giocata: sollecita le coppie o decidi dalla pagina della partita.</p>
          <ul className="court-rule">
            {e.inRitardo.map((p) => (
              <li key={p.id} className="grid gap-1 pb-3">
                <MatchRow
                  p={p}
                  squadraById={squadraById}
                  campi={campi.data ?? []}
                  href={href(p)}
                  nota={<span className="tabular">periodo finito il {labelDate(fine(p)!.fine)}</span>}
                />
                <WhatsAppButton
                  size="sm"
                  className="justify-self-start"
                  testo={`Ciao, la partita ${nomeSquadra(squadraById, p.squadraA)} contro ${nomeSquadra(squadraById, p.squadraB)} doveva essere giocata entro il ${labelDate(fine(p)!.fine)}. Programmatela appena potete: ${appUrl(href(p))}`}
                >
                  Scrivi alla coppia
                </WhatsAppButton>
              </li>
            ))}
          </ul>
        </Sezione>
      )}

      {e.daConfermare.length > 0 && (
        <Sezione titolo={`Risultati da confermare (${e.daConfermare.length})`} id="mon-confermare">
          <p className="text-ink-muted">Una coppia ha inserito il risultato e l’altra non l’ha ancora confermato.</p>
          <ul className="court-rule">{e.daConfermare.map((p) => riga(p))}</ul>
        </Sezione>
      )}

      {e.inScadenza.length > 0 && (
        <Sezione titolo={`Da programmare, periodo in scadenza (${e.inScadenza.length})`} id="mon-scadenza">
          <ul className="court-rule">
            {e.inScadenza.map((p) => riga(p, <span className="tabular">entro il {labelDate(fine(p)!.fine)}</span>))}
          </ul>
        </Sezione>
      )}

      {periodiAperti.length > 0 && (
        <Sezione titolo="Andamento per periodo" id="mon-periodi">
          <ul className="court-rule">
            {periodiAperti.map((per) => {
              const pp = filtrate.filter((x) => x.periodoId === per.id);
              return (
                <li key={per.id} className="grid gap-1.5 py-3">
                  <p className="font-bold">
                    {per.etichetta}{' '}
                    <span className="tabular font-normal text-ink-muted">
                      · {labelDate(per.inizio)} – {labelDate(per.fine)} · {pp.length} partite
                    </span>
                  </p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {STATI.map((s) => {
                      const n = pp.filter((x) => x.stato === s).length;
                      if (!n) return null;
                      const Icon = ICONE[STATO_PARTITA[s].icona];
                      return (
                        <li key={s} className="tabular inline-flex items-center gap-1.5">
                          <Icon className="size-4 text-ink-muted" aria-hidden />
                          {STATO_PARTITA[s].label.toLowerCase()} {n}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Sezione>
      )}
    </div>
  );
}
