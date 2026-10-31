import { LogIn, TriangleAlert, UserPlus, UsersRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRighe } from '../../components/states';
import { messaggioErrore } from '../../data/errors';
import { azioni, useAzione } from '../../data/mutations';
import { useInvito, useSquadre, useTorneo } from '../../data/queries';
import { Button, buttonVariants } from '../../ui';

type Blocco = 'BAD_TOKEN' | 'TEAM_FULL' | 'ALREADY_IN_TEAM' | 'REGISTRATION_CLOSED';

const MESSAGGI: Record<Blocco, string> = {
  BAD_TOKEN: 'Questo invito non è valido. Chiedi a chi te l’ha mandato un link nuovo.',
  TEAM_FULL: 'La coppia è già completa.',
  ALREADY_IN_TEAM: 'Sei già in una coppia di questo torneo.',
  REGISTRATION_CLOSED: 'Le iscrizioni sono chiuse.',
};

/** Testo grande (zoom 200%): i pulsanti lunghi vanno a capo invece di allargare la pagina. */
const RIFLUSSO = 'min-w-0 [&_a]:whitespace-normal [&_button]:whitespace-normal [&_h1]:break-words [&_h1]:hyphens-auto';

export default function InvitoPage() {
  return (
    <div className={RIFLUSSO}>
      <InvitoContenuto />
    </div>
  );
}

function InvitoContenuto() {
  const { token } = useParams();
  const { user, loading } = useAuth();

  if (loading)
    return (
      <>
        <PageHeader titolo="Invito in una coppia" />
        <SkeletonRighe righe={2} />
      </>
    );

  if (!user) {
    const next = encodeURIComponent(`/invito/${token ?? ''}`);
    return (
      <div className="grid max-w-xl gap-5">
        <PageHeader
          titolo="Ti hanno invitato in una coppia"
          sottotitolo="Un amico ti ha iscritto con sé a un torneo di padel. Accedi o crea un account per vedere l’invito ed entrare nella coppia."
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

  return <InvitoAutenticato token={token!} uid={user.id} />;
}

function InvitoAutenticato({ token, uid }: { token: string; uid: string }) {
  const navigate = useNavigate();
  const invito = useInvito(token);
  const dati = invito.data ?? null;
  const torneo = useTorneo(dati?.torneo_id);
  const squadre = useSquadre(dati?.torneo_id);
  const [erroreJoin, setErroreJoin] = useState<{ codice: Blocco | null; testo: string } | null>(null);

  const entra = useAzione(azioni.entraInCoppia, {
    errore: false,
    successo: () => (dati ? `Sei nella coppia «${dati.nome}».` : 'Sei nella coppia.'),
    onSuccess: () => dati && navigate(`/t/${dati.torneo_id}/coppia`, { replace: true }),
  });

  if (invito.isPending || (dati && (torneo.isPending || squadre.isPending)))
    return (
      <>
        <PageHeader titolo="Invito in una coppia" />
        <SkeletonRighe righe={2} />
      </>
    );

  if (invito.error) {
    const hint = (invito.error as { hint?: string }).hint;
    if (hint !== 'BAD_TOKEN')
      return (
        <>
          <PageHeader titolo="Invito in una coppia" />
          <ErrorState errore={invito.error} onRiprova={() => invito.refetch()} />
        </>
      );
  }

  if (!dati) return <Bloccato codice="BAD_TOKEN" />;

  const giaInSquadra = (squadre.data ?? []).find((s) => s.giocatori.includes(uid));
  const inQuesta = giaInSquadra?.id === dati.squadra_id;
  let blocco: Blocco | null = null;
  if (giaInSquadra && !inQuesta) blocco = 'ALREADY_IN_TEAM';
  else if (!inQuesta && (dati.giocatori >= 2 || dati.stato !== 'in attesa partner')) blocco = 'TEAM_FULL';
  else if (!inQuesta && torneo.data && torneo.data.stato !== 'iscrizioni') blocco = 'REGISTRATION_CLOSED';
  if (erroreJoin?.codice) blocco = erroreJoin.codice;

  const frase = (
    <>
      {dati.creatore_nome} ti ha invitato nella coppia «{dati.nome}»{torneo.data ? ` per ${torneo.data.nome}` : ''}.
    </>
  );

  if (inQuesta)
    return (
      <div className="grid max-w-xl gap-5">
        <PageHeader titolo={`Sei già nella coppia «${dati.nome}»`} sottotitolo="Hai già accettato questo invito." />
        <Link to={`/t/${dati.torneo_id}/coppia`} className={buttonVariants({ variant: 'secondary', className: 'justify-self-start' })}>
          <UsersRound aria-hidden /> Vai alla tua coppia
        </Link>
      </div>
    );

  if (blocco) return <Bloccato codice={blocco} frase={frase} tid={dati.torneo_id} />;

  return (
    <div className="grid max-w-xl gap-5">
      <PageHeader titolo="Entra nella coppia" sottotitolo={frase} />
      <p className="max-w-prose">
        Entrando, la coppia è completa e passa all’organizzatore per l’approvazione. Dopo potrai segnare le tue disponibilità.
      </p>
      <Button
        variant="primary"
        size="lg"
        className="justify-self-start"
        loading={entra.isPending}
        onClick={() =>
          entra.mutate(token, {
            onError: (e) => {
              const hint = (e as { hint?: string }).hint as Blocco | undefined;
              setErroreJoin(hint && hint in MESSAGGI ? { codice: hint, testo: MESSAGGI[hint] } : { codice: null, testo: messaggioErrore(e) });
            },
          })
        }
      >
        <UserPlus aria-hidden /> Entra nella coppia
      </Button>
      {erroreJoin && !erroreJoin.codice && (
        <p role="alert" className="flex items-start gap-2 font-semibold text-danger-ink">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {erroreJoin.testo}
        </p>
      )}
    </div>
  );
}

function Bloccato({ codice, frase, tid }: { codice: Blocco; frase?: ReactNode; tid?: string }) {
  return (
    <div className="grid max-w-xl gap-5">
      <PageHeader titolo="Non puoi entrare in questa coppia" sottotitolo={frase} />
      <p role="alert" className="flex items-start gap-2 text-lg font-semibold">
        <TriangleAlert className="mt-1 size-5 shrink-0 text-warn-ink" aria-hidden />
        {MESSAGGI[codice]}
      </p>
      <div className="flex flex-wrap gap-2">
        {codice === 'ALREADY_IN_TEAM' && tid && (
          <Link to={`/t/${tid}/coppia`} className={buttonVariants({ variant: 'secondary' })}>
            <UsersRound aria-hidden /> Vai alla tua coppia
          </Link>
        )}
        {codice !== 'ALREADY_IN_TEAM' && tid && (
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
