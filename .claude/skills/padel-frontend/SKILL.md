---
name: padel-frontend
description: How this repo writes React code — folder layout, data hooks (TanStack Query + Supabase), actions/RPC calls, realtime, forms, UI primitives, routing, Italian UI copy and tests. Use for ANY change under src/ (screens, components, hooks, lib logic).
---

# Frontend in Padel League

React 19 + TypeScript + Vite 8, Tailwind CSS v4, Radix primitives, TanStack Query 5, React Router 8 (hash routing), react-hook-form + zod, sonner toasts. Load `vercel-react-best-practices` / `vercel-composition-patterns` for generic React guidance (ignore their Next.js/RSC-only rules: this is a static SPA). For visual/UX work use `impeccable` with `PRODUCT.md` and `DESIGN.md`.

## Language

- Code is English: files, identifiers, props, comments, tests. Names come from `docs/glossary.md`; add a new domain term there before using it.
- **Italian only for what the user sees**: JSX text, `aria-label`, toasts, validation messages, error texts (`src/data/errors.ts`), URL path segments (`/t/:tid/partite`).
- Stored enum values are English (`'pending'`, `'manager'`, `'groups'`). Show them through the label maps in `src/lib/copy.ts` (`MATCH_STATUS`, `REQUEST_STATUS`, `TEAM_STATUS_LABEL`, `ROLE_LABEL`, …), never render a raw value.

## Layers (imports only point down)

```
features/<area>/   screens + feature-local logic.ts (pure, tested) — areas never import each other
components/        shared app components (AppShell, CourtLanes, StandingsTable, common.tsx…)
ui/                design-system primitives (Button, Field, Sheet, AlertDialog…) — no data access
data/              the only place that talks to Supabase
lib/               pure domain logic (slots, standings, bracket, berger, attention…) — no React, no I/O
types.ts           domain types
```

Something needed by two features moves down to `components/` or `lib/`.

## Data

- **Reads:** hooks in `src/data/queries.ts` (`useTournamentData`, `useMatches`, `useBookings`…). They return domain types via `src/data/adapters.ts`. Features never call `supabase` directly.
- **Query keys:** only from `qk` in `src/data/keys.ts`. Realtime invalidates by key prefix.
- **Writes:** add a function to `actions` in `src/data/mutations.ts` (RPC via the typed `rpc()` helper, or a direct table write only where RLS allows it), use it from a component with `useAction(actions.x, { success: 'Testo italiano' })`. Errors become Italian toasts through `errorMessage`.
- **Realtime:** one channel (`useRealtime`) invalidates queries per table using `INVALIDATE_BY_TABLE`. Never patch the cache by hand: the server is the truth.
- **Business rules that need integrity belong in the database** (see the `padel-database` skill); the client computes only derived views (standings, bracket, attention feed) in `src/lib`.
- Schema changes: update `src/data/database.types.ts` and the adapter together.

## Components

- Function components with named exports, except pages: they `export default` and are lazily loaded from `src/app/router.tsx` (`lazy: lazy(() => import(...))`). New route = add it there with the right guard (`auth`, `role('organizer')`…).
- Build with `src/ui` primitives and Tailwind tokens from `src/styles/index.css`; don't add new colours or one-off spacing outside the design system (`DESIGN.md`, page `/#/_kit` in dev).
- Loading/empty/error states: `QueryState`, `SkeletonRows`, `EmptyState`, `ErrorState` from `src/components/states.tsx`.
- Forms: react-hook-form + zod schema (`zodResolver`), Italian messages in the schema.
- Accessibility is a requirement (`PRODUCT.md`): WCAG 2.2 AA, 44 px touch targets, never colour alone, keyboard reachable, works at 320 px and 200% text.
- Dates/times: helpers in `src/lib/time.ts` (Europe/Rome); never `new Date().toISOString().slice(0, 10)` for "today".

## Tests

- Pure logic (`src/lib`, `features/*/logic.ts`) gets Vitest tests next to it (`__tests__/*.test.ts`). Move logic out of components to test it.
- Run: `npm test`, `npm run typecheck`, `npm run build`. In Docker: `docker compose run --rm app npm test`.
- Check the change in the running app (`docker compose up`, http://localhost:5173, demo users `p1@demo.it` / `password`).
