import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { redirectBase, useAuth } from '../../auth/AuthProvider';
import { errorMessage } from '../../data/errors';
import { supabase } from '../../data/supabase';
import { Button, Field, Input, Segmented } from '../../ui';

type Mode = 'signIn' | 'signUp' | 'reset';

// Google sign-in shows only when the provider is enabled in Supabase (VITE_GOOGLE_LOGIN=true at build time).
const googleEnabled = import.meta.env.VITE_GOOGLE_LOGIN === 'true';

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email('Inserisci un’email valida'),
  password: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function SignInPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const [mode, setMode] = useState<Mode>('signIn');
  const [sent, setSent] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError } = useForm<Form>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectBase('/profilo') });
        if (error) throw error;
        setSent('Ti abbiamo mandato un’email con il link per scegliere una nuova password.');
        return;
      }
      if (!password || password.length < 8) return setError('password', { message: 'Almeno 8 caratteri' });
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!name?.trim()) return setError('name', { message: 'Come ti chiami?' });
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: redirectBase(next) },
        });
        if (error) throw error;
        if (!data.session) setSent('Controlla la tua email: c’è il link per confermare l’account.');
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectBase(next) } });
    if (error) toast.error(errorMessage(error));
  };

  return (
    <div className="mx-auto grid max-w-md gap-6 py-4">
      <div className="grid gap-2">
        <h1 className="poster text-poster">{mode === 'signUp' ? 'Crea il tuo account' : mode === 'reset' ? 'Nuova password' : 'Accedi'}</h1>
        <p className="text-ink-muted">Serve per segnare le disponibilità, richiedere il campo e confermare i risultati.</p>
      </div>
      {mode !== 'reset' && (
        <Segmented
          label="Accedi o registrati"
          value={mode}
          onValueChange={(m) => {
            setMode(m);
            setSent(null);
          }}
          options={[
            { value: 'signIn', label: 'Ho già un account' },
            { value: 'signUp', label: 'Sono nuovo' },
          ]}
          className="w-full [&>*]:flex-1"
        />
      )}
      {sent ? (
        <p role="status" className="rounded-panel bg-ok-soft p-4 text-ok-ink">
          {sent}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {mode === 'signUp' && (
            <Field label="Nome e cognome" error={formState.errors.name?.message}>
              {(p) => <Input {...p} autoComplete="name" {...register('name')} />}
            </Field>
          )}
          <Field label="Email" error={formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...register('email')} />}
          </Field>
          {mode !== 'reset' && (
            <Field label="Password" hint={mode === 'signUp' ? 'Almeno 8 caratteri.' : undefined} error={formState.errors.password?.message}>
              {(p) => (
                <Input {...p} type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} {...register('password')} />
              )}
            </Field>
          )}
          <Button type="submit" variant="primary" size="lg" loading={formState.isSubmitting}>
            {mode === 'signIn' ? 'Accedi' : mode === 'signUp' ? 'Crea account' : 'Mandami il link'}
          </Button>
        </form>
      )}
      {googleEnabled && mode !== 'reset' && (
        <>
          <div className="flex items-center gap-3 text-sm text-ink-muted" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            oppure
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" size="lg" onClick={google}>
            Continua con Google
          </Button>
        </>
      )}
      <Button variant="link" className="justify-self-start" onClick={() => { setMode(mode === 'reset' ? 'signIn' : 'reset'); setSent(null); }}>
        {mode === 'reset' ? 'Torna all’accesso' : 'Ho dimenticato la password'}
      </Button>
    </div>
  );
}
