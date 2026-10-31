import { LogIn } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, QueryState, SkeletonRighe } from '../../components/states';
import { useTornei } from '../../data/queries';
import { buttonVariants } from '../../ui/button';
import { RigaLink, STATO_TORNEO } from '../public/comune';

// The feed (attention logic, mutations, rows) is only downloaded by logged-in users.
const DaFare = lazy(() => import('./DaFare').then((m) => ({ default: m.DaFare })));

function Caricamento() {
  return (
    <>
      <PageHeader titolo="Da fare" />
      <SkeletonRighe righe={3} />
    </>
  );
}

/** "/": the "Da fare" feed when logged in; the tournaments to follow when logged out. */
export default function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <Caricamento />;
  return user ? (
    <Suspense fallback={<Caricamento />}>
      <DaFare />
    </Suspense>
  ) : (
    <Pubblica />
  );
}

function Pubblica() {
  const tornei = useTornei();
  return (
    <>
      <PageHeader titolo="Tornei" sottotitolo="Classifiche, calendario e tabelloni: si leggono senza accedere." />
      <div className="grid max-w-3xl gap-8">
        <QueryState
          isPending={tornei.isPending}
          error={tornei.error}
          data={tornei.data}
          onRiprova={() => void tornei.refetch()}
          vuoto={(t) =>
            t.length ? null : <EmptyState titolo="Non c’è ancora nessun torneo." testo="Quando l’organizzatore crea il torneo, lo trovi qui." />
          }
        >
          {(t) => (
            <ul className="court-rule">
              {t.map((x) => (
                <li key={x.id}>
                  <RigaLink to={`/t/${x.id}`} dettaglio={STATO_TORNEO[x.stato]}>
                    {x.nome}
                  </RigaLink>
                </li>
              ))}
            </ul>
          )}
        </QueryState>

        <section aria-labelledby="accedi" className="grid justify-items-start gap-3 border-t border-line pt-5">
          <h2 id="accedi" className="text-lg font-bold">
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
