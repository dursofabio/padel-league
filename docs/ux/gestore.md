# Brief: Gestore del campo (`/campo`, `/campo/giorno/:data?`, `/campo/ricorrenze`, `/campo/impostazioni`)

Glossary and consolidated assumptions: [README.md](README.md).

## 1. Job and audience

- 1–2 court managers at the club's front desk, on a phone or a tablet, interrupted every few minutes by customers and the phone. They also run the club's own booking system; this app is only for the league and for keeping the 2 courts' day accurate.
- Needs: confirm or reject league requests with one tap without ever double-booking; mark external bookings, lessons and closures so players only see real free slots.
- Some gestori also play: their tabs are the union of roles (max 5).

## 2. Outcome and proof

- Primary action: "Conferma" on a 4/4 request, from the inbox, in one tap, with conflicts and off-grid impact visible before tapping.
- Success: no court is ever booked twice (server EXCLUDE constraint + `confirm_request` returning `occupato`); requests are answered before they expire; the timeline matches the real court.
- Product truth: `confirm_request` never throws on overlap, it returns `{esito, conflitti}`; `add_occupation`/`close_day` return how many pending requests moved to `conflitto`. The UI must report those numbers.

## 3. Selected direction consequences

- **Day timeline = two court lanes** (signature move): Campo 1 and Campo 2 as parallel vertical lanes (tablet/desktop) with time on horizontal court lines, Campo 2 grid starts offset 30'. Empty grid slots are outlined cells with their start time; occupations are blocks spanning their real duration (any length, 15' precision).
- Occupation types differ by **pattern + icon + label**, not colour alone: campionato (turf blue, `Trophy`, pair names), esterno (solid neutral fill, `Users`, "Esterno"), lezione (diagonal hatch, `GraduationCap`, "Lezione"), chiusura (cross-hatch, `DoorClosed`, "Chiuso").
- Inbox rows separated by court lines; lime only on "Conferma" (and on the selected row in two-pane). Reject and counter-propose are quiet secondary actions.
- Turf-blue top bar shows the club name/"Campo"; the current day in the day picker is turf-blue selected.

## 4. Scope and anti-goals

- In: inbox (pending, incomplete, upcoming confirmed with cancel), confirm/reject/counter-propose, off-grid impact preview, day timeline (navigate days, add occupation sheet from an empty slot or any time, remove occupation, close day), recurrences (list, create, apply, delete), court settings (name, first slot, last start, duration, active days, closure dates, order).
- Out: club booking system, payments, customer names for external bookings beyond a free note, multi-club.
- Anti-goal: a week calendar with drag-and-drop; modals for confirm (one-tap must stay one tap).

## 5. States and realistic ranges

- Pending requests: 0–15 (peaks before period ends); upcoming confirmed: 0–25 over the next 2 weeks. Per day: 2 courts × ~6 grid slots, 0–6 occupations each, 0–4 league matches.
- Request sub-states in inbox: 4/4 ready; < 4/4 (waiting players: cannot be confirmed); expiring < 2 h; off-grid (impact); counterproposal sent by me (waiting players); overlapping another pending request on the same court/time ("Sovrapposta").
- States: loading skeleton rows/lanes, empty inbox, empty day, court not active that day ("Campo chiuso il martedì"), action busy, action outcome banner, Realtime arrival of a new request (row inserted, polite announcement), offline (actions disabled with reason).

## 6. Interaction and layout

### Inbox (`/campo`)

- **Sections**: "Da confermare" (live, 4/4) sorted by `scadenza` asc; "In attesa dei giocatori" (live, < 4/4; collapsed by default, shows "3/4 · manca Luca"); "Prossime partite confermate" (next 14 days, by date/time).
- **Row**: "sab 14/11 · 15:30–17:00 · Campo 2"; pairs "Rossi/Bianchi – Verdi/Neri"; badges with icons: "Fuori griglia" (`Clock3`), "Controproposta" (`Repeat`), "Sovrapposta" (`TriangleAlert`); expiry "scade tra 5 h"; actions: lime "Conferma", secondary "Rifiuta", "Proponi altro orario".
- **Conflicts shown before confirming**: if another live request overlaps (same court, overlapping time), both rows show "Sovrapposta a 15:00 Campo 2 (Gialli/Blu)"; confirming one says in the outcome "1 richiesta sovrapposta è passata in conflitto".
- **Off-grid impact**: row shows a mini two-lane strip for that court and ±2 h with the requested block in blue and impacted grid slots hatched "inutilizzabile", plus text "Rende inutilizzabili gli slot delle 15:00 e 16:30 sul Campo 1" (`slotImpattati`).
- **Confirm**: one tap, no dialog. Outcomes: `ok` → row leaves, banner "Confermata sab 14/11 15:30 · Campo 2" (+ "; 1 richiesta sovrapposta in conflitto"); `occupato` → row turns to "Conflitto: il campo risulta occupato" with "Proponi altro orario"; `scaduta` → "Scaduta nel frattempo".
- **Reject**: opens an inline note row (optional, quick picks "Campo occupato", "Manutenzione", "Orario non disponibile") + "Rifiuta"; no AlertDialog (not destructive to the court).
- **Counter-propose**: opens a sheet prefilled with `slotLiberoPiuVicino` (same court first, then other court; days ±3 within the match period) showing "sab 14/11 · 16:30 · Campo 1 (3/4 già disponibili)"; the gestore can change court/day/start with the same lane picker as the players (slot states visible), add a note, then "Invia proposta". Text: "I giocatori dovranno accettare. La richiesta originale viene chiusa." If none found: "Nessun orario libero vicino: scegline uno tu."
- **Upcoming confirmed**: row with "Annulla partita" (AlertDialog, destructive: "Annullare la partita di sab 14/11 15:30? Il campo si libera e i giocatori dovranno riprogrammarla." with optional note) → `cancel_confirmed`.

### Day timeline (`/campo/giorno/:data?`)

- Day picker: "‹ ieri", date button (opens native date input), "domani ›", "Oggi". Default: today.
- Two lanes, time 08:00–24:00, auto-scrolled to 13:00 (or now if later). Grid slot cells show start time; tap an empty cell (or long-press/click empty time) → **Add occupation sheet** prefilled with court, start = slot start, end = slot end; fields: tipo (segmented: Esterno, Lezione, Chiusura), dalle/alle (15' steps), nota; lime "Segna occupato". Outcome: "Segnato. 1 richiesta in attesa è passata in conflitto." when `conflitti > 0`.
- Tap an occupation → sheet with details; for non-campionato: "Libera" (AlertDialog: "Liberare lezione 18:00–19:00 sul Campo 1?"). For campionato: pair names, link to the match, "Annulla partita" (same as inbox cancel).
- Pending requests appear as dashed blue outlines in their slot ("Richiesta in attesa") so the gestore sees what an occupation would hit.
- **Close day**: secondary destructive button "Chiudi la giornata" → AlertDialog with required reason (prefilled "Chiusura"); outcome reports `errori` (e.g. confirmed matches that block closure) and `conflitti`.
- 390: lanes side by side, each ~half width, cells show time + short label; occupation note truncated (full in sheet).

### Recurrences (`/campo/ricorrenze`)

- List rows: "ogni martedì 18:00–19:30 · Campo 1 · Lezione · scuola padel · dal 01/10 al 31/01". Actions: "Applica ai prossimi 60 giorni" (`materialize_recurrence`, outcome "Segnati 8 giorni. Saltati: 18/11 (già occupato)"), "Elimina" (AlertDialog: "Le occupazioni già segnate restano: liberale dalla giornata se serve.").
- "Nuova ricorrenza" sheet: campo, giorno della settimana, dalle/alle, tipo, nota, dal/al; lime "Salva e applica".

### Settings (`/campo/impostazioni`)

- Per court: name, "Primo inizio", "Ultimo inizio", "Durata (minuti)", "Giorni attivi" (7 toggles with day names), "Giorni di chiusura" (list of dates with add via date input and remove buttons), order. Live preview line of the generated starts: "13:30 · 15:00 · 16:30 · 18:00 · 19:30 · 21:00" and a two-lane mini preview of both courts so the stagger stays visible.
- Saving warns when changes would orphan future confirmed matches: "3 partite confermate non sono più su uno slot di griglia: restano valide." (informational).

### Breakpoints

- **390**: bottom tabs "Richieste · Giornata · Torneo · Altro" (Altro → Ricorrenze, Impostazioni, Profilo). Inbox and timeline are separate screens.
- **820 (tablet, primary device)**: two-pane: inbox list left (~40%), day timeline right showing the day of the selected request with that request highlighted as a lime-outlined blue block; confirming updates the timeline in place. Selecting a confirmed match jumps the timeline to its day.
- **1440**: sidebar; same two-pane with wider timeline (both lanes + time axis), inbox sections all expanded.

## 7. Italian microcopy

- Tabs/titles: "Richieste", "Giornata", "Ricorrenze", "Impostazioni campi".
- Sections: "Da confermare", "In attesa dei giocatori", "Prossime partite confermate".
- Buttons: "Conferma", "Rifiuta", "Proponi altro orario", "Invia proposta", "Annulla partita", "Segna occupato", "Libera", "Chiudi la giornata", "Applica ai prossimi 60 giorni", "Nuova ricorrenza", "Salva".
- Empty: inbox "Nessuna richiesta da confermare. Le nuove arrivano qui da sole." · day "Nessuna occupazione: tocca uno slot per segnarlo occupato." · recurrences "Nessuna ricorrenza. Usale per lezioni e prenotazioni fisse."
- Errors: `OVERLAP`/`23P01` "Il campo è già occupato in quell'orario: <elenco>." · `EXPIRED` "La richiesta è scaduta nel frattempo." · `NOT_ALL_ACCEPTED` "Mancano accettazioni: si conferma solo con 4 su 4." · `BAD_STATE` "La richiesta è cambiata nel frattempo: aggiorno l'elenco." · "L'orario di fine deve venire dopo quello di inizio."

## 8. Open decisions / assumptions

- **ASSUNZIONE G1**: Inbox default order is by expiry (soonest first); no alternative sort in v1.
- **ASSUNZIONE G2**: Requests below 4/4 are listed (collapsed) so the gestore can reject or counter-propose early, but "Conferma" is not shown for them.
- **ASSUNZIONE G3**: Counter-proposal search covers ±3 days around the requested date, clipped to the match period, same court first.
- **ASSUNZIONE G4**: Timeline shows 08:00–24:00 and opens scrolled to 13:00 (or the current time if later).
- **ASSUNZIONE G5**: Rejecting needs no confirmation dialog (it does not touch the court); cancelling a confirmed match, freeing an occupation, deleting a recurrence and closing a day do.
- **ASSUNZIONE G6**: Editing a recurrence rule does not change occupations already materialized; the gestore re-applies or frees them manually.
- **ASSUNZIONE G7**: The tablet two-pane layout starts at 820 px width (portrait iPad) and above.
- **ASSUNZIONE G8**: Pending requests are drawn on the timeline (dashed) for context even though they are not occupations.
