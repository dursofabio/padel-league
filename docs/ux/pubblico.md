# Brief: Torneo pubblico (`/t/:tid`, `/t/:tid/classifiche`, `/t/:tid/calendario`, `/t/:tid/tabellone/:fase`)

Glossary and consolidated assumptions: [README.md](README.md).

## 1. Job and audience

- Anyone, logged in or not: players checking where they stand, friends and club members following the league, opened mostly from a WhatsApp link on a phone. Logged-in players reach it from the "Torneo" tab.
- Need: "Where are we, who's going to Gold, when is the next match, who plays whom in the finals?" Mode: browse and read, 30 seconds to a few minutes.

## 2. Outcome and proof

- Primary task: read the standings of my group with the qualification cut understood without colour; second: find a match in the calendar; third: follow the bracket.
- Success: anonymous users never hit a login wall for read views; standings are always current (client-computed from official results with the configured tie-break chain).
- Product truth: standings via `classificaGirone`/`classificheTorneo`, ties flagged by `pariMerito`, qualification via `qualifica` (perPosizione or avulsa), brackets via `derivaTabellone`; `partite_v` and `giocatori_pubblici` are anon-readable.

## 3. Selected direction consequences

- The overview and standings live on the neutral ground with court lines as row dividers; the turf-blue top bar carries the tournament name and phase.
- **Qualification zones**: a horizontal court line, thicker and labelled, drawn between the last Gold place and the first Silver place ("Gold sopra questa linea · Silver sotto"), plus a text badge in the row ("Gold" with `Medal`, "Silver" with `Medal` outline variant). The line and label carry the meaning; any tint is extra.
- Brackets drawn with court lines as connectors; the current round heading turf-blue. Lime only for focus and the selected round tab.
- Calendar rows: match state icon + label from the glossary; scheduled ones show day/time/court on tabular numerals.

## 4. Scope and anti-goals

- In: overview (phase, next matches, my group shortcut when logged in, links), standings per group, tie notes, calendar by matchday (per group), bracket per phase (Gold, Silver), match row → match page (logged in) or nothing (anon).
- Out: player statistics, head-to-head pages, comments, sharing images.
- Anti-goal: hero metrics ("104 partite!"), tinted rows as the only zone indicator, horizontal-scrolling brackets without an accessible list.

## 5. States and realistic ranges

- 2 groups × 10 pairs; 9 matchdays per group (5 matches each) = 90 matches; Gold and Silver 8 pairs each → 7 + 7 matches (3 rounds). Pair names up to ~30 characters ("I Bomber della Domenica").
- Tournament phases: `iscrizioni` (no groups yet: list of registered approved pairs), `gironi`, `fasiFinali`, `concluso` (winners stated at top).
- States: loading skeleton table, tournament not found, calendar not generated, bracket not generated, unresolved ties, offline cached view.

## 6. Interaction and layout

### Overview (`/t/:tid`)

- Heading: tournament name; one line of phase in words ("Fase a gironi · Periodo 2, fino a dom 30/11").
- Blocks in order (separated by court lines, no cards): "Prossime partite" (next 5 `programmata` across groups by date: "sab 14/11 15:30 · Campo 2 · Rossi/Bianchi – Verdi/Neri"); "Ultimi risultati" (last 5 official); links "Classifiche", "Calendario", "Tabellone Gold/Silver" (when generated). Logged-in player: "Il tuo girone" mini standings (top 4 + own row).
- `concluso`: first line "Vincono il Gold: Rossi/Bianchi · Vincono il Silver: Gialli/Blu" with `Trophy`.

### Standings (`/t/:tid/classifiche`)

- One table per group, group switcher (segmented "Girone A · Girone B") on mobile, side by side on 1440.
- Columns: "#", "Coppia", "Pt", "G" (giocate), "V", "P", "±S", "±G". Abbreviations have `abbr` titles and a one-line legend under the table.
- **390 column strategy**: sticky "#" + "Coppia" column; visible "Pt", "G", "±S"; "V", "P", "±G" reachable by horizontal scroll of the numeric part only (with a visible scroll hint "Scorri per altre colonne"); tap a row → expands inline with the full stats in words ("5 vinte, 2 perse · set 11-6 · game 78-60").
- **Zones**: the labelled court line between qualification bands + row badge text; for `avulsa` qualification the line is drawn only for sure places and a note explains "Le migliori seconde si decidono con la classifica avulsa (media punti)".
- **Ties**: rows with `pariMerito` show `Equal` icon + "pari merito" and a note under the table: "Rossi/Bianchi e Verdi/Neri sono pari anche dopo tutti i criteri: decide il sorteggio dell'organizzatore." Applied tie-break chain listed once: "Criteri: punti, scontro diretto, differenza set, differenza game, sorteggio."
- My pair (logged in) marked with `User` icon + "la tua coppia", not by colour.

### Calendar (`/t/:tid/calendario`)

- Group switcher, then matchdays as sections "Giornata 3" (with period "entro dom 30/11"); each match row: pairs, state label+icon, and either date/time/court (programmata), score (giocata/tavolino), or nothing more. Filter chips: "Tutte · Da giocare · Giocate", and "Solo la mia coppia" when logged in.
- Default scroll: first matchday with unplayed matches.
- 1440: two groups side by side by matchday.

### Brackets (`/t/:tid/tabellone/:fase`)

- Phase switcher "Gold · Silver". Rounds named by `nomeTurno` ("Quarti", "Semifinali", "Finale").
- **390**: horizontal scroll-snap, one round per screen width with a round tab bar above ("Quarti · Semifinali · Finale"); each match shows both pairs (seed + group origin "A1"), score, winner in bold with `Check`; TBD as "Vincente Quarto 1".
- **820/1440**: full bracket with court-line connectors; the round tabs remain as anchors.
- **Accessible list**: the bracket is also exposed as an ordered list by round (always in the DOM; on mobile it is the scroll-snap content itself; on desktop a "Vista elenco" toggle shows it visually). Each item: "Semifinale 1: Rossi/Bianchi contro Verdi/Neri, 6-4 6-3, vincono Rossi/Bianchi".

## 7. Italian microcopy

- Titles: "Classifiche", "Calendario", "Tabellone", "Prossime partite", "Ultimi risultati", "Il tuo girone".
- Legend: "Pt punti · G giocate · V vinte · P perse · ±S differenza set · ±G differenza game".
- Zone labels: "Gold", "Silver", "Gold sopra questa linea", "Silver sotto".
- Empty: "I gironi non sono ancora stati composti. Le coppie iscritte sono qui sotto." · "Il calendario non è ancora pronto." · "Il tabellone si crea alla fine dei gironi."
- Errors: "Torneo non trovato. Controlla il link." · "Non riesco a caricare i dati. Riprova."
- Anon nudge (footer line, not a banner): "Giochi in questo torneo? Accedi per programmare le tue partite."

## 8. Open decisions / assumptions

- **ASSUNZIONE PB1**: Zone lines are drawn per group by position (as the current `zona()` logic) when `criterioQualificazione = perPosizione`; with `avulsa` only certain places get a line, plus an explanatory note.
- **ASSUNZIONE PB2**: Mobile standings keep #, Coppia, Pt, G, ±S visible; V, P, ±G are behind horizontal scroll and row expansion.
- **ASSUNZIONE PB3**: Public views show pair names only; individual player names appear only to logged-in users.
- **ASSUNZIONE PB4**: `/t/:tid` lands on the overview in every phase; there is no automatic redirect to the bracket during finals.
- **ASSUNZIONE PB5**: Anonymous users tapping a match row get no navigation (match pages require login); the row itself shows all public info.
