import { LogIn, TriangleAlert, UserPlus, UsersRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/states';
import { errorMessage } from '../../data/errors';
import { actions, useAction } from '../../data/mutations';
import { useInvite, useTeams, useTournament } from '../../data/queries';
import { Button, buttonVariants } from '../../ui';

type Block = 'BAD_TOKEN' | 'TEAM_FULL' | 'ALREADY_IN_TEAM' | 'REGISTRATION_CLOSED';

const MESSAGES: Record<Block, string> = {
  BAD_TOKEN: 'Questo invito non è valido. Chiedi a chi te l’ha mandato un link nuovo.',
  TEAM_FULL: 'La coppia è già completa.',
  ALREADY_IN_TEAM: 'Sei già in una coppia di questo torneo.',
  REGISTRATION_CLOSED: 'Le iscrizioni sono chiuse.',
};

/** Large text (200% zoom): long buttons wrap instead of widening the page. */
const REFLOW = 'min-w-0 [&_a]:whitespace-normal [&_button]:whitespace-normal [&_h1]:break-words [&_h1]:hyphens-auto';

export default function InvitePage() {
  return (
    <div className={REFLOW}>
      <InviteContent />
    </div>
  );
}

function InviteContent() {
  const { token } = useParams();
  const { user, loading } = useAuth();

  if (loading)
    return (
      <>
        <PageHeader title="Invito in una coppia" />
        <SkeletonRows rows={2} />
      </>
    );

  if (!user) {
    const next = encodeURIComponent(`/invito/${token ?? ''}`);
    return (
      <div className="grid max-w-xl gap-5">
        <PageHeader
          title="Ti hanno invitato in una coppia"
          subtitle="Un amico ti ha iscritto con sé a un torneo di padel. Accedi o crea un account per vedere l’invito ed entrare nella coppia."
        />
        <div className="grid justify-items-start gap-2">
          <Link to={`/accedi?next=${next}`} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            <LogIn aria-hidden /> Accedi o registrati
          </Link>
          <p className="text-sm text-ink-muted">Se non hai ancora un account scegli «Sono nuovo». Dopo l’accesso torni qui.</p>
        </div>
      </div>
    );
  }

  return <AuthenticatedInvite token={token!} uid={user.id} />;
}

function AuthenticatedInvite({ token, uid }: { token: string; uid: string }) {
  const navigate = useNavigate();
  const invite = useInvite(token);
  const info = invite.data ?? null;
  const tournament = useTournament(info?.tournament_id);
  const teams = useTeams(info?.tournament_id);
  const [joinError, setJoinError] = useState<{ code: Block | null; text: string } | null>(null);

  const join = useAction(actions.joinTeam, {
    error: false,
    success: () => (info ? `Sei nella coppia «${info.name}».` : 'Sei nella coppia.'),
    onSuccess: () => info && navigate(`/t/${info.tournament_id}/coppia`, { replace: true }),
  });

  if (invite.isPending || (info && (tournament.isPending || teams.isPending)))
    return (
      <>
        <PageHeader title="Invito in una coppia" />
        <SkeletonRows rows={2} />
      </>
    );

  if (invite.error) {
    const hint = (invite.error as { hint?: string }).hint;
    if (hint !== 'BAD_TOKEN')
      return (
        <>
          <PageHeader title="Invito in una coppia" />
          <ErrorState error={invite.error} onRetry={() => invite.refetch()} />
        </>
      );
  }

  if (!info) return <Blocked code="BAD_TOKEN" />;

  const alreadyInTeam = (teams.data ?? []).find((t) => t.players.includes(uid));
  const inThisTeam = alreadyInTeam?.id === info.team_id;
  let block: Block | null = null;
  if (alreadyInTeam && !inThisTeam) block = 'ALREADY_IN_TEAM';
  else if (!inThisTeam && (info.players >= 2 || info.status !== 'awaiting_partner')) block = 'TEAM_FULL';
  else if (!inThisTeam && tournament.data && tournament.data.status !== 'registration') block = 'REGISTRATION_CLOSED';
  if (joinError?.code) block = joinError.code;

  const sentence = (
    <>
      {info.creator_name} ti ha invitato nella coppia «{info.name}»{tournament.data ? ` per ${tournament.data.name}` : ''}.
    </>
  );

  if (inThisTeam)
    return (
      <div className="grid max-w-xl gap-5">
        <PageHeader title={`Sei già nella coppia «${info.name}»`} subtitle="Hai già accettato questo invito." />
        <Link to={`/t/${info.tournament_id}/coppia`} className={buttonVariants({ variant: 'secondary', className: 'justify-self-start' })}>
          <UsersRound aria-hidden /> Vai alla tua coppia
        </Link>
      </div>
    );

  if (block) return <Blocked code={block} sentence={sentence} tid={info.tournament_id} />;

  return (
    <div className="grid max-w-xl gap-5">
      <PageHeader title="Entra nella coppia" subtitle={sentence} />
      <p className="max-w-prose">
        Entrando, la coppia è completa e passa all’organizzatore per l’approvazione. Dopo potrai segnare le tue disponibilità.
      </p>
      <Button
        variant="primary"
        size="lg"
        className="justify-self-start"
        loading={join.isPending}
        onClick={() =>
          join.mutate(token, {
            onError: (e) => {
              const hint = (e as { hint?: string }).hint as Block | undefined;
              setJoinError(hint && hint in MESSAGES ? { code: hint, text: MESSAGES[hint] } : { code: null, text: errorMessage(e) });
            },
          })
        }
      >
        <UserPlus aria-hidden /> Entra nella coppia
      </Button>
      {joinError && !joinError.code && (
        <p role="alert" className="flex items-start gap-2 font-semibold text-danger-ink">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {joinError.text}
        </p>
      )}
    </div>
  );
}

function Blocked({ code, sentence, tid }: { code: Block; sentence?: ReactNode; tid?: string }) {
  return (
    <div className="grid max-w-xl gap-5">
      <PageHeader title="Non puoi entrare in questa coppia" subtitle={sentence} />
      <p role="alert" className="flex items-start gap-2 text-lg font-semibold">
        <TriangleAlert className="mt-1 size-5 shrink-0 text-warn-ink" aria-hidden />
        {MESSAGES[code]}
      </p>
      <div className="flex flex-wrap gap-2">
        {code === 'ALREADY_IN_TEAM' && tid && (
          <Link to={`/t/${tid}/coppia`} className={buttonVariants({ variant: 'secondary' })}>
            <UsersRound aria-hidden /> Vai alla tua coppia
          </Link>
        )}
        {code !== 'ALREADY_IN_TEAM' && tid && (
          <Link to={`/t/${tid}`} className={buttonVariants({ variant: 'secondary' })}>
            Vai al torneo
          </Link>
        )}
        {!tid && (
          <Link to="/" className={buttonVariants({ variant: 'secondary' })}>
            Torna alla home
          </Link>
        )}
      </div>
    </div>
  );
}
