import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, ErrorBox, Loading, useAction } from '../components/ui';
import { hasRole, useAuth } from '../hooks/auth';
import { useTornei } from '../hooks/data';
import { creaTorneo } from '../services/torneo';

const STATI: Record<string, string> = {
  iscrizioni: 'Iscrizioni aperte',
  gironi: 'Fase a gironi',
  fasiFinali: 'Fasi finali',
  concluso: 'Concluso',
};

export default function Home() {
  const { user, profile } = useAuth();
  const tornei = useTornei();
  const [nome, setNome] = useState('');
  const act = useAction();

  return (
    <>
      <Card title="Tornei">
        {tornei.loading ? <Loading /> : <ErrorBox error={tornei.error} />}
        {!tornei.loading && tornei.data.length === 0 && <p className="muted">Nessun torneo.</p>}
        <ul className="list">
          {tornei.data.map((t) => (
            <li key={t.id}>
              <Link to={`/t/${t.id}`}>{t.nome}</Link> <Badge>{STATI[t.stato] ?? t.stato}</Badge>
              {user && (
                <span className="muted small">
                  {' · '}
                  <Link to={`/t/${t.id}/mie`}>le mie partite</Link>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {hasRole(profile, 'admin') && (
        <Card title="Nuovo torneo">
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (nome.trim()) act.run(() => creaTorneo(nome.trim(), user!.uid), 'Torneo creato').then(() => setNome(''));
            }}
          >
            <input placeholder="Nome del torneo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <button disabled={act.busy}>Crea</button>
          </form>
          {act.feedback}
        </Card>
      )}
      {!user && (
        <p className="muted">
          Classifiche e calendari sono pubblici. <Link to="/login">Accedi</Link> per programmare le tue partite.
        </p>
      )}
    </>
  );
}
