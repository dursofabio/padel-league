import { LogIn } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, QueryState, SkeletonRows } from '../../components/states';
import { useTournaments } from '../../data/queries';
import { buttonVariants } from '../../ui/button';
import { LinkRow, TOURNAMENT_STATUS_LABEL } from '../../components/common';

// The feed (attention logic, mutations, rows) is only downloaded by logged-in users.
const TodoFeed = lazy(() => import('./TodoFeed').then((m) => ({ default: m.TodoFeed })));

function Loading() {
  return (
    <>
      <PageHeader title="Da fare" />
      <SkeletonRows rows={3} />
    </>
  );
}

/** "/": the "Da fare" feed when logged in; the tournaments to follow when logged out. */
export default function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? (
    <Suspense fallback={<Loading />}>
      <TodoFeed />
    </Suspense>
  ) : (
    <PublicHome />
  );
}

function PublicHome() {
  const tournaments = useTournaments();
  return (
    <>
      <PageHeader title="Tornei" subtitle="Classifiche, calendario e tabelloni: si leggono senza accedere." />
      <div className="grid max-w-3xl gap-8">
        <QueryState
          isPending={tournaments.isPending}
          error={tournaments.error}
          data={tournaments.data}
          onRetry={() => void tournaments.refetch()}
          empty={(t) =>
            t.length ? null : <EmptyState title="Non c’è ancora nessun torneo." text="Quando l’organizzatore crea il torneo, lo trovi qui." />
          }
        >
          {(t) => (
            <ul className="court-rule">
              {t.map((x) => (
                <li key={x.id}>
                  <LinkRow to={`/t/${x.id}`} detail={TOURNAMENT_STATUS_LABEL[x.status]}>
                    {x.name}
                  </LinkRow>
                </li>
              ))}
            </ul>
          )}
        </QueryState>

        <section aria-labelledby="sign-in" className="grid justify-items-start gap-3 border-t border-line pt-5">
          <h2 id="sign-in" className="text-lg font-bold">
            Giochi in un torneo?
          </h2>
          <p className="max-w-prose text-ink-muted">Accedi per segnare quando puoi giocare, programmare le tue partite e inserire i risultati.</p>
          <Link to="/accedi" className={buttonVariants({ variant: 'primary' })}>
            <LogIn aria-hidden />
            Accedi
          </Link>
        </section>
      </div>
    </>
  );
}
