# UX briefs: Padel League

Impeccable "shape" briefs (Phase 3) for the rebuild of every screen, inside the approved direction "Righe del campo" (`.impeccable/surfaces/src-components-appshell-tsx.md`). Product truth: `PRODUCT.md`. Data and server rules: `docs/contratto-api.md`. No interview was possible: every open choice is marked **ASSUNZIONE** and collected at the end of this file so the lead can confirm them with the user in one round.

## Index

| Brief | Routes | Main audience |
|---|---|---|
| [home-da-fare.md](home-da-fare.md) | `/` | everyone, merged roles; defines `deriveAttention` (`src/lib/attention.ts`) |
| [disponibilita.md](disponibilita.md) | `/t/:tid/disponibilita` | players |
| [programma-partita.md](programma-partita.md) | `/t/:tid/partite/:mid` | players (state machine, court-lanes slot grid, requests, off-grid) |
| [risultato.md](risultato.md) | `/t/:tid/partite/:mid#risultato` | players, organizer |
| [gestore.md](gestore.md) | `/campo`, `/campo/giorno/:data?`, `/campo/ricorrenze`, `/campo/impostazioni` | court managers |
| [pubblico.md](pubblico.md) | `/t/:tid`, `/t/:tid/classifiche`, `/t/:tid/calendario`, `/t/:tid/tabellone/:fase` | public, players |
| [organizzatore.md](organizzatore.md) | `/t/:tid/organizza/*`, `/admin/utenti`, `/profilo`, `/t/:tid/coppia`, `/invito/:token` | organizer, admin, everyone |

Shared rules every brief follows (from the direction contract and craft floor): turf-blue shell; white 1px court lines as the only dividers; lime only for the primary action, current selection and focus; one family (Atkinson Hyperlegible Next) with tabular numerals for times and scores; no eyebrow/kicker labels, no nested cards, no coloured side borders > 1px, no colour-only meaning, no modal-first (sheets: bottom on mobile, side on desktop; AlertDialog only for destructive or irreversible confirmations); ≥ 16px text, ≥ 44px targets; Italian, informal "tu", verbs on buttons, no exclamation marks in errors; light and dark themes. Breakpoints referenced: 390 (phone), 820 (tablet), 1440 (desktop).

## Glossary of status labels

Tones are semantic, not CSS: **neutro** (grey/ink), **info** (blue, the "requested/in progress" family), **successo** (green), **attenzione** (amber), **critico** (red). Lime is never a status tone; turf blue is reserved for shell and selection. Every status is always rendered as icon + text label (+ tone); occupied slots and occupation types also carry a pattern. Icons are `lucide-react` component names.

### Match (`stato_partita` and derived)

| Value | UI label | Icon | Tone |
|---|---|---|---|
| `da programmare` | Da programmare | `CalendarPlus` | neutro |
| `richiesta` | Richiesta inviata | `Send` | info |
| `programmata` | Programmata | `CalendarCheck` | successo |
| `giocata` | Giocata | `CircleCheckBig` | neutro (final, quiet) |
| `contestata` | Contestata | `MessageSquareWarning` | attenzione |
| `tavolino` | Tavolino | `Gavel` | neutro |
| derived: result entered, not confirmed | Risultato da confermare | `Hourglass` | attenzione |
| derived: period ended, not played | In ritardo | `AlarmClock` | critico |

### Request (`stato_richiesta`)

| Value | UI label | Icon | Tone |
|---|---|---|---|
| `attesa` (live) | In attesa | `Hourglass` | info |
| `confermata` | Confermata | `CircleCheck` | successo |
| `rifiutata` | Rifiutata | `CircleX` | critico |
| `annullata` | Annullata | `Ban` | neutro |
| `conflitto` | Conflitto | `TriangleAlert` | critico |
| `scaduta` (or `attesa` past `scadenza`) | Scaduta | `TimerOff` | neutro |
| flag `fuori_griglia` | Fuori griglia | `Clock3` | info |
| flag `controproposta` | Proposta dal campo | `Repeat` | info |
| acceptance given / missing | ha accettato / deve accettare | `CircleCheck` / `Hourglass` | successo / attenzione |

### Slot (`classificaSlot` colour → UI)

| `colore` | UI label | Icon | Tone | Extra channel |
|---|---|---|---|---|
| `verde` | 4/4 libero ("4/4") | `CircleCheck` | successo | — |
| `giallo` | 3/4 ("3/4 · manca Luca") | `UserX` | attenzione | missing name in sheet/aria |
| `grigio` | ≤ 2/4 ("2/4", "1/4", "0/4") | `CircleMinus` | neutro | low emphasis |
| `rosso` | Occupato | `Lock` | critico | hatch pattern |
| `blu` | Richiesto | `Send` | info | — |
| selection (not a state) | Selezionato | `Check` | lime outline | — |
| impacted by off-grid | Inutilizzabile | `Ban` | neutro | hatch pattern |

### Occupation type (`tipo_occupazione`, gestore timeline)

| Value | UI label | Icon | Pattern |
|---|---|---|---|
| `campionato` | Partita del campionato | `Trophy` | turf-blue fill with court line |
| `esterno` | Esterno | `Users` | solid neutral fill |
| `lezione` | Lezione | `GraduationCap` | diagonal hatch |
| `chiusura` | Chiuso | `DoorClosed` | cross-hatch |

### Team (`stato_squadra`) and tournament (`stato_torneo`)

| Value | UI label | Icon | Tone |
|---|---|---|---|
| `in attesa partner` | Manca il compagno | `UserPlus` | attenzione |
| `da approvare` | Da approvare | `Hourglass` | info |
| `approvata` | Approvata | `BadgeCheck` | successo |
| `ritirata` | Ritirata | `UserMinus` | neutro |
| torneo `iscrizioni` / `gironi` / `fasiFinali` / `concluso` | Iscrizioni aperte / Fase a gironi / Fasi finali / Concluso | — (text in top bar) | neutro |

Other shared icons: deadline `AlarmClock`, winner `Trophy`, qualification zone `Medal`, tie `Equal`, own pair `User`, locked field `Lock`, reorder `ArrowUp`/`ArrowDown`, remove `X`, capacity warnings `TriangleAlert` / `OctagonAlert`.

## Consolidated assumptions (ASSUNZIONE)

Verbatim from the briefs, grouped by file. IDs are referenced across briefs.

### home-da-fare.md

- **ASSUNZIONE H1**: No manual dismissal; an item leaves the feed only when its condition is resolved. "Per sapere" items are capped at 3 visible with "Mostra altre".
- **ASSUNZIONE H2**: Urgency threshold is 24 h before the deadline (promotes to "Urgente"); a period is "in scadenza" when it ends within 7 days.
- **ASSUNZIONE H3**: Players can still request a slot after their period has ended, until the organizer decides (tavolino or result); the item shows "In ritardo".
- **ASSUNZIONE H4**: Confirming an opponent's result inline from the feed is allowed because the full score and pair order are shown in the row; contesting always opens the match.
- **ASSUNZIONE H5**: The gestore can confirm inline from the feed only on-grid, non-counterproposal requests at 4/4; off-grid and counterproposals open the inbox detail to show impact.
- **ASSUNZIONE H6**: The organizer is alerted about unconfirmed results after 48 h from `updated_at` (`promemoriaRisultatoOre`, not yet in `TorneoConfig`; constant until then).
- **ASSUNZIONE H7**: Admin role alone produces no feed items (admin work lives in `/admin/utenti`); `deriveAttention` treats roles literally, unlike SQL `has_role`.
- **ASSUNZIONE H8**: Approving a team inline (`approve_team`) is a direct update of `squadre.stato` allowed to the organizer by the contract; it is not an RPC.

### disponibilita.md

- **ASSUNZIONE D1**: Presets are fixed in code (Pausa pranzo 12–15, Pomeriggio 14–18:30, Sera 18–23, Tutto il giorno 8–23); not configurable by the organizer.
- **ASSUNZIONE D2**: Time selects use 30' steps, 15' only when the tournament allows off-grid requests with a 15' step; range 08:00–24:00.
- **ASSUNZIONE D3**: Saving is explicit (one "Salva"), not autosave, because a partial edit would change auto-acceptances immediately.
- **ASSUNZIONE D4**: "Copia su tutti i <giorno>" replaces (does not merge) windows on the same weekday within the selected period only, with client-side undo.
- **ASSUNZIONE D5**: The desktop week strip is a view of the same data; editing in it uses the same add row (in a side sheet), no drag-to-create in v1.
- **ASSUNZIONE D6**: The post-save "N orari 4/4" message is shown only when the match data is already cached; otherwise a plain confirmation.

### programma-partita.md

- **ASSUNZIONE P1**: The grid shows one week at a time, clipped to the match period; late matches show the next 7 days from today.
- **ASSUNZIONE P2**: 3/4 slots can be requested (the server auto-accepts covered players; the missing one must accept). ≤ 2/4 slots cannot be requested from the grid.
- **ASSUNZIONE P3**: A player who dislikes a proposed time uses "Annulla richiesta" (cancels for all four); there is no per-player decline, matching `cancel_request`.
- **ASSUNZIONE P4**: Players cannot cancel or move a confirmed match in the app; they contact the court (WhatsApp to a gestore's phone if any gestore profile has one), and the gestore uses `cancel_confirmed`.
- **ASSUNZIONE P5**: Other players' raw time windows are never shown; only derived "libero / manca" per slot.
- **ASSUNZIONE P6**: Off-grid start times are offered from 08:00 to 22:30 on the chosen court, in `passoFuoriGriglia` steps; the server remains the authority (`COURT_CLOSED`, `BAD_STEP`).
- **ASSUNZIONE P7**: Result entry is also reachable from S1 ("Hai già giocato?") for matches booked outside the app.

### risultato.md

- **ASSUNZIONE R1**: Stepper ranges: 0–7 for normal sets, 0–30 for the super tie-break; typed values outside are rejected inline.
- **ASSUNZIONE R2**: Result entry is available in `da programmare`, `richiesta` and `programmata`; for a `programmata` match it is collapsed until the scheduled start time.
- **ASSUNZIONE R3**: The inserter's pair can correct the result (new `submit_result`) until an opponent confirms or contests.
- **ASSUNZIONE R4**: A contest requires a non-empty reason.
- **ASSUNZIONE R5**: The forfeit score is decided by the server (`assign_forfeit`); the UI only picks the winning pair and shows the resulting score afterwards.
- **ASSUNZIONE R6**: There is no automatic confirmation after a timeout; the organizer is alerted instead (see H6).

### gestore.md

- **ASSUNZIONE G1**: Inbox default order is by expiry (soonest first); no alternative sort in v1.
- **ASSUNZIONE G2**: Requests below 4/4 are listed (collapsed) so the gestore can reject or counter-propose early, but "Conferma" is not shown for them.
- **ASSUNZIONE G3**: Counter-proposal search covers ±3 days around the requested date, clipped to the match period, same court first.
- **ASSUNZIONE G4**: Timeline shows 08:00–24:00 and opens scrolled to 13:00 (or the current time if later).
- **ASSUNZIONE G5**: Rejecting needs no confirmation dialog (it does not touch the court); cancelling a confirmed match, freeing an occupation, deleting a recurrence and closing a day do.
- **ASSUNZIONE G6**: Editing a recurrence rule does not change occupations already materialized; the gestore re-applies or frees them manually.
- **ASSUNZIONE G7**: The tablet two-pane layout starts at 820 px width (portrait iPad) and above.
- **ASSUNZIONE G8**: Pending requests are drawn on the timeline (dashed) for context even though they are not occupations.

### pubblico.md

- **ASSUNZIONE PB1**: Zone lines are drawn per group by position (as the current `zona()` logic) when `criterioQualificazione = perPosizione`; with `avulsa` only certain places get a line, plus an explanatory note.
- **ASSUNZIONE PB2**: Mobile standings keep #, Coppia, Pt, G, ±S visible; V, P, ±G are behind horizontal scroll and row expansion.
- **ASSUNZIONE PB3**: Public views show pair names only; individual player names appear only to logged-in users.
- **ASSUNZIONE PB4**: `/t/:tid` lands on the overview in every phase; there is no automatic redirect to the bracket during finals.
- **ASSUNZIONE PB5**: Anonymous users tapping a match row get no navigation (match pages require login); the row itself shows all public info.

### organizzatore.md

- **ASSUNZIONE O1**: The organizer cannot write `tornei.stato` directly (not in the contract's writable columns); phase changes happen inside `generate_calendar` / `generate_finals`. Closing registrations and marking the tournament `concluso` need a backend decision (new RPC or contract change).
- **ASSUNZIONE O2**: Groups are composed at random only (with preview and reshuffle); no seeded/snake draw in v1.
- **ASSUNZIONE O3**: Matchdays are distributed across group periods in consecutive blocks, as in the current logic.
- **ASSUNZIONE O4**: Capacity thresholds stay as today: ≥ 3 slots per match = good, 1.5–3 = tight, < 1.5 = insufficient.
- **ASSUNZIONE O5**: Scoring and tie-break chain stay editable during the season (standings recompute); set format locks once any result exists.
- **ASSUNZIONE O6**: An admin cannot remove their own admin role; `giocatore` is always kept.
- **ASSUNZIONE O7**: The theme preference is stored per device (local storage), not in `profiles`.
- **ASSUNZIONE O8**: The team creator can rename the pair until it is approved; only while `in attesa partner` can they delete it.
- **ASSUNZIONE O9**: The phone number is optional; WhatsApp links fall back to "choose a contact" when it is missing.
- **ASSUNZIONE O10**: Organizer screens are usable on mobile but optimised for desktop; nothing is blocked by screen size.

