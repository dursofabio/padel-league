import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, Loading, useAction } from '../components/ui';
import { db } from '../firebase';
import { hasRole, useAuth } from '../hooks/auth';
import { useUtenti } from '../hooks/data';
import type { Role } from '../types';

const RUOLI: Role[] = ['giocatore', 'gestore', 'organizzatore', 'admin'];

export default function Admin() {
  const { user, profile, loading } = useAuth();
  const utenti = useUtenti();
  const [filtro, setFiltro] = useState('');
  const act = useAction();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (!hasRole(profile, 'admin')) return <p className="error">Area riservata all&apos;admin.</p>;
  const lista = utenti.data
    .filter((u) => `${u.nome} ${u.email}`.toLowerCase().includes(filtro.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return (
    <Card title={`Utenti e ruoli (${utenti.data.length})`}>
      <input placeholder="Cerca per nome o email" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <table className="standings">
        <thead><tr><th className="left">Nome</th><th className="left">Email</th><th className="left">Telefono</th><th>Ruolo</th></tr></thead>
        <tbody>
          {lista.map((u) => (
            <tr key={u.id}>
              <td className="left">{u.nome}</td>
              <td className="left small">{u.email}</td>
              <td className="left small">{u.telefono}</td>
              <td>
                <select value={u.role} disabled={u.id === user.uid || act.busy}
                  onChange={(e) => act.run(() => updateDoc(doc(db, 'users', u.id), { role: e.target.value }), `Ruolo di ${u.nome} aggiornato`)}>
                  {RUOLI.map((r) => <option key={r}>{r}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {act.feedback}
    </Card>
  );
}
