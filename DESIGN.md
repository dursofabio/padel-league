---
name: Padel League
description: "Righe del campo, the court's own lines: a doubles padel league app with a turf-blue shell, white court lines, and ball lime for the one thing to do."
colors:
  # Light theme values (src/styles/index.css :root). Dark values are listed in ## Colors and in .impeccable/design.json.
  ground: "oklch(0.975 0.006 250)"
  surface: "oklch(1 0 0)"
  surface-2: "oklch(0.955 0.01 250)"
  ink: "oklch(0.23 0.035 258)"
  ink-muted: "oklch(0.45 0.03 258)"
  line: "oklch(0.885 0.014 250)"
  line-strong: "oklch(0.6 0.025 252)"
  court: "oklch(0.46 0.135 256)"
  court-deep: "oklch(0.38 0.115 258)"
  court-ink: "oklch(0.99 0.004 250)"
  court-ink-muted: "oklch(0.88 0.03 250)"
  court-line: "oklch(1 0 0 / 0.55)"
  ball: "oklch(0.91 0.19 120)"
  ball-strong: "oklch(0.86 0.2 122)"
  ball-ink: "oklch(0.24 0.05 140)"
  ok: "oklch(0.52 0.13 150)"
  ok-soft: "oklch(0.95 0.045 150)"
  ok-ink: "oklch(0.37 0.1 150)"
  warn: "oklch(0.7 0.15 75)"
  warn-soft: "oklch(0.96 0.06 90)"
  warn-ink: "oklch(0.44 0.1 65)"
  danger: "oklch(0.55 0.19 27)"
  danger-soft: "oklch(0.95 0.035 25)"
  danger-ink: "oklch(0.46 0.17 27)"
  info: "oklch(0.5 0.14 258)"
  info-soft: "oklch(0.945 0.035 258)"
  info-ink: "oklch(0.42 0.13 258)"
  idle-soft: "oklch(0.94 0.008 250)"
  idle-ink: "oklch(0.42 0.02 258)"
  focus: "oklch(0.38 0.115 258)"
typography:
  headline:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: "2.3rem"
  statement:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.95rem"
  title:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: "1.7rem"
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: "1.55rem"
  body-strong:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: "1.55rem"
  label:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: "1.35rem"
  caption:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: "1.15rem"
  numeric:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: "1.55rem"
    fontFeature: "tnum"
rounded:
  focus: "4px"
  block: "6px"
  control: "0.5rem"
  panel: "0.875rem"
  pill: "9999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
  "10": "2.5rem"
  target: "2.75rem"
  tab: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.ball}"
    textColor: "{colors.ball-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.ball-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.court}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
    height: "2.75rem"
  button-secondary-hover:
    backgroundColor: "{colors.info-soft}"
  button-court:
    backgroundColor: "{colors.court}"
    textColor: "{colors.court-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
    height: "2.75rem"
  button-court-hover:
    backgroundColor: "{colors.court-deep}"
  button-ghost:
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
    height: "2.75rem"
  button-ghost-hover:
    backgroundColor: "{colors.surface-2}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
    height: "2.75rem"
  button-danger-hover:
    backgroundColor: "{colors.danger-soft}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "2.75rem"
  top-bar:
    backgroundColor: "{colors.court}"
    textColor: "{colors.court-ink}"
    padding: "0 1rem"
    height: "3.5rem"
  sidebar:
    backgroundColor: "{colors.court-deep}"
    textColor: "{colors.court-ink}"
    width: "16rem"
  sidebar-item-active:
    backgroundColor: "{colors.court}"
    textColor: "{colors.court-ink}"
    rounded: "{rounded.control}"
    height: "2.75rem"
  tab-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    height: "4rem"
  tab-bar-item-active:
    textColor: "{colors.court}"
  badge-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.625rem"
  badge-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.625rem"
  badge-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.625rem"
  badge-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.625rem"
  badge-idle:
    backgroundColor: "{colors.idle-soft}"
    textColor: "{colors.idle-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.625rem"
  lane-header:
    backgroundColor: "{colors.court}"
    textColor: "{colors.court-ink}"
    typography: "{typography.label}"
    padding: "0.375rem 0.5rem"
  lane:
    backgroundColor: "{colors.surface-2}"
    width: "minmax(0, 1fr)"
  lane-block-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok-ink}"
    rounded: "{rounded.block}"
    padding: "0.25rem 0.5rem"
  lane-block-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn-ink}"
    rounded: "{rounded.block}"
    padding: "0.25rem 0.5rem"
  lane-block-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.block}"
    padding: "0.25rem 0.5rem"
  lane-block-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info-ink}"
    rounded: "{rounded.block}"
    padding: "0.25rem 0.5rem"
  lane-block-idle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.idle-ink}"
    rounded: "{rounded.block}"
    padding: "0.25rem 0.5rem"
  lane-block-court:
    backgroundColor: "{colors.court}"
    textColor: "{colors.court-ink}"
    rounded: "{rounded.block}"
    padding: "0.25rem 0.5rem"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    width: "28rem"
  confirm-dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "1.25rem"
    width: "min(92vw, 28rem)"
---

# Design System: Padel League

## Overview

**Creative North Star: "Righe del campo" (the court's own lines)**

The app is drawn the way a padel court is drawn: a turf-blue field, white lines that divide it, and a yellow-lime ball that marks the one thing in play. Schedules are not a grid of identical white cards; they are two parallel court lanes, Campo 1 and Campo 2, with the 30-minute stagger between them visible and start times sitting on the lines. Everything else in the system (lists, sections, tables, the shell) is ruled by the same 1px line, so the product feels like one surface marked out, not a stack of boxes.

It is an Operate-mode tool for mixed-age amateur players (including 50+) on phones in the sun, one or two court managers at the front desk on a phone or tablet, and a volunteer organizer at a desktop. Density is moderate and generous at the same time: big type (body 17px), 44px targets everywhere, few colours, and every state spelled out in Italian words with an icon. The light theme is the court in daylight on cool neutral grounds; the dark theme is the same court at night under floodlights: a deep blue-black ground with the same white lines, and lime taking over the selection and focus roles that court blue holds in daylight.

The build rejects the category's default look (a single brand colour on white cards), imitation materials (no turf texture, bevels, glass, gradient text), kickers above headings and colour-only state. Hatching on occupied slots is a state pattern, not a material.

**Key Characteristics:**
- Turf blue (`court`) for the shell and for selection on light grounds; white or neutral 1px court lines as the only dividers.
- Ball lime (`ball`) for the one primary action per screen, current selection, focus on blue surfaces and in dark, and nothing else.
- One family, Atkinson Hyperlegible Next, with tabular numerals for every time, date, score and count.
- The signature component: `CourtLanes`, one lane per court, time running down, start times on the lines.
- State is always tone + icon + text (+ pattern in the lanes); never colour alone.
- Sheets for contextual tasks, ConfirmDialog only for destructive or irreversible ones.

## Colors

Cool, low-chroma neutrals at hue 250-258 carry the page; one saturated blue owns the shell and one saturated lime owns the action. Semantic families (ok, warn, danger, info, idle) each come as a trio: a strong edge colour, a soft fill and an ink for text on that fill. All values are OKLCH and the OKLCH source in `src/styles/index.css` is normative.

### Primary
- **Turf Blue** (`court`): top bar on phone and tablet, lane headers, the "today" day chip, checked checkbox, switch and segmented option in light, the active tab underline and the active tab-bar icon in light, the `court` button variant. It is the field the app stands on.
- **Night Turf** (`court-deep`): desktop sidebar ground, hover of the court button, selection outline in light (with the lime halo outside it), light-theme focus ring colour.
- **Court White** (`court-ink`, `court-ink-muted`) and **Court Line** (`court-line`, white at 55% light / 40% dark): text and dividers drawn on blue. The sidebar footer rule and the active sidebar item's 1px ring use `court-line`.

### Secondary
- **Ball Lime** (`ball`, hover `ball-strong`, text `ball-ink`): the primary button, the selection halo (5px ring) on lane blocks and the selected request card, the badge counter in the sidebar, `::selection`, the skip link, the ball dot in the court mark, focus on blue surfaces, and in dark: focus everywhere, checked switch/checkbox/segment/preset chips, active tab underline and active tab-bar item.

### Tertiary (state families)
- **Green** (`ok`, `ok-soft`, `ok-ink`): 4/4 free slots, "Programmata", "Confermata", capacity good.
- **Amber** (`warn`, `warn-soft`, `warn-ink`): 3/4 slots, "Risultato da confermare", pending acceptances, unresolved ties (the `*` marker).
- **Red** (`danger`, `danger-soft`, `danger-ink`): occupied slots, "Contestata", "Rifiutata", "Conflitto", closures, "In ritardo", error states, the tab-bar count badge, the "now" line in the lanes.
- **Request Blue** (`info`, `info-soft`, `info-ink`): "Richiesta inviata", "In attesa", pending requests in the timeline, "Fuori griglia", "Proposta dal campo", the logged-in pair's row in standings. In dark, `info-ink` also replaces `court` for text links.
- **Idle** (`idle-soft`, `idle-ink`): "Da programmare", "Giocata", "Tavolino", "Annullata", "Scaduta", ≤2/4 slots.

### Neutral
- **Daylight Ground** (`ground`, i.e. `--bg`): page background.
- **Paper** (`surface`) and **Shade** (`surface-2`): cards, sheets, inputs; lane background, skeletons, ghost hover.
- **Ink** (`ink`) and **Muted Ink** (`ink-muted`): text and secondary text; muted also for inactive tabs, hour labels and placeholders.
- **Court Line** (`line`): the 1px divider between list rows, sections and lane half-hours.
- **Strong Line** (`line-strong`): control borders (about 4:1 on white in light, about 3.2:1 on surface in dark), table header rules (2px), group headings' underline, unchecked switch track.

### Light and dark values

| Token | Light | Dark |
|---|---|---|
| `bg` | oklch(0.975 0.006 250) | oklch(0.17 0.03 260) |
| `surface` | oklch(1 0 0) | oklch(0.215 0.035 260) |
| `surface-2` | oklch(0.955 0.01 250) | oklch(0.195 0.032 260) |
| `ink` | oklch(0.23 0.035 258) | oklch(0.95 0.01 250) |
| `ink-muted` | oklch(0.45 0.03 258) | oklch(0.76 0.025 250) |
| `line` | oklch(0.885 0.014 250) | oklch(0.32 0.035 260) |
| `line-strong` | oklch(0.6 0.025 252) | oklch(0.55 0.04 256) |
| `court` | oklch(0.46 0.135 256) | oklch(0.31 0.09 258) |
| `court-deep` | oklch(0.38 0.115 258) | oklch(0.25 0.075 260) |
| `court-ink` | oklch(0.99 0.004 250) | oklch(0.97 0.006 250) |
| `court-ink-muted` | oklch(0.88 0.03 250) | oklch(0.84 0.03 250) |
| `court-line` | oklch(1 0 0 / 0.55) | oklch(1 0 0 / 0.4) |
| `ball` | oklch(0.91 0.19 120) | oklch(0.9 0.19 120) |
| `ball-strong` | oklch(0.86 0.2 122) | oklch(0.94 0.17 118) |
| `ball-ink` | oklch(0.24 0.05 140) | oklch(0.22 0.05 140) |
| `ok` / `ok-soft` / `ok-ink` | 0.52 0.13 150 / 0.95 0.045 150 / 0.37 0.1 150 | 0.72 0.14 150 / 0.3 0.06 152 / 0.87 0.1 150 |
| `warn` / `warn-soft` / `warn-ink` | 0.7 0.15 75 / 0.96 0.06 90 / 0.44 0.1 65 | 0.8 0.14 80 / 0.32 0.06 75 / 0.9 0.1 85 |
| `danger` / `danger-soft` / `danger-ink` | 0.55 0.19 27 / 0.95 0.035 25 / 0.46 0.17 27 | 0.7 0.16 27 / 0.31 0.07 25 / 0.88 0.08 25 |
| `info` / `info-soft` / `info-ink` | 0.5 0.14 258 / 0.945 0.035 258 / 0.42 0.13 258 | 0.72 0.12 255 / 0.3 0.07 258 / 0.88 0.06 255 |
| `idle-soft` / `idle-ink` | 0.94 0.008 250 / 0.42 0.02 258 | 0.27 0.025 258 / 0.8 0.02 250 |
| `focus` | oklch(0.38 0.115 258) (= court-deep) | oklch(0.9 0.19 120) (= ball) |

Theme selection: `[data-theme='dark']` on the root (the user's choice, otherwise it follows the system); Tailwind's `dark:` variant is bound to that attribute. Modal overlays use a fixed translucent ink, oklch(0.2 0.04 258 / 0.45) for sheets and / 0.5 for dialogs.

### Named Rules
**The One Ball Rule.** Lime appears on at most one action per screen: the primary button for the thing that needs the user now ("Trova un orario", "Invia richiesta al campo"). Everything else is court blue (`court` or `secondary`), ghost, or danger. A second lime button means one of them is not the primary.

**The Lime Licence Rule.** Lime is licensed for exactly four jobs: the primary action, current selection (the halo on lane blocks and the selected request; in dark, every checked control), focus where blue would vanish (blue surfaces, all of dark), and the ball dot in the court mark. Lime as a heading underline, border or decoration is not licensed.

**The Trio Rule.** A state colour is never used alone: its soft fill carries its ink for text, its strong value is only an edge, and an icon plus a word always come with it.

## Typography

**Display Font:** none (no display face by design)
**Body Font:** Atkinson Hyperlegible Next Variable (with ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** same family; numbers use tabular figures, never a monospace costume

**Character:** one hyperlegible family built for low-vision readers, so ambiguous glyphs (1/l/I, 0/O) separate cleanly in sunlight. Hierarchy comes from size and weight only (400, 600, 700); there are no italics, no uppercase labels and no tracking changes.

### Hierarchy
The scale is fixed rem with a ratio of about 1.18; there are no fluid sizes in this working UI. Root font size stays 100% so the user's own text size setting scales everything, including the lanes (the player grid's px-per-minute is multiplied by root size / 16).
- **Headline** (700, 1.875rem / 2.3rem): the single `h1` per page via `PageHeader`; `text-wrap: balance`. Sets the document title ("{h1} · Padel League").
- **Statement** (700, 1.5rem / 1.95rem): the sentence that answers "what now?" on a match: "Si gioca dom 01/11 alle 14:00 · Campo 2", the acceptances count, the result winner line, the score inputs.
- **Title** (700, 1.25rem / 1.7rem): section `h2` (`Sezione`), sheet and dialog titles, empty-state titles, Da fare group headings.
- **Body** (400 or 600, 1.0625rem / 1.55rem): all running text, list rows, buttons (600), inputs, notices (`Avviso`, `Nota`). Minimum body is 17px; long text caps at `max-w-prose`.
- **Label** (600, 0.9375rem / 1.35rem): form labels, badges and pills, lane headers, lane block text, hints, hour labels (400, muted), small buttons.
- **Caption** (600, 0.8125rem / 1.15rem): mobile tab-bar labels, count badges, standings zone tags and zone separator lines. Never used for content the user must act on.

### Named Rules
**The Tabular Rule.** Every time, date, score, count, standings figure and numeric input carries tabular numerals (`.tabular`, `font-variant-numeric: tabular-nums`; `Input` and `Select` have it built in), so columns of times line up on the court lines.

**The No Kicker Rule.** A page heading stands alone: optional back link above it ("← Partite"), optional subtitle below in muted body, actions to the right. No eyebrow or category label above the `h1`.

## Layout

The model is a single content column on a neutral ground inside a blue frame. `main` is centred at max-width 64rem (`max-w-5xl`) with horizontal padding 1rem on phone, 1.5rem from 768px and 2.5rem from 1024px; bottom padding 7rem on phone and tablet so content clears the fixed tab bar, 3rem on desktop. Spacing follows the 0.25rem Tailwind step; the observed rhythm is 4/8/12 px inside components, 16/20/24 px between blocks, 20px (`pt-5`) above each section's court line, 32-40px between the two Da fare columns.

**Navigation per breakpoint.**
- **Phone and tablet (< 1024px):** a turf-blue top bar (min-height 3.5rem: court mark, "Padel League", tournament name truncated, profile initials 44px), sticky from 768px. A fixed bottom tab bar on `surface` with a top `line`, max-width 36rem, items 4rem tall with a 24px icon over a caption label. At most 5 items; with more, the first 4 stay and the rest go into an "Altro" sheet (court-ruled list plus "Profilo"). Items are the union of the user's roles: Da fare, Partite, Disponibilità (short label "Orari"), Campo, Torneo, Organizza, Utenti. Active item: `court` text with a 2px rounded bar along the top edge (`ball` in dark).
- **Desktop (≥ 1024px):** a sticky full-height 16rem sidebar on `court-deep`: brand block, nav list (44px items, 600 weight), profile link above a `court-line` rule. Active item: `court` fill with a 1px `court-line` ring and a lime icon; in dark the active fill is a lighter blue, oklch(0.4 0.1 256), so it separates from the sidebar. Inactive items are `court-ink-muted` and fill with `court` on hover. Badges are lime pills with tabular counts.
- **Section navigation inside an area** (manager's Richieste / Giornata / Ricorrenze / Campi, organizer tabs): an underline tab strip on a `line` rule, active item 2px `court` underline (`ball` in dark); on narrow phones it scrolls horizontally with a 1.5rem fade mask and keeps the current item in view.

**Gestore two-pane (≥ 820px).** The manager's Richieste screen switches at `(min-width: 820px)` to a 2fr / 3fr grid: the request list on the left, the selected request's detail and its day's two lanes on the right. The selected list item gets the selection treatment (court-deep outline, lime halo). Below 820px each request expands in place and the lanes open on demand.

**Other responsive behaviour.** Da fare adds a right column ("Prossime partite") at ≥ 1024px. The Sheet is a bottom sheet below 768px (max-height 92dvh) and a 28rem right panel from 768px. The bracket shows one round per screen (85% width, horizontal scroll snap) on phone and side-by-side rounds from 768px. Standings hide V/P below 640px and ±Game below 768px. Scroll padding (1rem top, 6rem bottom on phone, 1rem on desktop) keeps focused elements clear of the fixed bars.

## Elevation & Depth

The system is flat. Depth is conveyed by tonal layering (ground → surface → surface-2) and by court lines, not by shadow. One shadow token exists, `--shadow` (`shadow-raised`), and only overlays use it: Sheet and ConfirmDialog, which also dim the page behind them. Lists, sections, cards and lane blocks are flat at rest. The primary button carries a 2px inner bottom shade (inset, 8% black), the only press cue in the system, and moves 1px down when active.

### Shadow Vocabulary
- **Overlay lift, light** (`box-shadow: 0 1px 2px oklch(0.23 0.035 258 / 0.08), 0 8px 24px -8px oklch(0.23 0.035 258 / 0.18)`): Sheet and ConfirmDialog only.
- **Overlay lift, dark** (`box-shadow: 0 1px 2px oklch(0 0 0 / 0.4), 0 10px 30px -10px oklch(0 0 0 / 0.6)`): the same role at night.
- **Selection halo** (`box-shadow: 0 0 0 5px var(--ball)` with a 2px `court-deep` outline offset 1px; outline is `ball` in dark): a ring, not elevation; marks the current slot, lane block or request.

### Named Rules
**The Flat Court Rule.** Nothing on the court surface floats. If an element needs to stand out, it gets a line, a tone or the lime halo, never a drop shadow. Shadows belong to things that sit above the court: sheets and dialogs.

## Shapes

Gently rounded and rectilinear, like court markings. Controls (buttons, inputs, selects, segmented controls, nav items) use 8px (`rounded.control`); panels, sheets, dialogs and error boxes use 14px (`rounded.panel`; the sheet rounds only its leading edge: top on phone, left on tablet/desktop); lane blocks, checkboxes, segmented items and legend swatches use 6px (`rounded.block`); badges, pills and counters are fully round; the focus outline has 4px. Lane headers round only the top corners and lanes only the bottom, so header plus lane reads as one court strip.

Lines do the structural work. The **court rule** (1px `line` between siblings, `.court-rule`) separates list rows; sections separate with a 1px top line; group headings and table headers sit on a 2px `line-strong` rule; standings zone boundaries (Gold/Silver) are a 2px `court` line (`line-strong` in dark) with a caption ("Gold sopra questa linea · Silver sotto"). Bracket round headings sit on the same 2px `court` line. On blue grounds the line is `court-line`.

The **court mark** (20×32 SVG: a court from above, 1.5px white strokes for outline, net and service lines, with a lime ball dot) is the only logo. The tab-bar active marker is a 2px rounded bar.

## Components

### Buttons
Big, quiet and verb-labelled. Minimum height 44px for every size (`lg` 48px, icon 44×44); 600 weight, 17px (15px for `sm`); 20px icons (16px in `sm`); text may wrap and balances.
- **Shape:** gently curved (8px).
- **Primary:** `ball` fill with `ball-ink` text, inner bottom shade, hover `ball-strong`, active 1px press. One per screen.
- **Secondary (default variant):** `surface` fill, 1px `court` border and `court` text, hover `info-soft`; in dark the border is `line-strong` and text is `ink`. Used for most actions, including "Condividi su WhatsApp" (`WhatsAppButton`, which turns primary only when sharing is the screen's main action).
- **Court:** solid `court` with `court-ink`, hover `court-deep`. Used for strong secondary actions on neutral ground (for example "Aggiungi a tutto il periodo").
- **Ghost:** text only, hover `surface-2`. Cancel, "Mostra tutto", toggles of lesser weight.
- **Danger:** `surface` fill, 1px `danger` border, `danger-ink` text, hover `danger-soft`. Destructive confirmations and "Riprova".
- **Link:** underlined `court` text (`info-ink` in dark), 1px decoration growing to 2px on hover, no min height.
- **States:** colour transitions 150ms ease-out; disabled 50% opacity and no pointer events; `loading` shows a spinning loader, sets `aria-busy` and disables the button.

### Chips and toggles
- **Segmented control:** an 8px bordered (`line-strong`) group with 44px options, 15px/600 muted text; checked option `court` fill with `court-ink` (lime with `ball-ink` in dark). For 2-4 exclusive options ("Vista settimana", "30 minuti").
- **Preset and filter chips:** secondary buttons with `aria-pressed`; pressed state `court` fill (lime in dark), e.g. availability presets "Sera 18–23".
- **Switch:** 48×28 track, `line-strong` when off, `court` when on (lime with a `court-deep` thumb in dark).
- **Checkbox:** 24px, 6px radius, 2px `line-strong` border; checked `court` (lime in dark) with a 3px-stroke check.

### Status badges and notices
- **Badge / Pill:** full-round, 2px × 10px padding, 15px/600, 16px icon then label, tone fill + tone ink from the trio (`TONO_CLASSI`). `StatoPartitaBadge` and `StatoRichiestaBadge` read the glossary below.
- **Avviso / Nota:** an inline sentence on the neutral ground, 20px tone icon + 17px text in the tone's ink colour, no box ("Scade tra 38 h (dom 01/11 alle 13:00)").
- **Count badge:** on the tab-bar icon, a red full-round counter with white tabular caption and a screen-reader suffix " da gestire"; in the sidebar, a lime pill.

**Status glossary** (`src/lib/copy.ts`; icons are Lucide):

| Match state | Label | Icon | Tone |
|---|---|---|---|
| da programmare | Da programmare | calendar-clock | idle |
| richiesta | Richiesta inviata | send | info |
| programmata | Programmata | calendar-check | ok |
| giocata | Giocata | trophy | idle |
| contestata | Contestata | flag | danger |
| tavolino | Tavolino | gavel | idle |

| Request state | Label | Icon | Tone |
|---|---|---|---|
| attesa | In attesa | hourglass | info |
| confermata | Confermata | circle-check | ok |
| rifiutata | Rifiutata | circle-x | danger |
| annullata | Annullata | ban | idle |
| conflitto | Conflitto | triangle-alert | danger |
| scaduta | Scaduta | timer-off | idle |

Supplementary pills on match screens: "In ritardo" (alarm-clock, danger), "Fuori griglia" (clock, info), "Proposta dal campo" (repeat, info), "Risultato da confermare" (hourglass, warn).

### Lists and rows
- **MatchRow:** "Coppia A *contro* Coppia B" (muted "contro"), then a muted line with date · start · court in tabular figures, or the official score in bold tabular ink, plus the state badge. Min height 56px, 12px vertical padding; as a link it gets a chevron, a negative-margin hover fill `surface-2` and 8px radius. The user's own pair and the winner are bold; the winner also gets a green check labelled "vincitore".
- **Rows are separated by court lines**, never by cards: Da fare groups, Prossime partite, the "Altro" sheet, bracket rounds.
- **StandingsTable:** a real table with tabular figures, `abbr` column headers (Pos, Coppia, Pt, G, V, P, ±Set, ±Game), 2px `line-strong` header rule, 1px `line` row rules, zone lines and zone text tags, the user's pair on `info-soft` and bold, ties marked with an amber `*` and a footnote.
- **Bracket:** one ordered list per round under a 2px `court` heading rule; rows are MatchRows; scroll region is focusable and labelled "Tabellone: scorri orizzontalmente tra i turni".

### Inputs / Fields
- **Style:** 44px min height, 8px radius, 1px `line-strong` border on `surface`, 17px text, muted placeholder, tabular numerals for Input and Select; Select is native (the most familiar control on a phone); Textarea min 96px.
- **Focus:** border turns `court` with a 2px `focus` outline at 0 offset. Caret and native accent colour are `court`.
- **Hover:** border to `ink-muted`.
- **Error / Disabled:** `aria-invalid` turns the border `danger` and `Field` shows a 15px/600 `danger-ink` message wired through `aria-describedby` with the hint; disabled is 60% opacity.
- **Label:** 15px/600 `ink` above the control, hint in 15px muted below.

### Navigation
See Layout for structure. The top bar and sidebar are the only large blue surfaces; on them focus switches to lime and dividers to `court-line`. The skip link "Vai al contenuto" appears on focus as a lime pill top-left.

### Overlays
- **Sheet** (`src/ui/sheet.tsx`): the default container for contextual tasks so the context stays visible: picking a slot, "Segna occupazione", counter-proposals, "Altro". Bottom sheet on phone (rounded top 14px, slides up 220ms, cubic-bezier(0.16, 1, 0.3, 1)), 28rem right panel from 768px (slides in from the right). Header with 20px/700 title, optional muted description, 44px close button ("Chiudi"); scrolling body; optional footer row on a top `line` with safe-area padding. Focus returns to the opener on close even without a Trigger.
- **ConfirmDialog** (`src/ui/alert-dialog.tsx`): centred alert dialog, min(92vw, 28rem), 14px radius, 20px padding, title + muted description, ghost "Annulla" then the confirm button (`danger` tone by default, `primary` on request). Only for destructive or irreversible actions; it replaces `window.confirm`. The title is a question and the button repeats the verb: "Eliminare il periodo?" → "Elimina periodo", "Annullare la partita?" → "Annulla partita", "Generare le fasi finali?" → "Genera le fasi finali" (primary tone).
- **Toasts** (sonner): bottom-centre, 1.5rem from the bottom on desktop and 5.5rem on phone above the tab bar, rich colours, close button, 16px text. Reversible actions offer "Annulla" in the toast instead of a dialog (e.g. "Ruoli di {nome} aggiornati").

### States
- **Loading:** `SkeletonRighe`, rows of `surface-2` bars (2/3 and 1/3 width) that follow the list layout, `role="status"` "Caricamento"; pulse stops under reduced motion. The manager's day skeleton mirrors the 2.75rem + two-lane grid.
- **Empty:** `EmptyState` teaches: a 20px/700 title, a muted explanation, and the next action ("Nessun orario buono · Mostra").
- **Error:** `ErrorState`, `role="alert"`, `danger-soft` panel with `danger-ink` text, offline variant "Sei offline: i dati non sono aggiornati." with a wifi-off icon, and a danger "Riprova" button.

### Court Lanes (signature)
`CourtLanes` draws one day as parallel lanes, one per court, in a `figure`: a 2.75rem hour gutter, then `repeat(n, minmax(0, 1fr))` lanes with a 6px column gap. Each lane has a `court` header (court name, 15px/700, rounded top, optionally sticky so names stay visible while scrolling) over a `surface-2` body with a 1px `line` border and a 1px `line` drawn every 30 minutes by a repeating gradient. Hour labels sit on the lines (centred vertically on them), right-aligned, 15px tabular muted. Time runs top to bottom, so Campo 1 (first slot 13:30) and Campo 2 (first slot 14:00) visibly step past each other by half a slot. A 2px `danger` "now" line crosses the lanes on today.

- **Scale:** range is computed from the courts' first and last slot, floored and ceiled to the hour. Pixels per minute: player slot grid 0.8 × (root font px / 16), so a 90' slot is 72px at default text size and grows with the user's text size; manager day 1 px/min over 08:00-24:00; request detail 1 px/min clipped to the request; court settings preview 0.45 px/min. Blocks never render shorter than 20px.
- **Blocks (`LaneBlock`):** absolutely positioned by start/end, inset 4px on both sides; overlays (`sfalsato`: occupations and requests on top of grid slots) inset 12px left and 4px right so the slot underneath stays legible. 6px radius, 1px border, 4px × 8px padding, 15px text, tight leading. Tones: ok, warn, danger, info (soft fill, tone ink, strong border), idle (`surface`, `idle-ink`, `line-strong` border) and court (solid blue). Interactive blocks are real buttons inside a `role="listitem"` (each lane is a `role="list"` labelled with the court name), with an accessible name that begins with the visible text, e.g. "14:00, Campo 2, tutti e 4 liberi". Hover dims to 97% brightness (110% in dark).
- **Patterns:** `hatch` (single 45° hatch of currentColor at 22%, 6px gap, 2px line) = occupied or unusable; `cross` (double hatch) = closure, distinct from occupied; `dots` (8px grid of 1px dots at 18%) = few players free. Patterns always come with an icon and a word.
- **Player slot encoding** (`SLOT_UI`): 4/4 ok + circle-check "4/4 liberi"; 3/4 warn + user-x "3/4, ne manca uno" (requestable); ≤2/4 idle, flat and borderless + circle-minus "2/4 o meno: non si può chiedere"; occupied danger + hatch + lock "Occupato"; requested by another match info + send "Richiesto da un’altra partita". Start time first in bold tabular. A legend (native `details`, open by default) repeats the encoding with 28px swatches, including the selected swatch. Days with no slot at 3/4 or better collapse to one row; the grid filters to good slots by default ("Mostro solo gli orari buoni").
- **Manager timeline block types** (`GiornoLanes`): free grid slot = dashed idle outline, transparent, start time + "+" and "libero" (tap to "Segna occupazione"); unusable grid slot = idle + hatch + ban icon "inutilizzabile" (label drops to the bottom when an occupation covers its start); occupations by type: Partita del campionato = court (solid blue) + trophy, Esterno = idle solid `idle-soft` + users, Lezione = neutral `surface` + hatch + graduation-cap, Chiuso = danger + cross + door-closed; pending request = info, 2px dashed border on 70% `info-soft` + hourglass "Richiesta in attesa". Occupations of 75' or less put icon, title and time on one line and hide the time below a 10rem block width, so a title is never cut; longer blocks clamp the title to two lines, then time, then the note from 120'.
- **Selection treatment:** a 2px `court-deep` outline offset 1px plus a 5px `ball` halo (outline `ball` in dark), raised to z-index 10, `aria-pressed`, and in the player grid a 3px-stroke check in the top-right corner. The same treatment marks the selected request card in the manager's list, so "selected" looks the same in the list and on the court.
- **Keyboard:** the player grid uses roving tabindex (one tab stop) with arrow keys, PageUp/PageDown, Home and End; selecting opens the slot Sheet and focus returns to the same slot on close.

## Do's and Don'ts

### Do:
- **Do** separate rows, sections and lane half-hours with the 1px `line` court rule; use `court-line` on blue.
- **Do** give each screen exactly one lime primary action, labelled with a verb ("Trova un orario", "Invia richiesta al campo"); make every other action `secondary`, `court`, `ghost` or `danger`.
- **Do** pair every state colour with an icon and an Italian word, and in the lanes with a pattern where the glossary assigns one (hatch occupied, cross closure, dots few free).
- **Do** draw anything that lives on a court and a time as `CourtLanes` with the 30' stagger and start times on the lines, never as a uniform card grid.
- **Do** put tabular numerals on every time, date, score and count.
- **Do** keep targets at 44px minimum (tab-bar items 64px) and body text at 17px; let buttons wrap rather than truncate.
- **Do** open contextual tasks in a Sheet and reserve ConfirmDialog for destructive or irreversible steps; offer "Annulla" in a toast for reversible ones.
- **Do** switch focus and selection to lime on blue surfaces and in the dark theme; keep light-theme focus `court-deep` on neutral grounds.
- **Do** write in Italian, informal "tu", short and concrete, and always say what is missing and until when: "L’anteprima è provvisoria: mancano 3 partite dei gironi.", "Scade tra 38 h (dom 01/11 alle 13:00)", "Puoi annullarla fino a sab 31/10 alle 14:00".
- **Do** announce real-time changes and page changes through polite live regions ("Le richieste sono state aggiornate.", "Pagina: Partite").

### Don't:
- **Don't** use lime as decoration: no lime borders, heading underlines, side stripes or backgrounds outside the four licensed jobs.
- **Don't** communicate a state by colour alone, and don't reuse amber for anything but 3/4 and "waiting on someone" (lessons are neutral + hatch, not amber).
- **Don't** add drop shadows to cards, rows or lane blocks; only sheets and dialogs are raised.
- **Don't** put a kicker or eyebrow above a page heading, or use uppercase tracked labels.
- **Don't** introduce a second font family, a display face, a monospace for numbers, or fluid type sizes.
- **Don't** add coloured side stripes thicker than 1px to list items, cards or nav items.
- **Don't** imitate materials: no turf texture, bevels, glass or gradient text; hatching is a state pattern only.
- **Don't** cut visible text inside a lane block; drop the time (the axis carries it) before truncating a title.
- **Don't** use a modal dialog for choosing a slot or editing an occupation; the court must stay visible behind the task.
- **Don't** animate beyond 150ms colour transitions and the 150-220ms overlay entrances; everything collapses to 0.01ms under `prefers-reduced-motion`.

## Accessibility commitments and known deviations

**Commitments as built.** WCAG 2.2 AA. A skip link "Vai al contenuto"; one `h1` per page that sets `document.title` and is announced on route change; global `:focus-visible` 2px outline at 2px offset; scroll padding so focus is never hidden under the fixed bars (2.4.11); Sheets trap focus and return it to the opener; `Field` wires label, hint and error; lanes are labelled lists of real buttons whose names start with the visible text; the bracket scroll region is focusable and labelled; standings use a captioned table with scoped headers; live regions for realtime updates and route changes; `prefers-reduced-motion` collapses all animation and transition durations; nothing below 15px carries actionable content.

**Accepted deviations (finish review, disposition ship).**
- Initial JS is about 219 KB gzip against the 180 KB budget (react 91.8 + supabase 59.0 + index 68.2). Accepted; repeat visits load from the PWA precache. Follow-up: lazy-load Supabase on public routes or revise the budget to 220 KB.
- The mobile tab label for Disponibilità is "Orari" (`breve`), while the sidebar and page title say "Disponibilità"; the icon is the same.
- Light-theme focus ring is `court-deep` (lime on white is about 1.3:1), not lime as the direction contract states; lime is the focus colour on blue surfaces and throughout dark.
- In dark, some strong secondary actions use the `court` variant (navy) rather than lime, so lime stays reserved for one primary per screen.

**Drift not canonized.** The shipped slot encoding is `SLOT_UI` (`src/features/player/matches/parts.tsx`); `STATO_SLOT` in `src/lib/copy.ts` carries different icons and labels and is used only by the dev kit page. Occupation labels exist twice ("Prenotazione esterna"/"Chiusura" in `copy.ts`, "Esterno"/"Chiuso" in the manager's `ETICHETTA_TIPO`). The tab-bar counter uses literal white text, and the dark active sidebar fill and overlay scrims are inline OKLCH literals rather than tokens. The `CourtLanes` comment promises a stronger hourly line, but the build draws one identical `line` every 30 minutes; this document records the build.
