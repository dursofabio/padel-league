import { CalendarRange, List, Plus, TriangleAlert, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useBlocker, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../../../auth/AuthProvider';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../../../components/states';
import { WhatsAppButton } from '../../../components/WhatsAppButton';
import { actions, useAction } from '../../../data/mutations';
import { useAvailability, useCourts, useTournamentData } from '../../../data/queries';
import {
  addToWeekdays,
  addWindowWithOutcome,
  changedDays,
  copyToSameWeekday,
  defaultPeriod,
  futureOnly,
  openPeriods,
  periodDays,
  removeWindow,
  setDay,
  timeStep,
  weeks,
  windowsEqual,
} from '../../../lib/windows';
import { labelDate, today, weekday } from '../../../lib/time';
import { appUrl } from '../../../lib/whatsapp';
import type { Availability, Court, Period, Windows } from '../../../types';
import { Button, ConfirmDialog, Field, Segmented, Select, Sheet } from '../../../ui';
import { AddWindow, copyLabel, DayActions, WindowChips, weekdayPlural } from './DayEditor';
import { QuickFill } from './QuickFill';
import { TickLegend, Timeline } from './Timeline';
import { WeekStrip } from './WeekStrip';

const EMPTY: Windows = {};

/** "2026-11-10" -> "10/11" */
function ggmm(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

function periodLabel(p: Period): string {
  return `${p.label} · ${ggmm(p.startsOn)} – ${ggmm(p.endsOn)}`;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** Large text (200% zoom): long buttons wrap instead of widening the page. */
const REFLOW = 'min-w-0 [&_a]:whitespace-normal [&_button]:whitespace-normal [&_h1]:break-words [&_h1]:hyphens-auto';

export default function AvailabilityPage() {
  return (
    <div className={REFLOW}>
      <AvailabilityContent />
    </div>
  );
}

function AvailabilityContent() {
  const { tid } = useParams();
  const { user } = useAuth();
  const uid = user?.id;
  const td = useTournamentData(tid);
  const avail = useAvailability(tid, uid ? [uid] : []);
  const courts = useCourts();

  if (td.isPending || avail.isPending)
    return (
      <>
        <PageHeader title="Le mie disponibilità" />
        <SkeletonRows rows={6} />
      </>
    );
  const error = td.error ?? avail.error;
  if (error)
    return (
      <>
        <PageHeader title="Le mie disponibilità" />
        <ErrorState
          error={error}
          onRetry={() => {
            td.refetch();
            avail.refetch();
          }}
        />
      </>
    );

  return (
    <Editor
      key={`${tid}-${uid}`}
      tid={tid!}
      uid={uid!}
      saved={avail.data?.[uid!]}
      serverData={avail.data}
      td={td}
      courts={courts.data ?? []}
    />
  );
}

function Editor({
  tid,
  uid,
  saved,
  serverData,
  td,
  courts,
}: {
  tid: string;
  uid: string;
  saved: Availability | undefined;
  serverData: unknown;
  td: ReturnType<typeof useTournamentData>;
  courts: Court[];
}) {
  const todayDate = today();
  const online = useOnline();
  const serverWindows = saved?.windows ?? EMPTY;

  // base = last saved version we know of; draft = what the user is editing
  const [base, setBase] = useState<Windows>(serverWindows);
  const [draft, setDraft] = useState<Windows>(serverWindows);
  const [seen, setSeen] = useState(serverData);
  const [conflict, setConflict] = useState<Windows | null>(null);
  const changed = useMemo(() => changedDays(draft, base), [draft, base]);
  const dirty = changed.length > 0;

  // a new version arrives from the server (realtime, another device, after saving)
  if (serverData !== seen) {
    setSeen(serverData);
    if (!dirty) {
      setBase(serverWindows);
      setDraft(serverWindows);
      setConflict(null);
    } else if (!windowsEqual(serverWindows, base)) {
      setConflict(serverWindows);
    }
  }

  const open = useMemo(() => openPeriods(td.periods, todayDate), [td.periods, todayDate]);
  const [periodId, setPeriodId] = useState<string | undefined>(() => defaultPeriod(open, td.matches, uid)?.id);
  const period = open.find((p) => p.id === periodId) ?? open[0];
  const days = useMemo(() => (period ? periodDays(period, todayDate) : []), [period, todayDate]);
  const step = timeStep(td.tournament?.config);

  const [openRow, setOpenRow] = useState<string | null>(null); // "Aggiungi orario" row open (list view)
  const [inSheet, setInSheet] = useState<string | null>(null); // day opened from the week view
  const [view, setView] = useState<'week' | 'list'>('week');
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useAction(actions.saveAvailability, { success: 'Disponibilità salvate.', error: false });

  // closing the tab with unsaved changes: browser warning
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  // opening/closing the "Aggiungi orario" row: on close focus returns to the day's button
  const addButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const [returnFocus, setReturnFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!returnFocus) return;
    const target =
      addButtons.current[returnFocus] ??
      // "Aggiungi orario" row open: the day's first control
      document.querySelector<HTMLElement>(`[data-day-row="${returnFocus}"] button`);
    target?.focus();
    setReturnFocus(null);
  }, [returnFocus]);
  const closeRow = (d: string) => {
    setOpenRow(null);
    setReturnFocus(d);
  };

  // toast actions (Annulla, Copia su…) run later: they read the latest draft
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const update = (n: Windows) => {
    draftRef.current = n;
    setDraft(n);
    setSaveError(null);
  };

  const withUndo = (before: Windows, message: string) =>
    toast(message, { action: { label: 'Annulla', onClick: () => update(before) } });

  const hasSameWeekday = (d: string) => days.some((x) => x !== d && weekday(x) === weekday(d));

  const copy = (date: string) => {
    const before = draftRef.current;
    const r = copyToSameWeekday(before, date, days);
    update(r.windows);
    withUndo(before, `Copiato su ${r.days.length} ${weekdayPlural(date, r.days.length)}.`);
  };

  const add = (date: string, from: string, to: string) => {
    const current = draftRef.current;
    const wasEmpty = !(current[date] ?? []).length;
    const r = addWindowWithOutcome(current[date] ?? [], from, to);
    update(setDay(current, date, r.list));
    // first time of the day: offer right away to repeat it on the same weekdays
    if (wasEmpty && hasSameWeekday(date))
      toast(`Aggiunto a ${labelDate(date)}.`, { action: { label: copyLabel(date), onClick: () => copy(date) } });
    return r.mergedInto;
  };
  // the pressed button (chip ×, Svuota) disappears: focus returns to the day's "Aggiungi" (list view)
  const remove = (date: string, w: string) => {
    update(setDay(draftRef.current, date, removeWindow(draftRef.current[date] ?? [], w)));
    if (!inSheet) setReturnFocus(date);
  };

  const clear = (date: string) => {
    const before = draftRef.current;
    update(setDay(before, date, []));
    withUndo(before, `${labelDate(date)} svuotato.`);
    if (!inSheet) setReturnFocus(date);
  };

  const applyQuickFill = (weekdays: number[], from: string, to: string) => {
    const before = draftRef.current;
    const r = addToWeekdays(before, days, weekdays, from, to);
    update(r.windows);
    withUndo(before, `Aggiunto ${from}–${to} a ${r.days.length} ${r.days.length === 1 ? 'giorno' : 'giorni'} del periodo.`);
  };

  const onSave = () => {
    if (!online) {
      setSaveError('Sei offline: salva quando torna la connessione.');
      return;
    }
    const cleaned = futureOnly(draft, todayDate);
    save.mutate(
      { tournament: tid, uid, windows: cleaned },
      {
        onSuccess: () => {
          setBase(cleaned);
          setDraft(cleaned);
          setConflict(null);
          setSaveError(null);
        },
        onError: () => setSaveError('Non sono riuscito a salvare. Le modifiche sono ancora qui: riprova.'),
      },
    );
  };

  const header = (
    <PageHeader
      title="Le mie disponibilità"
      subtitle="Segna quando puoi giocare. Vale per tutte le tue partite del periodo e conta già come accettazione degli orari che copre."
      actions={
        period && (
          <WhatsAppButton
            text={`Segna le tue disponibilità per ${period.label} (${ggmm(period.startsOn)}–${ggmm(period.endsOn)}), così troviamo subito un orario: ${appUrl(`/t/${tid}/disponibilita`)}`}
          >
            Ricorda al gruppo
          </WhatsAppButton>
        )
      }
    />
  );

  if (!period)
    return (
      <>
        {header}
        <EmptyState
          title="Nessun periodo aperto"
          text="Non c'è un periodo di gioco aperto. Quando l'organizzatore apre il prossimo, lo trovi qui."
        />
      </>
    );

  return (
    <>
      {header}

      <div className="grid gap-5 [&>*]:min-w-0">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          {open.length <= 3 ? (
            <div className="grid gap-1.5">
              <span className="text-sm font-semibold">Periodo</span>
              <Segmented
                label="Periodo"
                value={period.id}
                onValueChange={setPeriodId}
                options={open.map((p) => ({ value: p.id, label: <span className="tabular whitespace-normal">{periodLabel(p)}</span> }))}
                className="h-auto max-w-full flex-wrap"
              />
            </div>
          ) : (
            <Field label="Periodo" className="w-full sm:w-80">
              {(p) => (
                <Select {...p} value={period.id} onChange={(e) => setPeriodId(e.target.value)}>
                  {open.map((x) => (
                    <option key={x.id} value={x.id}>
                      {periodLabel(x)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Segmented
            label="Vista"
            value={view}
            onValueChange={setView}
            className="hidden lg:inline-flex"
            options={[
              {
                value: 'week',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="size-4" aria-hidden /> Vista settimana
                  </span>
                ),
              },
              {
                value: 'list',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <List className="size-4" aria-hidden /> Vista elenco
                  </span>
                ),
              },
            ]}
          />
        </div>

        {conflict && (
          <div role="status" className="grid gap-3 rounded-panel bg-warn-soft p-4 text-warn-ink">
            <p className="flex items-start gap-2 font-semibold">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              Hai modificato le disponibilità da un altro dispositivo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setBase(conflict);
                  setDraft(conflict);
                  setConflict(null);
                }}
              >
                Usa quelle salvate
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setBase(conflict);
                  setConflict(null);
                }}
              >
                Tieni le mie
              </Button>
            </div>
          </div>
        )}

        <section aria-labelledby="quick-fill-h" className="grid gap-3">
          <div className="grid gap-1">
            <h2 id="quick-fill-h" className="poster text-poster-sm">
              Compila veloce
            </h2>
            <p className="max-w-prose text-ink-muted">
              {!saved && !dirty
                ? 'Inizia da qui: scegli i giorni in cui giochi di solito e un orario, lo aggiungo a tutti quei giorni del periodo. Poi ritocca i singoli giorni qui sotto.'
                : 'Scegli i giorni della settimana e un orario: lo aggiungo a tutti quei giorni del periodo.'}
            </p>
          </div>
          <QuickFill step={step} onApply={applyQuickFill} />
        </section>

        <section aria-labelledby="days-h" className="grid gap-3 border-t border-line pt-5">
          <h2 id="days-h" className="poster text-poster-sm">
            Giorno per giorno
          </h2>
          {days.length === 0 ? (
            <EmptyState title="Il periodo è finito" text="Non restano giorni da segnare in questo periodo." />
          ) : (
            <>
              <div className={view === 'week' ? 'hidden gap-3 lg:grid' : 'hidden'}>
                <p className="text-ink-muted">Clicca un giorno per aggiungere o togliere un orario.</p>
                <TickLegend courts={courts} vertical />
                <WeekStrip days={days} windows={draft} courts={courts} today={todayDate} selected={inSheet} onOpen={setInSheet} />
              </div>
              <div className={view === 'week' ? 'grid gap-5 lg:hidden' : 'grid gap-5'}>
                {days.some((d) => (draft[d] ?? []).length > 0) && <TickLegend courts={courts} />}
                {weeks(days).map((w) => {
                  const weekDays = w.filter((d): d is string => !!d);
                  const title = `Settimana ${ggmm(weekDays[0])} – ${ggmm(weekDays[weekDays.length - 1])}`;
                  return (
                    <div key={weekDays[0]} className="grid gap-1">
                      <h3 className="tabular text-base font-bold text-ink-muted">{title}</h3>
                      <ul className="court-rule border-y border-line" aria-label={title}>
                        {weekDays.map((d) => {
                          const list = draft[d] ?? [];
                          const empty = list.length === 0;
                          const addRef = (el: HTMLButtonElement | null) => {
                            addButtons.current[d] = el;
                          };
                          return (
                            <li key={d} data-day-row={d} className={empty && openRow !== d ? 'py-1' : 'grid gap-3 py-3'}>
                              <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                <p className="flex flex-wrap items-baseline gap-x-3">
                                  <span className="tabular text-lg font-bold">{labelDate(d)}</span>
                                  {d === todayDate && <span className="text-sm font-semibold text-ink">oggi</span>}
                                  {empty && openRow !== d && <span className="text-sm text-ink-muted">nessun orario</span>}
                                  {changed.includes(d) && <span className="text-sm text-ink-muted">modificato</span>}
                                </p>
                                {empty && openRow !== d && (
                                  <Button ref={addRef} variant="ghost" className="text-ink" aria-label={`Aggiungi orario, ${labelDate(d)}`} onClick={() => setOpenRow(d)}>
                                    <Plus aria-hidden /> Aggiungi
                                  </Button>
                                )}
                              </div>
                              {!empty && <WindowChips windows={list} onRemove={(w) => remove(d, w)} />}
                              {!empty && <Timeline date={d} windows={list} courts={courts} />}
                              {!empty && (
                                <div className="flex flex-wrap gap-2">
                                  {openRow !== d && (
                                    <Button ref={addRef} variant="secondary" onClick={() => setOpenRow(d)}>
                                      <Plus aria-hidden /> Aggiungi orario
                                    </Button>
                                  )}
                                  <DayActions
                                    date={d}
                                    hasWindows
                                    canCopy={hasSameWeekday(d)}
                                    onCopy={() => copy(d)}
                                    onClear={() => clear(d)}
                                  />
                                </div>
                              )}
                              {openRow === d && (
                                <AddWindow step={step} onAdd={(from, to) => add(d, from, to)} onClose={() => closeRow(d)} />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <p aria-live="polite" className="sr-only">
          {dirty ? 'Hai modifiche non salvate.' : ''}
        </p>

        {dirty && (
          <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 grid gap-2 rounded-panel border border-line bg-surface p-3 shadow-raised lg:bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold">
                Modifiche non salvate ({changed.length} {changed.length === 1 ? 'giorno' : 'giorni'})
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => update(base)} disabled={save.isPending}>
                  Annulla modifiche
                </Button>
                <Button variant="primary" onClick={onSave} loading={save.isPending}>
                  Salva
                </Button>
              </div>
            </div>
            {(saveError || !online) && (
              <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-danger-ink">
                {!online ? <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
                {!online ? 'Sei offline: salva quando torna la connessione.' : saveError}
              </p>
            )}
          </div>
        )}
      </div>

      <Sheet
        open={!!inSheet}
        onOpenChange={(o) => !o && setInSheet(null)}
        title={inSheet ? labelDate(inSheet) : ''}
        description="Le modifiche restano in bozza finché non tocchi «Salva»."
      >
        {inSheet && (
          <div className="grid gap-4">
            <WindowChips windows={draft[inSheet] ?? []} onRemove={(w) => remove(inSheet, w)} />
            <div className="flex flex-wrap gap-2">
              <DayActions
                date={inSheet}
                hasWindows={(draft[inSheet] ?? []).length > 0}
                canCopy={hasSameWeekday(inSheet)}
                onCopy={() => copy(inSheet)}
                onClear={() => clear(inSheet)}
              />
            </div>
            <div className="border-t border-line pt-4">
              <AddWindow key={inSheet} step={step} framed={false} onAdd={(from, to) => add(inSheet, from, to)} />
            </div>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset();
        }}
        title="Esci senza salvare?"
        description={`Hai modifiche non salvate su ${changed.length} ${changed.length === 1 ? 'giorno' : 'giorni'}. Se esci le perdi.`}
        cancelLabel="Resta qui"
        confirmLabel="Esci senza salvare"
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}
