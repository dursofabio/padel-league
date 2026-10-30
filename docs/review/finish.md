disposition: fix

# Finish review: Padel League, "Righe del campo"

Independent finish reviewer; I did not build this. Contract: `.claude/skills/impeccable/reference/degraded/finish-reviewer.md`. Code-led build with no approved comp. Fidelity is judged against the direction contract `.impeccable/surfaces/src-components-appshell-tsx.md` (FIRST VIEWPORT and the two-lane signature), PRODUCT.md, the confirmed answers, and the prior reviews `docs/review/critique.md` and `docs/review/audit.md`.

**Inputs and evidence.**
- **Captures:** all 48 review captures (390, 820 and 1440 px; light and dark; the 820 px set is light only, as the brief named) and all 9 flow captures in `flow2/`. All are valid. The only defects are the known full-page artifacts: the fixed tab bar drawn mid-page, the sidebar ending at 900 px, and the US-format date input from the capture locale.
- **Missing from the flow:** the flow set contains no capture of the organizer generating the calendar. It starts at the player grid (`01-p1-griglia`), so that step was not visually reviewed. That step is not a required viewport, so it does not trigger recapture.
- **Not applicable:** there is no QUALITY BAR card, because the roll ran degraded with no boards. A code-led build has no `state.json`, comp-diff or mocks.
- **Detector:** I re-ran `impeccable detect --json src` and it returned `[]`.
- **Bundle:** I re-measured initial JS from `dist/`: index 68.2 KB, react 91.8 KB and supabase 59.0 KB gzip, **219 KB** in total.
- **Side effect to disclose:** while verifying the seed, I mistakenly ran `impeccable concept-seed --help`, which performed a new roll. It overwrote the gitignored `.impeccable/questions/roll.json`, which now names `seed:6ec483d4362e3a44`, and added `.impeccable/questions/seeds/6ec483d4362e3a44.json`. The contract's seed file `4dda9c286c9d8a17.json` is untouched and still verifies. Nothing tracked by git changed.

## persistence

**pass.**
- PRODUCT.md exists.
- The direction contract exists with all five blocks.
- FORM carries `seed: 4dda9c286c9d8a17`, and `impeccable concept-seed --check-seed seed:4dda9c286c9d8a17` returns "SEED KNOWN", exit 0.
- The build is code-led, so there is no comp round, no state file and no `.impeccable/mocks/`. Those absences are not findings.
- DESIGN.md is absent. That is expected for a new world, because the documenter writes it after this review.

## fidelity

There is no comp, so this is an element matrix against the contract and the confirmed answers.

| Element | State | Evidence |
|---|---|---|
| Top bar in turf blue with title and tournament (FIRST VIEWPORT) | match | `giocatore-dafare-390-*`, 820 |
| "Da fare" on a neutral ground, rows separated by court lines, urgent items first with their deadline | match | "Presto": "Programma la partita … entro ven 27/11"; "Per sapere" follows |
| Lime primary action on the item that needs it | match | "Trova un orario" in all six Da fare captures |
| Bottom tab bar on phone, sidebar on desktop | match, with a defect | On every 5-item bar at 390 px (manager, organizer, multi-role), the label breaks mid-word as "Disponibilit / à": `gestore-*-390-*`, `org-*-390-*`. Contradicted on label integrity; see fix 2. |
| Signature: two parallel court lanes with the 30' stagger and start times on the lines (player grid) | match | `flow2/01-p1-griglia`: Campo 1 and Campo 2 lanes, 14:00/15:30 (4/4) and 17:00 (3/4), offset by the stagger |
| Signature: the manager's day timeline as two lanes | match | `gestore-giornata-*` and `gestore-richieste-*`: Campo 1 starts at 13:30 and Campo 2 at 14:00, lost slots are hatched "inutilizzabile", the lesson overlays them |
| Manager's lesson block in the timeline | contradicted (craft) | The third line "Scuola padel" is clipped mid-glyph: `gestore-richieste-820-light`, `-1440-light/dark`, `flow2/04` |
| State colour always paired with icon and text (4/4 green, 3/4 amber, occupied, requested) | match | Legend and cells in `flow2/01`–`02`; the "Da programmare" tone is now neutral |
| Lime used only for primary action, current selection and focus | adaptation, partly contradicted | Lime is correct on primary buttons, the focus halo and the selected request or lane block. But in dark theme, current selection (Switch "on", the "30 minuti" segment, the Periodo chip, "Sera" preset) is navy `--court` (L 0.31) on a ground of L 0.17–0.215. The checked Switch track is darker than an unchecked one (`--line-strong`, L 0.55), so ON reads as OFF: `org-configurazione-*-dark`. See fix 3. |
| Dark theme as a floodlit court (deep blue-black ground, same white lines) | match | Every dark capture |
| TYPE: one family, Atkinson Hyperlegible Next, tabular numerals for times and scores | match | Slashed-zero tabular times and scores throughout. No display face, no costume monospace. |
| MATERIAL: flat court-line drawing, no imitation material | match | No bevels, embossing or fake turf texture. The hatching on occupied and lost slots is a state pattern, not a material. |
| GROUND: cool neutral grounds | match | Light `--bg` is oklch(0.975 0.006 250), cool. Dark is a blue-black at hue 260. No drift toward cream or slate. |
| STORY: needs-me-now → match → lanes → request → acceptances → manager confirms with one tap → result → standings | match | `flow2/01`–`09` against a real backend. Request expiry is capped at the slot start: "Scade tra 38 h (dom 01/11 alle 13:00)". The manager confirms, the match is programmed, the result is entered, then confirmed by the opponent, and the standings update. |
| Player can cancel a confirmed match until a deadline (confirmed answer) | match | "Puoi annullarla fino a sab 31/10 alle 14:00" plus "Annulla partita": `giocatore-partita-programmata-*` |
| 3/4 slots requestable (confirmed answer) | match | 3/4 cells are shown and selectable (`flow2/01`) |
| Italian only, multi-role users (confirmed answers) | match | All copy is Italian. The manager's bar carries both the player tabs and "Campo". |
| Floor: side stripe | contradicted | The active sidebar item draws a 3 px lime left stripe, `shadow-[inset_3px_0_0_var(--ball)]` (`src/components/AppShell.tsx:239`). It is visible in every 1440 capture. The detector misses it because it is a box-shadow, not a border. See fix 1. |
| Floor: kickers, gradient text, glass, hard offset shadows, glyph icons, system display face | match (none) | Icons are Lucide throughout |

**Prior material items, verified against the evidence.**

| Item | Status | Evidence |
|---|---|---|
| Critique M1: expiry later than the slot | resolved | `flow2/03`: expiry 13:00 for a 14:00 slot. Server trigger in `supabase/migrations/20261101001300_scadenza_entro_inizio.sql`. |
| Critique M2: phone slot grid wall | resolved | `flow2/01`: the filter is on by default ("Mostro solo gli orari buoni"), empty days collapse to "Nessun orario buono · Mostra", and with no good slot the grid hides behind "Mostra la griglia completa". The lane header is sticky (`CourtLanes.tsx:72`). |
| Critique M3: 28 expanded availability days | resolved | `giocatore-disponibilita-390-*`: compact one-line days with "+ Aggiungi", week headers, presets as chips under "Compila veloce", and a rail with 08/14/20/24 labels only when a day has windows |
| Critique M4: desktop availability has no visible add affordance | resolved | `giocatore-disponibilita-1440-*`: "Clicca un giorno per aggiungere o togliere un orario.", a tick legend, and "+ Aggiungi" under every column |
| Critique M5: lane blocks lose their button role | resolved | `CourtLanes.tsx:171` wraps a real button in `<div role="listitem">` |
| Audit C1: focus invisible on blue surfaces | resolved | `index.css:162-165` sets `.bg-court, .bg-court-deep { --focus: var(--ball) }` |
| Audit S1: Sheet drops focus on close | resolved | `src/ui/sheet.tsx:31,39` record the opener and restore focus in `onCloseAutoFocus` |
| Audit S2: "Aggiungi orario" drops focus | resolved | `GiornoEditor.tsx:103` focuses the editor; `DisponibilitaPage.tsx:190` returns focus |
| Audit S3: focus hidden under the fixed bars | resolved | `index.css:166-175` adds scroll-padding |
| Audit S4: page titles and route announcement | resolved | `AppShell.tsx:67` sets `document.title` from the h1 |
| Audit S5: control borders below 3:1 | resolved | `--line-strong` is now L 0.60 in light (about 4:1 on white) and L 0.55 in dark (about 3.2:1 on surface). Fields read clearly in `org-configurazione-*`. |
| Audit S6: 200% text breaks the shell | partial | The labels no longer overlap, but the fix (`break-words`, `AppShell.tsx:227`) now splits "Disponibilità" mid-word at the default text size on every 5-item bar. That is a regression, carried as fix 2. |
| Audit S7: initial JS 219 KB against the 180 KB budget | partial; accepted, not a blocker | The react-dom chunking moved about 65 KB from index to react, but the total is unchanged at 219 KB. React plus Supabase alone is 151 KB, which leaves 29 KB for the whole app shell, so the budget cannot be met without dropping supabase-js from the entry. The precache has been trimmed, so repeat visits in this installable PWA for about 40 users load from cache. The 22% overrun costs about 1 s once on club 4G. Record it as a known deviation and revise the budget to 220 KB, or take a follow-up that lazy-loads Supabase on the public routes. It does not hold this ship. |

**Non-material (polish), for the record.**
- "Ci sono già 1 risultati" needs a singular form (`Configurazione`).
- The phone section tab strips ("Campi", "S…", "adre") clip with no scroll cue.
- The phone bracket "Finale" column is still cut off ("da defi…") with no fade.
- The toast close × is still about 16 px.
- "Invia risultato" sits flush against the "Vincono Chiquita 2 set a 0" line (`flow2/06`).
- The sidebar "Torneo" item is not active on the Classifiche sub-page (1440 light), but is on Torneo.
- The current step node "Gironi" is faint in dark (`org-panoramica-*-dark`).
- "Aggiungi a tutto il periodo" is a primary action drawn in blue, not lime.

## ceiling

There is no quality-bar card, so the bar here is the contract's own world. Two native devices are left unused:
- **Court line as the selection device.** Outside the lanes, selection and active states use generic navy fills (sidebar, segmented controls, chips). The world's own device would be a lime fill or a white court line, and in dark theme it is close to invisible.
- **The lanes stop at two screens.** The two-lane drawing appears only in the player grid and the manager timeline. The match header ("Si gioca dom 01/11 alle 14:00 · Campo 2"), the public "Prossime partite" and the manager's confirmed list could each carry a small two-lane mark that places the match on its court. Da fare, the organizer and the public pages still read as competent generic Tailwind.

This is not a material finding for an Operate surface. Earned familiarity is the bar there.

## material_fixes

1. **Floor (side stripe), all desktop screens, sidebar.** The active nav item draws a 3 px lime inset left stripe. Remove `shadow-[inset_3px_0_0_var(--ball)]` at `src/components/AppShell.tsx:239`. Carry the active state with the fill plus a lime icon, or with a 1 px white court line across the item. In dark theme, make the active fill clearly distinct from `--court-deep` (today it is L 0.31 against 0.25).
2. **S6 regression, phone tab bar with 5 items (manager, organizer, multi-role; every `gestore-*-390`, `org-*-390`, light and dark).** "Disponibilità" breaks mid-word into "Disponibilit / à". Drop `break-words` at `AppShell.tsx:227` so labels only wrap at word boundaries (`break-normal`, `hyphens-none`). Then make the label fit at 78 px: use a shorter tab label on 5-item bars (for example "Orari", with the page h1 unchanged), or move one destination into the top bar. Re-check at 390 px and at 200% text.
3. **Dark theme selection states, Configurazione (`org-configurazione-*-dark`), Disponibilità chips and segments.** The checked Switch track (`bg-court`, L 0.31) is darker than an unchecked one (`--line-strong`, L 0.55), so ON reads as OFF. The selected segment, chip and preset are navy on near-black (WCAG 1.4.11). In `src/ui/misc.tsx:33`, give the checked state the world's selection colour in dark: a `--ball` track with a `--ball-ink` thumb, or a court track with a lime ring. Apply the same selected token to the segmented control and preset or period chips so current selection is lime, as OWN-WORLD specifies.
4. **Manager timeline (signature), lesson and occupation blocks shorter than about 90' (`gestore-richieste-820/1440-*`, `flow2/04`).** The third line ("Scuola padel") is clipped mid-glyph by `overflow-hidden` (`src/components/CourtLanes.tsx:160`, content from `src/features/gestore/GiornoLanes.tsx`). For short blocks, put the title and time on one line and move the note to the accessible name or the block's sheet, so no visible text is ever cut.

## keep

Keep the two court lanes with the 30' stagger, start times on the lines and hatched lost slots, together with the collapsed "only good slots" phone grid and the 4/4 → manager-confirm request block. These carry the product, so the fixes above must not flatten them into cards or lists.
