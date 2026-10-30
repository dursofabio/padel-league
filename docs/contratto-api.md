# API contract (Supabase): frozen for parallel work

This is the source of truth shared by the backend (`supabase/migrations`) and the frontend (`src/data`). Any change must update this file **and** `src/data/database.types.ts` in the same commit.

Conventions:
- schema `public`, snake_case names, Italian domain terms;
- `date` = local Europe/Rome day; `time` = local wall-clock time. PostgREST returns times as `"HH:MM:SS"`, and the client adapter trims them to `"HH:MM"`. `'24:00'` is allowed only as an end time;
- `timestamptz` = absolute instants (deadlines, logs), ISO strings on the client.

## Enums

| enum | values |
|---|---|
| `app_role` | `admin`, `organizzatore`, `gestore`, `giocatore` |
| `stato_torneo` | `iscrizioni`, `gironi`, `fasiFinali`, `concluso` |
| `stato_squadra` | `in attesa partner`, `da approvare`, `approvata`, `ritirata` |
| `stato_partita` | `da programmare`, `richiesta`, `programmata`, `giocata`, `contestata`, `tavolino` |
| `stato_richiesta` | `attesa`, `confermata`, `rifiutata`, `annullata`, `conflitto`, `scaduta` |
| `tipo_occupazione` | `esterno`, `lezione`, `chiusura`, `campionato` |

## Tables and views

| Relation | Columns | anon read | authenticated read | direct client writes |
|---|---|---|---|---|
| `profiles` | `id uuid` (= auth.users.id), `nome text`, `email text`, `telefono text`, `roles app_role[]` (≥ `{giocatore}`), `created_at` | no | yes | own row: `nome`, `telefono` |
| `giocatori_pubblici` (view) | `id`, `nome` | yes | yes | — |
| `tornei` | `id uuid`, `nome`, `stato`, `config jsonb` (shape = `TorneoConfig` in `src/types.ts`, camelCase keys), `sorteggio jsonb` (`{squadraId: n}`), `fasi_generate text[]`, `created_at` | yes | yes | org: `nome`, `config`, `sorteggio`; admin: insert/delete |
| `periodi` | `id uuid`, `torneo_id`, `fase text`, `turno int?`, `inizio date`, `fine date`, `etichetta text` | yes | yes | org: CRUD |
| `squadre` | `id uuid`, `torneo_id`, `nome`, `girone text?`, `stato`, `creato_da uuid`, `created_at` | yes | yes | org: `girone`, `stato`, `nome`, delete; creator: `nome` until approved, delete while `in attesa partner` |
| `squadra_giocatori` | `squadra_id`, `torneo_id`, `user_id`, `ordine smallint (1,2)` | yes | yes | — (RPC) |
| `inviti` | `token text` PK, `squadra_id`, `torneo_id`, `creato_da` | no | creator and org | org: delete |
| `partite` | `id uuid`, `torneo_id`, `codice text` (unique per tournament), `fase text` (`gironi`/`gold`/`silver`/…), `girone text?`, `turno int?`, `posizione int?`, `prossima_codice text?`, `lato text?` (`A`/`B`), `squadra_a uuid?`, `squadra_b uuid?`, `periodo_id uuid?`, `stato`, `richiesta_id uuid?`, `set jsonb?` (`[{"a":6,"b":4},…]`), `inserito_da uuid?`, `confermato_da uuid?`, `contestato_da uuid?`, `nota_risultato text?`, `updated_at` | yes | yes | — (RPC) |
| `partite_v` (view, preferred read path) | all of `partite` + `giocatori_a uuid[]`, `giocatori_b uuid[]`, `giocatori uuid[]` (A then B, ordered by `ordine`), `prog_campo_id text?`, `prog_data date?`, `prog_inizio time?`, `prog_fine time?` (from the confirmed request) | yes | yes | — |
| `campi` | `id text` PK, `nome`, `primo_slot time`, `ultimo_slot time` (last start), `durata int` (min), `giorni_attivi smallint[]` (0 = Sunday), `eccezioni date[]`, `ordine int` | yes | yes | gestore: CRUD |
| `ricorrenze` | `id uuid`, `campo_id`, `giorno_settimana smallint`, `inizio time`, `fine time`, `tipo`, `nota text`, `dal date`, `al date` | no | yes | gestore: CRUD |
| `occupazioni` | `id uuid`, `campo_id`, `data date`, `inizio time`, `fine time`, `tipo`, `nota text?`, `partita_id?`, `richiesta_id?`, `torneo_id?`, `ricorrenza_id?`, `creato_da uuid?` | no | yes | — (RPC). **EXCLUDE** on `(campo_id, tsrange(data+inizio, data+fine))` |
| `richieste` | `id uuid`, `torneo_id`, `partita_id`, `campo_id`, `data date`, `inizio time`, `fine time`, `fuori_griglia bool`, `controproposta bool`, `stato`, `scadenza timestamptz`, `creato_da uuid`, `gestito_da uuid?`, `nota text?`, `created_at` | no | yes | — (RPC). Unique in `attesa`: `(campo_id, data, inizio)` and `(partita_id)` |
| `richiesta_giocatori` | `richiesta_id`, `user_id`, `accettata_at timestamptz?` | no | yes | — (RPC) |
| `disponibilita` | `torneo_id`, `user_id`, `fasce jsonb` (`{"2026-11-14": ["14:00-19:00"]}`), `updated_at`; PK `(torneo_id, user_id)` | no | yes | own row: upsert/delete |
| `log` | `id bigint`, `chi uuid?`, `cosa text`, `riferimento text`, `quando timestamptz` | no | org | — |

Role helpers (SQL, schema `private`): `has_role(role)` (admin always true), `is_giocatore_partita(partita_id)`.

## RPC (`supabase.rpc(name, args)`)

All are SECURITY DEFINER; `authenticated` only (`email_promemoria` is `service_role` only). Arguments are prefixed `p_`.

| RPC | Arguments | Returns | Who |
|---|---|---|---|
| `create_request` | `p_partita uuid, p_campo text, p_data date, p_inizio time, p_nota text default null` | `uuid` (request id) | one of the 4 players |
| `accept_request` | `p_richiesta uuid` | `void` | a player of the request |
| `cancel_request` | `p_richiesta uuid, p_nota text default null` | `void` | a player (while `attesa`) |
| `confirm_request` | `p_richiesta uuid` | `jsonb {esito: 'ok'\|'occupato'\|'scaduta', conflitti: int}` | gestore |
| `reject_request` | `p_richiesta uuid, p_nota text default null` | `void` | gestore |
| `cancel_confirmed` | `p_richiesta uuid, p_nota text default null` | `void` | gestore |
| `counter_propose` | `p_richiesta uuid, p_campo text, p_data date, p_inizio time, p_nota text default null` | `uuid` (new request) | gestore |
| `add_occupation` | `p_campo text, p_data date, p_inizio time, p_fine time, p_tipo tipo_occupazione, p_nota text default null` | `jsonb {id, conflitti}` | gestore (`tipo` ≠ `campionato`) |
| `remove_occupation` | `p_id uuid` | `void` | gestore (not `campionato`) |
| `close_day` | `p_data date, p_nota text` | `jsonb {errori: text[], conflitti: int}` | gestore |
| `materialize_recurrence` | `p_ricorrenza uuid, p_giorni int default 60` | `jsonb {creati: int, saltati: text[]}` | gestore |
| `submit_result` | `p_partita uuid, p_set jsonb` | `void` | a player |
| `confirm_result` | `p_partita uuid` | `void` | opponent of `inserito_da` |
| `contest_result` | `p_partita uuid, p_nota text` | `void` | opponent of `inserito_da` |
| `set_official_result` | `p_partita uuid, p_set jsonb, p_nota text default null` | `void` | org |
| `assign_forfeit` | `p_partita uuid, p_vincente text ('A'\|'B'), p_nota text default null` | `void` | org |
| `clear_result` | `p_partita uuid` | `void` | org |
| `create_team` | `p_torneo uuid, p_nome text` | `jsonb {squadra_id, token}` | authenticated (tournament in `iscrizioni`) |
| `get_invite` | `p_token text` | `jsonb {squadra_id, torneo_id, nome, creatore_nome, stato, giocatori: int}` or null | authenticated |
| `join_team` | `p_token text` | `uuid` (squadra id) | authenticated |
| `my_invite_token` | `p_squadra uuid` | `text` or null | team creator |
| `generate_calendar` | `p_torneo uuid, p_partite jsonb` (`[{codice, girone, turno, posizione, squadra_a, squadra_b, periodo_id}]`) | `int` | org |
| `generate_finals` | `p_torneo uuid, p_fase text, p_partite jsonb` (`[{codice, turno, posizione, prossima_codice, lato, squadra_a, squadra_b, periodo_id}]`) | `int` | org |
| `sync_bracket` | `p_torneo uuid, p_updates jsonb` (`[{codice, squadra_a, squadra_b}]`) | `int` | org |
| `set_roles` | `p_user uuid, p_roles app_role[]` | `void` | admin |

Server-side rules worth knowing on the client:
- `create_request` / `counter_propose` compute `fuori_griglia`, the off-grid step, `fine = inizio + durata`, the expiry (`config.scadenzaRichiesteOre`), and the **acceptances**. The creator is accepted, and so is any player whose `fasce` covers the slot.
- Lazy expiry: before taking a lock, expired requests on the same slot or match become `scaduta`.
- `confirm_request` never raises on overlap: it returns `esito: 'occupato'` and moves the request to `conflitto`.
- `confirm_result` also cancels any request of that match still in `attesa`.

## Errors

RPCs raise `P0001` with an Italian `message` and a code in `hint`. The client maps by `hint` and falls back to `message`.

| hint | meaning |
|---|---|
| `NOT_AUTHORIZED` | role or ownership missing |
| `NOT_FOUND` | the entity does not exist |
| `BAD_STATE` | invalid state transition |
| `SLOT_TAKEN` | slot already requested or occupied |
| `MATCH_HAS_REQUEST` | the match already has a pending request |
| `OVERLAP` | overlap with an occupation (`message` lists which ones) |
| `NOT_ALL_ACCEPTED` | acceptances < 4/4 |
| `EXPIRED` | request expired |
| `OFF_GRID_DISABLED` / `BAD_STEP` / `COURT_CLOSED` / `IN_PAST` | off-grid / time checks |
| `INVALID_SCORE` | sets not valid (`message` explains) |
| `ALREADY_CONFIRMED` | result already confirmed |
| `TEAM_FULL` / `ALREADY_IN_TEAM` / `BAD_TOKEN` / `REGISTRATION_CLOSED` | teams |
| `CALENDAR_EXISTS` / `BAD_CALENDAR` / `PHASE_EXISTS` / `BAD_BRACKET` | generation |

Postgres errors: `23505` → "Già esistente / slot appena preso", `23P01` (exclusion) → "Campo già occupato in quell'orario", `42501` → "Permessi insufficienti".

## Realtime

Publication `supabase_realtime`: `richieste`, `richiesta_giocatori`, `partite`, `occupazioni`, `squadre`, `disponibilita`. The client only invalidates TanStack Query caches; it never patches data from events.

## Scheduled jobs (pg_cron, when available)

`private.job_scadenze()` every 15', `private.job_ricorrenze(28)` every hour, `private.job_non_giocate()` daily. Emails: GitHub Actions calls `email_promemoria()` with the service role key → `jsonb [{email, nome, righe: text[]}]`.
