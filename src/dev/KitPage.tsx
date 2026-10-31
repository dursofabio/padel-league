/**
 * Component gallery (development only, /#/_kit): synthetic data to check the design system
 * at 390/820/1440 px in light and dark themes. Not shipped in production.
 */
import { Check, CircleDashed, Clock, Lock } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../app/theme';
import { CourtLanes, LaneBlock, scaleFromCourts } from '../components/CourtLanes';
import { MatchRow } from '../components/MatchRow';
import { PageHeader, Section } from '../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../components/states';
import { StandingsTable } from '../components/StandingsTable';
import { Badge, MatchStatusBadge, RequestStatusBadge } from '../components/StatusBadge';
import { SLOT_STATUS } from '../lib/copy';
import { gridSlots } from '../lib/slots';
import type { Court, Match, MatchStatus, RequestStatus, Team } from '../types';
import { Button, Checkbox, ConfirmDialog, Field, Input, Segmented, Select, Sheet, Switch } from '../ui';

const courts: Court[] = [
  { id: 'c1', name: 'Campo 1', firstSlot: '13:30', lastSlot: '21:00', slotMinutes: 90, activeDays: [0, 1, 2, 3, 4, 5, 6], closedDates: [] },
  { id: 'c2', name: 'Campo 2', firstSlot: '14:00', lastSlot: '20:00', slotMinutes: 90, activeDays: [0, 1, 2, 3, 4, 5, 6], closedDates: [] },
];
const teams: Team[] = [
  { id: 's1', name: 'Le Bandejas', players: [], status: 'approved', createdBy: '', group: 'A' },
  { id: 's2', name: 'Vibora Team', players: [], status: 'approved', createdBy: '', group: 'A' },
  { id: 's3', name: 'Chiquita', players: [], status: 'approved', createdBy: '', group: 'A' },
  { id: 's4', name: 'Por Tres', players: [], status: 'approved', createdBy: '', group: 'A' },
];
const byId = new Map(teams.map((t) => [t.id, t]));
const base = { playersA: [] as string[], playersB: [] as string[], players: [] as string[], phase: 'groups' };
const matches: Match[] = [
  { ...base, id: 'p1', teamA: 's1', teamB: 's2', status: 'scheduled', schedule: { courtId: 'c2', date: '2026-11-14', start: '18:30', end: '20:00' } },
  { ...base, id: 'p2', teamA: 's3', teamB: 's4', status: 'played', result: { sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 10, b: 7 }], enteredBy: 'x', confirmedBy: 'y' } },
  { ...base, id: 'p3', teamA: 's2', teamB: 's3', status: 'unscheduled' },
];
const colors = ['green', 'green', 'yellow', 'red', 'grey', 'blue'] as const;
const icons = { green: Check, yellow: CircleDashed, grey: CircleDashed, red: Lock, blue: Clock };
const tones = { green: 'ok', yellow: 'warn', grey: 'idle', red: 'danger', blue: 'info' } as const;

export default function KitPage() {
  const [theme, setTheme] = useTheme();
  const [sheet, setSheet] = useState(false);
  const [sel, setSel] = useState<string | null>('c2-15:30');
  const scale = scaleFromCourts(courts, 0.75);
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Kit di sistema"
        subtitle="Dati sintetici, solo sviluppo."
        actions={
          <Segmented
            label="Tema"
            value={theme}
            onValueChange={setTheme}
            options={[
              { value: 'light', label: 'Chiaro' },
              { value: 'dark', label: 'Scuro' },
              { value: 'system', label: 'Sistema' },
            ]}
          />
        }
      />
      <Section title="Azioni">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Invia richiesta</Button>
          <Button>Proponi un altro orario</Button>
          <Button variant="court">Conferma partita</Button>
          <Button variant="ghost">Annulla</Button>
          <Button variant="danger">Rifiuta</Button>
          <Button variant="primary" loading>
            Invio…
          </Button>
          <Button variant="link">Ho dimenticato la password</Button>
        </div>
      </Section>
      <Section title="Campi del modulo">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome della coppia" hint="Lo vedranno tutti in classifica.">
            {(p) => <Input {...p} defaultValue="Le Bandejas" />}
          </Field>
          <Field label="Campo" error="Il campo è chiuso in quel giorno.">
            {(p) => (
              <Select {...p}>
                <option>Campo 1</option>
                <option>Campo 2</option>
              </Select>
            )}
          </Field>
          <label className="flex min-h-11 items-center gap-3">
            <Checkbox defaultChecked /> Consenti richieste fuori griglia
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <Switch defaultChecked /> Set decisivo come super tie-break
          </label>
        </div>
      </Section>
      <Section title="Stati">
        <div className="flex flex-wrap gap-2">
          {(['unscheduled', 'requested', 'scheduled', 'played', 'disputed', 'forfeit'] as MatchStatus[]).map((s) => (
            <MatchStatusBadge key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['pending', 'confirmed', 'rejected', 'cancelled', 'conflict', 'expired'] as RequestStatus[]).map((s) => (
            <RequestStatusBadge key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(SLOT_STATUS).map((v) => (
            <Badge key={v.label} entry={v} />
          ))}
        </div>
      </Section>
      <Section title="Partite">
        <ul className="court-rule">
          {matches.map((m) => (
            <li key={m.id}>
              <MatchRow match={m} teamById={byId} courts={courts} href="#" highlight={['s1']} />
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Corsie dei campi">
        <CourtLanes
          courts={courts}
          scale={scale}
          caption="sab 14/11"
          nowMinute={17 * 60 + 10}
          renderLane={(c) =>
            gridSlots(c, '2026-11-14').map((s, i) => {
              const st = colors[(i + (c.id === 'c2' ? 2 : 0)) % colors.length];
              const Icon = icons[st];
              const key = `${c.id}-${s.start}`;
              return (
                <LaneBlock
                  key={key}
                  scale={scale}
                  start={s.start}
                  end={s.end}
                  tone={tones[st]}
                  pattern={st === 'red' ? 'hatch' : st === 'grey' ? 'dots' : undefined}
                  selected={sel === key}
                  onClick={() => setSel(key)}
                  ariaLabel={`${s.start}, ${c.name}: ${SLOT_STATUS[st].label}`}
                >
                  <span className="tabular flex items-center gap-1 font-bold">
                    <Icon className="size-4" aria-hidden />
                    {s.start}
                  </span>
                  <span className="text-xs">{st === 'yellow' ? '3/4 · manca Luca' : SLOT_STATUS[st].label}</span>
                </LaneBlock>
              );
            })
          }
        />
      </Section>
      <Section title="Classifica">
        <StandingsTable
          group="A"
          teamById={byId}
          phases={[
            { name: 'Gold', spots: 2 },
            { name: 'Silver', spots: 2 },
          ]}
          groupCount={1}
          highlight="s1"
          rows={teams.map((t, i) => ({
            teamId: t.id, group: 'A', played: 3, won: 3 - i, lost: i, points: 9 - i * 3, setsWon: 6 - i, setsLost: i * 2,
            gamesWon: 40 - i * 5, gamesLost: 20 + i * 5, position: i + 1, tied: i === 3,
          }))}
        />
      </Section>
      <Section title="Stati di pagina">
        <SkeletonRows rows={2} />
        <EmptyState title="Niente da fare" text="Prossima partita: sab 14/11 alle 18:30 sul Campo 2." action={<Button>Vedi le partite</Button>} />
        <ErrorState error={{ hint: 'SLOT_TAKEN' }} onRetry={() => undefined} />
      </Section>
      <Section title="Pannelli">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSheet(true)}>Apri pannello</Button>
          <ConfirmDialog
            trigger={<Button variant="danger">Annulla partita confermata</Button>}
            title="Annullare la partita?"
            description="Il campo torna libero e la partita torna da programmare."
            confirmLabel="Annulla partita"
            cancelLabel="Tienila"
            onConfirm={() => undefined}
          />
        </div>
        <Sheet
          open={sheet}
          onOpenChange={setSheet}
          title="sab 14/11 · 15:30–17:00 · Campo 2"
          description="Tutti e 4 sono liberi e il campo è libero."
          footer={<Button variant="primary">Invia richiesta</Button>}
        >
          <p>Contenuto del pannello.</p>
        </Sheet>
      </Section>
    </div>
  );
}
