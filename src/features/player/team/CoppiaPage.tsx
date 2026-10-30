import { BadgeCheck, CalendarRange, Check, Copy, Hourglass, Pencil, Trash2, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { PageHeader, Sezione } from '../../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../../../components/states';
import { TONO_CLASSI } from '../../../components/StatusBadge';
import { WhatsAppButton } from '../../../components/WhatsAppButton';
import { azioni, useAzione } from '../../../data/mutations';
import { useMioInvito, useNomi, useProfili, useTorneoData } from '../../../data/queries';
import type { Tono } from '../../../lib/copy';
import { appUrl } from '../../../lib/whatsapp';
import type { Squadra, StatoSquadra } from '../../../types';
import { Button, buttonVariants, cn, ConfirmDialog, Field, Input, Skeleton } from '../../../ui';

const STATO_SQUADRA: Record<StatoSquadra, { label: string; icon: LucideIcon; tono: Tono }> = {
  'in attesa partner': { label: 'Manca il compagno', icon: UserPlus, tono: 'warn' },
  'da approvare': { label: 'Da approvare', icon: Hourglass, tono: 'info' },
  approvata: { label: 'Approvata', icon: BadgeCheck, tono: 'ok' },
  ritirata: { label: 'Ritirata', icon: UserMinus, tono: 'idle' },
};

function StatoSquadraBadge({ stato }: { stato: StatoSquadra }) {
  const v = STATO_SQUADRA[stato];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold', TONO_CLASSI[v.tono])}>
      <v.icon className="size-4" aria-hidden />
      {v.label}
    </span>
  );
}

function validaNome(nome: string): string | null {
  const n = nome.trim();
  if (!n) return 'Scrivi il nome della coppia.';
  if (n.length > 40) return 'Il nome è troppo lungo: al massimo 40 caratteri.';
  return null;
}

/** Testo grande (zoom 200%): i pulsanti lunghi vanno a capo invece di allargare la pagina. */
const RIFLUSSO = 'min-w-0 [&_a]:whitespace-normal [&_button]:whitespace-normal [&_h1]:break-words [&_h1]:hyphens-auto';

export default function CoppiaPage() {
  return (
    <div className={RIFLUSSO}>
      <CoppiaContenuto />
    </div>
  );
}

function CoppiaContenuto() {
  const { tid } = useParams();
  const { user } = useAuth();
  const td = useTorneoData(tid);

  if (td.isPending)
    return (
      <>
        <PageHeader titolo="La tua coppia" />
        <SkeletonRighe righe={3} />
      </>
    );
  if (td.error || !td.torneo)
    return (
      <>
        <PageHeader titolo="La tua coppia" />
        <ErrorState errore={td.error} onRiprova={td.refetch} />
      </>
    );

  const uid = user!.id;
  const mia = td.squadre.find((s) => s.giocatori.includes(uid)) ?? td.squadre.find((s) => s.creatoDa === uid);

  if (!mia) {
    if (td.torneo.stato !== 'iscrizioni')
      return (
        <>
          <PageHeader titolo="La tua coppia" />
          <EmptyState
            titolo="Le iscrizioni sono chiuse."
            testo="Il torneo è già partito. Puoi seguire classifiche e calendario dalla pagina del torneo."
            azione={
              <Link to={`/t/${tid}`} className={buttonVariants({ variant: 'secondary' })}>
                Vai al torneo
              </Link>
            }
          />
        </>
      );
    return <CreaCoppia tid={tid!} nomeTorneo={td.torneo.nome} />;
  }

  return <LaMiaCoppia tid={tid!} uid={uid} squadra={mia} nomeTorneo={td.torneo.nome} />;
}

function CreaCoppia({ tid, nomeTorneo }: { tid: string; nomeTorneo: string }) {
  const [nome, setNome] = useState('');
  const [provato, setProvato] = useState(false);
  const crea = useAzione(azioni.creaCoppia, { successo: 'Coppia creata. Ora invita il tuo compagno.' });
  const errore = provato ? validaNome(nome) : null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProvato(true);
    if (validaNome(nome)) return;
    crea.mutate({ torneo: tid, nome: nome.trim() });
  };

  return (
    <>
      <PageHeader titolo="Iscrivi la tua coppia" sottotitolo={`Torneo ${nomeTorneo}. Dai un nome alla coppia, poi mandi il link d’invito al tuo compagno.`} />
      <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4">
        <Field label="Nome della coppia" hint="Lo vedranno tutti in classifica, per esempio «I Bomber»." error={errore}>
          {(p) => <Input {...p} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" maxLength={60} />}
        </Field>
        <Button type="submit" variant="primary" loading={crea.isPending} className="justify-self-start">
          Crea la coppia
        </Button>
      </form>
    </>
  );
}

function LaMiaCoppia({ tid, uid, squadra, nomeTorneo }: { tid: string; uid: string; squadra: Squadra; nomeTorneo: string }) {
  const { nome } = useNomi();
  const profili = useProfili();
  const creatore = squadra.creatoDa === uid;
  const compagnoId = squadra.giocatori.find((g) => g !== uid);
  const compagno = compagnoId ? profili.data?.find((p) => p.id === compagnoId) : undefined;
  const nomeCompagno = compagnoId ? (compagno?.nome ?? nome(compagnoId)) : null;
  const rinominabile = creatore && (squadra.stato === 'in attesa partner' || squadra.stato === 'da approvare');

  return (
    <>
      <PageHeader titolo="La tua coppia" sottotitolo={`Torneo ${nomeTorneo}`} />
      <div className="grid gap-6 [&>*]:min-w-0">
        <section aria-labelledby="coppia-h" className="grid gap-3 [&>*]:min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="coppia-h" className="text-xl font-bold">
              {squadra.nome}
            </h2>
            <StatoSquadraBadge stato={squadra.stato} />
          </div>
          <ul className="court-rule max-w-xl">
            <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 py-2">
              <span className="text-ink-muted">Tu</span>
              <span className="font-semibold">{nome(uid)}</span>
            </li>
            <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 py-2">
              <span className="text-ink-muted">Compagno</span>
              <span className="font-semibold">{nomeCompagno ?? 'non ancora entrato'}</span>
            </li>
            {squadra.stato === 'approvata' && (
              <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 py-2">
                <span className="text-ink-muted">Girone</span>
                <span className="font-semibold">{squadra.girone ? `Girone ${squadra.girone}` : 'non ancora assegnato'}</span>
              </li>
            )}
          </ul>
          {rinominabile && <Rinomina squadra={squadra} />}
        </section>

        {squadra.stato === 'in attesa partner' && (
          <Sezione titolo="Invita il tuo compagno" id="invito-h">
            {creatore ? (
              <Invito squadra={squadra} nomeTorneo={nomeTorneo} />
            ) : (
              <p className="text-ink-muted">Il link d’invito ce l’ha chi ha creato la coppia.</p>
            )}
          </Sezione>
        )}

        {squadra.stato === 'da approvare' && (
          <Sezione titolo="Cosa succede ora" id="ora-h">
            <p className="max-w-prose">
              Tu e {nomeCompagno ?? 'il tuo compagno'} siete iscritti. Manca l’approvazione dell’organizzatore: quando arriva, trovi qui il
              tuo girone.
            </p>
          </Sezione>
        )}

        {squadra.stato === 'approvata' && (
          <Sezione titolo="Prossimo passo" id="ora-h">
            <p className="max-w-prose">
              La coppia è approvata. Segna quando puoi giocare: l’app trova da sola gli orari buoni per tutti e quattro.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/t/${tid}/disponibilita`} className={buttonVariants({ variant: 'primary' })}>
                <CalendarRange aria-hidden /> Segna le tue disponibilità
              </Link>
              {compagnoId && (
                <WhatsAppButton testo={`Ciao ${nomeCompagno ?? ''}, segniamo le disponibilità per il torneo? ${appUrl(`/t/${tid}/disponibilita`)}`} telefono={compagno?.telefono}>
                  Scrivi a {nomeCompagno}
                </WhatsAppButton>
              )}
            </div>
            {compagnoId && !compagno?.telefono && profili.data && (
              <p className="text-sm text-ink-muted">{nomeCompagno} non ha indicato il telefono: WhatsApp ti farà scegliere il contatto.</p>
            )}
          </Sezione>
        )}

        {squadra.stato === 'ritirata' && (
          <Sezione titolo="Coppia ritirata" id="ora-h">
            <p className="max-w-prose">
              La coppia è stata ritirata dal torneo. I risultati già giocati restano in classifica; per dubbi scrivi all’organizzatore.
            </p>
          </Sezione>
        )}
      </div>
    </>
  );
}

function Invito({ squadra, nomeTorneo }: { squadra: Squadra; nomeTorneo: string }) {
  const invito = useMioInvito(squadra.id);
  const [copiato, setCopiato] = useState<'ok' | 'errore' | null>(null);
  const [elimina, setElimina] = useState(false);
  const eliminaAz = useAzione(azioni.eliminaSquadra, { successo: 'Coppia eliminata.', onSuccess: () => setElimina(false) });

  const link = invito.data ? appUrl(`/invito/${invito.data}`) : null;

  const copia = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiato('ok');
    } catch {
      setCopiato('errore');
    }
  };

  return (
    <div className="grid max-w-xl gap-4">
      <p className="max-w-prose">
        Manda questo link al tuo compagno: quando lo apre ed entra, la coppia passa all’organizzatore per l’approvazione.
      </p>
      {invito.isPending ? (
        <Skeleton className="h-11 w-full" />
      ) : invito.error ? (
        <ErrorState errore={invito.error} onRiprova={() => invito.refetch()} />
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
              testo={`Ciao! Ti ho iscritto con me al ${nomeTorneo} come coppia «${squadra.nome}». Entra qui → ${link}`}
            >
              Invia su WhatsApp
            </WhatsAppButton>
            <Button variant="secondary" onClick={copia}>
              {copiato === 'ok' ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copiato === 'ok' ? 'Link copiato' : 'Copia link'}
            </Button>
          </div>
          <p aria-live="polite" className="text-sm text-ink-muted">
            {copiato === 'errore' ? 'Non sono riuscito a copiare: tieni premuto sul link e copialo a mano.' : ''}
          </p>
        </>
      )}

      <div className="border-t border-line pt-4">
        <ConfirmDialog
          open={elimina}
          onOpenChange={setElimina}
          title="Eliminare la coppia?"
          description={`La coppia «${squadra.nome}» viene cancellata e il link d’invito smette di funzionare. Potrai crearne un’altra.`}
          confirmLabel="Elimina la coppia"
          loading={eliminaAz.isPending}
          onConfirm={() => eliminaAz.mutate(squadra.id)}
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

function Rinomina({ squadra }: { squadra: Squadra }) {
  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState(squadra.nome);
  const [provato, setProvato] = useState(false);
  const salva = useAzione(azioni.aggiornaSquadra, { successo: 'Nome della coppia aggiornato.', onSuccess: () => setAperto(false) });
  const errore = provato ? validaNome(nome) : null;

  if (!aperto)
    return (
      <Button
        variant="ghost"
        className="justify-self-start"
        onClick={() => {
          setNome(squadra.nome);
          setProvato(false);
          setAperto(true);
        }}
      >
        <Pencil aria-hidden /> Rinomina
      </Button>
    );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProvato(true);
    if (validaNome(nome)) return;
    salva.mutate({ id: squadra.id, nome: nome.trim() });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-3">
      <Field label="Nuovo nome della coppia" hint="Puoi cambiarlo finché l’organizzatore non approva la coppia." error={errore}>
        {(p) => <Input {...p} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" autoFocus maxLength={60} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="court" loading={salva.isPending}>
          Salva nome
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAperto(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
