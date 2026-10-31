# Phases

The map `/coordinate` reads instead of the whole product docs. Each phase lists what to read, its dependencies and its done criterion. `PRODUCT.md`, `DESIGN.md` and `docs/api-contract.md` stay the source of truth: if this file disagrees with them, they win and the difference must be reported.

Fields:

- **Read**: doc sections (and `docs/ux/*` briefs) needed to plan and implement the phase. Nothing else.
- **Depends on**: phases that must be `done`.
- **Prerequisites**: decisions or external conditions to check in `docs/PROGRESS.md` before starting.
- **Gate**: `human` means a person approves the plan before implementation; `auto` means the coordinator's check is enough.
- **Type**: `development` (plan → implement → verify) or `review` (deep verification, then test-driven fixes).
- **Done when**: criterion checked by the verifier.

Ids: `P<milestone>.<n>`, milestones `P1`, `P2`, …

---

<!-- Template:

## P1 — <milestone name>

### P1.1 <phase title>
- Read: PRODUCT.md §…, docs/ux/….md
- Depends on: —
- Prerequisites: —
- Gate: auto
- Type: development
- Done when: …

-->
