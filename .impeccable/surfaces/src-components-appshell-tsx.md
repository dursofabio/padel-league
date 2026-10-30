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

THESIS: The court's own lines organise the app. Schedules read as two lanes of court with the 30-minute stagger visible, instead of the category's grid of identical white cards with a single brand colour.

OWN-WORLD: Padel-turf blue for the shell (rail/top bar) and selected states; white court lines as the only dividers (1px, on blue and on neutral grounds); a ball yellow-lime used only for the primary action, current selection and focus halo; cool neutral grounds; state colours (green 4/4, amber 3/4, red occupied, blue requested) always paired with icon and text. One family, Atkinson Hyperlegible Next, tabular numerals for times and scores. Dark theme = floodlit court at night: deep blue-black ground, the same white lines.

STORY: A player opens the app, sees what needs them now, taps a match, sees the two court lanes for the week with the slots that work for all four, requests one, and watches the acceptances arrive. The manager sees requests and a day of two lanes and confirms with one tap.

FIRST VIEWPORT: Top bar in turf blue with the title and tournament; "Da fare" list on a neutral ground, each item a row separated by a court line, urgent ones first with their deadline; bottom tab bar on mobile, sidebar on desktop; primary action button in lime on the item that needs it.

FORM: Court lines (grounded list position 2; Impeccable's pick, chosen by the user over the assigned "club notice board"); signature move: the slot grid and the manager's timeline drawn as two parallel court lanes with the 30' stagger offset, start times on the lines. seed: 4dda9c286c9d8a17

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Roll ran degraded (impeccable.style unreachable from the environment): no challengers or quality-bar boards.
