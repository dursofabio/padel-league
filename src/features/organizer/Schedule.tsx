import { ArrowRight, CalendarCheck, Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Section } from '../../components/PageHeader';
import { actions, useAction } from '../../data/mutations';
import { useCourts, useRecurrences } from '../../data/queries';
import { countSlots } from '../../lib/slots';
import { teamName } from '../../lib/tournament';
import { Button, ConfirmDialog } from '../../ui';
import { assessCapacity, bookingsFromRecurrences, groupPeriods, periodDates, planCalendar, prng, teamsByGroup } from './logic';
import { Note, Precondition } from './parts';
import type { SectionProps } from './types';

export default function Schedule({ d }: SectionProps) {
  const { tournament, teams, periods, matches, teamById } = d;
  const groupMatches = matches.filter((m) => m.phase === 'groups');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [confirming, setConfirming] = useState(false);
  const [created, setCreated] = useState<number | null>(null);
  const plan = useMemo(() => planCalendar(teams, periods, prng(seed)), [teams, periods, seed]);
  const generate = useAction(actions.generateCalendar, {
    success: (n) => `${n} partite create`,
    onSuccess: (n) => {
      setConfirming(false);
      setCreated(Number(n));
    },
  });

  const courts = useCourts();
  const rec = useRecurrences();
  const groupPers = groupPeriods(periods);
  const capacityOk = useMemo(() => {
    if (!courts.data || !rec.data || !groupPers.length) return null;
    return groupPers.every((p) => {
      const days = periodDates(p);
      const n = plan.matches.filter((x) => x.period_id === p.id).length;
      return (assessCapacity(countSlots(courts.data, days, bookingsFromRecurrences(rec.data, days)), n, days.length).ratio ?? 3) >= 1.5;
    });
  }, [courts.data, rec.data, groupPers, plan.matches]);

  const scheduleLink = (
    <Link to={`/t/${tournament.id}/calendario`} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink underline">
      Vedi il calendario pubblico <ArrowRight className="size-4" aria-hidden />
    </Link>
  );

  if (groupMatches.length)
    return (
      <Section title="Calendario dei gironi" id="cal-done">
        <div aria-live="polite">
          <Note tone="ok" icon={CalendarCheck}>
            {created ? `${created} partite create.` : `Calendario generato: ${groupMatches.length} partite.`} I gironi ora sono bloccati.
          </Note>
        </div>
        <div className="flex flex-wrap gap-x-6">
          {scheduleLink}
          <Link
            to={`/t/${tournament.id}/organizza/monitoraggio`}
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink underline"
          >
            Segui l’andamento in Monitoraggio <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Section>
    );

  const byGroup = teamsByGroup(teams);
  const approved = teams.filter((t) => t.status === 'approved');
  const withoutGroup = approved.filter((t) => !t.group).length;
  const toApprove = teams.filter((t) => t.status === 'pending_approval').length;
  const sizes = [...byGroup.values()].map((l) => l.length);
  const balanced = sizes.length > 0 && Math.max(...sizes) - Math.min(...sizes) <= 1;
  const total = plan.matches.length;
  const ready = byGroup.size > 0 && sizes.every((n) => n >= 2) && withoutGroup === 0;
  const base = `/t/${tournament.id}/organizza`;

  return (
    <div className="grid gap-8">
      <Section title="Prima di generare" id="cal-pre">
        <ul className="court-rule">
          <Precondition ok={approved.length > 0 && withoutGroup === 0 && byGroup.size > 0}>
            {approved.length} coppie approvate in {byGroup.size} {byGroup.size === 1 ? 'girone' : 'gironi'}
            {withoutGroup > 0 && (
              <>
                {` · ${withoutGroup} senza girone: `}
                <Link to={`${base}/squadre`} className="font-semibold underline">
                  componi i gironi
                </Link>
              </>
            )}
          </Precondition>
          <Precondition ok={toApprove === 0} warning>
            {toApprove === 0 ? 'Nessuna coppia in attesa di approvazione' : `${toApprove} coppie ancora da approvare: resteranno fuori dal calendario`}
          </Precondition>
          <Precondition ok={balanced} warning>
            {sizes.length ? `Gironi ${balanced ? 'bilanciati' : 'sbilanciati'} (${sizes.join(' e ')})` : 'Gironi non ancora composti'}
          </Precondition>
          <Precondition ok={groupPers.length > 0} warning>
            {groupPers.length ? (
              `Periodo dei gironi presente (${groupPers.length})`
            ) : (
              <>
                Nessun periodo dei gironi: le partite non avranno scadenza.{' '}
                <Link to={`${base}/periodi`} className="font-semibold underline">
                  Aggiungi un periodo
                </Link>
              </>
            )}
          </Precondition>
          {capacityOk !== null && (
            <Precondition ok={capacityOk} warning>
              {capacityOk ? 'Capienza sufficiente nei periodi' : 'Capienza stretta in almeno un periodo: controlla in Periodi'}
            </Precondition>
          )}
        </ul>
      </Section>

      {ready && (
        <Section title="Anteprima" id="cal-preview">
          <ul className="court-rule">
            {plan.groups.map((g) => {
              const first = plan.matches.filter((m) => m.group_name === g.group && m.round === 1);
              return (
                <li key={g.group} className="grid gap-2 py-3">
                  <h3 className="font-bold">
                    Girone {g.group}: <span className="tabular">{g.matches} partite in {g.matchdays} giornate</span>
                  </h3>
                  <p className="tabular text-ink-muted">
                    {g.blocks
                      .map((b) => `${b.from === b.to ? `Giornata ${b.from}` : `Giornate ${b.from}–${b.to}`} ${b.periodId ? `nel ${b.label}` : 'senza periodo'}`)
                      .join(', ')}
                  </p>
                  <details>
                    <summary className="min-h-11 cursor-pointer content-center font-semibold">Prima giornata</summary>
                    <ul className="court-rule">
                      {first.map((m) => (
                        <li key={m.code} className="py-2">
                          {teamName(teamById, m.team_a)} <span className="text-ink-muted">contro</span> {teamName(teamById, m.team_b)}
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
              open={confirming}
              onOpenChange={setConfirming}
              title={`Generare ${total} partite?`}
              description="Dopo non potrai più cambiare i gironi. Il torneo passa alla fase a gironi."
              confirmLabel="Genera il calendario"
              tone="primary"
              loading={generate.isPending}
              onConfirm={() => generate.mutate({ tournament: tournament.id, matches: plan.matches })}
              trigger={
                <Button variant="primary" size="lg">
                  <CalendarCheck aria-hidden /> Genera il calendario
                </Button>
              }
            />
            <Button variant="secondary" size="lg" onClick={() => setSeed(Math.floor(Math.random() * 2 ** 31))}>
              <Shuffle aria-hidden /> Rimescola gli accoppiamenti
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}
