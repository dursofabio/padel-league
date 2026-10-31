import { ArrowRight, Check, CircleCheck, Flag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Section } from '../../components/PageHeader';
import { actions, useAction } from '../../data/mutations';
import { nextStep } from '../../lib/nextStep';
import { today } from '../../lib/time';
import { groups } from '../../lib/tournament';
import { Button, ConfirmDialog, cn } from '../../ui';
import { exceptions, hoursSince, phaseSteps, previousStatus, RESULT_REMINDER_HOURS } from './logic';
import { Note } from './parts';
import type { SectionProps } from './types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Overview({ d }: SectionProps) {
  const { tournament, periods, teams, matches } = d;
  const base = `/t/${tournament.id}/organizza`;
  const step = useMemo(() => nextStep(tournament, periods, teams, matches), [tournament, periods, teams, matches]);
  const exc = useMemo(() => exceptions(matches, periods, today()), [matches, periods]);
  const [confirming, setConfirming] = useState(false);
  const status = useAction(actions.setTournamentStatus, {
    success: (_r) => (tournament.status === 'completed' ? 'Torneo riaperto' : 'Torneo concluso'),
    onSuccess: () => setConfirming(false),
  });

  const approved = teams.filter((t) => t.status === 'approved').length;
  const groupMatches = matches.filter((m) => m.phase === 'groups');
  const played = matches.filter((m) => m.status === 'played' || m.status === 'forfeit').length;
  const open = matches.length - played;
  const groupCount = groups(teams).length;

  const old = exc.toConfirm.filter((m) => (hoursSince(m.updatedAt) ?? 0) >= RESULT_REMINDER_HOURS).length;
  const exceptionLines = [
    exc.disputed.length && plural(exc.disputed.length, 'contestazione da decidere', 'contestazioni da decidere'),
    exc.late.length && plural(exc.late.length, 'partita in ritardo', 'partite in ritardo'),
    exc.toConfirm.length &&
      `${plural(exc.toConfirm.length, 'risultato da confermare', 'risultati da confermare')}${
        old ? ` (${old} da più di 2 giorni)` : ''
      }`,
    exc.endingSoon.length &&
      `${plural(exc.endingSoon.length, 'partita ancora da programmare', 'partite ancora da programmare')} con il periodo che finisce entro 7 giorni`,
  ].filter(Boolean) as string[];

  const completed = tournament.status === 'completed';
  const previous = previousStatus(tournament, matches);

  return (
    <div className="grid gap-8">
      <Section title="Fase del torneo" id="org-phase">
        <ol className="relative grid grid-cols-4 gap-1" aria-label="Fasi del torneo">
          <span aria-hidden className="absolute top-3 right-[12.5%] left-[12.5%] h-px bg-line-strong" />
          {phaseSteps(tournament.status).map((p) => (
            <li key={p.status} aria-current={p.step === 'current' ? 'step' : undefined} className="relative grid justify-items-center gap-1.5 text-center">
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full border-2',
                  p.step === 'done' && 'border-court bg-court text-court-ink',
                  p.step === 'current' && 'border-court bg-surface ring-4 ring-info-soft',
                  p.step === 'future' && 'border-line-strong bg-surface',
                )}
              >
                {p.step === 'done' && <Check className="size-4" strokeWidth={3} aria-hidden />}
                {p.step === 'current' && <span className="size-2.5 rounded-full bg-court" aria-hidden />}
              </span>
              <span className={cn('text-sm', p.step === 'current' ? 'font-bold text-ink' : p.step === 'done' ? 'text-ink' : 'text-ink-muted')}>
                {p.label}
                <span className="sr-only">{p.step === 'done' ? ', completata' : p.step === 'current' ? ', in corso' : ', da fare'}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Prossimo passo" id="org-next-step">
        {step ? (
          <div className="grid justify-items-start gap-3">
            <p className="text-ink-muted">
              {step.id === 'periods' && 'Senza un periodo le partite dei gironi non hanno una scadenza.'}
              {step.id === 'approve-teams' && 'Ci sono coppie iscritte che aspettano la tua approvazione.'}
              {step.id === 'groups' && `${plural(step.n, 'coppia approvata non ha', 'coppie approvate non hanno')} ancora un girone.`}
              {step.id === 'schedule' && 'Coppie e gironi sono pronti: controlla l’anteprima e genera le partite.'}
              {step.id === 'finals' && 'I gironi sono conclusi: risolvi eventuali pari merito e genera i tabelloni.'}
              {step.id === 'sync' && `${plural(step.n, 'partita del tabellone ha', 'partite del tabellone hanno')} nuove coppie qualificate da scrivere.`}
            </p>
            <Button asChild variant="primary" size="lg">
              <Link to={`${base}/${step.section}`}>
                {step.label}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        ) : (
          <Note tone="ok" icon={CircleCheck}>
            {completed ? 'Il torneo è concluso.' : 'Tutto in ordine: non c’è niente che aspetti te.'}
          </Note>
        )}
      </Section>

      <Section title="In breve" id="org-summary">
        <p className="tabular">
          {plural(approved, 'coppia approvata', 'coppie approvate')}
          {groupCount > 0 && ` in ${plural(groupCount, 'girone', 'gironi')}`} · {plural(periods.length, 'periodo', 'periodi')}
          {matches.length > 0 && ` · ${played} partite concluse su ${matches.length}`}
          {groupMatches.length === 0 && ' · calendario non ancora generato'}
        </p>
        {exceptionLines.length ? (
          <ul className="court-rule">
            {exceptionLines.map((r) => (
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
      </Section>

      <Section title="Gestione torneo" id="org-status">
        <p className="max-w-prose text-ink-muted">
          {completed
            ? 'Il torneo è concluso: classifiche e tabelloni restano visibili a tutti. Se serve correggere qualcosa, riaprilo.'
            : tournament.status === 'finals'
              ? 'Quando l’ultima finale è giocata, segna il torneo come concluso. Potrai riaprirlo da qui.'
              : 'Il torneo si conclude di solito dopo le finali. Se devi chiuderlo prima, puoi farlo da qui e riaprirlo in seguito.'}
        </p>
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={completed ? 'Riaprire il torneo?' : 'Concludere il torneo?'}
          description={
            completed
              ? 'Il torneo torna alla fase in cui era e le partite si possono di nuovo programmare.'
              : open > 0
                ? `Ci sono ancora ${plural(open, 'partita non conclusa', 'partite non concluse')}. Il torneo passa a «Concluso» e nessuno le programmerà più.`
                : 'Il torneo passa a «Concluso». Classifiche e tabelloni restano visibili.'
          }
          confirmLabel={completed ? 'Riapri il torneo' : 'Concludi il torneo'}
          tone={completed ? 'primary' : 'danger'}
          loading={status.isPending}
          onConfirm={() => status.mutate({ tournament: tournament.id, status: completed ? previous : 'completed' })}
          trigger={
            <Button variant={completed || tournament.status === 'finals' ? 'secondary' : 'ghost'} className="justify-self-start">
              <Flag aria-hidden />
              {completed ? 'Riapri il torneo' : 'Concludi il torneo'}
            </Button>
          }
        />
      </Section>
    </div>
  );
}
