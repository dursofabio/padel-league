import { Equal, Medal, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/states';
import { StandingsTable } from '../../components/StandingsTable';
import { useTorneoData } from '../../data/queries';
import type { RigaClassifica } from '../../lib/standings';
import { classificheTorneo, nomeSquadra } from '../../lib/torneo';
import type { Spareggio, Squadra } from '../../types';
import { Segmented } from '../../ui/misc';
import { AvvisoOffline, InvitoAccesso, StatoTorneoPagina, useMiaSquadra, useOnline } from './comune';

const CRITERIO: Record<Spareggio, string> = {
  punti: 'punti',
  scontroDiretto: 'scontro diretto',
  diffSet: 'differenza set',
  diffGame: 'differenza game',
  setVinti: 'set vinti',
  gameVinti: 'game vinti',
  sorteggio: 'sorteggio',
};

/** Standings of every group (/t/:tid/classifiche): switcher on mobile, side by side on desktop. */
export default function ClassifichePage() {
  const { tid } = useParams();
  const d = useTorneoData(tid);
  const online = useOnline();
  const mia = useMiaSquadra(d.squadre);
  const classifiche = useMemo(() => (d.torneo ? classificheTorneo(d.torneo, d.squadre, d.partite) : {}), [d.torneo, d.squadre, d.partite]);
  const nomi = Object.keys(classifiche);
  const [scelto, setScelto] = useState<string | null>(null);

  const stato = StatoTorneoPagina({ isPending: d.isPending, error: d.error, torneo: d.torneo, refetch: d.refetch });
  if (stato || !d.torneo) return stato;
  const torneo = d.torneo;
  const attivo = scelto && nomi.includes(scelto) ? scelto : (mia?.girone && nomi.includes(mia.girone) ? mia.girone : nomi[0]);
  const criteri = torneo.config.spareggi.map((s) => CRITERIO[s]).join(', ');

  return (
    <>
      <PageHeader titolo="Classifiche" sottotitolo={torneo.nome} indietro={{ to: `/t/${torneo.id}`, label: 'Torneo' }} />
      {!online && <AvvisoOffline />}
      {nomi.length === 0 ? (
        <EmptyState titolo="I gironi non sono ancora stati composti." testo="Le classifiche compaiono appena l’organizzatore crea i gironi e il calendario." />
      ) : (
        <div className="grid gap-6">
          {nomi.length > 1 && (
            <Segmented
              label="Girone"
              className="justify-self-start lg:hidden"
              value={attivo}
              onValueChange={setScelto}
              options={nomi.map((g) => ({ value: g, label: `Girone ${g}` }))}
            />
          )}
          <div className="grid gap-10 lg:grid-cols-2">
            {nomi.map((g) => (
              <section key={g} aria-labelledby={`girone-${g}`} className={g === attivo ? 'grid content-start gap-3' : 'hidden content-start gap-3 lg:grid'}>
                <h2 id={`girone-${g}`} className="text-lg font-bold">
                  Girone {g}
                </h2>
                <StandingsTable
                  girone={g}
                  righe={classifiche[g]}
                  squadraById={d.squadraById}
                  fasi={torneo.config.fasiFinali}
                  nGironi={nomi.length}
                  evidenzia={mia?.id}
                />
                <NoteGirone righe={classifiche[g]} squadraById={d.squadraById} miaId={mia?.id} />
              </section>
            ))}
          </div>

          <div className="grid gap-2 border-t border-line pt-4 text-sm text-ink-muted">
            <p>Pt punti · G giocate · V vinte · P perse · ±Set differenza set · ±Game differenza game</p>
            <p className="flex items-start gap-2">
              <Medal className="mt-0.5 size-4 shrink-0" aria-hidden />
              {torneo.config.criterioQualificazione === 'avulsa'
                ? 'La linea spessa separa le zone di qualificazione. Le migliori seconde si decidono con la classifica avulsa (media punti).'
                : `La linea spessa separa le zone di qualificazione: ${torneo.config.fasiFinali.map((f) => f.nome).join(' sopra, ')} sotto. Ogni riga riporta la sua zona.`}
            </p>
            <p>Criteri: {criteri}.</p>
            <p className="md:hidden">Ruota il telefono o scorri la tabella per vedere vinte, perse e differenza game.</p>
          </div>
        </div>
      )}
      <InvitoAccesso />
    </>
  );
}

function NoteGirone({ righe, squadraById, miaId }: { righe: RigaClassifica[]; squadraById: Map<string, Squadra>; miaId?: string }) {
  // unresolved ties, grouped by points
  const perPunti = new Map<number, string[]>();
  for (const r of righe) if (r.pariMerito) perPunti.set(r.punti, [...(perPunti.get(r.punti) ?? []), nomeSquadra(squadraById, r.squadraId)]);
  const mia = miaId ? righe.find((r) => r.squadraId === miaId) : undefined;
  if (!perPunti.size && !mia) return null;
  return (
    <div className="grid gap-1.5 text-sm">
      {mia && (
        <p className="flex items-center gap-2">
          <User className="size-4 shrink-0" aria-hidden />
          <span>
            La tua coppia è <strong>{mia.posizione}ª</strong> con <span className="tabular">{mia.punti}</span> punti.
          </span>
        </p>
      )}
      {[...perPunti.values()]
        .filter((n) => n.length > 1)
        .map((n) => (
          <p key={n.join()} className="flex items-start gap-2 text-ink-muted">
            <Equal className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {n.slice(0, -1).join(', ')} e {n.at(-1)} sono pari anche dopo tutti i criteri: decide il sorteggio dell’organizzatore.
            </span>
          </p>
        ))}
    </div>
  );
}
