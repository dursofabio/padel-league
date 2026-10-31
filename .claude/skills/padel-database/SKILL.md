---
name: padel-database
description: How this repo changes its Supabase database — migrations, RLS, SECURITY DEFINER RPCs, error codes, pg_cron jobs, realtime, database types and the DB test suite. Use for ANY change under supabase/ or to src/data/database.types.ts, or when a feature needs a new table, column, policy or RPC.
---

# Database changes in Padel League

Load the official `supabase` and `supabase-postgres-best-practices` skills too; this skill adds the project's own rules on top.

## Where things live

| What | Where |
|---|---|
| Schema, RLS, RPCs, jobs | `supabase/migrations/*.sql` (applied in filename order) |
| Contract shared with the frontend | `docs/api-contract.md` |
| TypeScript mirror of the schema | `src/data/database.types.ts` (hand-written, `supabase gen types` format) |
| Row → domain mapping | `src/data/adapters.ts` |
| Italian names ↔ code names | `docs/glossary.md` |
| Sample courts | `supabase/seed.sql`; demo tournament: `scripts/seed-demo.mjs` |
| Tests | `supabase/tests/*.test.ts` (Vitest + `pg`, plain Postgres with `00_supabase_stub.sql`) |

## Rules

1. **English identifiers.** Tables, columns, enum values, functions, policies, constraints, comments: English, snake_case, names from `docs/glossary.md`. Italian only in user-facing error messages. Add new domain terms to the glossary first.
2. **Never edit an applied migration.** Add a new file `supabase/migrations/<yyyymmddhhmmss>_<english_name>.sql`. Make it re-runnable where cheap (`create or replace`, `if not exists`, `drop … if exists`).
3. **Revoke by default.** Nothing is reachable by `anon`/`authenticated` unless a migration grants it explicitly. Every new table: `enable row level security`, column-level `grant`s, then policies with `to authenticated` (or `anon`) plus an ownership/role predicate. Never `auth.role()`.
4. **Writes that need integrity go through RPCs**, not table grants:
   - `create or replace function public.<verb>_<noun>(p_… ) … language plpgsql security definer set search_path = ''` — always the empty search path and fully qualified names (`public.matches`, `private.today()`).
   - Check the caller first: `private.require_uid()`, `private.require_role('manager')`, `private.has_role(…)`.
   - Lock what you are about to change (`select … for update`, `private.lock_slot(court, date)`).
   - Fail with `perform private.fail('<CODE>', '<Italian message>')`. The code (HINT) is English UPPER_SNAKE; add a new code to `BY_HINT` in `src/data/errors.ts` with its Italian text.
   - `revoke all on function … from public, anon;` then `grant execute on function … to authenticated;` (see the end of `*_rpc_requests.sql`).
   - Internal helpers live in schema `private` (not exposed by PostgREST).
5. **Times:** `date`/`time` columns are Europe/Rome wall clock; use `private.today()` / `private.local_now()`, never `now()::date`. `timestamptz` for instants.
6. **Realtime:** a table the UI must refresh live goes into publication `supabase_realtime` (see `*_realtime.sql`) **and** into `INVALIDATE_BY_TABLE` in `src/data/keys.ts`.
7. **Jobs:** periodic work is a `private.job_*` function scheduled in `*_cron.sql` with `cron.schedule('padel-…', …)`; guard for pg_cron being absent.
8. **Keep the three mirrors in sync in the same commit:** migration ↔ `docs/api-contract.md` ↔ `src/data/database.types.ts` (+ adapter if a row shape changed).

## Workflow

1. Write the migration.
2. Write/extend a test in `supabase/tests/` — happy path, authorisation failure (`db.as(otherUser)` expecting the error code) and any constraint you rely on.
3. Run the suite:
   ```bash
   docker compose run --rm db-test   # no local Postgres needed
   npm run test:db                   # if PostgreSQL 16+ binaries or DATABASE_URL are available
   ```
4. Apply to the running local stack: `docker compose up migrate` (applies only pending files).
5. Update `database.types.ts`, adapters, `api-contract.md`, then `npm run typecheck && npm test`.

## Hosted project

Migrations reach production through `.github/workflows/migrations.yml` (`supabase db push`) on push to `main`. A migration that rewrites data must be safe to run on a live database.
