# Padel League

Doubles padel championship web app: React SPA (GitHub Pages) + Supabase (Postgres with RLS, SECURITY DEFINER RPCs, Realtime, Auth, pg_cron). Product: `PRODUCT.md`. Design system: `DESIGN.md`. Database contract: `docs/api-contract.md`.

## Language rule

- **Code is English**: identifiers, files, SQL, comments, tests, commit messages, docs, script output.
- **Italian only in what the end user sees**: UI copy, aria-labels, toasts, user-facing error messages, emails, URL paths.
- Italian UI term ↔ English code name: `docs/glossary.md`. Add new terms there before naming code.

## Commands

```bash
docker compose up                      # full local stack: app http://localhost:5173, API :54321, mail :54324
docker compose --profile studio up     # + Supabase Studio http://localhost:54323
docker compose run --rm db-test        # database test suite (throwaway Postgres)
docker compose down [-v]               # stop [and wipe data]

npm test                               # Vitest: src (pure logic, helpers)
npm run typecheck
npm run build
npm run local                          # alternative to compose: Supabase CLI + Vite on the host
```

Demo users (local): `admin@demo.it`, `org@demo.it`, `gestore@demo.it`, `p1@demo.it` … `p40@demo.it`, password `password`.

## Skills and agents

- `/coordinate` — runs a task or the phases in `docs/PHASES.md` through `planner` → `implementer` → `verifier`, keeping `docs/PROGRESS.md`.
- `planner` (writes `docs/plans/<id>.md`), `implementer` (tests first, one commit), `verifier` (independent, read-only, PASS/FAIL).
- `padel-database` skill — any change under `supabase/` or to the schema contract. Specialist agent: `database-engineer`.
- `padel-frontend` skill — any change under `src/`. Specialist agent: `frontend-engineer`.
- `reviewer` agent — read-only review of any diff against both skills.
- Generic: `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`, `impeccable` (UI/UX).

## Invariants

Numbered so plans and verifications can cite them. A change that would break one stops and is reported.

1. **Language:** code, SQL, comments, tests, docs and commit messages in English; Italian only in what the end user sees (UI copy, aria-labels, toasts, user-facing errors, emails, URL paths). Names come from `docs/glossary.md`.
2. **Integrity in the database:** rules that must hold for every client (bookings, acceptances, results, roles) are enforced by RLS, constraints or `security definer` RPCs. The client only derives views (standings, bracket, attention feed) in `src/lib`.
3. **Revoke by default:** every table has RLS and explicit column grants; every RPC sets `search_path = ''`, checks the caller and is not executable by `anon` unless intended. The service key never reaches the client.
4. **Migrations are append-only:** never edit an applied migration; add a new one.
5. **One contract:** migration ↔ `docs/api-contract.md` ↔ `src/data/database.types.ts` ↔ adapters ↔ `BY_HINT` error codes change together.
6. **Layers:** features don't import each other; only `src/data` talks to Supabase; `src/lib` is pure (no React, no I/O).
7. **Enum values are stored in English** and shown through the label maps in `src/lib/copy.ts`.
8. **Time:** dates and times are Europe/Rome wall clock (`src/lib/time.ts`, `private.today()`); instants are `timestamptz`.
9. **Accessibility:** WCAG 2.2 AA, 44 px targets, nothing by colour alone, usable at 320 px and 200% text (`PRODUCT.md`).
10. **Done means verified:** `npm run typecheck && npm test && npm run build`, `docker compose run --rm db-test` for database changes, and the screen checked in the running app for UI changes.
