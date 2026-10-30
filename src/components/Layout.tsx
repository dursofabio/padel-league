import { signOut } from 'firebase/auth';
import { collection, query, where } from 'firebase/firestore';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { hasRole, useAuth } from '../hooks/auth';
import { useRichiesteGiocatore } from '../hooks/data';
import { useQuery } from '../hooks/firestore';
import { richiestaAttiva } from '../lib/slots';
import type { Richiesta } from '../types';

export function Layout() {
  const { user, profile } = useAuth();
  const gestore = hasRole(profile, 'gestore');
  const mie = useRichiesteGiocatore(user?.uid);
  const daAccettare = mie.data.filter((r) => r.stato === 'attesa' && richiestaAttiva(r) && !r.accettazioni?.[user!.uid]).length;
  const pendenti = useQuery<Richiesta>(
    gestore ? query(collection(db, 'richieste'), where('stato', '==', 'attesa')) : null,
    `pend-${gestore}`,
  );
  const daConfermare = pendenti.data.filter((r) => richiestaAttiva(r)).length;
  const loc = useLocation();
  const tid = loc.pathname.match(/^\/t\/([^/]+)/)?.[1];

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">🎾 Padel League</Link>
        <nav>
          {gestore && (
            <NavLink to="/gestore">
              Campo{daConfermare > 0 && <span className="dot">{daConfermare}</span>}
            </NavLink>
          )}
          {hasRole(profile, 'admin') && <NavLink to="/admin">Admin</NavLink>}
          {user ? (
            <>
              <NavLink to="/profilo">{profile?.nome ?? 'Profilo'}</NavLink>
              <button className="link" onClick={() => signOut(auth)}>Esci</button>
            </>
          ) : (
            <NavLink to="/login">Accedi</NavLink>
          )}
        </nav>
      </header>
      {tid && (
        <nav className="subnav">
          <NavLink to={`/t/${tid}`} end>Classifiche</NavLink>
          {user && (
            <NavLink to={`/t/${tid}/mie`}>
              Le mie partite{daAccettare > 0 && <span className="dot">{daAccettare}</span>}
            </NavLink>
          )}
          {user && <NavLink to={`/t/${tid}/disponibilita`}>Disponibilità</NavLink>}
          {hasRole(profile, 'organizzatore') && <NavLink to={`/t/${tid}/organizza`}>Organizza</NavLink>}
        </nav>
      )}
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
