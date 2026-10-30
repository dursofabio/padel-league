# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + Tailwind CSS, published as a static SPA on GitHub Pages (hash routing). Backend: Supabase (Postgres, Row Level Security, RPC functions, Realtime, Auth with email/password and Google), free plan. Installable as a PWA.

## Users

- **Players** (about 40, i.e. 20 pairs): mixed-age amateurs, including people over 50, with varying comfort with technology. They use the app almost only from their phones, often outdoors or at the club, and coordinate through WhatsApp groups. Their job: say when they can play, find a slot that works for all four players of a match, confirm it, then enter or confirm the result.
- **Court manager ("gestore")**: one or two people at a single club with 2 courts, usually at the front desk and working from a phone or tablet. Their job: confirm or reject booking requests in one tap, and keep the courts' day timeline accurate (external bookings, lessons, closures).
- **Organizer**: a volunteer who sets up the tournament (groups, periods, scoring rules), approves teams, monitors late matches, resolves disputed results and generates the Gold/Silver final phases. Mostly works from a desktop.
- **Admin**: assigns roles. One user can hold several roles (for example, a court manager who also plays).
- **Public**: anyone following standings, calendar and brackets without logging in.

## Product Purpose

Run a doubles padel championship from the group phase to the Gold and Silver finals, and above all **remove the scheduling back-and-forth**. Today match dates are agreed in WhatsApp groups with endless proposals and counter-proposals, and then confirmed with the court manager. With the app, each player declares availability once, the app finds the slots compatible with all four players and with the courts, and the manager confirms with a tap.

Success: matches get scheduled without long chats, the manager never double-books a court, results are confirmed by both sides, and everyone can see standings that are always up to date.

## Positioning

It doesn't replace the club's booking system or the WhatsApp group. It is the place where a league's **four-player availability meets the real court grid**: staggered courts (Court 1 starts at 13:30, Court 2 at 14:00, 90-minute slots), lessons and external bookings of any length, a lock per slot, and confirmation by the manager. WhatsApp remains the channel: the app generates links and messages to share there.

## Operating Context

- 2 courts, 90-minute slots, staggered by 30 minutes, so a match can start every half hour by alternating the two courts.
- The group phase is a round robin (Berger schedule) of 20 pairs in 2 groups of 10: 90 matches, plus 7 Gold and 7 Silver matches, 104 matches per season. Matches must be played within configurable periods (date windows).
- Requests: on-grid (standard) or off-grid (an exception with a 15/30-minute step, explicit acceptance from all four players, impact on the grid slots). A request expires if nobody answers.
- Results are entered set by set by one of the four players and confirmed by an opponent. A dispute is decided by the organizer.
- Notifications: WhatsApp share links, in-app badges in real time, reminder emails.

## Capabilities and Constraints

- Free plans only (Supabase Free, GitHub Pages, GitHub Actions). On Supabase Free the project pauses after 7 days of inactivity, and there are no automatic backups.
- One club, one tournament at a time (multi-tournament support is not a goal today, but the data model must not rule it out).
- Domain terms (always in Italian in the UI): coppia, girone, giornata, periodo, slot, fascia (di disponibilità), richiesta, controproposta, fuori griglia, occupazione, lezione, chiusura, tavolino, Gold, Silver, tabellone, spareggio.
- Match states: da programmare, richiesta, programmata, giocata, contestata, tavolino. Request states: attesa, confermata, rifiutata, annullata, conflitto, scaduta.
- Still undecided (product open points): what happens to matches not played within the period, withdrawal of a team mid-tournament, substitutes, a 3rd/4th place final, multiple clubs.

## Brand Commitments

- Name: "Padel League", neutral. There is no club logo or club colors.
- Voice: Italian only, informal ("tu"), short and concrete. Buttons are verbs ("Invia richiesta", "Conferma partita").
- Light and dark themes from the first version.

## Evidence on Hand

No real content: no photos, logos, testimonials or real data. Demo data comes only from the seed (generic teams and players) and must not be presented as real.

## Product Principles

1. **One availability, many matches**: the player enters their time windows once, and the app does the matching work.
2. **The court is the truth**: never two bookings on the same court at the same time; the server guarantees it, not the goodwill of the client.
3. **Always say what's missing**: who still has to accept, who still has to enter availability, how long until it expires; never leave anyone wondering "what now?".
4. **WhatsApp is the channel, not the enemy**: every key moment has a ready-made message to share.
5. **Easy for anyone**: whoever is least comfortable with technology has to be able to schedule a match without help.

## Accessibility & Inclusion

- Mixed-age users, including people over 50: generous text (at least 16px), high contrast that also works in sunlight, touch targets of at least 44px, nothing communicated through color alone (slot states also have icons, text and patterns).
- Target: WCAG 2.2 AA, including keyboard navigation and screen-reader announcements for real-time updates.
