import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge, Card, useAction } from '../components/ui';
import { db } from '../firebase';
import { useAuth } from '../hooks/auth';

export default function Profilo() {
  const { user, profile, loading } = useAuth();
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const act = useAction();
  useEffect(() => {
    if (profile) {
      setNome(profile.nome);
      setTelefono(profile.telefono ?? '');
    }
  }, [profile]);
  if (!loading && !user) return <Navigate to="/login?next=/profilo" replace />;
  if (!profile) return null;
  return (
    <Card title="Profilo" actions={<Badge>{profile.role}</Badge>}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          act.run(() => updateDoc(doc(db, 'users', profile.id), { nome, telefono }), 'Salvato');
        }}
      >
        <label>
          Nome
          <input required value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>
          Telefono (per i contatti WhatsApp)
          <input type="tel" placeholder="+39…" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </label>
        <p className="muted small">Email: {profile.email}</p>
        <button disabled={act.busy}>Salva</button>
      </form>
      {act.feedback}
    </Card>
  );
}
