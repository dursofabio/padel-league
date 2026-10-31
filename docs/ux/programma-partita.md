# Brief: Partita e programmazione (`/t/:tid/partite/:mid`)

Glossary (match, request and slot labels, icons, tones) and consolidated assumptions: [README.md](README.md). Result entry details: [risultato.md](risultato.md).

## 1. Job and audience

- One of the 4 players of a match, on the phone, typically arriving from Da fare, from "Le mie partite", or from a WhatsApp link sent by a partner or opponent. Mixed comfort with technology; some will do this once per match and never learn the screen.
- Need: find an hour that works for all four and for the court, ask for it, see who still has to accept, and know when it is confirmed. Later: enter or confirm the result.
- Also reached by: other logged-in users (read-only), the organizer (read + organizer tools), the public calendar (no login: redirected to the public view of the match row).

## 2. Outcome and proof

- Primary action per state, exactly one primary block on screen (see state machine). For the main case: tap a 4/4 slot, "Invia richiesta al campo", done in 3 taps.
- Success: no WhatsApp back-and-forth; the request reaches the gestore at 4/4 whenever all four declared availability; every player can see what is missing and until when.
- Product truth: slot states come from `classificaSlot` (verde/giallo/grigio/rosso/blu) over `slotGriglia` of both courts, 4 players' `fasce`, the day's `occupazioni`, and live `richieste`; the server is the authority on locks, acceptances and expiry.

## 3. Selected direction consequences (signature move)

- **Two court lanes.** The slot grid is drawn as two parallel lanes per day, Campo 1 and Campo 2, with Campo 2 visibly offset by 30' (Campo 1 starts 13:30, Campo 2 14:00, 90' slots). Start times sit on white court lines across the lanes, so the stagger reads as "a match can start every half hour, alternating courts".
- Slots are cells inside the lanes, not cards. Each carries icon + short text + state colour; occupied cells add a hatch pattern. Lime appears only on the selected slot (outline + check) and on the primary button.
- Turf blue marks the current day header and the selected state in navigation; the match header (pairs, girone, giornata, period) sits on the neutral ground, separated by a court line.
- One primary block per state; secondary information (players, period, history) is below, separated by court lines, never in nested boxes.

## 4. Scope and anti-goals

- In: match header, state machine, slot grid (week view, period-bounded), slot sheet, request status with 4 acceptances, cancel request, off-grid proposal with impact preview, counterproposal display, scheduled block, WhatsApp shares, error/expired/conflict states, organizer tools entry (see risultato brief).
- Out: chat, comments, editing availability here (link to Disponibilità instead), choosing opponents, payments.
- Anti-goals: a colour-only grid; a modal-first flow; showing other players' raw time windows (privacy and noise; only the derived "manca Luca" is shown).

## 5. State machine (one primary block per state)

Effective state is derived client-side: a `richiesta` match whose request is not live (`scadenza ≤ now` or not `attesa`) behaves as `da programmare`.

| # | Effective state | Who | Primary block | Secondary |
|---|---|---|---|---|
| S0 | Pairs not known (finals TBD) | all | Notice: "La griglia si apre quando entrambe le coppie sono note." | Bracket link |
| S1 | `da programmare` | player | **Slot grid** "Scegli un orario" (+ reason line if last request was rifiutata/conflitto/scaduta/annullata) | Off-grid entry, WhatsApp, "Hai già giocato? Inserisci il risultato" |
| S2 | `richiesta`, live, < 4/4 | player | **Request status**: 4 acceptances, expiry; lime "Accetta" if I'm missing | Sollecita, Annulla richiesta |
| S3 | `richiesta`, live, 4/4 | player | **Request status**: "Aspettiamo la conferma del campo" + expiry | Annulla richiesta, Condividi |
| S4 | `programmata`, before start | player | **Scheduled block**: day, time, court, "Si gioca sab 14/11 alle 15:30 · Campo 2" | Condividi, "Per spostarla scrivi al campo" |
| S5 | `programmata` after end, or any open state with no result | player | **Result entry** (risultato brief) | Scheduled info collapsed |
| S6 | Result entered, unconfirmed | opponent | **Confirm / contest** | — |
| S6b | Result entered, unconfirmed | inserter's side | **Waiting**: "Aspettiamo la conferma di Verdi o Neri" | Correggi, Sollecita |
| S7 | `contestata` | players | **Dispute status**: "La decide l'organizzatore" + both notes | — |
| S8 | `giocata` / `tavolino` | all | **Final result** with winner and who confirmed / organizer note | — |
| — | Any | non-player logged in | Read-only version of the current block, no actions | — |
| — | Any | organizer | Same as above + "Strumenti organizzatore" section (risultato brief) | — |

Transitions arrive via Realtime (`partite`, `richieste`, `request_players`); a change re-renders the primary block and announces it politely ("Marta ha accettato: 4 su 4").

## 6. Slot grid (S1)

- **Window**: one week (7 days) at a time, clipped to the match's period; starts at `max(today, period.inizio)`; "Settimana precedente / successiva" buttons, disabled at period edges. If the period is over (late match), show the next 7 days from today with a notice "Periodo terminato il 10/11: puoi ancora programmarla finché l'organizzatore non decide".
- **Summary line above the grid**: "3 orari vanno bene per tutti e 4 questa settimana" with "Mostra solo questi" toggle (filters to 4/4; off by default). If 0: "Nessun orario per tutti e 4. Mancano le disponibilità di Luca." with WhatsApp "Chiedi a Luca".
- **Missing availability**: players with no window in the period are named once above the grid ("Luca non ha ancora segnato le disponibilità"), not repeated per slot.
- **Encoding** (all three channels every time; labels from the glossary):
  - 4/4 libero: green, `CircleCheck`, "4/4".
  - 3/4: amber, `UserX`, "3/4"; sheet names who is missing.
  - ≤ 2/4: grey, `CircleMinus`, "2/4" / "1/4" / "0/4"; low emphasis.
  - occupato: red tone with hatch pattern, `Lock`, "Occupato".
  - richiesto: blue, `Send`, "Richiesto".
  - selected: lime outline + `Check`; past slots on today are not rendered.
- **Legend**: one line under the summary, always visible on first visit, collapsible afterwards ("Legenda").
- **390 (list form of the lanes)**: per day a section with the day heading ("sab 14/11"); inside, two narrow lanes side by side (Campo 1 left, Campo 2 right), Campo 2 offset down by half a row; each cell shows start time + state text + icon, full lane width, ≥ 44 px tall. Days with no active court show "Campi chiusi". Days scroll vertically; a sticky mini-header shows the lane names.
- **820**: same lanes, two days side by side.
- **1440 (matrix)**: rows = days; each day row contains two lanes; columns = 30' time axis 13:30–23:00 with time labels on vertical court lines; slots span 3 columns (90'), so the 30' stagger is literally visible between the lanes. Hover shows the same text as the sheet header; click opens the side sheet.
- **Keyboard / ARIA**: each day is a `group` labelled by its heading; slots are buttons in time order (Campo 1 13:30, Campo 2 14:00, Campo 1 15:00, …) with roving tabindex: ↑/↓ previous/next start time in the day, ←/→ switch court, PageUp/PageDown previous/next day, Home/End first/last slot of the day, Enter/Space opens the sheet. `aria-label`: "Sabato 14 novembre, Campo 2, 15:30–17:00, 3 su 4 liberi, manca Luca". Occupied/requested slots stay focusable (they explain why) but their sheet has no request action.

## 7. Slot sheet

Bottom sheet on mobile, side sheet on desktop; focus moves into it; Esc / swipe-down / "Chiudi" returns focus to the slot.

- Header: "sab 14/11 · 15:30–17:00 · Campo 2" + state label with icon.
- Players: the 4 names grouped by pair, each with `CircleCheck` "libero" or `CircleMinus` "non ha segnato questo orario".
- Actions by state:
  - 4/4: lime "Invia richiesta al campo"; optional "Nota per il campo"; text: "Tutti e 4 sono liberi: la richiesta parte già accettata da tutti."
  - 3/4: lime "Invia richiesta al campo"; text: "Luca dovrà accettare prima che il campo possa confermare."; secondary "Chiedi a Luca su WhatsApp".
  - ≤ 2/4: no request button; "Chiedi a Luca e Marta di segnare questo orario" (WhatsApp).
  - Occupato: "Il campo è occupato: lezione 15:00–16:30." No action; link "Proponi un altro orario" if off-grid is enabled.
  - Richiesto: "Questo orario è già stato chiesto per un'altra partita." No action.
- After send: sheet closes, the page switches to S2/S3, toast "Richiesta inviata al campo", and a WhatsApp share button is offered in the request block.

## 8. Request status (S2/S3)

- Line 1: "Richiesta per sab 14/11 · 15:30–17:00 · Campo 2" + request label ("In attesa", `Hourglass`) + badges "Fuori griglia" (`Clock3`) / "Proposta dal campo" (`Repeat`) when relevant. For a counterproposal: "Il campo propone 16:30 invece di 15:00" with the original time in plain text.
- Two-step progress in text: "1. Accettazioni 3 su 4" → "2. Conferma del campo". The current step is turf-blue; completed steps carry `Check`.
- Acceptances: 4 rows (grouped by pair): `CircleCheck` "Marco · ha accettato" / `Hourglass` "Luca · deve accettare"; the creator shows "ha chiesto".
- Expiry: "Scade tra 20 h (dom 15/11 alle 10:00)"; under 2 h it becomes the first line.
- Actions: lime "Accetta" (only if I'm missing); "Sollecita su WhatsApp" (to the missing players; direct to their phone if known); "Annulla richiesta" (AlertDialog: "Annullare la richiesta per tutti? Il campo non la vedrà più." → "Annulla richiesta" / "Tieni").
- A player who does not want the proposed time uses "Annulla richiesta" (cancels for everyone); there is no separate "rifiuta".

## 9. Off-grid proposal

- Entry: secondary link under the grid "Proponi un orario fuori griglia", only when `config.consentiFuoriGriglia`. Opens a sheet (not a modal).
- Fields: court (segmented "Campo 1 / Campo 2"), day (week days of the current window), start (select in `passoFuoriGriglia` steps); end computed and shown ("fine 17:15, 90 minuti").
- Live checks (`verificaFuoriGriglia`, `slotImpattati`, `fasciaCopre`):
  - Blocking occupation → error, submit disabled: "Si sovrappone a una lezione 15:00–16:30."
  - Court closed / ends after 24:00 → error: "Il campo è chiuso a quell'ora."
  - Overlaps another pending request → warning, submit allowed: "Si sovrappone a un'altra richiesta in attesa: il campo potrà confermarne una sola."
  - Past time → error.
- **Impact preview**: a mini two-lane strip of that day (both courts, ± 2 h around the proposal) showing the proposed block in blue and the grid slots it makes unusable hatched and labelled "inutilizzabile" ("Rende inutilizzabili gli slot delle 15:00 e delle 16:30 sul Campo 1"). Same visual vocabulary as the gestore timeline.
- Acceptances preview: "Accettano subito: tu, Marco. Devono accettare: Luca, Marta." (creator + players whose windows cover the time).
- Submit: lime "Invia proposta". Result: S2 with "Fuori griglia" badge.

## 10. WhatsApp shares (prefilled, `waLink`)

- No 4/4 slot: "Non abbiamo ancora un orario in comune per Rossi/Bianchi – Verdi/Neri: segnate le disponibilità qui → <link disponibilità>"
- Some 4/4 slots: "Abbiamo 3 orari che vanno bene a tutti e 4, scegliamo? → <link partita>"
- Request sent: "Ho chiesto il campo per sab 14/11 alle 15:30 (Campo 2). Luca, Marta: accettate qui → <link>"
- Reminder to one player: "Luca, manca solo la tua conferma per sab 14/11 alle 15:30 → <link>"
- Confirmed: "Confermata: Rossi/Bianchi – Verdi/Neri, sab 14/11 alle 15:30, Campo 2 → <link>"
- Ask the court (S4): opens WhatsApp to the gestore's phone if any gestore profile has one: "Ciao, per la partita di sab 14/11 alle 15:30 (Campo 2) …"

## 11. States, errors, ranges

- Ranges: 2 courts × 6 starts/day (Campo 1 13:30–21:00, Campo 2 14:00–21:30) ≈ 12 slots/day, 84 per week; period 1–6 weeks; 4 players; 0–3 earlier requests per match.
- Loading: skeleton lanes (two grey lane outlines with line ticks), no spinner in content. Partial data (availability loaded, occupations not): grid hidden until all three sources are ready.
- Expired request: S1 with reason line "La richiesta per sab 14/11 alle 15:30 è scaduta senza risposta. Scegline un'altra." Rejected: "Il campo ha rifiutato sab 14/11 alle 15:30" + gestore note if any. Conflict: "Mentre il campo confermava, l'orario risultava già occupato. Scegline un altro." Cancelled: "Marco ha annullato la richiesta."
- Error mapping (by `hint`):
  - `SLOT_TAKEN`/`23505`: "Qualcuno ha appena preso questo orario. Scegline un altro." (grid refreshes, selection cleared)
  - `MATCH_HAS_REQUEST`: "C'è già una richiesta in corso per questa partita." (switch to S2)
  - `OVERLAP`/`23P01`: "Il campo è già occupato in quell'orario."
  - `EXPIRED`: "La richiesta è scaduta nel frattempo."
  - `OFF_GRID_DISABLED`: "Gli orari fuori griglia non sono attivi in questo torneo."
  - `BAD_STEP`: "Scegli un orario ogni 30 minuti." (or 15)
  - `COURT_CLOSED`: "Il campo è chiuso quel giorno."
  - `IN_PAST`: "Quell'orario è già passato."
  - `NOT_AUTHORIZED`: "Solo i giocatori di questa partita possono farlo."
  - Network: "Non riesco a contattare il server. Controlla la connessione e riprova."

## 12. Italian microcopy (key labels)

- Header: "Rossi/Bianchi contro Verdi/Neri" · "Girone A · Giornata 3 · da giocare entro dom 30/11".
- Grid: "Scegli un orario", "Settimana precedente", "Settimana successiva", "Mostra solo gli orari per tutti e 4", "Legenda", "Campi chiusi", "Proponi un orario fuori griglia".
- Sheet: "Invia richiesta al campo", "Nota per il campo (facoltativa)", "Chiudi".
- Status: "Accetta", "Sollecita su WhatsApp", "Annulla richiesta", "Aspettiamo la conferma del campo".
- Scheduled: "Si gioca sab 14/11 alle 15:30 · Campo 2", "Condividi su WhatsApp", "Per spostarla scrivi al campo".

## 13. Open decisions / assumptions

- **ASSUNZIONE P1**: The grid shows one week at a time, clipped to the match period; late matches show the next 7 days from today.
- **ASSUNZIONE P2**: 3/4 slots can be requested (the server auto-accepts covered players; the missing one must accept). ≤ 2/4 slots cannot be requested from the grid.
- **ASSUNZIONE P3**: A player who dislikes a proposed time uses "Annulla richiesta" (cancels for all four); there is no per-player decline, matching `cancel_request`.
- **ASSUNZIONE P4**: Players cannot cancel or move a confirmed match in the app; they contact the court (WhatsApp to a gestore's phone if any gestore profile has one), and the gestore uses `cancel_confirmed`.
- **ASSUNZIONE P5**: Other players' raw time windows are never shown; only derived "libero / manca" per slot.
- **ASSUNZIONE P6**: Off-grid start times are offered from 08:00 to 22:30 on the chosen court, in `passoFuoriGriglia` steps; the server remains the authority (`COURT_CLOSED`, `BAD_STEP`).
- **ASSUNZIONE P7**: Result entry is also reachable from S1 ("Hai già giocato?") for matches booked outside the app.
