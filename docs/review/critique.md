⚠️ DEGRADED: single-context (run as a delegated reviewer with no sub-agent tool; Assessment A was completed before the detector was run, and no live browser was available, so the supplied screenshots stood in for browser inspection)

# Impeccable critique: Padel League ("Righe del campo")

Reviewer: independent. I did not build this app. Date: 2026-10-30.
Target: the whole app shell and its working screens (`src/components/AppShell.tsx` and `src/features/*`), judged against `PRODUCT.md`, the direction contract `.impeccable/surfaces/src-components-appshell-tsx.md` and the briefs in `docs/ux/`.

## Run notes

- **Evidence:** 50 review screenshots (390 / 820 / 1440, light and dark) and 10 flow captures, taken against a local backend with demo data. I read every one, cropping the tall phone captures to read them at full size. I opened source only to confirm causes; the judgments are about what users see.
- **Capture artifacts, not counted as defects:** in the full-page phone captures the fixed bottom tab bar is drawn part-way down the page, and in `06-p1-sheet` the top bar is drawn mid-page. That is how full-page screenshots handle fixed elements. The same applies to the desktop sidebar ending at 900 px on long pages, and to the US-format date input (`10/31/2026`), which comes from the capture browser's locale.
- **Deterministic scan:** `impeccable detect --json src` exited 0 with **0 findings**. No gradient text, side-stripe borders, glass effects, or other pattern tells. The detector reads markup and CSS only, so it cannot see any of the layout and flow problems below. Nothing it reported is a false positive.
- **Visual overlay:** none. No browser automation was available, so nothing was injected.

---

## 1. Scores per role surface (Nielsen, 0–4)

### 1a. Player: match scheduling (`/t/:tid/partite/:mid`)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The request block (4 acceptances, two steps, expiry) is excellent. But the expiry it shows can fall after the slot itself (see M1). |
| 2 | Match system / real world | 3 | Italian domain words are right. "0/4" and "2/4" are a code the legend has to teach. |
| 3 | User control and freedom | 3 | Sheet with ×/Esc, "Annulla richiesta", back link. |
| 4 | Consistency and standards | 3 | The "today" day header is a solid turf-blue bar while other days are plain text. "Da programmare" uses the wrong tone and icon (see P4). |
| 5 | Error prevention | 2 | A request can stay "In attesa" past the time it was for. ≤2/4 cells look like the requestable ones. |
| 6 | Recognition rather than recall | 3 | Missing players are named once with "Chiedi a…". The legend is visible. |
| 7 | Flexibility and efficiency | 3 | Roving-tabindex keyboard navigation, and a "Mostra solo gli orari per tutti e 4" toggle (off by default). |
| 8 | Aesthetic and minimalist design | 2 | On a phone the week is a 5,000 px wall of grey 0/4 cells. |
| 9 | Error recovery | 3 | Server hints are mapped to plain Italian, with a next step. |
| 10 | Help and documentation | 2 | A legend only. Nothing explains why a slot is grey or what to do about it until you tap it. |
| **Total** | | **27/40** | **Acceptable** (one point short of Good) |

### 1b. Player: home ("Da fare") and availability (`/`, `/t/:tid/disponibilita`)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | "Da fare" puts deadlines on every item and gives one lime action. |
| 2 | Match system / real world | 3 | Clear verbs ("Trova un orario", "Aggiungi orario"). "Presto" is a vague section name. |
| 3 | User control and freedom | 3 | Each time window has its own remove ×, and there are "Svuota" and "Copia su tutti i sabati". |
| 4 | Consistency and standards | 2 | The phone list and the desktop week strip are two different instruments with different affordances. The time rail has no labels on the phone. |
| 5 | Error prevention | 3 | Saving is explicit, and copying to the same weekday is undoable. |
| 6 | Recognition rather than recall | 2 | On desktop there is no visible way to add a time. The rail ticks are never explained. |
| 7 | Flexibility and efficiency | 3 | Presets, copy to the same weekday, and a choice between week and list views. |
| 8 | Aesthetic and minimalist design | 2 | The phone shows 28 identical "Nessun orario / rail / Aggiungi orario" blocks (5,800 px). |
| 9 | Error recovery | 3 | Save errors keep the edits (per the brief and code). Not observed live. |
| 10 | Help and documentation | 2 | The one-line intro is good. The rail and ticks are unexplained. |
| **Total** | | **26/40** | **Acceptable** |

### 1c. Court manager (`/campo`, `/campo/giorno`)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Inline banner "Confermata sab 31/10 14:00 · Campo 2", badge count, live timeline. |
| 2 | Match system / real world | 3 | The two lanes read as the actual courts. "scade tra 2 g" is clipped. |
| 3 | User control and freedom | 3 | Confirm, reject and counter-propose. Cancelling a match is behind a dialog. |
| 4 | Consistency and standards | 2 | Navigation appears twice (sidebar and in-page tabs). Selection is shown two different ways. The request header breaks at tablet width. |
| 5 | Error prevention | 3 | "Conferma" is disabled with a reason when blocked. Stale requests are not prevented (M1). |
| 6 | Recognition rather than recall | 3 | The selected request is shown on that day's timeline beside the inbox. |
| 7 | Flexibility and efficiency | 3 | Two panes on tablet, "Segna occupazione" at the top, recurring bookings. |
| 8 | Aesthetic and minimalist design | 3 | Calm and focused. Free slots in the dark theme are close to invisible. |
| 9 | Error recovery | 3 | Conflict and expired outcomes come back as an "esito", not a crash. |
| 10 | Help and documentation | 2 | A legend of icons only. It does not explain why slots vanish around a lesson. |
| **Total** | | **28/40** | **Good** |

### 1d. Organizer (`/t/:tid/organizza/*`)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Phase stepper, "Prossimo passo", "anteprima provvisoria" warnings. |
| 2 | Match system / real world | 3 | Help text explains the qualification methods (including "avulsa") and byes. |
| 3 | User control and freedom | 3 | Confirmation dialogs, "Riapri il torneo", "Azzera". |
| 4 | Consistency and standards | 3 | One sub-navigation pattern throughout. Panoramica says "Tutto in ordine" while Fasi finali asks for a tie-break draw. |
| 5 | Error prevention | 2 | "Concludi il torneo" is a red button that is live at 0/6 matches. The tie-break draw is requested before any match is played. |
| 6 | Recognition rather than recall | 3 | Checklist before generating; results summarised in Panoramica. |
| 7 | Flexibility and efficiency | 2 | No bulk actions. After generating the calendar the only next step is a link out to the public calendar. |
| 8 | Aesthetic and minimalist design | 2 | The Fasi finali preview shows "Da programmare" badges on matches that do not exist yet. The save bar is always on screen. |
| 9 | Error recovery | 3 | Blocked actions explain what is missing ("Mancano 6 partite dei gironi"). |
| 10 | Help and documentation | 3 | Good inline help under the configuration fields. |
| **Total** | | **27/40** | **Acceptable** |

### 1e. Public (`/t/:tid`, `/classifiche`)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Phase and period in the header; next matches; an empty state for results. |
| 2 | Match system / real world | 3 | Abbreviations carry dotted underlines and are spelled out in a legend. |
| 3 | User control and freedom | 3 | Simple back links. |
| 4 | Consistency and standards | 2 | A bottom tab bar (phone) and a sidebar (desktop) that each hold a single item, "Torneo". |
| 5 | Error prevention | n/a | Read-only surface. |
| 6 | Recognition rather than recall | 3 | Column legend and tie-break criteria are listed. |
| 7 | Flexibility and efficiency | n/a | Read-only, browse-only surface. |
| 8 | Aesthetic and minimalist design | 2 | The tie is explained twice (asterisk note and "=" note), and a "Gold" pill sits on every row. |
| 9 | Error recovery | 3 | No errors observed. The empty states are honest. |
| 10 | Help and documentation | 3 | The legend explains the zones and the criteria. |
| **Total** | | **22/32** | **69%: Acceptable** (one point short of Good) |

**Design specificity verdict.** The scheduling grid and the manager's timeline are genuinely authored for this product. Two court lanes with the 30-minute stagger visible, start times sitting on the lines, and hatched occupied cells could not be lifted into an unrelated product unchanged. Everything around them is competent but generic: Da fare, the organizer forms and the public pages could belong to any Tailwind admin app. The signature is strong but limited to the lanes. The places where it fails users are density problems on the phone, not a lack of character.

**Cognitive load.** The checklist fails on 3 of 8 items (moderate): *single focus* and *minimal choices* on the phone grid (84 cells), and *progressive disclosure* on availability (28 expanded days). On the phone match screen, the week with no common slot offers five actions before the grid: two "Chiedi a…" buttons, "Condividi su WhatsApp", "Modifica le tue disponibilità" and the week arrows. That is above the four-option limit.

**Emotional journey.** The peak, "Richiesta inviata al campo" followed by "Accettazioni 4 su 4 → 2. Conferma del campo", lands well. The low point comes just before it: a 50+ player opens a match, sees "Nessun orario per tutti e 4" and then scrolls through roughly 80 grey boxes that all look tappable. The ending, "Si gioca sab 31/10 alle 14:00 · Campo 2", is strong and calm.

---

## 2. Top issues, ranked by user impact

### Material (must fix before shipping)

**M1. [P1] A request can expire after the time it asks for.**
- **Where:** player request block (`flow/07-p1-richiesta.png`, 390 light) and the manager inbox (`flow/08-gestore-inbox.png`, 1024 light).
- **What is wrong:** the request is for Sat 31/10 at 14:00, but it shows "Scade tra 2 giorni (dom 01/11 alle 22:47)", and the manager sees "scade tra 2 g". The server sets the expiry to `now() + scadenzaRichiesteOre` and never caps it at the slot's start (`supabase/migrations/20261031000500_rpc_requests.sql:103`). `confirm_request` (line 191 onward) has no check for a start time in the past. The result:
  - a request for tomorrow stays "In attesa" after the match time has passed;
  - the match stays locked in `richiesta`, so `MATCH_HAS_REQUEST` blocks a new request;
  - the manager can still "confirm" a slot that is already over.
- **Why it matters:** the product's promise is "always say what's missing … how long until it expires". A countdown that outlives the match is the kind of nonsense that sends a 50+ player back to WhatsApp, and it lets the manager act on stale data.
- **Fix:**
  - Server: in `private.crea_richiesta`, set the expiry to `least(now() + cfg, (data + inizio) - interval '1 hour')`, or another lead time the manager needs. Make `confirm_request`, `accept_request` and the expiry job treat any `attesa` request whose start is in the past as `scaduta`.
  - Client: `scadenzaTesto` (`src/features/manager/logic.ts:36`) and the player's request block should show the earlier of the expiry and the start time, and promote the line when it is under 2 hours, as the brief requires.

**M2. [P1] The phone slot grid is a 5,000 px wall of mostly non-actionable cells.**
- **Where:** `giocatore-partita-da-programmare-390-light/dark`, `flow/05-p1-partita.png`.
- **What is wrong:**
  - Seven days × about 12 cells are drawn in full. In the demo week almost every cell is grey "0/4", and each is a bordered, dotted tile that looks exactly as tappable as a 4/4 one.
  - When 4/4 slots do exist (`05-p1-partita`: "2 orari vanno bene per tutti e 4"), the "Mostra solo…" toggle is off by default, so the two useful cells are lost among about 80.
  - When none exist, the grid still renders in full under "Nessun orario per tutti e 4".
  - The brief's sticky mini-header with the lane names is missing (no `sticky` in `CourtLanes.tsx` or `SlotGrid.tsx`). Three screens down, nothing says which column is Campo 1.
- **Why it matters:** this is the core job ("easy for anyone … without help"), on the phone, often outdoors. Older users will scroll, lose the column headers and give up.
- **Fix:**
  - When any 4/4 or 3/4 slot exists in the week, switch the filter on by default, and say so in the summary line ("Mostro solo i 2 orari buoni · Mostra tutti").
  - Collapse each day that has no slot at 3/4 or better into one row: "dom 01/11 · nessun orario buono · Mostra".
  - With zero useful slots in the week, hide the grid behind "Mostra la griglia completa" and lead with the "Chiedi a…" actions.
  - Make the Campo 1 / Campo 2 header sticky under the top bar.
  - Give ≤2/4 cells a flatter, borderless treatment so they stop reading as buttons. They still open their explanatory sheet.

**M3. [P1] Phone availability is 28 expanded days of identical controls.**
- **Where:** `giocatore-disponibilita-390-light/dark` (5,839 px).
- **What is wrong:**
  - Every day of the four-week period renders "Nessun orario", an unlabeled tick rail and a full-width "Aggiungi orario" button: 28 identical primary-looking buttons.
  - The rail on the phone has no hour labels, so the ticks mean nothing to the user.
  - The presets that make this fast (Pausa pranzo, Sera, …) are only reachable after opening a day.
  - No week grouping: the user cannot tell where one week ends and the next begins.
- **Why it matters:** the brief frames this as a 2–5 minute session for players aged 50+, done right after a WhatsApp nudge. At this length people fill in one day and stop, and the app's matching depends on availability being complete.
- **Fix:** in `src/features/player/availability/DayEditor.tsx` and `LineaTempo.tsx`:
  - Render empty days as one compact 56 px row: the date plus a "+ Aggiungi" text button on the right. No rail.
  - Show the rail only when the day has windows, with labels at 08, 14 and 20.
  - Put week headers ("Settimana 2 · 02/11–08/11") between weeks.
  - After the first window is added, offer "Copia su tutti i sabati" immediately as a toast action.
  - Show the presets as one-tap chips inside the open row.

**M4. [P1] Desktop availability has no visible way to add a time.**
- **Where:** `giocatore-disponibilita-1440-light/dark`.
- **What is wrong:** the week strip is 28 grey columns with paired tick marks. Each column is a `<button>` (`SettimanaStrip.tsx:72`), but nothing says so: no "+", no hover hint, no instruction. The ticks (the Campo 1 / Campo 2 slot starts) are not explained anywhere on the page. The list view, which does have buttons, sits behind a toggle.
- **Why it matters:** recognition over recall fails completely here. A player on a laptop sees a chart, not a form.
- **Fix:**
  - Add the line "Clicca un giorno per aggiungere un orario" above the strip.
  - Add a persistent "+ Aggiungi" at the foot of each column.
  - Add a tick legend: "segni: inizio partita Campo 1 | Campo 2".
  - Alternatively, default to "Vista elenco" until the player has saved at least once.

**M5. [P1] Manager timeline blocks lose their button role for screen readers.**
- **Where:** `src/components/CourtLanes.tsx:160` (`<button role="listitem">`), used for the free slots, occupations and requests in `src/features/manager/DayLanes.tsx:86,141,167`.
- **What is wrong:** the explicit `role="listitem"` overrides the button's native role, so VoiceOver and NVDA announce these as list items, not actionable controls (WCAG 4.1.2). The player grid does this correctly: a `div` list item wraps a real button.
- **Why it matters:** the target is WCAG 2.2 AA, and "Segna occupazione" from a free slot is a core manager action.
- **Fix:** when `onClick` is set, render `<div role="listitem"><button …/></div>`, the same pattern `SlotGrid.tsx` already uses.

### Polish (fix in the next pass, ordered by impact)

**P1. [P2] The decision line of the manager's request card breaks at tablet width.**
- **Where:** `flow/08-gestore-inbox.png` and `gestore-richieste-820-light`.
- **What is wrong:** "sab 31/10 · 14:00–15:30" wraps inside its own span and "· Campo 2" ends up in a second column. Cause: `Intestazione` in `src/features/manager/RequestsPage.tsx:276–289` is an `inline-flex` containing two sibling spans.
- **Why it matters:** this is the one line the manager reads before tapping "Conferma", and the tablet at the desk is their main device.
- **Fix:** put the text in a single span with `text-wrap: balance`, or use `flex-wrap` on a block element, and keep "Campo 2" together with a non-breaking space.

**P2. [P2] The manager timeline hides slots lost to a lesson.**
- **Where:** `gestore-giornata-*`, `gestore-richieste-*`.
- **What is wrong:** the lesson from 16:00 to 17:00 removes the 15:00 and 16:30 slots on Campo 1. The timeline just leaves unexplained gaps at 15:00–16:00 and 17:00–18:00. Players, meanwhile, see those two slots as "Occupato".
- **Fix:** draw the lost grid slots hatched and labelled "inutilizzabile", using the glossary's existing "Inutilizzabile" vocabulary (`Ban` icon), so the manager understands why 15:00 cannot be offered.

**P3. [P2] Toasts are the wrong size and in the wrong place.**
- **Where:** `flow/07-p1-richiesta.png`, `flow/03-org-generato.png`.
- **What is wrong:** the sonner toast is pinned to the top centre, where it covers the app bar or the page `h1`. Its text is about 13 px, below the product's 16 px floor, and the close × is about 16 px.
- **Fix:** in `AppShell.tsx:152`, use `position="bottom-center"` with an offset above the tab bar, set `toastOptions.classNames` to force `text-base`, and give the close button a 44 px hit area.

**P4. [P2] "Da programmare" is shown as a warning everywhere.**
- **Where:** `flow/04-p1-partite.png` and every match header.
- **What is wrong:** `src/lib/copy.ts:34` uses tone `warn` and a `calendar-clock` icon. The glossary specifies **neutro** and `CalendarPlus`.
- **Why it matters:** every match is amber from day one, which dilutes the amber that matters (3/4 slots, "Risultato da confermare").
- **Fix:** make it neutral, and drop the pill in "Le mie partite", where the section heading already says "Da programmare (3)". Put the deadline ("entro gio 26/11") on each row instead.

**P5. [P2] The finals bracket bleeds off the phone screen.**
- **Where:** `org-finali-390-dark`.
- **What is wrong:** "Semifinale" touches the left edge and the "Finale" column is clipped ("da defini…") with no scroll cue. `Bracket.tsx` is shared, so the public `/tabellone` page probably has the same problem on phones.
- **Fix:** keep the page gutter inside the scroll container (`px-4` with `scroll-padding`) and fade the right edge as a scroll hint.

**P6. [P2] The desktop match grid wastes the screen.**
- **Where:** `giocatore-partita-da-programmare-1440-*`.
- **What is wrong:** the brief specified a matrix (rows are days, time runs horizontally, 90' slots span three 30' columns). The build is three columns of small vertical lane pairs, and "today", with no slots, still takes a full cell. The page is 2,762 px tall on a 900 px screen.
- **Fix:** either implement the matrix from the brief, or drop days with no slots and let each day row span the full width.

**P7. [P2] The organizer sees noise before it means anything.**
- **Where:** `org-finali-1440-*`, `org-panoramica-*`.
- **What is wrong:** the provisional bracket shows "Da programmare" badges on semifinals that do not exist. The tie-break draw ("Pari merito dal 1° posto: decidi tu l'ordine") is requested while every team is on 0 points. Panoramica says "Tutto in ordine" at the same time.
- **Fix:** hide the draw controls until the groups are complete. Render the preview bracket without status badges, with a "Anteprima" label.

**P8. [P3] Destructive action is too prominent too early.**
- **Where:** `org-panoramica-*`.
- **What is wrong:** "Concludi il torneo" is a red button in Panoramica during the group phase with 0/6 matches played. It is guarded by a dialog and reversible, but it is the most saturated control on the page.
- **Fix:** show it only from `fasiFinali` onward, or as a quiet text link before that.

**P9. [P3] Configuration form.**
- **Where:** `org-configurazione-*`.
- **What is wrong:** the sticky save bar stays visible with "Nessuna modifica da salvare" and a disabled lime button. The brief says it appears only when there are unsaved changes. In the Punteggio row the third field sits higher than the other two because of its help text.
- **Fix:** render the bar only when dirty, and align the fields with `items-start` and reserved help-text space.

**P10. [P3] Navigation is duplicated or pointless.**
- **What is wrong:**
  - Manager on desktop/tablet: the sidebar has Richieste and Giornata, and the in-page tabs repeat Richieste, Giornata, Ricorrenze and Campi.
  - Manager on phone: the "Campi" tab is cut off at 390 with no scroll cue.
  - Public: the bottom bar or sidebar holds a single item, "Torneo".
- **Fix:** collapse the manager section into one sidebar entry with tabs. For anonymous users, hide the tab bar and put "Accedi" in the top bar only (it is already there).

**P11. [P3] The request block repeats itself.**
- **Where:** `flow/07`.
- **What is wrong:** "Richiesta al campo" and "Richiesta per …" are stacked headings, and the four players are listed in the acceptances and again under "Giocatori".
- **Fix:** hide the "Giocatori" section while a request is live.

**P12. [P3] Small text and dark-theme contrast.**
- **What is wrong:**
  - The lane time-axis labels are 13 px `text-ink-muted` (`CourtLanes.tsx:75`), and the slot counts are 15 px. Both are below the stated 16 px minimum.
  - In the dark theme the manager's free-slot cells (dashed `line-strong` on near-black, `gestore-giornata-1440-dark`) barely register.
- **Fix:** use 16 px for the axis labels, and a stronger dashed border or `idle-soft` fill for free slots in dark.

**P13. [P3] Desktop Da fare repeats the next match.**
- **Where:** `giocatore-dafare-1440-*`.
- **What is wrong:** "Per sapere → Prossima partita" and the right-hand "Prossime partite" column show the same match. The right column also truncates "Le Bandejas contr…" with 700 px of empty space beside it.
- **Fix:** keep one of the two, and let the names wrap.

---

## 3. Direction contract compliance ("Righe del campo")

| Contract item | Verdict | Evidence / drift |
|---|---|---|
| Two court lanes with the 30' stagger and start times on the lines (signature) | **Honoured** | The player grid and the manager timeline both offset Campo 2 by 30', with times on the lines and hatched occupied cells. This is the strongest part of the build. Drift: desktop does not use the brief's horizontal matrix (P6), and the phone has no sticky lane header (M2). |
| Turf blue for the shell and selected states | **Honoured** | Top bar, sidebar, active navigation, lane headers and the current day header. |
| Lime only for primary action, current selection and focus | **Mostly honoured** | One lime primary per screen (Da fare, sheet, "Segna occupazione", "Conferma"); selected slot and request use a lime outline. Drift: (a) in the dark theme, Bracket round headings and the Squadre preview headings use `dark:border-ball`, i.e. lime as decoration (`Bracket.tsx:31`, `Squadre.tsx:262`, also visible in `org-finali-390-dark`); (b) in the light theme, `--focus` is court-deep blue, not lime. That is a sound choice for contrast (lime on white is about 1.3:1) but it departs from the contract, so record it in DESIGN.md; (c) the confirmed match on the manager timeline keeps a lime ring while its list row only gets a grey fill, so "selected" is shown two different ways. |
| White 1px court lines as the only dividers | **Honoured** | Lists use `.court-rule` 1px lines, and section breaks are hairlines. The `border-b-2` underlines on bracket and group headings are the only thicker lines. |
| No nested cards | **Honoured** | The manager's request card and the confirmed-match card are single `surface-2` panels inside a pane, not cards within cards. Slot cells are lane cells, not cards. |
| No coloured side borders > 1px, no eyebrows, no gradient text | **Honoured** | Confirmed by the detector (0 findings) and visually. The active sidebar item's lime left accent is a 2–3 px navigation indicator, not a card stripe, so it is acceptable. |
| State colours always paired with icon and text, plus patterns | **Honoured, with tone drift** | Every slot has an icon and a label, occupied cells are hatched, and ≤2/4 cells are dotted. Drift: "Da programmare" is amber, not neutral (P4); "Lezione" is amber with a hatch, so it shares a hue with 3/4 "attenzione" when the glossary asks for a pattern only. |
| One family (Atkinson Hyperlegible Next) with tabular numerals | **Honoured** | A single `@fontsource-variable` family. The slashed-zero look of the times is the font's tabular figures, not a monospace costume. |
| Dark theme as a floodlit court | **Honoured** | Deep blue-black ground, the same lines, and lime focus in dark. Free slots are too faint (P12). |
| ≥ 16 px text, ≥ 44 px targets | **Partly** | Buttons are `min-h-11`. Lane axis labels (13 px), toast text and the toast close (P3, P12) are below the floor. |

**Verdict:** the build honours the contract in spirit and in nearly all of its mechanics. The signature is real. The drift is small (decorative lime in dark headings, the focus colour in light, tones that do not match the glossary) and easy to fix. It does not hold back what the contract promises for the phone: on the phone the lanes are faithful but too long to use.

---

## 4. What works well

- **The court lanes.** The stagger is legible at a glance, and hatched "Occupato" plus dotted "0/4" mean nothing depends on colour alone. Players and the manager share one visual vocabulary, so "Campo 2 · 14:00" means the same thing on both sides of the desk.
- **The request status block** (`flow/07`). "Accettazioni 4 su 4 → 2. Conferma del campo", named per-player acceptances and an explicit expiry are exactly the "always say what's missing" principle. The confirmed state, "Si gioca sab 31/10 alle 14:00 · Campo 2", with the 24-hour rule written out and "Scrivi al gestore", is clear and calm.
- **The manager's two-pane view.** On tablet the inbox sits beside that day's timeline with the request outlined, which makes the one-tap confirmation trustworthy. The empty state ("Le nuove arrivano qui da sole, appena tutti e 4 hanno accettato") teaches the system.
- **Copy.** Informal, short, verbs on buttons, honest empty states ("Ancora nessun risultato ufficiale"), and the "Chiedi a Giocatore 5" WhatsApp nudges are aimed at the right person.

---

## Persona red flags

- **"Franco", 58, player, phone in the sun:** opens the match from WhatsApp and reads "Nessun orario per tutti e 4". He scrolls past roughly 80 identical grey tiles, loses track of which column is which court, and returns to WhatsApp (M2). On Disponibilità he fills in one Saturday and stops at the 28-row list (M3).
- **"Sam", screen-reader user (manager):** free slots, occupations and requests on the timeline are announced as list items, not buttons (M5). The toast appears at the top, away from where focus is.
- **"Casey", distracted phone user:** the success toast at the top is outside thumb reach and has a tiny close button (P3). The match deadline is not on "Le mie partite" rows, so she cannot triage without opening each one (P4).
- **"Alex", organizer at a desktop:** asked to hand-order four teams on 0 points before a single match, while Panoramica says everything is fine (P7). After generating the calendar the only way to see it is a link to the public page.

## Questions to consider

- What if the phone match screen were the list of slots that work, with the full lanes as an optional view, rather than the lanes as the default?
- Should Disponibilità start from "Which days of the week do you usually play?" and expand to dates, instead of listing 28 dates?
- Is the request expiry a fixed number of hours, or "until the manager needs to know", meaning a fixed time before the slot?
