# Audit tecnico: Padel League

Independent technical audit following the Impeccable `audit` method (`.claude/skills/impeccable/reference/audit.md`) and the craft floor, measured against `PRODUCT.md` (WCAG 2.2 AA, users over 50, phone used outdoors, touch targets ≥ 44 px, nothing by colour alone, Italian only, light and dark themes).

- **Build audited:** commit `0624dc4`, Vite dev server at `http://localhost:5173` with the local Supabase demo seed. Lighthouse ran on a production build served by `vite preview`.
- **Date:** 2026-10-30
- **Method:** Chromium (Playwright) at 320, 390, 820 and 1440 px, light and dark (`colorScheme`), `reducedMotion: reduce`, and 200% root text size. axe-core 4 (`wcag2a/aa`, `wcag21a/aa`, `wcag22aa`, best-practice) on 24 routes × 2 themes, each logged in as the right role. Scripted Tab walks and arrow-key navigation. Contrast computed from the rendered colours (canvas sRGB, WCAG formula). Lighthouse (mobile, simulated throttling). The Impeccable detector ran on `src` and, over CDP, on the public routes.
- **Scope:** the audit was read-only. No data was created, confirmed, cancelled or deleted. Sheets were opened and then closed with Esc or "Chiudi".

---

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | **2** | Focus ring is invisible on the blue shell in light mode (1.00:1 in the sidebar, 1.41:1 in the top bar). Every controlled Sheet drops focus to `<body>` when it closes. |
| 2 | Performance | **3** | Lazy chunks per area are well done, but initial JS is **219 KB gzip** against a 180 KB budget. Lighthouse mobile performance is 82 (TBT 740 ms on home). |
| 3 | Theming | **3** | Full OKLCH token system and a solid dark theme. `--focus` and `--line-strong` are not remapped for the surfaces where they fail. |
| 4 | Responsive Design | **3** | No horizontal overflow from 320 to 1440 px at 100% text. At 200% text the tab bar labels overlap and the slot grid overflows. A few targets are under 44 px. |
| 5 | Implementation Integrity | **3** | A coherent, product-specific system ("righe del campo"). Isolated drift: 13–15 px text against a 16 px floor, `role="listitem"` placed on buttons. |
| **Total** | | **14/20** | **Good**: fix the accessibility gaps first. |

### Third-party scores

| Tool | Route | Performance | Accessibility | Best practices | Notes |
|---|---|---|---|---|---|
| Lighthouse 12 (mobile, simulated) | `#/` (logged out) | **82** | **100** | **100** | FCP 1.0 s · LCP 1.0 s · **TBT 740 ms** · CLS 0.06 · TTI 3.5 s · unused JS 109 KiB |
| Lighthouse 12 (mobile, simulated) | `#/t/<tid>/classifiche` | **82** | **100** | **100** | FCP 1.0 s · **LCP 3.8 s** · TBT 320 ms · CLS 0 · TTI 3.8 s · unused JS 108 KiB |
| axe-core | 5 public routes × 2 themes | | **0 violations** | | |
| axe-core | 19 authenticated routes × 2 themes | | 1–3 rule types per route | | `label-content-name-mismatch` (serious, every logged-in route), `aria-allowed-role` (11 nodes, `#/campo/giorno`), `scrollable-region-focusable` (`organizza/finali`) |
| Impeccable detector | `src` (static) | | | | `[]`, no findings |
| Impeccable detector (CDP) | public routes | | | | Advisories only: "repeating-stripes-gradient" on `body` is a **false positive** (it is the functional `.pattern-hatch` used for occupied courts, as PRODUCT requires). "straggler" on one paragraph in `classifiche`. |

---

## Implementation Integrity Verdict: **PASS**

The implementation expresses one product-specific system rather than a generic kit:

- **Tokens:** `src/styles/index.css` defines a complete OKLCH token set (turf blue shell, white court lines as the only dividers, ball yellow-lime reserved for primary action, selection and focus) with a matching dark theme.
- **Signature component:** the slot grid (`CourtLanes` + `SlotGrid`) draws the two staggered courts literally.
- **State encoding:** slot states always carry an icon, text, a tone and a pattern. Nothing is communicated by colour alone, as `PRODUCT.md` asks.
- **Browser surfaces are themed:** `::selection` (ball/ball-ink), `caret-color` and `accent-color` (court), `scrollbar-color`, a global `:focus-visible`, `text-underline-offset`, and a `.tabular` utility. None of the numeric `td`/`th` cells measured on any route lacked tabular numerals.
- **Hard-coded colours:** only 4 in feature code, all overlay or scrim alphas (`src/ui/sheet.tsx:31`, `src/ui/alert-dialog.tsx:35`, `src/ui/button.tsx:16`) plus one `text-white` at `src/components/AppShell.tsx:226`.

The integrity problems are isolated, not systemic:

- Type below the 16 px floor in dense views.
- `role="listitem"` placed on `<button>` in `CourtLanes`.
- The focus token is not remapped on blue surfaces. This is the most serious issue in the audit, but it is a token-scoping mistake, not drift.

---

## Executive Summary

- **Audit Health Score: 14/20 (Good)**
- **Issues found:** 1 critical (P0), 7 serious (P1), 8 moderate (P2), 3 minor (P3).
- **Top issues:**
  1. **Invisible keyboard focus on the shell in light mode.** In the desktop sidebar the ring is court-deep on court-deep (1.00:1). In the top bar it is 1.41:1. The organizer, who works from a desktop, cannot see focus in primary navigation.
  2. **Focus is lost when any Sheet closes.** All 13 controlled Sheets return focus to `<body>`; only the slot grid works around it. The inline "Aggiungi orario" editor also drops focus to `<body>`.
  3. **Focused elements can be fully hidden under the fixed bottom tab bar** (WCAG 2.2 SC 2.4.11). There is no `scroll-padding` anywhere.
  4. **Every route has the same `document.title`** ("Padel League"), and nothing is announced on navigation.
  5. **Form control borders and unchecked checkboxes or switches reach only 1.99:1** against the surface (light). That fails SC 1.4.11 and is worse in sunlight.
- **Next steps:**
  1. Scope `--focus` to the shell and fix the Sheet focus return (two small, central fixes).
  2. Add `scroll-padding` and per-route titles.
  3. Darken `--line-strong` or add a control-border token.
  4. Then handle large-text resilience and the JS budget.

---

## Detailed Findings by Severity

Severity scale: **Critical = P0**, **Serious = P1**, **Moderate = P2**, **Minor = P3**.

### Critical (P0)

#### [P0] C1. Focus indicator invisible on court-blue surfaces (light theme)
- **Location:** `src/styles/index.css` (`--focus: oklch(0.38 0.115 258)` and the global `:focus-visible` rule); `src/components/AppShell.tsx` (`<aside class="bg-court-deep">`, `<header class="bg-court">`).
- **Routes:** every route. At ≥ 1024 px, all sidebar links and the profile link; at < 1024 px, the brand link and the avatar link in the top bar.
- **Evidence (measured):**
  - Sidebar link "Partite" focused at 1440 px: outline `oklch(0.38 0.115 258)`, parent background `oklch(0.38 0.115 258)`, so the ring contrast is **1.00:1**. The screenshot shows no visible change. The link has no hover/focus background either (`bg=rgba(0,0,0,0)`).
  - Top bar at 390 px: brand link and "Profilo di …" link, ring contrast **1.41:1** against `--court`.
  - In dark theme the same elements measure 10.15–12.32:1 (ball focus), so this is a light-only defect.
- **Category:** Accessibility / Theming
- **Impact:** a keyboard user loses track of focus in primary navigation on every page. The organizer, who mostly works from a desktop, is the user most affected.
- **WCAG:** 2.4.7 Focus Visible (AA); 1.4.11 Non-text Contrast (AA).
- **Recommendation:** remap the token on the shell, which costs nothing elsewhere:
  ```css
  /* src/styles/index.css */
  .bg-court, .bg-court-deep { --focus: var(--ball); }
  ```
  An equivalent is to add `focus-visible:outline-ball` to `Brand`, `ProfiloLink` and the sidebar `NavItem`. Ball on court is about 5:1 (estimated) in light and 10:1 in dark. Also give sidebar items a `focus-visible:bg-court` fill so the state does not rely on the outline alone.
- **Suggested command:** `/impeccable harden`

### Serious (P1)

#### [P1] S1. Every controlled Sheet drops focus to `<body>` on close
- **Location:** `src/ui/sheet.tsx`. Radix `Dialog.Content`'s default `onCloseAutoFocus` calls `event.preventDefault(); context.triggerRef.current?.focus()`. The app never renders `D.Trigger`, so `triggerRef` is `null` and focus ends on `<body>`.
- **Routes and elements (measured):**
  - "Altro" sheet (AppShell tab bar, gestore and admin): after Esc, `document.activeElement = BODY`.
  - `#/campo/giorno`: tapping a lane block opens "Segna occupazione". After Esc, focus is on `BODY`; after clicking "Chiudi", also `BODY`.
  - The same pattern applies to the controlled Sheets in `GiornataPage` (×3), `RicorrenzePage`, `ImpostazioniPage`, `RichiestePage`, `ControproponiSheet`, `Periodi`, `Squadre`, `OffGrid`, `DisponibilitaPage` and `AppShell`.
  - Only `SlotGrid.tsx` (`chiudiSheet`) restores focus manually. That sheet was verified: focus moves inside on open, Tab cycles only within the sheet (trap OK), and Esc returns focus to the same slot.
- **Category:** Accessibility
- **Impact:** after every sheet, keyboard and screen-reader users restart from the top of the page. On VoiceOver/TalkBack the reading position resets. This hits the court manager's core loop (mark occupied, close, next slot).
- **WCAG:** 2.4.3 Focus Order (A).
- **Recommendation:** in `Sheet`, record `document.activeElement` when `open` becomes true. Then pass `onCloseAutoFocus={(e) => { e.preventDefault(); (prev?.isConnected ? prev : fallbackRef.current)?.focus(); }}` to `D.Content`, and allow an optional `returnFocusRef` prop. With that in place the manual `setTimeout` in `SlotGrid` can be removed.
- **Suggested command:** `/impeccable harden`

#### [P1] S2. "Aggiungi orario" unmounts its own button and drops focus to `<body>`
- **Location:** `src/features/player/availability/AvailabilityPage.tsx:357-360` (`{aperto !== d && <Button …>Aggiungi orario</Button>}`) and `GiornoEditor.tsx` (`AggiungiOrario`).
- **Route:** `#/t/<tid>/disponibilita` (list view, 390 px).
- **Evidence:** focus "Aggiungi orario", press Enter. The inline editor opens, but `document.activeElement = BODY`.
- **Category:** Accessibility
- **Impact:** this is the first task a new player does ("say when you can play"). Keyboard and screen-reader users lose their place and have to hunt for the newly opened "dalle/alle" selects.
- **WCAG:** 2.4.3 Focus Order (A).
- **Recommendation:** `autoFocus` the "dalle" select when the editor opens. On "Chiudi" or after "Aggiungi", return focus to the day's "Aggiungi orario" button (keep a ref per day). Also consider closing the editor on Esc.
- **Suggested command:** `/impeccable harden`

#### [P1] S3. Focused elements hidden under the fixed bottom tab bar
- **Location:** `src/components/AppShell.tsx` (tab bar `fixed inset-x-0 bottom-0`, `min-h-16`; top bar `sticky top-0`). There is no `scroll-padding` anywhere in `src/`.
- **Evidence (390 × 844):**
  - `#/admin/utenti`: a role checkbox focused at `y=813`, height 24, is **100% covered** by the tab bar (780–844).
  - `#/t/<tid>/partite/b55f…`: the "Legenda" `<summary>` is **93% covered** when it receives focus.
  - `#/campo/giorno`: a lane block is 14% covered.
  - The browser does not scroll because the element is technically inside the viewport.
- **Category:** Accessibility / Responsive
- **WCAG:** 2.4.11 Focus Not Obscured (Minimum) (AA, new in 2.2).
- **Recommendation:** add the following to `src/styles/index.css`:
  ```css
  html { scroll-padding-top: 4rem; scroll-padding-bottom: calc(4.5rem + env(safe-area-inset-bottom)); }
  @media (min-width: 1024px) { html { scroll-padding: 1rem; } }
  ```
- **Suggested command:** `/impeccable adapt`

#### [P1] S4. No page titles and no route-change announcement
- **Location:** there is no `document.title` assignment in `src/` (grep). `src/components/PageHeader.tsx` is the natural place for it.
- **Evidence:**
  - `document.title === "Padel League"` on all 24 routes audited.
  - After activating the "Disponibilità" tab, focus stays on the tab link and nothing is announced. `<main key={pathname}>` remounts, but focus is not moved.
- **Category:** Accessibility
- **Impact:** screen-reader users get no confirmation that the page changed. Browser history, the tab switcher and the PWA task switcher all show the same name.
- **WCAG:** 2.4.2 Page Titled (A); related to 4.1.3 Status Messages.
- **Recommendation:**
  - In `PageHeader`, add `useEffect(() => { document.title = \`${titolo} · Padel League\`; }, [titolo])`.
  - On pathname change (in `AppShell`), focus the page `<h1>` (`tabIndex={-1}`) unless the navigation came from in-page interaction. Alternatively, push the title into the existing `aria-live` region.
- **Suggested command:** `/impeccable harden`

#### [P1] S5. Form control boundaries below 3:1
- **Location:** `src/styles/index.css` `--line-strong`, used by `src/ui/field.tsx` (`border-line-strong` on every Input/Select/Textarea), `src/ui/misc.tsx` `Checkbox` (`border-2 border-line-strong`) and `Switch` (unchecked track `bg-line-strong` with a `bg-surface` thumb).
- **Evidence (rendered colours):**
  - `--line-strong` against `--surface`: **1.99:1** (light) and **2.07:1** (dark).
  - `--line-strong` against `--bg`: 1.85:1 (light).
  - The input fill (`surface`) against the page (`bg`) is about 1.04:1, so the border is the **only** cue for where a field is.
  - Unchecked Switch: the thumb against the track measures 1.99:1.
- **Routes:** `#/accedi`, `#/profilo`, `#/admin/utenti` (44 role checkboxes), `organizza/configurazione`, `#/campo/impostazioni`, and Disponibilità selects.
- **Category:** Accessibility / Theming
- **Impact:** outdoors, in sunlight, users over 50 cannot find the fields or tell an unchecked checkbox from blank space.
- **WCAG:** 1.4.11 Non-text Contrast (AA).
- **Recommendation:** introduce `--control-border` at ≥ 3:1 on both `surface` and `bg`. For example, light `oklch(0.6 0.03 255)`; dark `oklch(0.58 0.04 258)`, which needs verifying. Use it in `field.tsx`, `Checkbox` and the `Switch` track. Keep `--line-strong` for decorative dividers.
- **Suggested command:** `/impeccable colorize`

#### [P1] S6. Large text (200%) breaks the shell and the slot grid
- **Location:** `src/components/AppShell.tsx` (tab bar labels `text-xs`, one grid column per item; top bar), and the slot grid and availability layouts.
- **Evidence:** at 390 px with `html { font-size: 200% }`, which mirrors the large-text settings common among the target users:
  - Tab labels "Partite", "Disponibilità" and "Torneo" **overlap each other** (see `zoom200_t_T_partite…png`).
  - The sticky top bar grows to 136 px and the tab bar to 129 px, so **265 of 844 px (31%)** are permanently covered.
  - `scrollWidth` is **554 px** on the match page and **489 px** on Disponibilità, so the H1 "Le Bandejas contro Chiquita" is clipped.
  - Home and Classifiche stay at 390 (OK).
- **Category:** Responsive / Accessibility
- **WCAG:** 1.4.4 Resize Text (AA); 1.4.10 Reflow (AA).
- **Recommendation:**
  - Let tab labels wrap to two lines with `text-balance` and `leading-tight`, or hide labels when they do not fit (keep `aria-label`) above a font-size threshold.
  - Make the top bar non-sticky, or collapse it on scroll, when `rem` > 20 px.
  - Find the fixed-width elements in the lanes (`CourtLanes` hour gutter `2.75rem` and the `whitespace-nowrap` buttons) and allow them to wrap or stack the two courts vertically.
- **Suggested command:** `/impeccable adapt`

#### [P1] S7. Initial JavaScript exceeds the 180 KB gzip budget
- **Location:** `vite.config.ts` (`manualChunks`), `index.html` preloads.
- **Evidence (production build, gzip):**

  | Chunk | gzip |
  |---|---|
  | `index-*.js` | 133.6 KB |
  | `supabase-*.js` | 59.0 KB |
  | `react-*.js` | 26.7 KB |
  | **Total initial JS** | **219.3 KB** |

  - The total is **22% over budget**.
  - `react-dom` ends up in `index` (the minified React error URL string is present there), because `manualChunks.react` lists `'react-dom'` while the app imports `react-dom/client`.
  - Lighthouse reports 108–109 KiB of unused JS at load (index 61 KiB unused, supabase 47 KiB unused) and **TBT 740 ms** on home.
  - The PWA precache has 80 entries (1.3 MB), including all organizer and court-manager chunks for anonymous visitors.
  - CSS is 45.5 KB raw; fonts are 34 KB + 19 KB woff2.
- **Category:** Performance
- **Impact:** slow first load on a mid-range phone over a 4G connection at the club. With the PWA precache, first visits download more than 1 MB in the background.
- **Recommendation:**
  - Add `'react-dom/client'` and `'scheduler'` to the `react` chunk.
  - Load `sonner` and the `Sheet`/Radix dialog lazily from the routes that need them.
  - Move the realtime subscription and `useRichiesteGiocatore`/`useRichiesteInAttesa` behind an authenticated dynamic import.
  - Check for supabase tree-shaking (`@supabase/supabase-js` pulls in realtime, storage and functions). Consider `@supabase/postgrest-js` plus `auth-js` for the public bundle.
  - Restrict `workbox.globPatterns` to the shell plus public chunks and use runtime caching for the rest.
- **Suggested command:** `/impeccable optimize`

### Moderate (P2)

#### [P2] M1. Accessible names do not contain the visible label
- **Location:**
  - `src/components/AppShell.tsx:250`: avatar link, visible "G1", name "Profilo di Giocatore 1". Present on every logged-in route except `/admin/utenti`, where axe did not flag it.
  - `src/features/player/matches/slots/SlotGrid.tsx` together with `logica.ts` `ariaSlot`: 66 slot buttons whose visible text is "13:30 / 3/4" while the name reads "…, 13:30–15:00, 3 su 4 liberi, …".
- **Evidence:** axe `label-content-name-mismatch` (serious): 1 node per logged-in route and 67 on `partite/b55f…`.
- **Category:** Accessibility
- **Impact:** voice-control users who say "tap 3/4" or "tap G1" get no match.
- **WCAG:** 2.5.3 Label in Name (A). The time is already in the name, so the practical impact is limited.
- **Recommendation:**
  - Avatar: drop `aria-label` and add `<span class="sr-only">Profilo di {nome}</span>` after the initials.
  - Slots: phrase the name as "13:30, 3/4 liberi, Campo 2, …", or put the visible text first.
- **Suggested command:** `/impeccable clarify`

#### [P2] M2. Gestore lane blocks: `role="listitem"` overrides the button role
- **Location:** `src/components/CourtLanes.tsx:160`: `<button type="button" role="listitem" …>`.
- **Route:** `#/campo/giorno`, 11 nodes (axe `aria-allowed-role`).
- **Impact:** screen readers announce "list item" instead of "button", so the court manager's main action ("tap a slot to mark it occupied") is not exposed as actionable. `aria-pressed` on a listitem is also ignored.
- **WCAG:** 4.1.2 Name, Role, Value (A).
- **Recommendation:** render `<div role="listitem"><button …/></div>`, the same structure the non-interactive branch at line 164 uses.
- **Suggested command:** `/impeccable harden`

#### [P2] M3. Touch targets below the 44 px product floor
- All of these pass WCAG 2.5.8 (24 px) but fail the `PRODUCT.md` floor. Measured at 390 px:

| Route | Element | Size |
|---|---|---|
| `#/admin/utenti` | Role `Checkbox` (`src/ui/misc.tsx` `size-6`) and its label row | **24×24**, label 25 px tall (44 instances) |
| every logged-in route | Avatar profile link (`AppShell.tsx` `ProfiloLink`) | **36**×44 |
| `#/accedi` | "Ho dimenticato la password" (`Button variant="link"`) | 218×**25** |
| `#/t/<tid>/partite/b55f…` | "Proponi un orario fuori griglia" (`Button variant="link"`) | 261×**25** |
| `organizza/configurazione` | `Switch` | 48×**28** (the label is clickable, which mitigates this) |

- **Root cause:** `src/ui/button.tsx:21`, where `link: 'min-h-0 px-0 …'` removes the 44 px minimum.
- **Recommendation:**
  - Set `link` to `min-h-11`.
  - Wrap Checkbox and Label in a `<label class="flex min-h-11 items-center gap-3">` row.
  - Give the avatar `size-11`.
- **Suggested command:** `/impeccable adapt`

#### [P2] M4. Text below the 16 px product floor
- **Evidence:** across the 24 routes at 390 px, visible text nodes measured **243 at 13 px** (`text-xs`) and **323 at 15 px** (`text-sm`), against 640 at 17 px. Concentrations:
  - Slot grid: 71 nodes at 13 px and 92 at 15 px, including the slot state "3/4" and "Occupato" (15 px).
  - `#/campo/giorno`: 34 nodes at 13 px (legend, "Libero").
  - Tab bar labels: 13 px.
  - Top bar tournament name: 13 px.
- **Location:** type scale in `src/styles/index.css` `@theme` (`--text-xs: 0.8125rem`, `--text-sm: 0.9375rem`).
- **Impact:** `PRODUCT.md` asks for "at least 16 px" for users over 50 outdoors. The densest, most important view (the slot grid) is also the smallest.
- **Recommendation:** raise `--text-sm` to 1rem and keep `--text-xs` only for non-essential metadata. In lanes, rely on the bold 17 px time and an icon, and make the state label at least 16 px.
- **Suggested command:** `/impeccable typeset`

#### [P2] M5. Selection relies on ball yellow at 1.17:1 in light mode
- **Location:**
  - `src/features/manager/RequestsPage.tsx:351`: selected request `bg-surface-2 outline-2 outline-ball`.
  - `src/features/player/availability/WeekStrip.tsx:76`: selected day `outline-2 outline-offset-4 outline-ball`.
- **Evidence:** `--ball` against `--bg` is **1.17:1** and against `--surface` 1.26:1 (light); `--surface-2` against `--surface` is about 1.04:1. The slot grid avoids the problem (`ring-2 ring-court-deep` plus a check icon), so this is inconsistent with the system's own rule.
- **WCAG:** 1.4.11 Non-text Contrast (AA) for state indication.
- **Recommendation:** reuse the slot grid treatment (`outline-ball ring-2 ring-court-deep`) or a `--court` outline in light mode.
- **Suggested command:** `/impeccable polish`

#### [P2] M6. Reduced motion: the global 0.01 ms rule makes infinite animations flicker
- **Location:** the `@media (prefers-reduced-motion: reduce)` rule in `src/styles/index.css`.
- **Evidence:** under `reducedMotion: reduce`, `.animate-spin` and `.animate-pulse` compute `animation-duration: 1e-05s; animation-iteration-count: infinite`. The Button loading spinner (`src/ui/button.tsx:55`) and `Skeleton` (`src/ui/misc.tsx:10`) therefore cycle about 100,000 times per second and show an arbitrary frame each repaint, which reads as jitter instead of stillness. Sheets lose their slide entirely; that is acceptable, but a 150 ms opacity fade would preserve where the panel came from.
- **Recommendation:** add `animation-iteration-count: 1 !important` to the reduce block, and `motion-reduce:animate-none` on the spinner with a visible "Attendi…" label. Keep the opacity-only fade for sheets.
- **Suggested command:** `/impeccable animate`

#### [P2] M7. Dotted "2/4 o meno" pattern drops text contrast in dark theme
- **Location:** `.pattern-dots` in `src/styles/index.css` (`currentColor` at 30%), used by `SlotGrid` and `CourtLanes`.
- **Evidence:** text against the solid fill is 8.18:1, but against the dot colour it is **4.09:1** for 15 px / 600 "0/4" (needs 4.5:1). Light theme: 4.53:1 against the dots, and the light hatch for "Occupato" is exactly **4.50:1** (at threshold). axe could not evaluate any of these: 132 nodes were "incomplete, background gradient".
- **WCAG:** 1.4.3 Contrast (Minimum) (AA), local.
- **Recommendation:** use 18% dot opacity in dark (`[data-theme=dark] .pattern-dots`) and 16% for the hatch, or keep patterns out of the text area (pad-left band only).
- **Suggested command:** `/impeccable colorize`

#### [P2] M8. Horizontal bracket scroller not keyboard-reachable
- **Location:** `src/components/Bracket.tsx:26` (`overflow-x-auto snap-x`).
- **Route:** `#/t/<tid>/organizza/finali`. At 320 px, `scrollWidth` 538 against 320 visible.
- **Evidence:** axe `scrollable-region-focusable` (serious) in both themes. The region contains no focusable children.
- **WCAG:** 2.1.1 Keyboard (A).
- **Recommendation:** `tabIndex={0} role="region" aria-label="Tabellone"`, plus a visible focus ring. This also covers the public `#/t/<tid>/tabellone/:fase` when it overflows.
- **Suggested command:** `/impeccable harden`

### Minor (P3)

#### [P3] m1. Calendar day headings concatenate without a separator
- **Location:** `src/features/public/SchedulePage.tsx:125-128`.
- **Evidence:** the accessible text of the `<h3>` is "Giornata 1entro gio 26/11".
- **Recommendation:** insert `{' · '}` or `<span class="sr-only">, </span>` before the `entro` span.
- **Suggested command:** `/impeccable clarify`

#### [P3] m2. Section tab strips overflow at 320 px with no affordance
- **Location:** gestore `GestoreNav.tsx` (`scrollWidth` 468 against 288) and Organizza section nav (818 against 320).
- **Evidence:** at 320–390 px, "Ricorrenze" is cut mid-word and "Campi" is off-screen. The strips stay keyboard-reachable because they contain links.
- **Recommendation:** add an edge fade mask (`mask-image`), and on mount use `scrollIntoView({inline:'nearest'})` on the active tab.
- **Suggested command:** `/impeccable layout`

#### [P3] m3. PWA icons
- **Location:** `vite.config.ts` manifest and `index.html`.
- **Evidence:** only an SVG icon (`sizes: 'any'`, `purpose: 'any maskable'`), and no `apple-touch-icon`.
- **Impact:** iOS home-screen installs get a screenshot icon. Maskable and "any" in one SVG also crops badly on Android.
- **Recommendation:** add 192/512 PNG icons, a separate maskable PNG, and `<link rel="apple-touch-icon">`.
- **Suggested command:** `/impeccable polish`

---

## Checks that passed (evidence)

| Check | Result |
|---|---|
| axe, public routes (`/`, `/t/<tid>`, `classifiche`, `calendario`, `accedi`), light and dark | **0 violations** |
| Text contrast (rendered, all leaf text on 19 routes × 2 themes, solid backgrounds) | **No failures.** Only disabled buttons at `opacity:0.5` (exempt). Muted text: `ink-muted`/`bg` 6.93:1 (light), 8.98:1 (dark). Top bar `court-ink-muted`/`court` 5.04:1. Status inks on soft fills 7.07–9.5:1. |
| Horizontal overflow at 320 / 390 / 820 / 1440, 100% text | `scrollWidth === innerWidth` on all 25 routes. No clipped text except intentional `truncate` and `sr-only`. |
| Slot grid keyboard | Single tab stop (roving `tabindex`: 1 of 66 buttons has `tabindex=0`). ↑/↓ follow time across both courts, ←/→ switch court, Home/End go to first/last of day, PageDown goes to next day. Enter opens the sheet with focus inside (on "Chiudi"). Tab is trapped (12 presses, all inside). Esc returns focus to the originating slot. |
| Skip link | "Vai al contenuto" is the first tab stop, visible on focus (ball fill), and targets `#contenuto`. |
| Landmarks | One visible `header`, `main`, `nav[aria-label=Principale]` per breakpoint (the other is `display:none`), plus labelled secondary navs ("Settimane", "Sezioni del campo", "Sezioni di Organizza", "Fase finale"). |
| Heading order | One `h1` per route, no skipped levels on any of the 25 routes. `#/campo/giorno` and `#/admin/utenti` have only an `h1`; acceptable. |
| Live regions | Always-mounted `aria-live="polite"` in `AppShell` for realtime updates; week range and "N orari vanno bene" in the slot grid are polite; `role="status"` on loading skeletons; sonner toasts. |
| Not colour alone | Slot states: icon, text, tone and pattern. The legend repeats them, and the selected slot adds a check icon plus a court-deep ring. The active bottom tab has a top bar and `aria-current`. |
| Dark theme | Focus ring (ball) 10–14.7:1 everywhere; all text pairs ≥ 4.7:1. |
| Browser surfaces | `::selection`, caret, `accent-color`, `scrollbar-color`, `:focus-visible`, underline offset and `.tabular` are all themed from tokens. 0 numeric table cells without tabular numerals. |
| Lazy loading | 40+ route and feature chunks. Organizer (`OrganizzaPage` 5 KB, `Configurazione` 4.8 KB…) and court-manager (`GiornataPage` 19 KB) code is not in the public path. |
| Lighthouse accessibility / best practices | 100 / 100 on both public routes. |

## Patterns & Systemic Issues

1. **Focus management is ad hoc.** The slot grid handles return focus perfectly, but the shared `Sheet` primitive does not, and inline editors and route changes do not move focus at all. Fixing `src/ui/sheet.tsx` and adding a route-focus hook in `AppShell` closes most of it.
2. **Tokens are tuned for the white content surface, not for every surface they land on.** `--focus` fails on court blue, `--line-strong` fails as a control border, and `--ball` fails as a selection outline on light backgrounds. A small set of role tokens would remove the whole class: `--focus-on-court`, `--control-border`, `--selected-ring`.
3. **Density beats the 16 px floor in the views that matter most:** the slot grid, the gestore day timeline, and the tab bar. It also breaks first when the user enlarges text.
4. **The fixed chrome (sticky top bar plus fixed tab bar) is not accounted for** in scrolling (`scroll-padding`) or at large text sizes.

## Positive Findings

- The **slot grid** is an exemplary composite widget: roving `tabindex`, full arrow/Home/End/PageUp/PageDown support, rich Italian `aria-label`s, `aria-pressed`, an always-available legend, and correct focus return.
- **States are never by colour alone**, exactly as `PRODUCT.md` requires, and the patterns have meaning (hatch for occupied, dots for "2/4 or less").
- **Clean axe results** on all public pages in both themes. Lighthouse accessibility 100.
- **Dark theme is first-class**, not inverted: the focus ring switches to ball yellow and contrast is higher than in light.
- **Code splitting per role area**, so anonymous visitors do not download organizer or court-manager code at runtime.
- **Browser surfaces are deliberately themed** (selection, caret, scrollbars, tabular numerals). This is rare and well done.
- Atkinson Hyperlegible Next is self-hosted: an accessible typeface chosen for the audience.

## Recommended Actions

1. **[P0] `/impeccable harden`**: scope `--focus` to `var(--ball)` on `.bg-court` and `.bg-court-deep` (sidebar and top bar); add a focus fill to sidebar items (C1).
2. **[P1] `/impeccable harden`**: make `src/ui/sheet.tsx` restore focus to the opener; fix focus on the "Aggiungi orario" inline editor; per-route `document.title` plus focus on `<h1>` on navigation (S1, S2, S4).
3. **[P1] `/impeccable adapt`**: add `scroll-padding` for the fixed bars; make the tab bar and lanes survive 200% text (S3, S6).
4. **[P1] `/impeccable colorize`**: `--control-border` ≥ 3:1 for inputs, checkboxes and switches (S5).
5. **[P1] `/impeccable optimize`**: get initial JS under 180 KB gzip (react-dom chunking, lazy toaster and dialog, trimmed precache) (S7).
6. **[P2] `/impeccable harden`**: `role="listitem"` wrapper in `CourtLanes`; focusable bracket scroller; label-in-name for the avatar and slots (M1, M2, M8).
7. **[P2] `/impeccable adapt`**: 44 px for `Button variant="link"`, checkbox rows and the avatar (M3).
8. **[P2] `/impeccable typeset`**: lift `--text-sm` to 16 px and stop using 13 px for essential labels (M4).
9. **[P2] `/impeccable colorize`**: soften the dots and hatch under text in dark mode (M7).
10. **[P2] `/impeccable animate`**: reduced-motion iteration count and spinner alternative (M6).
11. **[P3] `/impeccable polish`**: selection ring consistency (M5), calendar heading separator, tab-strip overflow affordance, PWA icons; final polish pass.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.

---

### Appendix: raw artefacts
The scripts and raw outputs live outside the repository, under `/tmp/claude-0/-home-user-padel-league/2a6e0b5f-dca7-5ee7-9e39-09551182ed8f/scratchpad/audit/`:

| File | Contents |
|---|---|
| `axe.json` | axe results, 48 runs |
| `measure.json` | overflow, targets, type sizes, headings, landmarks, live regions at 4 widths |
| `lh-home.json`, `lh-classifiche.json` | Lighthouse reports |
| `shots/` | screenshots, including `sidebar_focus_1440_light.png`, `topbar_focus_390_light.png` and `zoom200_*.png` |
