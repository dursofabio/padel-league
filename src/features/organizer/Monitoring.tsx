import { AlarmClock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MatchRow } from '../../components/MatchRow';
import { Section } from '../../components/PageHeader';
import { STATUS_ICONS } from '../../components/StatusBadge';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { useCourts } from '../../data/queries';
import { MATCH_STATUS } from '../../lib/copy';
import { labelDate, today } from '../../lib/time';
import { groups, teamName } from '../../lib/tournament';
import { appUrl } from '../../lib/whatsapp';
import type { Match, MatchStatus } from '../../types';
import { Field, Select, cn } from '../../ui';
import { ageText, exceptions, hoursSince, RESULT_REMINDER_HOURS } from './logic';
import type { SectionProps } from './types';

const STATUSES: MatchStatus[] = ['unscheduled', 'requested', 'scheduled', 'played', 'disputed', 'forfeit'];

export default function Monitoring({ d }: SectionProps) {
  const { tournament, periods, matches, teams, teamById } = d;
  const courts = useCourts();
  const [period, setPeriod] = useState('');
  const [group, setGroup] = useState('');
  const todayDate = today();

  const filtered = useMemo(
    () => matches.filter((m) => (!period || m.periodId === period) && (!group || m.group === group)),
    [matches, period, group],
  );
  const e = useMemo(() => exceptions(filtered, periods, todayDate), [filtered, periods, todayDate]);
  const perId = new Map(periods.map((p) => [p.id, p]));
  const href = (m: Match) => `/t/${tournament.id}/partite/${m.id}`;
  const row = (m: Match, note?: React.ReactNode) => (
    <li key={m.id}>
      <MatchRow match={m} teamById={teamById} courts={courts.data ?? []} href={href(m)} note={note} />
    </li>
  );
  const periodOf = (m: Match) => (m.periodId ? perId.get(m.periodId) : undefined);
  const none = !e.disputed.length && !e.late.length && !e.toConfirm.length && !e.endingSoon.length;
  const openPeriods = periods.filter((p) => p.startsOn <= todayDate && filtered.some((x) => x.periodId === p.id));

  if (!matches.length)
    return <p className="text-ink-muted">Le partite compaiono qui dopo aver generato il calendario. Nessuna partita in ritardo e nessuna contestazione.</p>;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap gap-3">
        <Field label="Periodo" className="min-w-48">
          {(p) => (
            <Select {...p} value={period} onChange={(ev) => setPeriod(ev.target.value)}>
              <option value="">Tutti i periodi</option>
              {periods.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Girone" className="min-w-40">
          {(p) => (
            <Select {...p} value={group} onChange={(ev) => setGroup(ev.target.value)}>
              <option value="">Tutti i gironi</option>
              {groups(teams).map((g) => (
                <option key={g} value={g}>
                  Girone {g}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {none && <p className="text-ink-muted">Nessuna partita in ritardo e nessuna contestazione.</p>}

      {e.disputed.length > 0 && (
        <Section title={`Contestazioni (${e.disputed.length})`} id="mon-disputed">
          <p className="text-ink-muted">Apri la partita: da lì fissi il risultato ufficiale o assegni il tavolino.</p>
          <ul className="court-rule">{e.disputed.map((m) => row(m, m.result?.note ? `«${m.result.note}»` : undefined))}</ul>
        </Section>
      )}

      {e.late.length > 0 && (
        <Section title={`Partite in ritardo (${e.late.length})`} id="mon-late">
          <p className="text-ink-muted">Il periodo è finito e la partita non è stata giocata: sollecita le coppie o decidi dalla pagina della partita.</p>
          <ul className="court-rule">
            {e.late.map((m) => (
              <li key={m.id} className="grid gap-1 pb-3">
                <MatchRow
                  match={m}
                  teamById={teamById}
                  courts={courts.data ?? []}
                  href={href(m)}
                  note={<span className="tabular">periodo finito il {labelDate(periodOf(m)!.endsOn)}</span>}
                />
                <WhatsAppButton
                  className="justify-self-start"
                  text={`Ciao, la partita ${teamName(teamById, m.teamA)} contro ${teamName(teamById, m.teamB)} doveva essere giocata entro il ${labelDate(periodOf(m)!.endsOn)}. Programmatela appena potete: ${appUrl(href(m))}`}
                >
                  Scrivi alla coppia
                </WhatsAppButton>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {e.toConfirm.length > 0 && (
        <Section title={`Risultati da confermare (${e.toConfirm.length})`} id="mon-to-confirm">
          <p className="text-ink-muted">Una coppia ha inserito il risultato e l’altra non l’ha ancora confermato. Dopo 2 giorni conviene sollecitarla.</p>
          <ul className="court-rule">
            {[...e.toConfirm]
              .sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''))
              .map((m) => {
                const hours = hoursSince(m.updatedAt);
                if (hours === null) return row(m);
                const old = hours >= RESULT_REMINDER_HOURS;
                return row(
                  m,
                  <span className={cn('tabular inline-flex items-center gap-1', old && 'font-semibold text-warn-ink')}>
                    {old && <AlarmClock className="size-4" aria-hidden />}
                    inserito {ageText(hours)}
                  </span>,
                );
              })}
          </ul>
        </Section>
      )}

      {e.endingSoon.length > 0 && (
        <Section title={`Da programmare, periodo in scadenza (${e.endingSoon.length})`} id="mon-ending">
          <ul className="court-rule">
            {e.endingSoon.map((m) => row(m, <span className="tabular">entro il {labelDate(periodOf(m)!.endsOn)}</span>))}
          </ul>
        </Section>
      )}

      {openPeriods.length > 0 && (
        <Section title="Andamento per periodo" id="mon-periods">
          <ul className="court-rule">
            {openPeriods.map((per) => {
              const pp = filtered.filter((x) => x.periodId === per.id);
              return (
                <li key={per.id} className="grid gap-1.5 py-3">
                  <p className="font-bold">
                    {per.label}{' '}
                    <span className="tabular font-normal text-ink-muted">
                      · {labelDate(per.startsOn)} – {labelDate(per.endsOn)} · {pp.length} partite
                    </span>
                  </p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {STATUSES.map((s) => {
                      const n = pp.filter((x) => x.status === s).length;
                      if (!n) return null;
                      const Icon = STATUS_ICONS[MATCH_STATUS[s].icon];
                      return (
                        <li key={s} className="tabular inline-flex items-center gap-1.5">
                          <Icon className="size-4 text-ink-muted" aria-hidden />
                          {MATCH_STATUS[s].label.toLowerCase()} {n}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
