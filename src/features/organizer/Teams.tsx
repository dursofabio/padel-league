import { Check, Lock, Pencil, Shuffle, Trash2, UserMinus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Section } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { actions, useAction } from '../../data/mutations';
import { useNames } from '../../data/queries';
import { appUrl } from '../../lib/whatsapp';
import type { Team, TeamStatus } from '../../types';
import { Button, ConfirmDialog, Field, Input, Select, Sheet, cn } from '../../ui';
import { drawGroups, groupLetters, prng } from './logic';
import { Note, TEAM_STATUS, TeamStatusBadge } from './parts';
import type { SectionProps, TournamentData } from './types';

type Filter = 'all' | TeamStatus;
const ORDER: TeamStatus[] = ['pending_approval', 'awaiting_partner', 'approved', 'withdrawn'];

export default function Teams({ d }: SectionProps) {
  const { teams, tournament } = d;
  const { name } = useNames();
  const scheduleDone = d.matches.some((m) => m.phase === 'groups');
  const [filter, setFilter] = useState<Filter>('all');
  const [renaming, setRenaming] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);
  const [withdrawing, setWithdrawing] = useState<Team | null>(null);
  const [composing, setComposing] = useState(false);

  const approve = useAction(actions.updateTeam, { success: 'Coppia approvata' });
  const update = useAction(actions.updateTeam, { success: 'Coppia aggiornata', onSuccess: () => setRenaming(null) });
  const withdraw = useAction(actions.updateTeam, { success: 'Coppia ritirata', onSuccess: () => setWithdrawing(null) });
  const remove = useAction(actions.deleteTeam, { success: 'Coppia eliminata', onSuccess: () => setDeleting(null) });

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: teams.length, pending_approval: 0, awaiting_partner: 0, approved: 0, withdrawn: 0 };
    for (const t of teams) c[t.status]++;
    return c;
  }, [teams]);

  const list = useMemo(
    () =>
      teams
        .filter((t) => filter === 'all' || t.status === filter)
        .sort(
          (a, b) =>
            ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.group ?? '~').localeCompare(b.group ?? '~') || a.name.localeCompare(b.name),
        ),
    [teams, filter],
  );
  const firstToApprove = list.find((t) => t.status === 'pending_approval')?.id;
  const existingGroupCount = new Set(teams.map((t) => t.group).filter(Boolean)).size;
  const letters = groupLetters(Math.max(4, existingGroupCount));
  const busy = (m: { isPending: boolean; variables?: { id: string } | string }, id: string) =>
    m.isPending && (typeof m.variables === 'string' ? m.variables === id : m.variables?.id === id);

  if (!teams.length)
    return (
      <EmptyState
        title="Nessuna coppia iscritta"
        text="Condividi il link del torneo nel gruppo WhatsApp: ogni giocatore crea la coppia e invita il compagno."
        action={
          <WhatsAppButton text={`Iscrivi la tua coppia a ${tournament.name}: ${appUrl(`/t/${tournament.id}/coppia`)}`}>Invia il link su WhatsApp</WhatsAppButton>
        }
      />
    );

  return (
    <div className="grid gap-8">
      <Section title="Coppie" id="teams-list">
        <div role="group" aria-label="Filtra per stato" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {(['all', ...ORDER] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'tabular inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold',
                filter === f ? 'border-court bg-court text-court-ink' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
              )}
            >
              {filter === f && <Check className="size-4" aria-hidden />}
              {f === 'all' ? 'Tutte' : TEAM_STATUS[f].label} {counts[f]}
            </button>
          ))}
        </div>

        {!list.length ? (
          <p className="py-4 text-ink-muted">Nessuna coppia in questo stato.</p>
        ) : (
          <ul className="court-rule">
            {list.map((s) => (
              <li key={s.id} className="grid gap-3 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="grid min-w-0 gap-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{s.name}</span>
                    <TeamStatusBadge status={s.status} />
                  </p>
                  <p className="truncate text-ink-muted">
                    {s.players.length ? s.players.map((g) => name(g)).join(' e ') : 'Nessun giocatore'}
                    {s.status === 'awaiting_partner' && ' · aspetta il compagno'}
                  </p>
                </div>
                <div>
                  {s.status === 'approved' || (s.status === 'withdrawn' && s.group) ? (
                    <Field label={<span className="sr-only">Girone di {s.name}</span>} className="max-w-48">
                      {(p) => (
                        <Select
                          {...p}
                          value={s.group ?? ''}
                          disabled={scheduleDone || s.status === 'withdrawn' || busy(update, s.id)}
                          onChange={(e) => update.mutate({ id: s.id, group: e.target.value || null })}
                        >
                          <option value="">Senza girone</option>
                          {letters.map((l) => (
                            <option key={l} value={l}>
                              Girone {l}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1 lg:justify-end">
                  {s.status === 'pending_approval' && (
                    <Button
                      variant={s.id === firstToApprove ? 'primary' : 'secondary'}
                      loading={busy(approve, s.id)}
                      onClick={() => approve.mutate({ id: s.id, status: 'approved' })}
                    >
                      <Check aria-hidden /> Approva
                    </Button>
                  )}
                  {s.status !== 'withdrawn' && (
                    <Button variant="ghost" size="icon" aria-label={`Rinomina ${s.name}`} onClick={() => setRenaming(s)}>
                      <Pencil aria-hidden />
                    </Button>
                  )}
                  {scheduleDone
                    ? s.status === 'approved' && (
                        <Button variant="ghost" onClick={() => setWithdrawing(s)}>
                          <UserMinus aria-hidden /> Ritira
                        </Button>
                      )
                    : (
                        <Button variant="ghost" size="icon" aria-label={`Elimina ${s.name}`} onClick={() => setDeleting(s)}>
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Gironi" id="teams-groups">
        <GroupsSummary teams={teams} />
        {scheduleDone ? (
          <Note tone="info" icon={Lock}>
            Gironi bloccati: il calendario è già stato generato.
          </Note>
        ) : composing ? (
          <ComposeGroups d={d} onDone={() => setComposing(false)} initialCount={Math.max(2, existingGroupCount)} />
        ) : (
          <Button
            variant={counts.pending_approval === 0 && teams.some((t) => t.status === 'approved' && !t.group) ? 'primary' : 'secondary'}
            className="justify-self-start"
            disabled={!counts.approved}
            onClick={() => setComposing(true)}
          >
            <Shuffle aria-hidden /> Componi i gironi
          </Button>
        )}
      </Section>

      <RenameSheet team={renaming} onClose={() => setRenaming(null)} loading={update.isPending} onSave={(n) => renaming && update.mutate({ id: renaming.id, name: n })} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Eliminare «${deleting?.name ?? ''}»?`}
        description="La coppia e il suo link d’invito spariscono. I giocatori potranno iscriversi di nuovo."
        confirmLabel="Elimina coppia"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
      <ConfirmDialog
        open={!!withdrawing}
        onOpenChange={(o) => !o && setWithdrawing(null)}
        title={`Ritirare «${withdrawing?.name ?? ''}»?`}
        description="I risultati restano. Le partite residue si chiudono a tavolino dalle singole partite."
        confirmLabel="Ritira coppia"
        loading={withdraw.isPending}
        onConfirm={() => withdrawing && withdraw.mutate({ id: withdrawing.id, status: 'withdrawn' })}
      />
    </div>
  );
}

function GroupsSummary({ teams }: { teams: Team[] }) {
  const approved = teams.filter((t) => t.status === 'approved');
  const per = new Map<string, number>();
  for (const t of approved) if (t.group) per.set(t.group, (per.get(t.group) ?? 0) + 1);
  const without = approved.filter((t) => !t.group).length;
  return (
    <p className="tabular">
      {per.size
        ? [...per.entries()]
            .sort()
            .map(([g, n]) => `Girone ${g}: ${n} coppie`)
            .join(' · ')
        : 'Nessun girone ancora composto.'}
      {without > 0 && ` · ${without} ${without === 1 ? 'coppia approvata' : 'coppie approvate'} senza girone`}
    </p>
  );
}

function ComposeGroups({ d, onDone, initialCount }: { d: TournamentData; onDone: () => void; initialCount: number }) {
  const approved = useMemo(() => d.teams.filter((t) => t.status === 'approved'), [d.teams]);
  const toApprove = d.teams.filter((t) => t.status === 'pending_approval').length;
  const [n, setN] = useState(Math.min(4, initialCount));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const preview = useMemo(() => drawGroups(approved.map((t) => t.id), n, prng(seed)), [approved, n, seed]);
  const byId = new Map(approved.map((t) => [t.id, t]));
  const confirm = useAction(
    async (a: Record<string, string>) => {
      await Promise.all(Object.entries(a).map(([id, group]) => actions.updateTeam({ id, group })));
      return Object.keys(a).length;
    },
    { success: (k) => `Gironi composti: ${k} coppie assegnate`, onSuccess: onDone },
  );

  return (
    <div className="grid gap-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Numero di gironi" className="w-40">
          {(p) => (
            <Select {...p} value={n} onChange={(e) => setN(Number(e.target.value))}>
              {[1, 2, 3, 4].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="min-h-11 content-center text-ink-muted">Metodo: a sorte</p>
      </div>
      {toApprove > 0 && (
        <Note tone="warn">
          {toApprove} {toApprove === 1 ? 'coppia è' : 'coppie sono'} ancora da approvare e non {toApprove === 1 ? 'entra' : 'entrano'} nel sorteggio.
        </Note>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]" aria-live="polite">
        {groupLetters(n).map((g) => {
          const ids = Object.entries(preview)
            .filter(([, x]) => x === g)
            .map(([id]) => id);
          return (
            <section key={g} aria-labelledby={`preview-${g}`}>
              <h3 id={`preview-${g}`} className="flex items-center gap-2 border-b-2 border-court pb-1 font-bold dark:border-line-strong">
                <Users className="size-5" aria-hidden /> Girone {g} <span className="tabular font-normal text-ink-muted">· {ids.length} coppie</span>
              </h3>
              <ul className="court-rule">
                {ids.map((id) => (
                  <li key={id} className="py-2">
                    {byId.get(id)?.name}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={confirm.isPending} onClick={() => confirm.mutate(preview)}>
          <Check aria-hidden /> Conferma gironi
        </Button>
        <Button variant="secondary" onClick={() => setSeed(Math.floor(Math.random() * 2 ** 31))}>
          <Shuffle aria-hidden /> Rimescola
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Annulla
        </Button>
      </div>
    </div>
  );
}

function RenameSheet({ team, onClose, onSave, loading }: { team: Team | null; onClose: () => void; onSave: (name: string) => void; loading: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [forId, setForId] = useState<string | null>(null);
  if (team && forId !== team.id) {
    setForId(team.id);
    setValue(team.name);
    setError(null);
  }
  if (!team && forId !== null) setForId(null);
  const formId = 'rename-form';
  return (
    <Sheet
      open={!!team}
      onOpenChange={(o) => !o && onClose()}
      title="Rinomina la coppia"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={loading}>
            Salva nome
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const v = value.trim();
          if (!v) return setError('Scrivi un nome per la coppia');
          if (v.length > 40) return setError('Massimo 40 caratteri');
          onSave(v);
        }}
      >
        <Field label="Nome della coppia" error={error}>
          {(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />}
        </Field>
      </form>
    </Sheet>
  );
}
