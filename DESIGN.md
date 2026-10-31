---
name: Padel League
description: "Manifesto: the app is the tournament's poster. Warm paper, ink-black type and 2px ink borders, Anton for one huge statement per screen, ball lime for the one thing to do now, clay coral for availability."
colors:
  # Light theme values from src/styles/index.css (:root). Dark values: see ## Colors and .impeccable/design.json.
  # Token names predate the redesign: `court` is the ink fill (not turf blue); `bar` is the always-black navigation bar.
  ground: "oklch(0.955 0.013 85)"
  surface: "oklch(0.99 0.005 85)"
  surface-2: "oklch(0.925 0.016 85)"
  ink: "oklch(0.2 0.006 80)"
  ink-muted: "oklch(0.43 0.014 75)"
  line: "oklch(0.85 0.014 85)"
  line-strong: "oklch(0.2 0.006 80)"
  court: "oklch(0.2 0.006 80)"
  court-deep: "oklch(0.12 0.004 80)"
  court-ink: "oklch(0.97 0.01 85)"
  court-ink-muted: "oklch(0.8 0.012 85)"
  bar: "oklch(0.17 0.005 80)"
  bar-ink: "oklch(0.97 0.01 85)"
  bar-ink-muted: "oklch(0.78 0.012 85)"
  ball: "oklch(0.92 0.2 122)"
  ball-strong: "oklch(0.88 0.21 124)"
  ball-ink: "oklch(0.2 0.006 80)"
  clay: "oklch(0.77 0.14 42)"
  clay-strong: "oklch(0.72 0.15 40)"
  clay-ink: "oklch(0.2 0.006 80)"
  edge: "oklch(0.17 0.005 80)"
  paper: "oklch(0.97 0.01 85)"
  ok: "oklch(0.5 0.13 150)"
  ok-soft: "oklch(0.93 0.05 150)"
  ok-ink: "oklch(0.36 0.1 150)"
  warn: "oklch(0.7 0.15 75)"
  warn-soft: "oklch(0.94 0.07 90)"
  warn-ink: "oklch(0.42 0.1 65)"
  danger: "oklch(0.55 0.2 27)"
  danger-soft: "oklch(0.93 0.04 25)"
  danger-ink: "oklch(0.45 0.17 27)"
  info: "oklch(0.5 0.14 258)"
  info-soft: "oklch(0.93 0.035 258)"
  info-ink: "oklch(0.4 0.13 258)"
  idle-soft: "oklch(0.91 0.012 85)"
  idle-ink: "oklch(0.38 0.014 75)"
  focus: "oklch(0.2 0.006 80)"
typography:
  poster-2xl:
    fontFamily: "Anton, Atkinson Hyperlegible Next Variable, ui-sans-serif, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "0.01em"
  poster-xl:
    fontFamily: "Anton, Atkinson Hyperlegible Next Variable, ui-sans-serif, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  poster-lg:
    fontFamily: "Anton, Atkinson Hyperlegible Next Variable, ui-sans-serif, sans-serif"
    fontSize: "3.25rem"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  poster:
    fontFamily: "Anton, Atkinson Hyperlegible Next Variable, ui-sans-serif, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  poster-sm:
    fontFamily: "Anton, Atkinson Hyperlegible Next Variable, ui-sans-serif, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.01em"
  poster-block:
    fontFamily: "Anton, Atkinson Hyperlegible Next Variable, ui-sans-serif, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0.01em"
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
    fontWeight: 700
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
rounded:
  swatch: "6px"
  control: "0.75rem"
  panel: "1.125rem"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ball}"
    textColor: "{colors.ball-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ball-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-court:
    backgroundColor: "{colors.court}"
    textColor: "{colors.court-ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-court-hover:
    backgroundColor: "{colors.court-deep}"
  button-ink:
    backgroundColor: "{colors.edge}"
    textColor: "{colors.paper}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-2}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.danger-soft}"
  block-ball:
    backgroundColor: "{colors.ball}"
    textColor: "{colors.ball-ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  block-clay:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.clay-ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  block-paper:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  block-next-match:
    backgroundColor: "{colors.court}"
    textColor: "{colors.court-ink}"
    rounded: "{rounded.panel}"
    padding: "20px"
  standing-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.poster-2xl}"
    rounded: "{rounded.panel}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  segmented-option-checked:
    backgroundColor: "{colors.ball}"
    textColor: "{colors.ball-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "44px"
  nav-bar:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.bar-ink-muted}"
    typography: "{typography.caption}"
    height: "64px"
  nav-item-active:
    backgroundColor: "{colors.ball}"
    textColor: "{colors.ball-ink}"
    rounded: "{rounded.full}"
  status-badge:
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  deadline-stamp:
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  lane-header:
    backgroundColor: "{colors.court}"
    textColor: "{colors.court-ink}"
    typography: "{typography.label}"
    padding: "6px 8px"
---

# Design System: Padel League

## Overview

**Creative North Star: "The Tournament Poster"**

The app is the tournament's poster. Every screen leads with one huge condensed statement in Anton, uppercase: what you have to do ("Ciao Marco, hai 10 cose da fare"), who you play ("Por Tres contro Le Bandejas"), where you stand (a 72px "2°"). Everything else steps back to a quiet supporting line in Atkinson Hyperlegible Next. The category default, an even list of identical rows with outline buttons, is what this world replaces: content is ranked into blocks, and the block's fill says what kind of thing it is.

The material is printed matter. A warm paper ground, ink-black text, solid 2px ink borders on every block and control, flat colour fills with no gradients or textures. Colour has jobs, not moods: ball lime is the one thing to do now (the first feed block, the primary action, the current selection, the active nav item, the highlighter on the key word of a headline); clay coral is availability and time windows; paper is everything else. The navigation bar is ink black in both themes. Dark is the poster in negative: a near-black ground with paper text and paper borders, the "next match" block flips to a paper fill with black ink, and the lime and clay fills stay identical with black ink.

The audience is mixed-age amateur players (many 50+) on phones in the sun, a court manager at the front desk on a phone or tablet, and a volunteer organizer at a desktop. So the poster is never at the expense of reading: body text is 17px, every target is at least 44px, nothing is carried by colour alone, and the state colours (ok, warn, danger, info, idle) stay with an icon and an Italian word.

**Key Characteristics:**
- One poster statement per screen, Anton uppercase; everything else is Atkinson at reading size.
- Paper ground, ink text, 2px ink borders on blocks and controls; flat fills, no texture.
- Lime = the one thing to do now; clay = availability; paper = everything else; ink fill = your next match and "today".
- The black bar (tab bar, sidebar) with lime marking where you are.
- Dark theme is the same poster in negative; lime and clay never change.
- State is always tone + icon + text (+ pattern in the court lanes).

## Colors

A printed palette: paper, ink and two flat inks of colour, plus a muted state set that only ever speaks with an icon and a word.

### Primary
- **Ball Lime** (`ball`, hover `ball-strong`, text `ball-ink`): the one thing to do now. The first block of the feed, the primary button (one per screen), the checked Segmented option, the active tab-bar pill and sidebar item, the player's own row in the standings, the `.mark` highlighter behind the key word or numeral of a headline (the count in "hai **10** cose da fare", the time of the next match), text selection, and the focus ring on ink fills. Identical in both themes.

### Secondary
- **Clay Coral** (`clay`, hover `clay-strong`, text `clay-ink`): availability and time windows. The "Segna le disponibilità" group block and anything that asks the player for their free times. Identical in both themes.

### Tertiary
- **Ink Fill** (`court`, `court-deep`, text `court-ink`, `court-ink-muted`): the solid ink block. The next-match block, the "today" day chip, court-lane headers, the `court` button variant (e.g. "Oggi"), checked checkboxes and switches in light, the avatar in the top bar. In dark it inverts to a paper fill with black ink, so it stays the strongest neutral block on either ground.
- **The Bar** (`bar`, `bar-ink`, `bar-ink-muted`, `bar-line`): the navigation bar, ink black in both themes (a touch deeper in dark).

### Neutral
- **Paper Ground** (`ground`, i.e. `--bg`): page background and the top bar.
- **Card Paper** (`surface`): paper blocks, inputs, secondary buttons, the standing tile, sheets and dialogs.
- **Pressed Paper** (`surface-2`): hover on paper, skeletons, lane bodies.
- **Ink** (`ink`): all text and icons. **Muted Ink** (`ink-muted`): supporting lines, subtitles, hints, placeholder, table heads.
- **Ink Rule** (`line-strong`): the 2px border of every paper block and control, section rules, table head rule, zone lines. In dark it is paper.
- **Hairline** (`line`): 1px dividers between list rows (`court-rule`), table rows, sheet header.
- **Edge** (`edge`) and **Paper** (`paper`): fixed constants that never invert. `edge` is the border of lime and clay fills and the fill of the `ink` button inside them; `paper` is that button's text and the background of an error line inside a coloured block.

### State colours
Each is a trio (strong / soft fill / ink text) and always ships with an icon and an Italian word.
- **ok** (green): "Programmata", "Confermata", 4/4 free slots.
- **warn** (amber): "Risultato da confermare", 3/4 slots, pending acceptances, the unresolved-tie `*`.
- **danger** (red): occupied slots, "Contestata", "Rifiutata", closures, urgent deadlines, the tab-bar count badge, the "now" line in the lanes, form errors.
- **info** (blue): "Richiesta inviata", "In attesa", pending requests in the manager timeline.
- **idle** (`idle-soft`, `idle-ink`): "Da programmare", "Giocata", "Annullata", ≤2/4 slots.

### Dark theme values
| Token | Dark |
|---|---|
| `ground` / `surface` / `surface-2` | oklch(0.16 0.006 80) / oklch(0.21 0.007 80) / oklch(0.25 0.008 80) |
| `ink` / `ink-muted` | oklch(0.95 0.012 85) / oklch(0.78 0.014 85) |
| `line` / `line-strong` | oklch(0.34 0.008 80) / oklch(0.95 0.012 85) |
| `court` / `court-deep` / `court-ink` | oklch(0.95 0.012 85) / oklch(0.85 0.014 85) / oklch(0.17 0.005 80) |
| `bar` / `bar-ink` / `bar-ink-muted` | oklch(0.11 0.004 80) / oklch(0.95 0.012 85) / oklch(0.76 0.012 85) |
| `ball` / `ball-strong` / `ball-ink` | oklch(0.92 0.2 122) / oklch(0.95 0.17 120) / oklch(0.17 0.005 80) |
| `clay` / `clay-strong` / `clay-ink` | oklch(0.77 0.14 42) / oklch(0.82 0.12 45) / oklch(0.17 0.005 80) |
| `ok` / `ok-soft` / `ok-ink` | oklch(0.74 0.14 150) / oklch(0.3 0.06 152) / oklch(0.88 0.1 150) |
| `warn` / `warn-soft` / `warn-ink` | oklch(0.8 0.14 80) / oklch(0.32 0.06 75) / oklch(0.9 0.1 85) |
| `danger` / `danger-soft` / `danger-ink` | oklch(0.7 0.17 27) / oklch(0.31 0.07 25) / oklch(0.88 0.08 25) |
| `info` / `info-soft` / `info-ink` | oklch(0.74 0.12 255) / oklch(0.3 0.06 258) / oklch(0.88 0.06 255) |
| `idle-soft` / `idle-ink` | oklch(0.27 0.008 80) / oklch(0.82 0.012 85) |
| `focus` | oklch(0.92 0.2 122) (lime) |

### Named Rules
**The One Lime Rule.** Lime marks the single thing to do now. One lime block at the top of the feed, one primary button per screen, one highlighted word per headline. A second lime element on the same screen is either the selection or the active nav item, never a second "most important" thing.

**The Fills Don't Invert Rule.** Lime and clay are the same in both themes and always carry `edge` borders, `edge` buttons and black ink. Only paper and ink swap in dark.

**The Never By Colour Rule.** Every state colour, zone and deadline comes with an icon and a word; in the court lanes also with a pattern. If you removed the colour, the screen must still say the same thing.

## Typography

**Display Font:** Anton (with Atkinson Hyperlegible Next as fallback)
**Body Font:** Atkinson Hyperlegible Next Variable (with ui-sans-serif, system-ui)

**Character:** A condensed poster face shouting one statement, paired with a typeface designed for low-vision legibility doing all the reading. Anton gives the poster; Atkinson makes sure a 60-year-old in the sun can still read the details.

### Hierarchy
- **Poster 2XL** (Anton 400, 4.5rem, 0.9): the position numeral in the standing tile ("2°").
- **Poster XL** (Anton 400, 3.5rem, 0.95): page titles from 640px up.
- **Poster LG** (Anton 400, 3.25rem, 0.95): the date and time of the next match.
- **Poster** (Anton 400, 2.75rem, 0.95): page titles on phones (the h1 in `PageHeader`, the home greeting).
- **Poster SM** (Anton 400, 1.75rem, 1.05): section titles (h2), the big line of the lime block, positions and points in the standings table.
- **Poster Block** (Anton 400, 1.25rem, tight): the big line of paper and clay blocks and group blocks; one step under the lime block on purpose. The wordmark uses 1.25–1.5rem.
- **Title** (Atkinson 700, 1.25rem): sheet and dialog titles.
- **Body** (Atkinson 400, 1.0625rem / 1.55rem): all running text. Supporting lines under poster type are body at 600–700 in `ink-muted` or full ink.
- **Label** (Atkinson 600–700, 0.9375rem): field labels, badges, deadline stamps, table heads, lane headers, hints.
- **Caption** (Atkinson 600, 0.8125rem): tab-bar labels and zone pills only. Never for content.

All poster type is uppercase with 0.01em tracking (the `.poster` utility). Numerals for times, dates, scores and counts are tabular in both faces (`.tabular`).

### Named Rules
**The One Statement Rule.** Each screen has one poster statement at the top (the h1) and poster section titles under it; inside the content only the lime block's big line speaks at Poster SM, the other blocks step down to Poster Block. If two things on a screen are equally huge, neither is the statement.

**The Anton Is Never Bold Rule.** Anton has one weight (400). Never apply `font-bold` to poster type, and never set running text, sentences or buttons in Anton. Connecting words inside a poster line ("contro") drop to Atkinson, lowercase.

**The Highlighter Rule.** Emphasis inside a headline is a lime `.mark` behind one word or numeral (inline-block, ink text), not a colour change of the text.

## Layout

A single reading column on phones, a two-column dashboard on wide screens, always with the navigation in the black bar.

- **Phone and tablet (< 1024px):** a paper top bar (2px ink rule under it, min-height 3.5rem): lime court-mark tile, "PADEL LEAGUE" wordmark in Anton, tournament name truncated, 44px ink avatar with initials. Sticky from 768px. Content in a column with 16px side padding (24px from 768px), 20px top padding and 7rem bottom padding to clear the fixed tab bar.
- **Desktop (≥ 1024px):** a sticky full-height 16rem black sidebar (brand, nav list, profile above a `bar-line` rule); content max-width 64rem with 40px side padding. The home splits into a feed column and a side column with the next-match block and the standing tile.
- **Rhythm:** 4px base. Blocks have 16px padding (20px from 640px); gaps inside blocks are 12px, between lines 6px; page header bottom margin 24px; sections are separated by a 2px ink rule with 16px above the title.
- **Feed structure:** greeting headline with lime count, muted subtitle with the most urgent deadline, the next-match block, then poster sections ("Presto", …) with blocks. Repeated items of the same kind collapse into one group block with a list inside.
- **Manager two-pane (≥ 820px):** request list left, detail and the day's lanes right (2fr / 3fr).
- **Focus visibility:** `scroll-padding` of 1rem top and 6rem bottom (1rem on desktop) so focused elements never hide under the fixed bars.
- Usable at 320px and 200% text: big lines `break-words`, secondary table columns drop below 640px/768px, the tab bar keeps at most 5 items (the rest go into "Altro").

## Elevation & Depth

The poster is flat. Blocks sit on the paper with a 2px border and a fill, never with a shadow; hierarchy comes from fill (lime > ink > clay > paper > plain row) and from type size. One soft shadow (`shadow-raised`) exists only for things that physically sit above the page: sheets, dialogs, menus, and sticky save bars.

### Shadow Vocabulary
- **Raised** (`box-shadow: 0 2px 4px oklch(0.2 0.006 80 / 0.08), 0 14px 32px -12px oklch(0.2 0.006 80 / 0.28)`; dark `0 2px 4px oklch(0 0 0 / 0.4), 0 14px 32px -12px oklch(0 0 0 / 0.7)`): sheets, confirm dialogs, popover menus, sticky action bars.
- **Selection halo** (`box-shadow: 0 0 0 5px var(--ball)` with a 2px `court-deep` outline offset 1px; outline lime in dark): a ring, not elevation; marks the selected slot, lane block or request card.

### Named Rules
**The Flat Poster Rule.** Nothing printed on the poster floats. To stand out, a block gets a fill or a bigger statement, never a shadow.

## Shapes

Soft-cornered printed blocks with a hard ink outline.

- **Panel corners** (`rounded-panel`, 18px): every block (feed blocks, group blocks, next-match, standing tile), sheets (top corners on phone, left corners on the side panel), dialogs.
- **Control corners** (`rounded-control`, 12px): buttons, inputs, selects, the brand tile, sidebar items, row hover areas.
- **Full round**: badges, deadline stamps, zone pills, the Segmented track and options, the active tab pill (48×32), avatars, count badges.
- **Swatch corners** (6px): checkboxes and lane blocks.
- **Borders:** 2px ink (`line-strong`) on paper blocks and controls, 2px `edge` on lime and clay fills, 1px `line` for row dividers, 4px ink for zone lines in the standings and the active tab underline, 2px `currentColor` on stamps and pills.
- **Focus:** a 3px outline offset 2px in `focus` (ink in light, lime in dark); lime on ink fills and the bar, `edge` on lime and clay.

## Components

### Buttons
Bold, square-shouldered and verb-labelled. Minimum height 44px for every size (`lg` 48px, icon 44×44); 17px semibold (15px for `sm`); 20px icons; text may wrap and balances. Hover changes the fill, active presses down 1px; 150ms ease-out colour transitions.
- **Primary:** lime fill, 2px `edge` border, bold `ball-ink` text, hover `ball-strong`. One per screen.
- **Secondary (default):** paper fill, 2px ink border, ink text, hover `surface-2`.
- **Court:** solid ink fill with paper text (inverted in dark), for compact strong actions like "Oggi".
- **Ink:** fixed `edge` fill with `paper` text and bold weight: the action inside a lime or clay block ("Trova un orario →"), full width on phones.
- **Ghost:** text only, hover `surface-2` (`edge` at 10% inside coloured blocks).
- **Danger:** paper fill, 2px danger border, `danger-ink` text, hover `danger-soft`.
- **Link:** underlined 2px, hover paints the lime highlighter behind it.

### Feed blocks (signature)
The poster's content unit (`AttentionRow`, `FeedGroup`). 18px corners, 2px border, 16/20px padding, 12px gaps.
- **Lime block** (`ball`): the first, most urgent item. Big line in Poster SM (the pairs, or the task), then an icon + bold task line, a detail line, the deadline stamp and an ink button.
- **Clay block** (`clay`): availability items and the "Segna le disponibilità di N periodi" group.
- **Paper block** (`surface`, ink border): other actions; big line in Poster Block, secondary button.
- **Plain row**: information only, no block; icon, bold title, muted detail, divided by hairlines.
- **Group block:** repeated items ("Programma altre 7 partite") as one block with a Poster Block title, one body sentence and a list of 56px link rows (bold label, deadline with alarm icon, chevron), hairline-divided (`edge` at 25% on clay).
- A block that only navigates is one whole-surface link; the arrow nudges 4px right on hover (200ms).
- **Deadline stamp:** full-round 2px `currentColor` outline, alarm-clock icon + bold tabular text ("entro ven 20/11"); urgent ones fill `danger` with white text.

### Next match (signature)
An ink block (paper in dark): date and time in Poster LG with the time on the lime highlighter, a bold line "La tua prossima partita · Campo 2", then the pairs in Anton 1.5rem with "contro" in Atkinson. The whole block is a link.

### Standing tile (signature)
A paper block with the position as a Poster 2XL numeral ("2°") beside a bold sentence ("posto nel Girone A") and a muted tabular line with points and zone in words.

### Standings table
Tabular, 17px. Head row 15px muted over a 2px ink rule; positions and points in Poster SM; 1px hairlines between rows; the player's row in lime with "(tu)"; qualification zones as a 4px ink rule with the words "Gold sopra questa linea · Silver sotto" and an outlined zone pill on the first row of each zone. W, L and ±Game hide on narrow screens.

### Chips, badges and selection
- **Status badge:** full-round, 1px `currentColor` border, tone soft fill + tone ink, 16px icon then a bold 15px label.
- **Segmented control:** full-round track with a 2px ink border on paper, 44px pill options in bold 15px muted text; checked option lime.
- **Tabs (area navigation):** a 2px ink baseline; active tab has a 4px ink underline and full ink text; inactive muted.
- **Checkbox:** 24px, 6px corners, 2px ink border; checked ink fill (lime in dark) with a 3px-stroke check.
- **Switch:** 48×28 track, `line-strong` off, ink on (lime in dark).

### Inputs / Fields
- **Style:** 44px min height, 12px corners, 2px ink border on paper, 17px text, muted placeholder, tabular numerals in Input and Select; Select is native; Textarea min 96px.
- **Focus:** a 2px `focus` outline at 0 offset on top of the ink border. Hover: border to `ink-muted`.
- **Error / Disabled:** `aria-invalid` turns the border `danger`; `Field` shows a bold 15px `danger-ink` message wired through `aria-describedby`; disabled is 60% opacity.

### Navigation
- **Tab bar (phone/tablet):** fixed bottom, `bar` black, 64px items with a 24px icon over a 13px semibold label in `bar-ink-muted`. Active item: lime label and a 48×32 lime pill behind the icon with black icon. Red count badge with a `bar` ring on the icon, with a screen-reader suffix. At most 5 items; overflow in an "Altro" sheet.
- **Sidebar (desktop):** `bar` black, Anton wordmark beside the lime court-mark tile, 44px items (20px icon, 17px semibold) in `bar-ink-muted`; active item is a lime fill with black text; hover `bar-line`. Red count pill. Profile at the bottom with a paper avatar.
- **Page header:** optional bold back link with arrow, the poster h1, a muted semibold subtitle, actions aligned right.

### Court lanes (signature)
`CourtLanes` draws one day as parallel lanes, one per court: a 2.75rem hour gutter, then equal lanes with a 6px gap. Each lane has an ink header (court name, bold 15px, rounded top) over a `surface-2` body with a 1px hairline every 30 minutes; hour labels sit on the lines, tabular and muted. Time runs top to bottom, so courts whose slots start half an hour apart visibly step past each other. A 2px `danger` "now" line crosses today.
- **Blocks:** absolutely positioned by start/end, 6px corners, 1px border, 15px tight text. Tones: ok, warn, danger, info (soft fill, tone ink, strong border), idle (paper, `line-strong` border), court (solid ink). Interactive blocks are real buttons whose accessible name begins with the visible text.
- **Patterns:** `hatch` (single 45° hatch) = occupied or unusable; `cross` (double hatch) = closure; `dots` = few players free. Patterns always come with an icon and a word.
- **Player slot encoding:** 4/4 ok + check "4/4 liberi"; 3/4 warn + user-x "3/4"; ≤2/4 idle; occupied danger + hatch + lock "Occupato"; requested by another match info + send. Start time first, bold tabular.
- **Selection:** the selection halo (see Elevation) plus `aria-pressed`; the same treatment marks the selected request in the manager list.

### Overlays and feedback
- **Sheet:** the default container for contextual tasks. Bottom sheet on phone (18px top corners, slides up 220ms `cubic-bezier(0.16, 1, 0.3, 1)`), 28rem right panel from 768px; 20px bold title, 44px close button, hairline under the header, raised shadow.
- **Confirm dialog:** centred, min(92vw, 28rem), 18px corners, only for destructive or irreversible actions; the title is a question and the button repeats the verb.
- **Toasts:** bottom-centre above the tab bar, 17px text, close button with a 44px hit area.
- **Motion:** state changes only (150ms colours, 200ms arrow nudge, 220ms sheet entry); all of it collapses under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** open every screen with one Anton uppercase statement (Poster on phones, Poster XL from 640px) and put everything else at reading size.
- **Do** use lime for exactly one "do this now" thing per screen, plus the selection and the active nav item.
- **Do** use clay for availability and time windows, and only there.
- **Do** give every paper block and control a 2px ink border, and every lime or clay fill a 2px `edge` border with `ink` buttons inside.
- **Do** collapse repeated items of the same kind into one group block with the list inside.
- **Do** pair every state colour with an icon and an Italian word, and in the lanes with a pattern (hatch occupied, cross closure, dots few free).
- **Do** put tabular numerals on every time, date, score, count and position.
- **Do** keep every target at least 44px and running text at least 16px (body 17px).
- **Do** draw anything that lives on a court and a time as `CourtLanes`, never as a uniform card grid.
- **Do** keep the navigation in the black bar in both themes, with lime for the active item.

### Don't:
- **Don't** put a small kicker or eyebrow label above a heading; the poster h1 stands alone (a back link is not a kicker).
- **Don't** fake-bold Anton or set sentences, buttons or body copy in it.
- **Don't** add drop shadows to blocks on the page; shadows are for sheets, dialogs, menus and sticky bars.
- **Don't** introduce gradients, textures, glass or gradient text; fills are flat printed inks (state hatching is a pattern, not a material).
- **Don't** use coloured side stripes to tag blocks; a block's meaning comes from its full fill.
- **Don't** invert lime or clay in dark, or put paper text on them.
- **Don't** rely on colour alone for any state, zone or deadline.
- **Don't** make two blocks on one screen speak at the same poster size.
