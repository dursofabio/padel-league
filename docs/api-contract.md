# API contract (Supabase): frozen for parallel work

This is the source of truth shared by the backend (`supabase/migrations`) and the frontend (`src/data`). Any change must update this file **and** `src/data/database.types.ts` in the same commit. Names follow `docs/glossary.md`.

Conventions:
- schema `public`, snake_case names, English identifiers (Italian only in user-facing text: error messages, notes written by the server, emails);
- `date` = local Europe/Rome day; `time` = local wall-clock time. PostgREST returns times as `"HH:MM:SS"`, and the client adapter trims them to `"HH:MM"`. `'24:00'` is allowed only as an end time;
- `timestamptz` = absolute instants (deadlines, logs), ISO strings on the client.

## Enums

| enum | values |
|---|---|
| `app_role` | `admin`, `organizer`, `manager`, `player` |
| `tournament_status` | `registration`, `groups`, `finals`, `completed` |
| `team_status` | `awaiting_partner`, `pending_approval`, `approved`, `withdrawn` |
| `match_status` | `unscheduled`, `requested`, `scheduled`, `played`, `disputed`, `forfeit` |
| `request_status` | `pending`, `confirmed`, `rejected`, `cancelled`, `conflict`, `expired` |
| `booking_type` | `external`, `lesson`, `closure`, `match` |

## Tables and views

| Relation | Columns | anon read | authenticated read | direct client writes |
|---|---|---|---|---|
| `profiles` | `id uuid` (= auth.users.id), `name text`, `email text`, `phone text`, `roles app_role[]` (≥ `{player}`), `created_at` | no | yes | own row: `name`, `phone` |
| `public_players` (view) | `id`, `name` | yes | yes | — |
| `tournaments` | `id uuid`, `name`, `status`, `config jsonb` (shape = `TournamentConfig` in `src/types.ts`, camelCase keys; includes `playerCancelHours`, default 24), `draw jsonb` (`{teamId: n}`), `generated_phases text[]`, `created_at` | yes | yes | org: `name`, `config`, `draw`; admin: insert/delete |
| `periods` | `id uuid`, `tournament_id`, `phase text`, `round int?`, `starts_on date`, `ends_on date`, `label text` | yes | yes | org: CRUD |
| `teams` | `id uuid`, `tournament_id`, `name`, `group_name text?`, `status`, `created_by uuid`, `created_at` | yes | yes | org: `group_name`, `status`, `name`, delete; creator: `name` until approved, delete while `awaiting_partner` |
| `team_players` | `team_id`, `tournament_id`, `user_id`, `position smallint (1,2)` | yes | yes | — (RPC) |
| `invites` | `token text` PK, `team_id`, `tournament_id`, `created_by` | no | creator and org | org: delete |
| `matches` | `id uuid`, `tournament_id`, `code text` (unique per tournament), `phase text` (`groups`/`gold`/`silver`/…), `group_name text?`, `round int?`, `position int?`, `next_code text?`, `side text?` (`A`/`B`), `team_a uuid?`, `team_b uuid?`, `period_id uuid?`, `status`, `request_id uuid?`, `sets jsonb?` (`[{"a":6,"b":4},…]`), `entered_by uuid?`, `confirmed_by uuid?`, `disputed_by uuid?`, `result_note text?`, `updated_at` | yes | yes | — (RPC) |
| `matches_v` (view, preferred read path) | all of `matches` + `players_a uuid[]`, `players_b uuid[]`, `players uuid[]` (A then B, ordered by `position`), `sched_court_id text?`, `sched_date date?`, `sched_start time?`, `sched_end time?` (from the confirmed request) | yes | yes | — |
| `courts` | `id text` PK, `name`, `first_slot time`, `last_slot time` (last start), `slot_minutes int`, `active_days smallint[]` (0 = Sunday), `closed_dates date[]`, `sort_order int` | yes | yes | manager: CRUD |
| `recurrences` | `id uuid`, `court_id`, `weekday smallint`, `start_time time`, `end_time time`, `type`, `note text`, `valid_from date`, `valid_to date` | no | yes | manager: CRUD |
| `bookings` | `id uuid`, `court_id`, `date date`, `start_time time`, `end_time time`, `type`, `note text?`, `match_id?`, `request_id?`, `tournament_id?`, `recurrence_id?`, `created_by uuid?` | no | yes | — (RPC). **EXCLUDE** on `(court_id, tsrange(date+start_time, date+end_time))` |
| `requests` | `id uuid`, `tournament_id`, `match_id`, `court_id`, `date date`, `start_time time`, `end_time time`, `off_grid bool`, `counter_proposal bool`, `status`, `expires_at timestamptz`, `created_by uuid`, `handled_by uuid?`, `note text?`, `created_at` | no | yes | — (RPC). Unique while `pending`: `(court_id, date, start_time)` and `(match_id)` |
| `request_players` | `request_id`, `user_id`, `accepted_at timestamptz?` | no | yes | — (RPC) |
| `availability` | `tournament_id`, `user_id`, `windows jsonb` (`{"2026-11-14": ["14:00-19:00"]}`), `updated_at`; PK `(tournament_id, user_id)` | no | yes | own row: upsert/delete |
| `audit_log` | `id bigint`, `actor_id uuid?`, `action text` (English), `target text`, `created_at timestamptz` | no | org, manager | — |

`requests` and `bookings` also have a generated `time_range tsrange` column (server-side overlap checks; the client can ignore it).

Role helpers (SQL, schema `private`): `has_role(role)` (admin always true), `is_match_player(match_id)`.

## RPC (`supabase.rpc(name, args)`)

All are SECURITY DEFINER; `authenticated` only (`reminder_emails` is `service_role` only). Arguments are prefixed `p_`.

| RPC | Arguments | Returns | Who |
|---|---|---|---|
| `create_request` | `p_match uuid, p_court text, p_date date, p_start time, p_note text default null` | `uuid` (request id) | one of the 4 players |
| `accept_request` | `p_request uuid` | `void` | a player of the request |
| `cancel_request` | `p_request uuid, p_note text default null` | `void` | a player (while `pending`) |
| `confirm_request` | `p_request uuid` | `jsonb {outcome: 'ok'\|'taken'\|'expired', conflicts: int}` | manager |
| `reject_request` | `p_request uuid, p_note text default null` | `void` | manager |
| `cancel_confirmed` | `p_request uuid, p_note text default null` | `void` | manager |
| `player_cancel_confirmed` | `p_request uuid, p_note text default null` | `void` | a player of the match, until `config.playerCancelHours` hours before the start (otherwise hint `TOO_LATE`). Frees the court (deletes the booking), request → `cancelled`, match → `unscheduled` |
| `counter_propose` | `p_request uuid, p_court text, p_date date, p_start time, p_note text default null` | `uuid` (new request) | manager |
| `add_occupation` | `p_court text, p_date date, p_start time, p_end time, p_type booking_type, p_note text default null` | `jsonb {id, conflicts}` | manager (`type` ≠ `match`) |
| `remove_occupation` | `p_id uuid` | `void` | manager (not `match`) |
| `close_day` | `p_date date, p_note text` | `jsonb {errors: text[], conflicts: int}` | manager |
| `materialize_recurrence` | `p_recurrence uuid, p_days int default 60` | `jsonb {created: int, skipped: text[]}` | manager |
| `submit_result` | `p_match uuid, p_sets jsonb` | `void` | a player |
| `confirm_result` | `p_match uuid` | `void` | opponent of `entered_by` |
| `contest_result` | `p_match uuid, p_note text` | `void` | opponent of `entered_by` |
| `set_official_result` | `p_match uuid, p_sets jsonb, p_note text default null` | `void` | org |
| `assign_forfeit` | `p_match uuid, p_winner text ('A'\|'B'), p_note text default null` | `void` | org |
| `clear_result` | `p_match uuid` | `void` | org |
| `create_team` | `p_tournament uuid, p_name text` | `jsonb {team_id, token}` | authenticated (tournament in `registration`) |
| `get_invite` | `p_token text` | `jsonb {team_id, tournament_id, name, creator_name, status, players: int}` or null | authenticated |
| `join_team` | `p_token text` | `uuid` (team id) | authenticated |
| `my_invite_token` | `p_team uuid` | `text` or null | team creator |
| `generate_calendar` | `p_tournament uuid, p_matches jsonb` (`[{code, group_name, round, position, team_a, team_b, period_id}]`) | `int` | org (tournament in `registration`, else `BAD_STATE`) |
| `generate_finals` | `p_tournament uuid, p_phase text, p_matches jsonb` (`[{code, round, position, next_code, side, team_a, team_b, period_id}]`) | `int` | org (tournament in `groups`/`finals`, else `BAD_STATE`) |
| `sync_bracket` | `p_tournament uuid, p_updates jsonb` (`[{code, team_a, team_b}]`) | `int` | org |
| `set_tournament_state` | `p_tournament uuid, p_status tournament_status` | `void` | org. Allowed: any → `completed`; `completed` → previous status (`finals` if `generated_phases` is not empty, else `groups` if group matches exist, else `registration`); `groups` → `registration` only without group matches. `registration`→`groups` only via `generate_calendar`, `groups`→`finals` only via `generate_finals`. Otherwise `BAD_STATE` |
| `set_roles` | `p_user uuid, p_roles app_role[]` | `void` | admin |
| `reminder_emails` | — | `jsonb [{email, name, lines: text[]}]` (lines in Italian) | service_role |

Server-side rules worth knowing on the client:
- `create_request` / `counter_propose` compute `off_grid`, the off-grid step, `end_time = start_time + slot_minutes`, the expiry (`config.requestExpiryHours`, capped at the slot start), and the **acceptances**. The creator is accepted, and so is any player whose `windows` cover the slot.
- Lazy expiry: before taking a lock, expired requests on the same slot or match become `expired`.
- `confirm_request` never raises on overlap: it returns `outcome: 'taken'` and moves the request to `conflict` (also when the request is already in `conflict`).
- `confirm_result` also cancels any request of that match still `pending`.
- Notes written by the server (`requests.note`, `matches.result_note` on forfeit) are user-facing and in Italian; booking types and statuses inside them use their Italian labels.

## Errors

RPCs raise `P0001` with an Italian `message` and a code in `hint`. The client maps by `hint` and falls back to `message`.

| hint | meaning |
|---|---|
| `NOT_AUTHORIZED` | role or ownership missing |
| `NOT_FOUND` | the entity does not exist |
| `BAD_STATE` | invalid state transition |
| `SLOT_TAKEN` | slot already requested or booked |
| `MATCH_HAS_REQUEST` | the match already has a pending request |
| `OVERLAP` | overlap with a booking (`message` lists which ones) |
| `NOT_ALL_ACCEPTED` | acceptances < 4/4 |
| `EXPIRED` | request expired |
| `OFF_GRID_DISABLED` / `BAD_STEP` / `COURT_CLOSED` / `IN_PAST` | off-grid / time checks |
| `INVALID_SCORE` | sets not valid (`message` explains) |
| `ALREADY_CONFIRMED` | result already confirmed |
| `TOO_LATE` | player cancellation too close to the start |
| `TEAM_FULL` / `ALREADY_IN_TEAM` / `BAD_TOKEN` / `REGISTRATION_CLOSED` | teams |
| `CALENDAR_EXISTS` / `BAD_CALENDAR` / `PHASE_EXISTS` / `BAD_BRACKET` | generation |

Postgres errors: `23505` → "Già esistente / slot appena preso", `23P01` (exclusion) → "Campo già occupato in quell'orario", `42501` → "Permessi insufficienti".

## Realtime

Publication `supabase_realtime`: `requests`, `request_players`, `matches`, `bookings`, `teams`, `availability`. The client only invalidates TanStack Query caches; it never patches data from events.

## Scheduled jobs (pg_cron, when available)

`private.job_expire_requests()` every 15', `private.job_recurrences(28)` every hour, `private.job_unplayed()` daily. Emails: GitHub Actions calls `reminder_emails()` with the service role key → `jsonb [{email, name, lines: text[]}]`.
