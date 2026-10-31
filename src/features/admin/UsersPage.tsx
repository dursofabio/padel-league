import { Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, QueryState, SkeletonRows } from '../../components/states';
import { errorMessage } from '../../data/errors';
import { actions, useAction } from '../../data/mutations';
import { useProfiles } from '../../data/queries';
import type { Role, UserProfile } from '../../types';
import { Checkbox, Field, Input, cn } from '../../ui';
import { searchUsers, withRole, ROLE_NAMES, ROLES } from './logic';

export default function UsersPage() {
  const { user } = useAuth();
  const profiles = useProfiles();
  const [search, setSearch] = useState('');
  const text = useDeferredValue(search);
  const list = useMemo(() => searchUsers(profiles.data ?? [], text), [profiles.data, text]);

  const setRoles = useAction(actions.setRoles, { error: false });

  const toggle = (u: UserProfile, role: Role, active: boolean) => {
    const before = u.roles;
    const after = withRole(before, role, active);
    const name = u.name || u.email;
    setRoles.mutate(
      { user: u.id, roles: after },
      {
        onSuccess: () =>
          toast.success(`Ruoli di ${name} aggiornati`, {
            action: {
              label: 'Annulla',
              onClick: () =>
                setRoles.mutate(
                  { user: u.id, roles: before },
                  { onSuccess: () => toast.success(`Ruoli di ${name} ripristinati`), onError: (e) => toast.error(errorMessage(e)) },
                ),
            },
          }),
        onError: (e) => toast.error(`Ruoli di ${name} non aggiornati: ${errorMessage(e)}`),
      },
    );
  };

  return (
    <div className="grid gap-5">
      <PageHeader title="Utenti e ruoli" subtitle="Una persona può avere più ruoli: per esempio gestore e giocatore." />
      <Field label="Cerca per nome o email" className="max-w-md">
        {(p) => (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input {...p} type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" autoComplete="off" />
          </div>
        )}
      </Field>

      <QueryState
        isPending={profiles.isPending}
        error={profiles.error}
        data={profiles.data}
        onRetry={() => profiles.refetch()}
        skeleton={<SkeletonRows rows={6} />}
        empty={(d) =>
          d.length === 0 ? <EmptyState title="Nessun utente" text="Gli utenti compaiono qui dopo la registrazione." /> : null
        }
      >
        {() =>
          list.length === 0 ? (
            <p className="py-4 text-ink-muted">Nessun utente corrisponde a «{text}». Prova con una parte del nome o dell’email.</p>
          ) : (
            <>
              <p className="sr-only" aria-live="polite">
                {list.length} utenti
              </p>
              <ul className="court-rule">
                {list.map((u) => {
                  const busy = setRoles.isPending && setRoles.variables?.user === u.id;
                  const isMe = u.id === user?.id;
                  return (
                    <li key={u.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" aria-busy={busy || undefined}>
                      <div className="grid min-w-0 gap-0.5">
                        <p className="font-bold">
                          {u.name || 'Senza nome'}
                          {isMe && <span className="font-normal text-ink-muted"> (tu)</span>}
                        </p>
                        <p className="truncate text-ink-muted">
                          {u.email}
                          {u.phone ? <span className="tabular"> · {u.phone}</span> : ' · nessun telefono'}
                        </p>
                      </div>
                      <fieldset className="flex flex-wrap gap-x-4 gap-y-0" disabled={busy}>
                        <legend className="sr-only">Ruoli di {u.name || u.email}</legend>
                        {ROLES.map((r) => {
                          const id = `role-${u.id}-${r}`;
                          const locked = r === 'player' || (isMe && r === 'admin');
                          const reason = r === 'player' ? 'sempre attivo' : isMe && r === 'admin' ? 'non puoi toglierlo a te' : null;
                          return (
                            <label
                              key={r}
                              htmlFor={id}
                              className={cn(
                                '-mx-2 flex min-h-11 items-center gap-2 rounded-control px-2 text-base',
                                locked ? 'cursor-default' : 'cursor-pointer hover:bg-surface-2',
                              )}
                            >
                              <Checkbox
                                id={id}
                                checked={r === 'player' || u.roles.includes(r)}
                                disabled={locked || busy}
                                aria-describedby={reason ? `${id}-reason` : undefined}
                                onCheckedChange={(v) => toggle(u, r, v === true)}
                              />
                              <span>{ROLE_NAMES[r]}</span>
                              {reason && (
                                <span id={`${id}-reason`} className="text-sm text-ink-muted">
                                  ({reason})
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </fieldset>
                    </li>
                  );
                })}
              </ul>
            </>
          )
        }
      </QueryState>
    </div>
  );
}
