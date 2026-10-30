/**
 * Component gallery (development only, /#/_kit): synthetic data to check the design system
 * at 390/820/1440 px in light and dark themes. Not shipped in production.
 */
import { Check, CircleDashed, Clock, Lock } from 'lucide-react';
import { useState } from 'react';
import { useTema } from '../app/theme';
import { CourtLanes, LaneBlock, scalaDaCampi } from '../components/CourtLanes';
import { MatchRow } from '../components/MatchRow';
import { PageHeader, Sezione } from '../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRighe } from '../components/states';
import { StandingsTable } from '../components/StandingsTable';
import { Badge, StatoPartitaBadge, StatoRichiestaBadge } from '../components/StatusBadge';
import { STATO_SLOT } from '../lib/copy';
import { slotGriglia } from '../lib/slots';
import type { Campo, Partita, Squadra, StatoPartita, StatoRichiesta } from '../types';
import { Button, Checkbox, ConfirmDialog, Field, Input, Segmented, Select, Sheet, Switch } from '../ui';

const campi: Campo[] = [
  { id: 'c1', nome: 'Campo 1', primoSlot: '13:30', ultimoSlot: '21:00', durata: 90, giorniAttivi: [0, 1, 2, 3, 4, 5, 6], eccezioni: [] },
  { id: 'c2', nome: 'Campo 2', primoSlot: '14:00', ultimoSlot: '20:00', durata: 90, giorniAttivi: [0, 1, 2, 3, 4, 5, 6], eccezioni: [] },
];
const squadre: Squadra[] = [
  { id: 's1', nome: 'Le Bandejas', giocatori: [], stato: 'approvata', creatoDa: '', girone: 'A' },
  { id: 's2', nome: 'Vibora Team', giocatori: [], stato: 'approvata', creatoDa: '', girone: 'A' },
  { id: 's3', nome: 'Chiquita', giocatori: [], stato: 'approvata', creatoDa: '', girone: 'A' },
  { id: 's4', nome: 'Por Tres', giocatori: [], stato: 'approvata', creatoDa: '', girone: 'A' },
];
const byId = new Map(squadre.map((s) => [s.id, s]));
const base = { giocatoriA: [] as string[], giocatoriB: [] as string[], giocatori: [] as string[], fase: 'gironi' };
const partite: Partita[] = [
  { ...base, id: 'p1', squadraA: 's1', squadraB: 's2', stato: 'programmata', programmazione: { campoId: 'c2', data: '2026-11-14', inizio: '18:30', fine: '20:00' } },
  { ...base, id: 'p2', squadraA: 's3', squadraB: 's4', stato: 'giocata', risultato: { set: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 10, b: 7 }], inseritoDa: 'x', confermatoDa: 'y' } },
  { ...base, id: 'p3', squadraA: 's2', squadraB: 's3', stato: 'da programmare' },
];
const stati = ['verde', 'verde', 'giallo', 'rosso', 'grigio', 'blu'] as const;
const icone = { verde: Check, giallo: CircleDashed, grigio: CircleDashed, rosso: Lock, blu: Clock };
const toni = { verde: 'ok', giallo: 'warn', grigio: 'idle', rosso: 'danger', blu: 'info' } as const;

export default function KitPage() {
  const [tema, setTema] = useTema();
  const [sheet, setSheet] = useState(false);
  const [sel, setSel] = useState<string | null>('c2-15:30');
  const scala = scalaDaCampi(campi, 0.75);
  return (
    <div className="grid gap-8">
      <PageHeader
        titolo="Kit di sistema"
        sottotitolo="Dati sintetici, solo sviluppo."
        azioni={
          <Segmented
            label="Tema"
            value={tema}
            onValueChange={setTema}
            options={[
              { value: 'light', label: 'Chiaro' },
              { value: 'dark', label: 'Scuro' },
              { value: 'system', label: 'Sistema' },
            ]}
          />
        }
      />
      <Sezione titolo="Azioni">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Invia richiesta</Button>
          <Button>Proponi un altro orario</Button>
          <Button variant="court">Conferma partita</Button>
          <Button variant="ghost">Annulla</Button>
          <Button variant="danger">Rifiuta</Button>
          <Button variant="primary" loading>
            Invio…
          </Button>
          <Button variant="link">Ho dimenticato la password</Button>
        </div>
      </Sezione>
      <Sezione titolo="Campi del modulo">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome della coppia" hint="Lo vedranno tutti in classifica.">
            {(p) => <Input {...p} defaultValue="Le Bandejas" />}
          </Field>
          <Field label="Campo" error="Il campo è chiuso in quel giorno.">
            {(p) => (
              <Select {...p}>
                <option>Campo 1</option>
                <option>Campo 2</option>
              </Select>
            )}
          </Field>
          <label className="flex min-h-11 items-center gap-3">
            <Checkbox defaultChecked /> Consenti richieste fuori griglia
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <Switch defaultChecked /> Set decisivo come super tie-break
          </label>
        </div>
      </Sezione>
      <Sezione titolo="Stati">
        <div className="flex flex-wrap gap-2">
          {(['da programmare', 'richiesta', 'programmata', 'giocata', 'contestata', 'tavolino'] as StatoPartita[]).map((s) => (
            <StatoPartitaBadge key={s} stato={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['attesa', 'confermata', 'rifiutata', 'annullata', 'conflitto', 'scaduta'] as StatoRichiesta[]).map((s) => (
            <StatoRichiestaBadge key={s} stato={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(STATO_SLOT).map((v) => (
            <Badge key={v.label} voce={v} />
          ))}
        </div>
      </Sezione>
      <Sezione titolo="Partite">
        <ul className="court-rule">
          {partite.map((p) => (
            <li key={p.id}>
              <MatchRow p={p} squadraById={byId} campi={campi} href="#" evidenzia={['s1']} />
            </li>
          ))}
        </ul>
      </Sezione>
      <Sezione titolo="Corsie dei campi">
        <CourtLanes
          campi={campi}
          scala={scala}
          caption="sab 14/11"
          oraCorrente={17 * 60 + 10}
          renderLane={(c) =>
            slotGriglia(c, '2026-11-14').map((s, i) => {
              const st = stati[(i + (c.id === 'c2' ? 2 : 0)) % stati.length];
              const Icon = icone[st];
              const key = `${c.id}-${s.inizio}`;
              return (
                <LaneBlock
                  key={key}
                  scala={scala}
                  inizio={s.inizio}
                  fine={s.fine}
                  tono={toni[st]}
                  pattern={st === 'rosso' ? 'hatch' : st === 'grigio' ? 'dots' : undefined}
                  selezionato={sel === key}
                  onClick={() => setSel(key)}
                  ariaLabel={`${s.inizio}, ${c.nome}: ${STATO_SLOT[st].label}`}
                >
                  <span className="tabular flex items-center gap-1 font-bold">
                    <Icon className="size-4" aria-hidden />
                    {s.inizio}
                  </span>
                  <span className="text-xs">{st === 'giallo' ? '3/4 · manca Luca' : STATO_SLOT[st].label}</span>
                </LaneBlock>
              );
            })
          }
        />
      </Sezione>
      <Sezione titolo="Classifica">
        <StandingsTable
          girone="A"
          squadraById={byId}
          fasi={[
            { nome: 'Gold', posti: 2 },
            { nome: 'Silver', posti: 2 },
          ]}
          nGironi={1}
          evidenzia="s1"
          righe={squadre.map((s, i) => ({
            squadraId: s.id, girone: 'A', giocate: 3, vinte: 3 - i, perse: i, punti: 9 - i * 3, setVinti: 6 - i, setPersi: i * 2,
            gameVinti: 40 - i * 5, gamePersi: 20 + i * 5, posizione: i + 1, pariMerito: i === 3,
          }))}
        />
      </Sezione>
      <Sezione titolo="Stati di pagina">
        <SkeletonRighe righe={2} />
        <EmptyState titolo="Niente da fare" testo="Prossima partita: sab 14/11 alle 18:30 sul Campo 2." azione={<Button>Vedi le partite</Button>} />
        <ErrorState errore={{ hint: 'SLOT_TAKEN' }} onRiprova={() => undefined} />
      </Sezione>
      <Sezione titolo="Pannelli">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSheet(true)}>Apri pannello</Button>
          <ConfirmDialog
            trigger={<Button variant="danger">Annulla partita confermata</Button>}
            title="Annullare la partita?"
            description="Il campo torna libero e la partita torna da programmare."
            confirmLabel="Annulla partita"
            cancelLabel="Tienila"
            onConfirm={() => undefined}
          />
        </div>
        <Sheet
          open={sheet}
          onOpenChange={setSheet}
          title="sab 14/11 · 15:30–17:00 · Campo 2"
          description="Tutti e 4 sono liberi e il campo è libero."
          footer={<Button variant="primary">Invia richiesta</Button>}
        >
          <p>Contenuto del pannello.</p>
        </Sheet>
      </Sezione>
    </div>
  );
}
