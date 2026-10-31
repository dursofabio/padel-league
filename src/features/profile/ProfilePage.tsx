import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useTheme, type Theme } from '../../app/theme';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader, Section } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/states';
import { actions, useAction } from '../../data/mutations';
import { ROLE_LABEL } from '../../lib/copy';
import { Button, Field, Input, Segmented } from '../../ui';
import { normalizePhone, profileSchema, type ProfileForm } from './logic';

export default function ProfilePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const { register, handleSubmit, reset, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile?.name ?? '', phone: profile?.phone ?? '' },
  });
  useEffect(() => {
    if (profile && !formState.isDirty) reset({ name: profile.name, phone: profile.phone ?? '' });
  }, [profile, reset, formState.isDirty]);

  const save = useAction(actions.updateProfile, { success: 'Profilo salvato' });

  return (
    <div className="grid max-w-2xl gap-8">
      <PageHeader title="Profilo" subtitle={profile ? `Sei: ${profile.roles.map((r) => ROLE_LABEL[r]).join(', ')}` : undefined} />

      {!profile ? (
        <SkeletonRows rows={3} />
      ) : (
        <Section title="I tuoi dati" id="profile-data">
          <form
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit((v) => {
              const phone = normalizePhone(v.phone);
              save.mutate({ id: profile.id, name: v.name.trim(), phone }, { onSuccess: () => reset({ name: v.name.trim(), phone: phone ?? '' }) });
            })}
          >
            <Field label="Nome e cognome" error={formState.errors.name?.message}>
              {(p) => <Input {...p} {...register('name')} autoComplete="name" />}
            </Field>
            <Field
              label="Telefono (facoltativo)"
              hint="Serve per i messaggi WhatsApp tra giocatori: gli altri della tua partita possono scriverti con un tocco. Formato +39…"
              error={formState.errors.phone?.message}
            >
              {(p) => <Input {...p} {...register('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="+39 333 123 4567" />}
            </Field>
            <div className="grid gap-1.5">
              <span className="text-sm font-semibold">Email</span>
              <p className="text-ink-muted">{profile.email}</p>
            </div>
            <Button type="submit" variant="primary" className="justify-self-start" loading={save.isPending} disabled={!formState.isDirty}>
              Salva
            </Button>
          </form>
        </Section>
      )}

      <Section title="Tema" id="profile-theme">
        <p className="text-ink-muted">Vale solo su questo dispositivo e si applica subito.</p>
        <Segmented<Theme>
          label="Tema"
          value={theme}
          onValueChange={setTheme}
          options={[
            { value: 'light', label: 'Chiaro' },
            { value: 'dark', label: 'Scuro' },
            { value: 'system', label: 'Come il dispositivo' },
          ]}
          className="justify-self-start"
        />
      </Section>

      <Section title="Account" id="profile-account">
        <Button
          variant="secondary"
          className="justify-self-start"
          loading={signingOut}
          onClick={async () => {
            setSigningOut(true);
            try {
              await signOut();
              navigate('/', { replace: true });
            } finally {
              setSigningOut(false);
            }
          }}
        >
          <LogOut aria-hidden /> Esci
        </Button>
      </Section>
    </div>
  );
}
