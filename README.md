# Padel League: managing a padel championship

Web app for a doubles padel championship. It covers sign-up with an invite link, the group stage (Berger schedule), match scheduling, results and Gold/Silver finals.

Scheduling works by crossing the players' availability with the court grid: each player enters their time windows once, the app finds the slots that work for all 4, and the court manager confirms with a tap.

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4, Radix primitives, TanStack Query. It ships as a static SPA on **GitHub Pages** (hash routing) and can be installed as a PWA.
- **Backend:** **Supabase** free plan.
  - Postgres with Row Level Security.
  - SECURITY DEFINER RPC functions for every operation that needs integrity.
  - Realtime, Auth (email/password and Google) and pg_cron.
- **Design:** "Righe del campo" direction, built with the [Impeccable](https://github.com/pbakaus/impeccable) skill (`.claude/skills/impeccable`). Product context is in `PRODUCT.md`, the design system in `DESIGN.md`, and the UX briefs in `docs/ux/`.

## What the server guarantees

| Rule | How |
|---|---|
| Never two bookings on the same court | `EXCLUDE USING gist` constraint on court time ranges |
| One slot, one request; one pending request per match | partial unique indexes on pending requests |
| Acceptances that can't be faked | computed by the server from the players' availability windows when the request is created |
| Confirmation only with all 4 accepted, and a request never expires after its start time | `confirm_request` plus a trigger that caps the expiry |
| Roles (several per user) that can't be self-assigned | trigger on `profiles` and the admin-only `set_roles` RPC |
| Results confirmed only by the opposing pair | `submit_result` / `confirm_result` / `contest_result` RPCs |
| Group schedule always a complete round robin | checked by `generate_calendar` |

Standings, qualification and bracket progression are computed by the client from confirmed results (`src/lib`, with tests).

## Structure

```
src/
  lib/          pure logic, tested: slot grid, Berger, scores, standings, brackets, Da fare feed
  data/         Supabase client, row → domain adapters, queries, actions (RPC), realtime, Italian errors
  ui/           primitives (buttons, fields, sheets, dialogs…)
  components/   shell, court lanes, standings, bracket, shared states
  features/     screens by area: home, public, player, gestore, organizer, admin, profile, invite
supabase/
  migrations/   schema, RLS, RPC, jobs, realtime
  tests/        database tests (Vitest + pg) on Postgres 16 or DATABASE_URL
scripts/        db-test.sh, seed-demo.mjs, cron.mjs (email)
docs/           API contract, UX briefs, reviews
```

## Going live

### 1. Supabase project

1. Create a project on [supabase.com](https://supabase.com) (Free plan, EU region).
2. **Database → Extensions:** enable **pg_cron** *before* the migrations. If you enable it later, re-run `supabase/migrations/20261101001000_cron.sql` and check with `select * from cron.job` (3 jobs).
3. Apply the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   Then load the courts from `supabase/seed.sql` (SQL Editor), or create them from the "Campi" screen.

   **Without a local checkout:** use the `.github/workflows/migrations.yml` workflow. Set the variable `SUPABASE_PROJECT_REF` and the secrets `SUPABASE_ACCESS_TOKEN` (Supabase account → Access Tokens) and `SUPABASE_DB_PASSWORD`, then run *Actions → Migrazioni database → Run workflow* (tick the option to load the sample courts). It also runs on every push to `main` that changes a migration.
4. **Authentication**
   - **URL Configuration:** set Site URL to `https://<user>.github.io/padel-league/` and add the redirect URL `https://<user>.github.io/padel-league/**`. The app uses the PKCE flow, so login links come back as `?code=` and don't clash with hash routing.
   - **Google:** create an OAuth client in Google Cloud with redirect URI `https://<ref>.supabase.co/auth/v1/callback` and enter its ID and secret in Supabase.
   - **SMTP:** set up a custom SMTP server. Without it, Supabase's built-in email reaches only the project team, so sign-up confirmations and password resets won't arrive for other users.
5. **First admin:** sign up in the app, then run in the SQL Editor:
   `update public.profiles set roles = '{admin,giocatore}' where email = '<your-email>';`
   From then on, roles are assigned from **Utenti** in the app.

### 2. GitHub Pages

1. *Settings → Pages → Source:* **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → Variables:* `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (the publishable/anon key, which is public by design).
3. Every push to `main` runs the tests, the build and the deploy (`.github/workflows/deploy.yml`).

### 3. Reminder emails (optional)

`.github/workflows/cron.yml` runs `scripts/cron.mjs` once a day. It calls `email_promemoria()` with the server key and sends the emails via SMTP.

| Setting | Values |
|---|---|
| Variables | `SUPABASE_URL`, `APP_URL`, `CRON_ENABLED=true` |
| Secrets | `SUPABASE_SECRET_KEY` (service role), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |

Request expiry, recurrence materialisation and unplayed-match reports run in **pg_cron**, inside the database.

### Free-plan limits to keep in mind

- A Supabase project is **paused after 7 days without activity**. During the championship this doesn't happen; between seasons, restore it from the dashboard.
- The Free plan has no automatic backups.
- GitHub disables scheduled workflows after 60 days without commits to the repository.

## Local development

```bash
npm install && (cd scripts && npm install)

# Full stack with Docker (Supabase CLI). Where the default registry is not reachable,
# add SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io
npx supabase start -x studio,imgproxy,storage-api,edge-runtime,logflare,vector,supavisor,postgres-meta
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=<service_role key printed by start> npm run seed:demo
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key> npm run dev
```

The demo creates the users `admin@`, `org@`, `gestore@` and `p1@`…`p8@` `demo.it` (password `password`), a tournament with 4 pairs, availability windows and a lesson. The `/#/_kit` page (development only) shows the design system.

Tests:

```bash
npm test          # pure logic and frontend helpers (Vitest)
npm run test:db   # migrations, RLS, RPC, constraints and jobs on a throwaway local Postgres (or DATABASE_URL)
npm run typecheck
```

## Product decisions (open points in the spec)

| Point | Choice (configurable per tournament where it makes sense) |
|---|---|
| Set format and points | best of 3 sets, decisive set as a super tie-break; 3 points for a win, 0 for a loss, +1 for a loss in the decisive set |
| Tie-break chain | points, head-to-head, set difference, game difference, draw |
| Request expiry | 48 hours, never after the slot's start |
| Off-grid step | 30 minutes |
| 3/4 slots | can be requested: the missing player accepts explicitly, the court manager confirms only at 4/4 |
| Cancelling a confirmed match | players can cancel up to 24 hours before (configurable); after that they write to the court manager |
| Matches after the period ends | still bookable and marked "In ritardo" until the organizer decides (forfeit or official result) |
| Team withdrawal | `ritirata` status; remaining matches closed by the organizer |
| Roles | several per user (e.g. court manager and player) |
| Phone number | visible to logged-in users; used for WhatsApp links |
| Substitutes, 3rd/4th place final, multiple clubs | not handled |
