import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { redirectBase, useAuth } from '../../auth/AuthProvider';
import { messaggioErrore } from '../../data/errors';
import { supabase } from '../../data/supabase';
import { Button, Field, Input, Segmented } from '../../ui';

type Modo = 'accedi' | 'registrati' | 'reset';

// Google sign-in shows only when the provider is enabled in Supabase (VITE_GOOGLE_LOGIN=true at build time).
const googleAttivo = import.meta.env.VITE_GOOGLE_LOGIN === 'true';

const schema = z.object({
  nome: z.string().optional(),
  email: z.string().email('Inserisci un’email valida'),
  password: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function AccediPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const [modo, setModo] = useState<Modo>('accedi');
  const [inviata, setInviata] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError } = useForm<Form>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit(async ({ nome, email, password }) => {
    try {
      if (modo === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectBase('/profilo') });
        if (error) throw error;
        setInviata('Ti abbiamo mandato un’email con il link per scegliere una nuova password.');
        return;
      }
      if (!password || password.length < 8) return setError('password', { message: 'Almeno 8 caratteri' });
      if (modo === 'accedi') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!nome?.trim()) return setError('nome', { message: 'Come ti chiami?' });
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: nome.trim() }, emailRedirectTo: redirectBase(next) },
        });
        if (error) throw error;
        if (!data.session) setInviata('Controlla la tua email: c’è il link per confermare l’account.');
      }
    } catch (e) {
      toast.error(messaggioErrore(e));
    }
  });

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectBase(next) } });
    if (error) toast.error(messaggioErrore(error));
  };

  return (
    <div className="mx-auto grid max-w-md gap-6 py-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-bold">{modo === 'registrati' ? 'Crea il tuo account' : modo === 'reset' ? 'Nuova password' : 'Accedi'}</h1>
        <p className="text-ink-muted">Serve per segnare le disponibilità, richiedere il campo e confermare i risultati.</p>
      </div>
      {modo !== 'reset' && (
        <Segmented
          label="Accedi o registrati"
          value={modo}
          onValueChange={(m) => {
            setModo(m);
            setInviata(null);
          }}
          options={[
            { value: 'accedi', label: 'Ho già un account' },
            { value: 'registrati', label: 'Sono nuovo' },
          ]}
          className="w-full [&>*]:flex-1"
        />
      )}
      {inviata ? (
        <p role="status" className="rounded-panel bg-ok-soft p-4 text-ok-ink">
          {inviata}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {modo === 'registrati' && (
            <Field label="Nome e cognome" error={formState.errors.nome?.message}>
              {(p) => <Input {...p} autoComplete="name" {...register('nome')} />}
            </Field>
          )}
          <Field label="Email" error={formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...register('email')} />}
          </Field>
          {modo !== 'reset' && (
            <Field label="Password" hint={modo === 'registrati' ? 'Almeno 8 caratteri.' : undefined} error={formState.errors.password?.message}>
              {(p) => (
                <Input {...p} type="password" autoComplete={modo === 'accedi' ? 'current-password' : 'new-password'} {...register('password')} />
              )}
            </Field>
          )}
          <Button type="submit" variant="primary" size="lg" loading={formState.isSubmitting}>
            {modo === 'accedi' ? 'Accedi' : modo === 'registrati' ? 'Crea account' : 'Mandami il link'}
          </Button>
        </form>
      )}
      {googleAttivo && modo !== 'reset' && (
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
      <Button variant="link" className="justify-self-start" onClick={() => { setModo(modo === 'reset' ? 'accedi' : 'reset'); setInviata(null); }}>
        {modo === 'reset' ? 'Torna all’accesso' : 'Ho dimenticato la password'}
      </Button>
    </div>
  );
}
