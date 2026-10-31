import { ArrowRight, Check, CircleCheck, Flag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Sezione } from '../../components/PageHeader';
import { azioni, useAzione } from '../../data/mutations';
import { prossimoPasso } from '../../lib/prossimoPasso';
import { today } from '../../lib/time';
import { gironi } from '../../lib/torneo';
import { Button, ConfirmDialog, cn } from '../../ui';
import { eccezioni, ORE_PROMEMORIA_RISULTATO, oreDa, passiTorneo, statoPrecedente } from './logic';
import { Nota } from './parti';
import type { PropsSezione } from './tipi';

const plurale = (n: number, uno: string, molti: string) => `${n} ${n === 1 ? uno : molti}`;

export default function Panoramica({ d }: PropsSezione) {
  const { torneo, periodi, squadre, partite } = d;
  const base = `/t/${torneo.id}/organizza`;
  const passo = useMemo(() => prossimoPasso(torneo, periodi, squadre, partite), [torneo, periodi, squadre, partite]);
  const ecc = useMemo(() => eccezioni(partite, periodi, today()), [partite, periodi]);
  const [conferma, setConferma] = useState(false);
  const stato = useAzione(azioni.impostaStatoTorneo, {
    successo: (_r) => (torneo.stato === 'concluso' ? 'Torneo riaperto' : 'Torneo concluso'),
    onSuccess: () => setConferma(false),
  });

  const approvate = squadre.filter((s) => s.stato === 'approvata').length;
  const pg = partite.filter((p) => p.fase === 'gironi');
  const giocate = partite.filter((p) => p.stato === 'giocata' || p.stato === 'tavolino').length;
  const aperte = partite.length - giocate;
  const nGironi = gironi(squadre).length;

  const vecchi = ecc.daConfermare.filter((p) => (oreDa(p.updatedAt) ?? 0) >= ORE_PROMEMORIA_RISULTATO).length;
  const righeEccezioni = [
    ecc.contestate.length && plurale(ecc.contestate.length, 'contestazione da decidere', 'contestazioni da decidere'),
    ecc.inRitardo.length && plurale(ecc.inRitardo.length, 'partita in ritardo', 'partite in ritardo'),
    ecc.daConfermare.length &&
      `${plurale(ecc.daConfermare.length, 'risultato da confermare', 'risultati da confermare')}${
        vecchi ? ` (${vecchi} da più di 2 giorni)` : ''
      }`,
    ecc.inScadenza.length &&
      `${plurale(ecc.inScadenza.length, 'partita ancora da programmare', 'partite ancora da programmare')} con il periodo che finisce entro 7 giorni`,
  ].filter(Boolean) as string[];

  const concluso = torneo.stato === 'concluso';
  const precedente = statoPrecedente(torneo, partite);

  return (
    <div className="grid gap-8">
      <Sezione titolo="Fase del torneo" id="org-fase">
        <ol className="relative grid grid-cols-4 gap-1" aria-label="Fasi del torneo">
          <span aria-hidden className="absolute top-3 right-[12.5%] left-[12.5%] h-px bg-line-strong" />
          {passiTorneo(torneo.stato).map((p) => (
            <li key={p.stato} aria-current={p.passo === 'corrente' ? 'step' : undefined} className="relative grid justify-items-center gap-1.5 text-center">
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full border-2',
                  p.passo === 'fatto' && 'border-court bg-court text-court-ink',
                  p.passo === 'corrente' && 'border-court bg-surface ring-4 ring-info-soft',
                  p.passo === 'futuro' && 'border-line-strong bg-surface',
                )}
              >
                {p.passo === 'fatto' && <Check className="size-4" strokeWidth={3} aria-hidden />}
                {p.passo === 'corrente' && <span className="size-2.5 rounded-full bg-court" aria-hidden />}
              </span>
              <span className={cn('text-sm', p.passo === 'corrente' ? 'font-bold text-ink' : p.passo === 'fatto' ? 'text-ink' : 'text-ink-muted')}>
                {p.label}
                <span className="sr-only">{p.passo === 'fatto' ? ', completata' : p.passo === 'corrente' ? ', in corso' : ', da fare'}</span>
              </span>
            </li>
          ))}
        </ol>
      </Sezione>

      <Sezione titolo="Prossimo passo" id="org-passo">
        {passo ? (
          <div className="grid justify-items-start gap-3">
            <p className="text-ink-muted">
              {passo.id === 'periodi' && 'Senza un periodo le partite dei gironi non hanno una scadenza.'}
              {passo.id === 'approva-squadre' && 'Ci sono coppie iscritte che aspettano la tua approvazione.'}
              {passo.id === 'gironi' && `${plurale(passo.n, 'coppia approvata non ha', 'coppie approvate non hanno')} ancora un girone.`}
              {passo.id === 'calendario' && 'Coppie e gironi sono pronti: controlla l’anteprima e genera le partite.'}
              {passo.id === 'finali' && 'I gironi sono conclusi: risolvi eventuali pari merito e genera i tabelloni.'}
              {passo.id === 'sincronizza' && `${plurale(passo.n, 'partita del tabellone ha', 'partite del tabellone hanno')} nuove coppie qualificate da scrivere.`}
            </p>
            <Button asChild variant="primary" size="lg">
              <Link to={`${base}/${passo.sezione}`}>
                {passo.label}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        ) : (
          <Nota tono="ok" icon={CircleCheck}>
            {concluso ? 'Il torneo è concluso.' : 'Tutto in ordine: non c’è niente che aspetti te.'}
          </Nota>
        )}
      </Sezione>

      <Sezione titolo="In breve" id="org-breve">
        <p className="tabular">
          {plurale(approvate, 'coppia approvata', 'coppie approvate')}
          {nGironi > 0 && ` in ${plurale(nGironi, 'girone', 'gironi')}`} · {plurale(periodi.length, 'periodo', 'periodi')}
          {partite.length > 0 && ` · ${giocate} partite concluse su ${partite.length}`}
          {pg.length === 0 && ' · calendario non ancora generato'}
        </p>
        {righeEccezioni.length ? (
          <ul className="court-rule">
            {righeEccezioni.map((r) => (
              <li key={r}>
                <Link to={`${base}/monitoraggio`} className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-control px-2 py-2 hover:bg-surface-2">
                  <span>{r}</span>
                  <ArrowRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">Nessuna partita in ritardo e nessuna contestazione.</p>
        )}
      </Sezione>

      <Sezione titolo="Gestione torneo" id="org-stato">
        <p className="max-w-prose text-ink-muted">
          {concluso
            ? 'Il torneo è concluso: classifiche e tabelloni restano visibili a tutti. Se serve correggere qualcosa, riaprilo.'
            : torneo.stato === 'fasiFinali'
              ? 'Quando l’ultima finale è giocata, segna il torneo come concluso. Potrai riaprirlo da qui.'
              : 'Il torneo si conclude di solito dopo le finali. Se devi chiuderlo prima, puoi farlo da qui e riaprirlo in seguito.'}
        </p>
        <ConfirmDialog
          open={conferma}
          onOpenChange={setConferma}
          title={concluso ? 'Riaprire il torneo?' : 'Concludere il torneo?'}
          description={
            concluso
              ? 'Il torneo torna alla fase in cui era e le partite si possono di nuovo programmare.'
              : aperte > 0
                ? `Ci sono ancora ${plurale(aperte, 'partita non conclusa', 'partite non concluse')}. Il torneo passa a «Concluso» e nessuno le programmerà più.`
                : 'Il torneo passa a «Concluso». Classifiche e tabelloni restano visibili.'
          }
          confirmLabel={concluso ? 'Riapri il torneo' : 'Concludi il torneo'}
          tone={concluso ? 'primary' : 'danger'}
          loading={stato.isPending}
          onConfirm={() => stato.mutate({ torneo: torneo.id, stato: concluso ? precedente : 'concluso' })}
          trigger={
            <Button variant={concluso || torneo.stato === 'fasiFinali' ? 'secondary' : 'ghost'} className="justify-self-start">
              <Flag aria-hidden />
              {concluso ? 'Riapri il torneo' : 'Concludi il torneo'}
            </Button>
          }
        />
      </Sezione>
    </div>
  );
}
