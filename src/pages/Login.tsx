import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Card, useAction } from '../components/ui';
import { auth } from '../firebase';
import { useAuth } from '../hooks/auth';

export default function Login() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const act = useAction();

  if (user) return <Navigate to={params.get('next') ?? '/'} replace />;

  return (
    <Card title={mode === 'login' ? 'Accedi' : 'Registrati'}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          act.run(async () => {
            if (mode === 'login') await signInWithEmailAndPassword(auth, email, password);
            else {
              const c = await createUserWithEmailAndPassword(auth, email, password);
              await updateProfile(c.user, { displayName: nome });
            }
          });
        }}
      >
        {mode === 'signup' && (
          <label>
            Nome e cognome
            <input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button disabled={act.busy}>{mode === 'login' ? 'Accedi' : 'Crea account'}</button>
      </form>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="secondary" onClick={() => act.run(() => signInWithPopup(auth, new GoogleAuthProvider()))}>
          Continua con Google
        </button>
        <button className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>
        {mode === 'login' && (
          <button
            className="link"
            onClick={() =>
              email
                ? act.run(() => sendPasswordResetEmail(auth, email), 'Email per il reset inviata')
                : act.setError('Inserisci la tua email')
            }
          >
            Password dimenticata
          </button>
        )}
      </div>
      {act.feedback}
    </Card>
  );
}
