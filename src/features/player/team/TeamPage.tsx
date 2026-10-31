import { BadgeCheck, CalendarRange, Check, Copy, Hourglass, Pencil, Trash2, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../../auth/AuthProvider';
import { PageHeader, Section } from '../../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../../components/states';
import { TONE_CLASSES } from '../../../components/StatusBadge';
import { WhatsAppButton } from '../../../components/WhatsAppButton';
import { actions, useAction } from '../../../data/mutations';
import { useMyInvite, useNames, useProfiles, useTournamentData } from '../../../data/queries';
import type { Tone } from '../../../lib/copy';
import { appUrl } from '../../../lib/whatsapp';
import type { Team, TeamStatus } from '../../../types';
import { Button, buttonVariants, cn, ConfirmDialog, Field, Input, Skeleton } from '../../../ui';

/** Badge copy for the player's own team (wording differs from TEAM_STATUS_LABEL on purpose). */
const TEAM_STATUS_BADGE: Record<TeamStatus, { label: string; icon: LucideIcon; tone: Tone }> = {
  awaiting_partner: { label: 'Manca il compagno', icon: UserPlus, tone: 'warn' },
  pending_approval: { label: 'Da approvare', icon: Hourglass, tone: 'info' },
  approved: { label: 'Approvata', icon: BadgeCheck, tone: 'ok' },
  withdrawn: { label: 'Ritirata', icon: UserMinus, tone: 'idle' },
};

function TeamStatusBadge({ status }: { status: TeamStatus }) {
  const v = TEAM_STATUS_BADGE[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold', TONE_CLASSES[v.tone])}>
      <v.icon className="size-4" aria-hidden />
      {v.label}
    </span>
  );
}

function validateName(name: string): string | null {
  const n = name.trim();
  if (!n) return 'Scrivi il nome della coppia.';
  if (n.length > 40) return 'Il nome è troppo lungo: al massimo 40 caratteri.';
  return null;
}

/** Large text (200% zoom): long buttons wrap instead of widening the page. */
const REFLOW = 'min-w-0 [&_a]:whitespace-normal [&_button]:whitespace-normal [&_h1]:break-words [&_h1]:hyphens-auto';

export default function TeamPage() {
  return (
    <div className={REFLOW}>
      <TeamContent />
    </div>
  );
}

function TeamContent() {
  const { tid } = useParams();
  const { user } = useAuth();
  const td = useTournamentData(tid);

  if (td.isPending)
    return (
      <>
        <PageHeader title="La tua coppia" />
        <SkeletonRows rows={3} />
      </>
    );
  if (td.error || !td.tournament)
    return (
      <>
        <PageHeader title="La tua coppia" />
        <ErrorState error={td.error} onRetry={td.refetch} />
      </>
    );

  const uid = user!.id;
  const mine = td.teams.find((t) => t.players.includes(uid)) ?? td.teams.find((t) => t.createdBy === uid);

  if (!mine) {
    if (td.tournament.status !== 'registration')
      return (
        <>
          <PageHeader title="La tua coppia" />
          <EmptyState
            title="Le iscrizioni sono chiuse."
            text="Il torneo è già partito. Puoi seguire classifiche e calendario dalla pagina del torneo."
            action={
              <Link to={`/t/${tid}`} className={buttonVariants({ variant: 'secondary' })}>
                Vai al torneo
              </Link>
            }
          />
        </>
      );
    return <CreateTeam tid={tid!} tournamentName={td.tournament.name} />;
  }

  return <MyTeam tid={tid!} uid={uid} team={mine} tournamentName={td.tournament.name} />;
}

function CreateTeam({ tid, tournamentName }: { tid: string; tournamentName: string }) {
  const [name, setName] = useState('');
  const [attempted, setAttempted] = useState(false);
  const create = useAction(actions.createTeam, { success: 'Coppia creata. Ora invita il tuo compagno.' });
  const error = attempted ? validateName(name) : null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (validateName(name)) return;
    create.mutate({ tournament: tid, name: name.trim() });
  };

  return (
    <>
      <PageHeader title="Iscrivi la tua coppia" subtitle={`Torneo ${tournamentName}. Dai un nome alla coppia, poi mandi il link d’invito al tuo compagno.`} />
      <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4">
        <Field label="Nome della coppia" hint="Lo vedranno tutti in classifica, per esempio «I Bomber»." error={error}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={60} />}
        </Field>
        <Button type="submit" variant="primary" loading={create.isPending} className="justify-self-start">
          Crea la coppia
        </Button>
      </form>
    </>
  );
}

function MyTeam({ tid, uid, team, tournamentName }: { tid: string; uid: string; team: Team; tournamentName: string }) {
  const { name } = useNames();
  const profiles = useProfiles();
  const isCreator = team.createdBy === uid;
  const partnerId = team.players.find((p) => p !== uid);
  const partner = partnerId ? profiles.data?.find((p) => p.id === partnerId) : undefined;
  const partnerName = partnerId ? (partner?.name ?? name(partnerId)) : null;
  const renamable = isCreator && (team.status === 'awaiting_partner' || team.status === 'pending_approval');

  return (
    <>
      <PageHeader title="La tua coppia" subtitle={`Torneo ${tournamentName}`} />
      <div className="grid gap-6 [&>*]:min-w-0">
        <section aria-labelledby="team-h" className="grid gap-3 [&>*]:min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="team-h" className="poster text-poster-sm">
              {team.name}
            </h2>
            <TeamStatusBadge status={team.status} />
          </div>
          <ul className="court-rule max-w-xl">
            <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 py-2">
              <span className="text-ink-muted">Tu</span>
              <span className="font-semibold">{name(uid)}</span>
            </li>
            <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 py-2">
              <span className="text-ink-muted">Compagno</span>
              <span className="font-semibold">{partnerName ?? 'non ancora entrato'}</span>
            </li>
            {team.status === 'approved' && (
              <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 py-2">
                <span className="text-ink-muted">Girone</span>
                <span className="font-semibold">{team.group ? `Girone ${team.group}` : 'non ancora assegnato'}</span>
              </li>
            )}
          </ul>
          {renamable && <Rename team={team} />}
        </section>

        {team.status === 'awaiting_partner' && (
          <Section title="Invita il tuo compagno" id="invite-h">
            {isCreator ? (
              <Invite team={team} tournamentName={tournamentName} />
            ) : (
              <p className="text-ink-muted">Il link d’invito ce l’ha chi ha creato la coppia.</p>
            )}
          </Section>
        )}

        {team.status === 'pending_approval' && (
          <Section title="Cosa succede ora" id="next-h">
            <p className="max-w-prose">
              Tu e {partnerName ?? 'il tuo compagno'} siete iscritti. Manca l’approvazione dell’organizzatore: quando arriva, trovi qui il
              tuo girone.
            </p>
          </Section>
        )}

        {team.status === 'approved' && (
          <Section title="Prossimo passo" id="next-h">
            <p className="max-w-prose">
              La coppia è approvata. Segna quando puoi giocare: l’app trova da sola gli orari buoni per tutti e quattro.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/t/${tid}/disponibilita`} className={buttonVariants({ variant: 'primary' })}>
                <CalendarRange aria-hidden /> Segna le tue disponibilità
              </Link>
              {partnerId && (
                <WhatsAppButton text={`Ciao ${partnerName ?? ''}, segniamo le disponibilità per il torneo? ${appUrl(`/t/${tid}/disponibilita`)}`} phone={partner?.phone}>
                  Scrivi a {partnerName}
                </WhatsAppButton>
              )}
            </div>
            {partnerId && !partner?.phone && profiles.data && (
              <p className="text-sm text-ink-muted">{partnerName} non ha indicato il telefono: WhatsApp ti farà scegliere il contatto.</p>
            )}
          </Section>
        )}

        {team.status === 'withdrawn' && (
          <Section title="Coppia ritirata" id="next-h">
            <p className="max-w-prose">
              La coppia è stata ritirata dal torneo. I risultati già giocati restano in classifica; per dubbi scrivi all’organizzatore.
            </p>
          </Section>
        )}
      </div>
    </>
  );
}

function Invite({ team, tournamentName }: { team: Team; tournamentName: string }) {
  const invite = useMyInvite(team.id);
  const [copied, setCopied] = useState<'ok' | 'error' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteAction = useAction(actions.deleteTeam, { success: 'Coppia eliminata.', onSuccess: () => setConfirmDelete(false) });

  const link = invite.data ? appUrl(`/invito/${invite.data}`) : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
  };

  return (
    <div className="grid max-w-xl gap-4">
      <p className="max-w-prose">
        Manda questo link al tuo compagno: quando lo apre ed entra, la coppia passa all’organizzatore per l’approvazione.
      </p>
      {invite.isPending ? (
        <Skeleton className="h-11 w-full" />
      ) : invite.error ? (
        <ErrorState error={invite.error} onRetry={() => invite.refetch()} />
      ) : !link ? (
        <p className="text-ink-muted">Il link d’invito non è disponibile. Ricarica la pagina o chiedi all’organizzatore.</p>
      ) : (
        <>
          <Field label="Link d’invito">
            {(p) => <Input {...p} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="text-sm" />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <WhatsAppButton
              variant="primary"
              text={`Ciao! Ti ho iscritto con me al ${tournamentName} come coppia «${team.name}». Entra qui → ${link}`}
            >
              Invia su WhatsApp
            </WhatsAppButton>
            <Button variant="secondary" onClick={copy}>
              {copied === 'ok' ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied === 'ok' ? 'Link copiato' : 'Copia link'}
            </Button>
          </div>
          <p aria-live="polite" className="text-sm text-ink-muted">
            {copied === 'error' ? 'Non sono riuscito a copiare: tieni premuto sul link e copialo a mano.' : ''}
          </p>
        </>
      )}

      <div className="border-t border-line pt-4">
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Eliminare la coppia?"
          description={`La coppia «${team.name}» viene cancellata e il link d’invito smette di funzionare. Potrai crearne un’altra.`}
          confirmLabel="Elimina la coppia"
          loading={deleteAction.isPending}
          onConfirm={() => deleteAction.mutate(team.id)}
          trigger={
            <Button variant="danger">
              <Trash2 aria-hidden /> Elimina la coppia
            </Button>
          }
        />
      </div>
    </div>
  );
}

function Rename({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(team.name);
  const [attempted, setAttempted] = useState(false);
  const save = useAction(actions.updateTeam, { success: 'Nome della coppia aggiornato.', onSuccess: () => setOpen(false) });
  const error = attempted ? validateName(name) : null;

  if (!open)
    return (
      <Button
        variant="ghost"
        className="justify-self-start"
        onClick={() => {
          setName(team.name);
          setAttempted(false);
          setOpen(true);
        }}
      >
        <Pencil aria-hidden /> Rinomina
      </Button>
    );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (validateName(name)) return;
    save.mutate({ id: team.id, name: name.trim() });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-3">
      <Field label="Nuovo nome della coppia" hint="Puoi cambiarlo finché l’organizzatore non approva la coppia." error={error}>
        {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoFocus maxLength={60} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="court" loading={save.isPending}>
          Salva nome
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
