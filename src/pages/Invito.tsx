import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, ErrorBox, Loading, useAction } from '../components/ui';
import { useAuth } from '../hooks/auth';
import { useUtenti } from '../hooks/data';
import { leggiInvito, uniscitiASquadra } from '../services/torneo';
import type { Squadra } from '../types';

export default function Invito() {
  const { tid, token } = useParams();
  const { user, loading } = useAuth();
  const utenti = useUtenti();
  const nav = useNavigate();
  const [squadra, setSquadra] = useState<Squadra | null | undefined>(undefined);
  const act = useAction();

  useEffect(() => {
    if (user) leggiInvito(tid!, token!).then(setSquadra).catch(() => setSquadra(null));
  }, [user, tid, token]);

  if (loading) return <Loading />;
  if (!user)
    return (
      <Card title="Invito">
        <p>Sei stato invitato a formare una coppia. <Link to={`/login?next=/invito/${tid}/${token}`}>Accedi o registrati</Link> per continuare.</p>
      </Card>
    );
  if (squadra === undefined) return <Loading />;
  if (squadra === null) return <ErrorBox error="Invito non valido o scaduto." />;
  return (
    <Card title={`Coppia "${squadra.nome}"`}>
      <p>Creata da {utenti.nome(squadra.creatoDa)}.</p>
      {squadra.giocatori.includes(user.uid) ? (
        <p>Fai già parte di questa coppia. <Link to={`/t/${tid}/mie`}>Vai alle tue partite</Link></p>
      ) : squadra.stato !== 'in attesa partner' ? (
        <p className="error">La coppia è già completa.</p>
      ) : (
        <button
          disabled={act.busy}
          onClick={() =>
            act
              .run(async () => {
                await uniscitiASquadra(tid!, squadra, token!, user.uid);
                return true;
              })
              .then((ok) => ok && nav(`/t/${tid}/mie`))
          }
        >
          Unisciti alla coppia
        </button>
      )}
      {act.feedback}
    </Card>
  );
}
