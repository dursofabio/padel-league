import { Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, QueryState, SkeletonRighe } from '../../components/states';
import { messaggioErrore } from '../../data/errors';
import { azioni, useAzione } from '../../data/mutations';
import { useProfili } from '../../data/queries';
import type { Role, UserProfile } from '../../types';
import { Checkbox, Field, Input, Label } from '../../ui';
import { cercaUtenti, conRuolo, NOMI_RUOLO, RUOLI } from './logic';

export default function UtentiPage() {
  const { user } = useAuth();
  const profili = useProfili();
  const [cerca, setCerca] = useState('');
  const testo = useDeferredValue(cerca);
  const lista = useMemo(() => cercaUtenti(profili.data ?? [], testo), [profili.data, testo]);

  const imposta = useAzione(azioni.impostaRuoli, { errore: false });

  const cambia = (u: UserProfile, ruolo: Role, attivo: boolean) => {
    const prima = u.roles;
    const dopo = conRuolo(prima, ruolo, attivo);
    const nome = u.nome || u.email;
    imposta.mutate(
      { utente: u.id, ruoli: dopo },
      {
        onSuccess: () =>
          toast.success(`Ruoli di ${nome} aggiornati`, {
            action: {
              label: 'Annulla',
              onClick: () =>
                imposta.mutate(
                  { utente: u.id, ruoli: prima },
                  { onSuccess: () => toast.success(`Ruoli di ${nome} ripristinati`), onError: (e) => toast.error(messaggioErrore(e)) },
                ),
            },
          }),
        onError: (e) => toast.error(`Ruoli di ${nome} non aggiornati: ${messaggioErrore(e)}`),
      },
    );
  };

  return (
    <div className="grid gap-5">
      <PageHeader titolo="Utenti e ruoli" sottotitolo="Una persona può avere più ruoli: per esempio gestore e giocatore." />
      <Field label="Cerca per nome o email" className="max-w-md">
        {(p) => (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input {...p} type="search" value={cerca} onChange={(e) => setCerca(e.target.value)} className="pl-10" autoComplete="off" />
          </div>
        )}
      </Field>

      <QueryState
        isPending={profili.isPending}
        error={profili.error}
        data={profili.data}
        onRiprova={() => profili.refetch()}
        skeleton={<SkeletonRighe righe={6} />}
        vuoto={(d) =>
          d.length === 0 ? <EmptyState titolo="Nessun utente" testo="Gli utenti compaiono qui dopo la registrazione." /> : null
        }
      >
        {() =>
          lista.length === 0 ? (
            <p className="py-4 text-ink-muted">Nessun utente corrisponde a «{testo}». Prova con una parte del nome o dell’email.</p>
          ) : (
            <>
              <p className="sr-only" aria-live="polite">
                {lista.length} utenti
              </p>
              <ul className="court-rule">
                {lista.map((u) => {
                  const occupato = imposta.isPending && imposta.variables?.utente === u.id;
                  const io = u.id === user?.id;
                  return (
                    <li key={u.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" aria-busy={occupato || undefined}>
                      <div className="grid min-w-0 gap-0.5">
                        <p className="font-bold">
                          {u.nome || 'Senza nome'}
                          {io && <span className="font-normal text-ink-muted"> (tu)</span>}
                        </p>
                        <p className="truncate text-ink-muted">
                          {u.email}
                          {u.telefono ? <span className="tabular"> · {u.telefono}</span> : ' · nessun telefono'}
                        </p>
                      </div>
                      <fieldset className="flex flex-wrap gap-x-5 gap-y-1" disabled={occupato}>
                        <legend className="sr-only">Ruoli di {u.nome || u.email}</legend>
                        {RUOLI.map((r) => {
                          const id = `ruolo-${u.id}-${r}`;
                          const bloccato = r === 'giocatore' || (io && r === 'admin');
                          const motivo = r === 'giocatore' ? 'sempre attivo' : io && r === 'admin' ? 'non puoi toglierlo a te' : null;
                          return (
                            <div key={r} className="flex min-h-11 items-center gap-2">
                              <Checkbox
                                id={id}
                                checked={r === 'giocatore' || u.roles.includes(r)}
                                disabled={bloccato || occupato}
                                aria-describedby={motivo ? `${id}-motivo` : undefined}
                                onCheckedChange={(v) => cambia(u, r, v === true)}
                              />
                              <Label htmlFor={id} className="text-base font-normal">
                                {NOMI_RUOLO[r]}
                              </Label>
                              {motivo && (
                                <span id={`${id}-motivo`} className="text-sm text-ink-muted">
                                  ({motivo})
                                </span>
                              )}
                            </div>
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
