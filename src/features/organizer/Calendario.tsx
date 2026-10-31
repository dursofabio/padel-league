import { ArrowRight, CalendarCheck, Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Sezione } from '../../components/PageHeader';
import { azioni, useAzione } from '../../data/mutations';
import { useCampi, useRicorrenze } from '../../data/queries';
import { contaSlot } from '../../lib/slots';
import { nomeSquadra } from '../../lib/torneo';
import { Button, ConfirmDialog } from '../../ui';
import { giorniPeriodo, occupazioniDaRicorrenze, periodiGironi, pianoCalendario, prng, squadrePerGirone, valutaCapienza } from './logic';
import { Nota, Precondizione } from './parti';
import type { PropsSezione } from './tipi';

export default function Calendario({ d }: PropsSezione) {
  const { torneo, squadre, periodi, partite, squadraById } = d;
  const pg = partite.filter((p) => p.fase === 'gironi');
  const [seme, setSeme] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [conferma, setConferma] = useState(false);
  const [esito, setEsito] = useState<number | null>(null);
  const piano = useMemo(() => pianoCalendario(squadre, periodi, prng(seme)), [squadre, periodi, seme]);
  const genera = useAzione(azioni.generaCalendario, {
    successo: (n) => `${n} partite create`,
    onSuccess: (n) => {
      setConferma(false);
      setEsito(Number(n));
    },
  });

  const campi = useCampi();
  const ric = useRicorrenze();
  const perGironi = periodiGironi(periodi);
  const capienzaOk = useMemo(() => {
    if (!campi.data || !ric.data || !perGironi.length) return null;
    return perGironi.every((p) => {
      const giorni = giorniPeriodo(p);
      const n = piano.partite.filter((x) => x.periodo_id === p.id).length;
      return (valutaCapienza(contaSlot(campi.data, giorni, occupazioniDaRicorrenze(ric.data, giorni)), n, giorni.length).rapporto ?? 3) >= 1.5;
    });
  }, [campi.data, ric.data, perGironi, piano.partite]);

  const linkCalendario = (
    <Link to={`/t/${torneo.id}/calendario`} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-court underline dark:text-info-ink">
      Vedi il calendario pubblico <ArrowRight className="size-4" aria-hidden />
    </Link>
  );

  if (pg.length)
    return (
      <Sezione titolo="Calendario dei gironi" id="cal-fatto">
        <div aria-live="polite">
          <Nota tono="ok" icon={CalendarCheck}>
            {esito ? `${esito} partite create.` : `Calendario generato: ${pg.length} partite.`} I gironi ora sono bloccati.
          </Nota>
        </div>
        <div className="flex flex-wrap gap-x-6">
          {linkCalendario}
          <Link
            to={`/t/${torneo.id}/organizza/monitoraggio`}
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-court underline dark:text-info-ink"
          >
            Segui l’andamento in Monitoraggio <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Sezione>
    );

  const gruppi = squadrePerGirone(squadre);
  const approvate = squadre.filter((s) => s.stato === 'approvata');
  const senzaGirone = approvate.filter((s) => !s.girone).length;
  const daApprovare = squadre.filter((s) => s.stato === 'da approvare').length;
  const dimensioni = [...gruppi.values()].map((l) => l.length);
  const bilanciati = dimensioni.length > 0 && Math.max(...dimensioni) - Math.min(...dimensioni) <= 1;
  const totale = piano.partite.length;
  const pronto = gruppi.size > 0 && dimensioni.every((n) => n >= 2) && senzaGirone === 0;
  const base = `/t/${torneo.id}/organizza`;

  return (
    <div className="grid gap-8">
      <Sezione titolo="Prima di generare" id="cal-pre">
        <ul className="court-rule">
          <Precondizione ok={approvate.length > 0 && senzaGirone === 0 && gruppi.size > 0}>
            {approvate.length} coppie approvate in {gruppi.size} {gruppi.size === 1 ? 'girone' : 'gironi'}
            {senzaGirone > 0 && (
              <>
                {` · ${senzaGirone} senza girone: `}
                <Link to={`${base}/squadre`} className="font-semibold underline">
                  componi i gironi
                </Link>
              </>
            )}
          </Precondizione>
          <Precondizione ok={daApprovare === 0} avviso>
            {daApprovare === 0 ? 'Nessuna coppia in attesa di approvazione' : `${daApprovare} coppie ancora da approvare: resteranno fuori dal calendario`}
          </Precondizione>
          <Precondizione ok={bilanciati} avviso>
            {dimensioni.length ? `Gironi ${bilanciati ? 'bilanciati' : 'sbilanciati'} (${dimensioni.join(' e ')})` : 'Gironi non ancora composti'}
          </Precondizione>
          <Precondizione ok={perGironi.length > 0} avviso>
            {perGironi.length ? (
              `Periodo dei gironi presente (${perGironi.length})`
            ) : (
              <>
                Nessun periodo dei gironi: le partite non avranno scadenza.{' '}
                <Link to={`${base}/periodi`} className="font-semibold underline">
                  Aggiungi un periodo
                </Link>
              </>
            )}
          </Precondizione>
          {capienzaOk !== null && (
            <Precondizione ok={capienzaOk} avviso>
              {capienzaOk ? 'Capienza sufficiente nei periodi' : 'Capienza stretta in almeno un periodo: controlla in Periodi'}
            </Precondizione>
          )}
        </ul>
      </Sezione>

      {pronto && (
        <Sezione titolo="Anteprima" id="cal-anteprima">
          <ul className="court-rule">
            {piano.gironi.map((g) => {
              const prima = piano.partite.filter((p) => p.girone === g.girone && p.turno === 1);
              return (
                <li key={g.girone} className="grid gap-2 py-3">
                  <h3 className="font-bold">
                    Girone {g.girone}: <span className="tabular">{g.partite} partite in {g.giornate} giornate</span>
                  </h3>
                  <p className="tabular text-ink-muted">
                    {g.blocchi
                      .map((b) => `${b.da === b.a ? `Giornata ${b.da}` : `Giornate ${b.da}–${b.a}`} ${b.periodoId ? `nel ${b.etichetta}` : 'senza periodo'}`)
                      .join(', ')}
                  </p>
                  <details>
                    <summary className="min-h-11 cursor-pointer content-center font-semibold">Prima giornata</summary>
                    <ul className="court-rule">
                      {prima.map((p) => (
                        <li key={p.codice} className="py-2">
                          {nomeSquadra(squadraById, p.squadra_a)} <span className="text-ink-muted">contro</span> {nomeSquadra(squadraById, p.squadra_b)}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              open={conferma}
              onOpenChange={setConferma}
              title={`Generare ${totale} partite?`}
              description="Dopo non potrai più cambiare i gironi. Il torneo passa alla fase a gironi."
              confirmLabel="Genera il calendario"
              tone="primary"
              loading={genera.isPending}
              onConfirm={() => genera.mutate({ torneo: torneo.id, partite: piano.partite })}
              trigger={
                <Button variant="primary" size="lg">
                  <CalendarCheck aria-hidden /> Genera il calendario
                </Button>
              }
            />
            <Button variant="secondary" size="lg" onClick={() => setSeme(Math.floor(Math.random() * 2 ** 31))}>
              <Shuffle aria-hidden /> Rimescola gli accoppiamenti
            </Button>
          </div>
        </Sezione>
      )}
    </div>
  );
}
