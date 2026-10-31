import { ArrowRight } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, QueryState, SkeletonRows } from '../../components/states';
import { useTournaments } from '../../data/queries';
import { SignInPrompt, TOURNAMENT_STATUS_LABEL } from '../../components/common';

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
      <PageHeader
        title={
          <>
            Segui il <span className="mark">torneo</span>
          </>
        }
        subtitle="Classifiche, calendario e tabelloni si leggono senza accedere."
      />
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
          <ul className="grid max-w-3xl gap-4">
            {t.map((x) => (
              <li key={x.id}>
                <Link to={`/t/${x.id}`} className="group grid gap-4 rounded-panel border-2 border-line-strong bg-court p-5 text-court-ink sm:p-6">
                  <span className="flex items-start justify-between gap-3">
                    <span className="poster text-poster break-words">{x.name}</span>
                    <ArrowRight className="mt-1 size-7 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />
                  </span>
                  <span className="grid gap-0.5">
                    <span className="font-bold">{TOURNAMENT_STATUS_LABEL[x.status]}</span>
                    <span className="font-semibold text-court-ink-muted">Classifiche, calendario e tabelloni</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <div className="max-w-3xl">
        <SignInPrompt title="Giochi in un torneo?" />
      </div>
    </>
  );
}
