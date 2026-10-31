---
version: 1
slug: "src-components-appshell-tsx"
primary_target: "src/components/AppShell.tsx"
related_targets: []
---

## Scope

Whole app shell and every working screen (Operate mode): player, court manager, organizer, admin, plus the public read-only views (standings, calendar, brackets), which inherit the same world. Mobile-first; tablet two-pane for the court manager; desktop sidebar for the organizer.

## Audience and task

Mixed-age amateur players (incl. 50+) on phones outdoors and at the club; 1–2 court managers at the front desk; one volunteer organizer at a desktop. Core jobs: declare availability once, pick a slot all 4 can play, accept, get the manager's tap, enter/confirm results. Constraints: Italian only, light and dark themes, WCAG 2.2 AA, 44px targets, nothing by colour alone.

## Direction contract

THESIS: The app is the tournament's poster. Each screen leads with one huge condensed statement (what you have to do, who you play, where you stand) instead of the category's even list of identical rows and outline buttons; everything else steps back to a quiet supporting line.

OWN-WORLD: Warm paper ground, ink-black text, solid 2px ink borders on every block and control. Full palette with named roles: ball lime = the one thing to do now (primary block, primary action, current selection); clay coral = availability and time windows; paper white = everything else. Ink-black bar at the bottom (tab bar, desktop sidebar) with lime for the active item. Anton for display (titles, team names in blocks, big numerals: positions, times, scores), Atkinson Hyperlegible Next for all reading text. State colours (ok/warn/danger/info) stay, always with icon and text. Dark theme = the poster in negative: near-black ground, paper text and borders, the same lime and coral fills with black ink.

STORY: A player opens the app and reads, in poster type, how many things need them; the first block is lime with the match and the button; their next match is a black block with the time in huge numerals. Repeated "schedule a match" items collapse into one block with the list inside. Standings show their position as a big number and their row in lime.

FIRST VIEWPORT: Paper top bar with the PADEL LEAGUE wordmark and avatar; the Anton headline "Hai N cose da fare" with N on a lime highlight; the next-match block; the first lime action block. Black tab bar at the bottom.

FORM: Pinned by the user: "Manifesto" (option C of the 2026-10-31 critique round: tournament poster, paper + Anton + full-colour blocks with ink borders). seed: none (pinned by user)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Team identity (initials + generated colour per pair) proposed, not yet built.
- Manager and organizer screens inherit the world through tokens and primitives only; a dedicated pass may follow.
