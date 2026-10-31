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

- `padel-database` skill — any change under `supabase/` or to the schema contract. Agent: `database-engineer`.
- `padel-frontend` skill — any change under `src/`. Agent: `frontend-engineer`.
- `reviewer` agent — read-only review of a diff against both skills.
- Generic: `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`, `impeccable` (UI/UX).

## Ground rules

- Integrity lives in the database (RLS + RPCs); the client only derives views (standings, bracket, attention feed) in `src/lib`.
- Never edit an applied migration; add a new one. Keep migration ↔ `docs/api-contract.md` ↔ `src/data/database.types.ts` in sync.
- Before saying a change is done: `npm run typecheck && npm test`, plus `docker compose run --rm db-test` for database changes, and check the screen in the running app for UI changes.
