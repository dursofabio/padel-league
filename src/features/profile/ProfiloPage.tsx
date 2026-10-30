import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTema, type Tema } from '../../app/theme';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader, Sezione } from '../../components/PageHeader';
import { SkeletonRighe } from '../../components/states';
import { azioni, useAzione } from '../../data/mutations';
import type { Role } from '../../types';
import { Button, Field, Input, Segmented } from '../../ui';
import { normalizzaTelefono, schemaProfilo, type FormProfilo } from './logic';

const RUOLI: Record<Role, string> = { giocatore: 'giocatore', gestore: 'gestore', organizzatore: 'organizzatore', admin: 'admin' };

export default function ProfiloPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tema, setTema] = useTema();
  const [uscita, setUscita] = useState(false);

  const { register, handleSubmit, reset, formState } = useForm<FormProfilo>({
    resolver: zodResolver(schemaProfilo),
    defaultValues: { nome: profile?.nome ?? '', telefono: profile?.telefono ?? '' },
  });
  useEffect(() => {
    if (profile && !formState.isDirty) reset({ nome: profile.nome, telefono: profile.telefono ?? '' });
  }, [profile, reset, formState.isDirty]);

  const salva = useAzione(azioni.aggiornaProfilo, { successo: 'Profilo salvato' });

  return (
    <div className="grid max-w-2xl gap-8">
      <PageHeader titolo="Profilo" sottotitolo={profile ? `Sei: ${profile.roles.map((r) => RUOLI[r]).join(', ')}` : undefined} />

      {!profile ? (
        <SkeletonRighe righe={3} />
      ) : (
        <Sezione titolo="I tuoi dati" id="profilo-dati">
          <form
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit((v) => {
              const telefono = normalizzaTelefono(v.telefono);
              salva.mutate({ id: profile.id, nome: v.nome.trim(), telefono }, { onSuccess: () => reset({ nome: v.nome.trim(), telefono: telefono ?? '' }) });
            })}
          >
            <Field label="Nome e cognome" error={formState.errors.nome?.message}>
              {(p) => <Input {...p} {...register('nome')} autoComplete="name" />}
            </Field>
            <Field
              label="Telefono (facoltativo)"
              hint="Serve per i messaggi WhatsApp tra giocatori: gli altri della tua partita possono scriverti con un tocco. Formato +39…"
              error={formState.errors.telefono?.message}
            >
              {(p) => <Input {...p} {...register('telefono')} type="tel" inputMode="tel" autoComplete="tel" placeholder="+39 333 123 4567" />}
            </Field>
            <div className="grid gap-1.5">
              <span className="text-sm font-semibold">Email</span>
              <p className="text-ink-muted">{profile.email}</p>
            </div>
            <Button type="submit" variant="primary" className="justify-self-start" loading={salva.isPending} disabled={!formState.isDirty}>
              Salva
            </Button>
          </form>
        </Sezione>
      )}

      <Sezione titolo="Tema" id="profilo-tema">
        <p className="text-ink-muted">Vale solo su questo dispositivo e si applica subito.</p>
        <Segmented<Tema>
          label="Tema"
          value={tema}
          onValueChange={setTema}
          options={[
            { value: 'light', label: 'Chiaro' },
            { value: 'dark', label: 'Scuro' },
            { value: 'system', label: 'Come il dispositivo' },
          ]}
          className="justify-self-start"
        />
      </Sezione>

      <Sezione titolo="Account" id="profilo-account">
        <Button
          variant="secondary"
          className="justify-self-start"
          loading={uscita}
          onClick={async () => {
            setUscita(true);
            try {
              await signOut();
              navigate('/', { replace: true });
            } finally {
              setUscita(false);
            }
          }}
        >
          <LogOut aria-hidden /> Esci
        </Button>
      </Sezione>
    </div>
  );
}
