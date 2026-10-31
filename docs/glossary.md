# Glossary: Italian UI ↔ English code

**Rule:** code, database, comments, tests, scripts, logs and docs are in English. Italian appears only in what the user sees: UI copy, user-facing error messages, emails, the PWA manifest and URL paths (`/#/t/:tid/partite`, kept Italian because they are visible and shared).

When a new concept appears, add it here first, then name it in code.

## Domain terms

| Italian (UI) | Code (TS: camelCase / PascalCase, SQL: snake_case) | Notes |
|---|---|---|
| torneo, campionato | tournament | |
| coppia, squadra | team | a pair of two players |
| giocatore | player | |
| partita | match | |
| girone | group | SQL column `group_name` (`group` is reserved) |
| fase a gironi | phase `groups` | |
| fase finale, finali | finals, final phase | phase names `gold`, `silver` (lowercase) |
| tabellone | bracket | |
| turno | round | |
| periodo | period | date window in which a round must be played |
| calendario (gironi) | schedule | Berger round robin; RPC `generate_calendar` |
| classifica | standings | |
| classifica avulsa | cross-group ranking | qualification rule `crossGroup` |
| sorteggio | draw | tie broken by lot |
| spareggio | tiebreaker | |
| scontro diretto | head-to-head | |
| risultato | result | |
| set / game | set / game | |
| set decisivo | deciding set | |
| a tavolino | forfeit | |
| campo | court | |
| gestore (del campo) | manager (court manager) | role `manager` |
| organizzatore | organizer | role `organizer` |
| slot / griglia | slot / grid | |
| fuori griglia | off-grid | |
| occupazione | booking | anything that occupies a court: match, lesson, closure, external |
| ricorrenza | recurrence | recurring booking (weekly lesson) |
| lezione | lesson | |
| chiusura | closure | |
| richiesta (di campo) | request | match slot request, needs 4/4 acceptances |
| accettazione | acceptance | |
| controproposta | counter-proposal | |
| scadenza | expiry, `expires_at` | |
| disponibilità | availability | |
| fascia (oraria) | window (time window) | `"hh:mm-hh:mm"` string |
| invito | invite | |
| Da fare | to-do feed (`attention`) | `src/lib/attention.ts` |
| prossimo passo | next step | |
| giornata (vista gestore) | day | |
| promemoria | reminder | |
| esito | outcome | |
| impostazioni | settings | |
| panoramica | overview | |
| monitoraggio | monitoring | |

## Enums (database and TypeScript)

| enum | Italian (old value / UI label) → code value |
|---|---|
| `app_role` | admin → `admin`, organizzatore → `organizer`, gestore → `manager`, giocatore → `player` |
| `tournament_status` | iscrizioni → `registration`, gironi → `groups`, fasiFinali → `finals`, concluso → `completed` |
| `team_status` | in attesa partner → `awaiting_partner`, da approvare → `pending_approval`, approvata → `approved`, ritirata → `withdrawn` |
| `match_status` | da programmare → `unscheduled`, richiesta → `requested`, programmata → `scheduled`, giocata → `played`, contestata → `disputed`, tavolino → `forfeit` |
| `request_status` | attesa → `pending`, confermata → `confirmed`, rifiutata → `rejected`, annullata → `cancelled`, conflitto → `conflict`, scaduta → `expired` |
| `booking_type` | esterno → `external`, lezione → `lesson`, chiusura → `closure`, campionato → `match` |

Italian labels for every enum value live in the UI layer (label maps), never in the stored value.

## Database schema

Tables (old → new) and columns. Unlisted columns (`id`, `email`, `roles`, `config`, `token`, `user_id`, `created_at`, `updated_at`) keep their name.

| Old table | New table | Columns (old → new) |
|---|---|---|
| `profiles` | `profiles` | nome → `name`, telefono → `phone` |
| `tornei` | `tournaments` | nome → `name`, stato → `status`, sorteggio → `draw`, fasi_generate → `generated_phases` |
| `periodi` | `periods` | torneo_id → `tournament_id`, fase → `phase`, turno → `round`, inizio → `starts_on`, fine → `ends_on`, etichetta → `label` |
| `squadre` | `teams` | torneo_id → `tournament_id`, nome → `name`, girone → `group_name`, stato → `status`, creato_da → `created_by` |
| `squadra_giocatori` | `team_players` | squadra_id → `team_id`, torneo_id → `tournament_id`, ordine → `position` |
| `inviti` | `invites` | squadra_id → `team_id`, torneo_id → `tournament_id`, creato_da → `created_by` |
| `campi` | `courts` | nome → `name`, primo_slot → `first_slot`, ultimo_slot → `last_slot`, durata → `slot_minutes`, giorni_attivi → `active_days`, eccezioni → `closed_dates`, ordine → `sort_order` |
| `partite` | `matches` | torneo_id → `tournament_id`, codice → `code`, fase → `phase`, girone → `group_name`, turno → `round`, posizione → `position`, prossima_codice → `next_code`, lato → `side`, squadra_a → `team_a`, squadra_b → `team_b`, periodo_id → `period_id`, stato → `status`, richiesta_id → `request_id`, set → `sets`, inserito_da → `entered_by`, confermato_da → `confirmed_by`, contestato_da → `disputed_by`, nota_risultato → `result_note` |
| `ricorrenze` | `recurrences` | campo_id → `court_id`, giorno_settimana → `weekday`, inizio → `start_time`, fine → `end_time`, tipo → `type`, nota → `note`, dal → `valid_from`, al → `valid_to` |
| `richieste` | `requests` | torneo_id → `tournament_id`, partita_id → `match_id`, campo_id → `court_id`, data → `date`, inizio → `start_time`, fine → `end_time`, periodo → `time_range`, fuori_griglia → `off_grid`, controproposta → `counter_proposal`, stato → `status`, scadenza → `expires_at`, creato_da → `created_by`, gestito_da → `handled_by`, nota → `note` |
| `richiesta_giocatori` | `request_players` | richiesta_id → `request_id`, accettata_at → `accepted_at` |
| `occupazioni` | `bookings` | campo_id → `court_id`, data → `date`, inizio → `start_time`, fine → `end_time`, periodo → `time_range`, tipo → `type`, nota → `note`, partita_id → `match_id`, richiesta_id → `request_id`, torneo_id → `tournament_id`, ricorrenza_id → `recurrence_id`, creato_da → `created_by` |
| `disponibilita` | `availability` | torneo_id → `tournament_id`, fasce → `windows` |
| `log` | `audit_log` | chi → `actor_id`, cosa → `action`, riferimento → `target`, quando → `created_at` |

Views:

| Old | New | Extra columns |
|---|---|---|
| `partite_v` | `matches_v` | giocatori_a → `players_a`, giocatori_b → `players_b`, giocatori → `players`, prog_campo_id → `sched_court_id`, prog_data → `sched_date`, prog_inizio → `sched_start`, prog_fine → `sched_end` |
| `giocatori_pubblici` | `public_players` | `id`, `name` |

RPC parameters: `p_partita` → `p_match`, `p_campo` → `p_court`, `p_data` → `p_date`, `p_inizio` → `p_start`, `p_fine` → `p_end`, `p_nota` → `p_note`, `p_richiesta` → `p_request`, `p_tipo` → `p_type`, `p_ricorrenza` → `p_recurrence`, `p_giorni` → `p_days`, `p_set` → `p_sets`, `p_vincente` → `p_winner`, `p_torneo` → `p_tournament`, `p_nome` → `p_name`, `p_squadra` → `p_team`, `p_partite` → `p_matches`, `p_fase` → `p_phase`, `p_stato` → `p_status`. Public RPC names are already English and stay, except `email_promemoria` → `reminder_emails`. Private helper functions get English names too (e.g. `private.oggi` → `private.today`, `private.ora_locale` → `private.local_now`, `private.minuti` → `private.minutes`).

Error codes (`private.fail` HINT) are already English and stay. Their messages are user-facing and stay Italian.

## Tournament config (jsonb `tournaments.config`, TS `TournamentConfig`)

| Old key | New key |
|---|---|
| puntiVittoria | `pointsWin` |
| puntiSconfitta | `pointsLoss` |
| puntiSconfittaSetDecisivo | `pointsLossDecidingSet` |
| formatoSet `{ setPerVincere, superTieBreak }` | `setFormat` `{ setsToWin, superTieBreak }` |
| spareggi | `tiebreakers`: punti → `points`, scontroDiretto → `headToHead`, diffSet → `setDiff`, diffGame → `gameDiff`, setVinti → `setsWon`, gameVinti → `gamesWon`, sorteggio → `draw` |
| criterioQualificazione | `qualificationRule`: perPosizione → `byPosition`, avulsa → `crossGroup` |
| fasiFinali `[{ nome, posti }]` | `finals` `[{ name, spots }]` |
| consentiFuoriGriglia | `allowOffGrid` |
| passoFuoriGriglia | `offGridStep` |
| scadenzaRichiesteOre | `requestExpiryHours` |
| annullamentoGiocatoreOre | `playerCancelHours` |

## Domain types (`src/types.ts`)

| Old | New | Fields (old → new) |
|---|---|---|
| `Role` | `Role` | values as `app_role` |
| `UserProfile` | `UserProfile` | nome → `name`, telefono → `phone` |
| `Spareggio` | `Tiebreaker` | |
| `FormatoSet` | `SetFormat` | |
| `FaseFinaleConfig` | `FinalPhaseConfig` | nome → `name`, posti → `spots` |
| `TorneoConfig` | `TournamentConfig` | see config |
| `StatoTorneo` | `TournamentStatus` | |
| `Torneo` | `Tournament` | nome → `name`, stato → `status`, sorteggio → `draw`, fasiGenerate → `generatedPhases` |
| `StatoSquadra` | `TeamStatus` | |
| `Squadra` | `Team` | nome → `name`, giocatori → `players`, girone → `group`, stato → `status`, creatoDa → `createdBy` |
| `Periodo` | `Period` | fase → `phase`, turno → `round`, inizio → `startsOn`, fine → `endsOn`, etichetta → `label` |
| `StatoPartita` | `MatchStatus` | |
| `SetScore` | `SetScore` | `{ a, b }` |
| `Risultato` | `MatchResult` | set → `sets`, inseritoDa → `enteredBy`, confermatoDa → `confirmedBy`, contestatoDa → `disputedBy`, nota → `note` |
| `Programmazione` | `Schedule` | campoId → `courtId`, data → `date`, inizio → `start`, fine → `end` |
| `Partita` | `Match` | codice → `code`, fase → `phase`, girone → `group`, turno → `round`, posizione → `position`, prossimaPartita → `nextCode`, lato → `side`, squadraA/B → `teamA`/`teamB`, giocatoriA/B → `playersA`/`playersB`, giocatori → `players`, periodoId → `periodId`, stato → `status`, richiestaId → `requestId`, programmazione → `schedule`, risultato → `result` |
| `Campo` | `Court` | nome → `name`, primoSlot → `firstSlot`, ultimoSlot → `lastSlot`, durata → `slotMinutes`, giorniAttivi → `activeDays`, eccezioni → `closedDates`, ordine → `sortOrder` |
| `TipoOccupazione` | `BookingType` | |
| `Occupazione` | `Booking` | inizio → `start`, fine → `end`, tipo → `type`, nota → `note`, partitaId → `matchId`, richiestaId → `requestId`, torneoId → `tournamentId`, ricorrenzaId → `recurrenceId`, creatoDa → `createdBy` |
| `OccupazioneRiga` | `BookingRow` | campoId → `courtId`, data → `date` |
| `OccupazioniGiorno` | `CourtDayBookings` | |
| `Ricorrenza` | `Recurrence` | giornoSettimana → `weekday`, dal → `validFrom`, al → `validTo` |
| `StatoRichiesta` | `RequestStatus` | |
| `Richiesta` | `MatchRequest` | partitaId → `matchId`, fuoriGriglia → `offGrid`, controproposta → `counterProposal`, giocatori → `players`, accettazioni → `acceptances`, scadenza → `expiresAt`, creatoDa → `createdBy`, nota → `note` |
| `Fasce` | `Windows` | |
| `Disponibilita` | `Availability` | torneoId → `tournamentId`, fasce → `windows` |

Time fields on the client: `start` / `end` (`"HH:MM"`), dates `date` (`yyyy-mm-dd`).

## Files

| Old | New |
|---|---|
| `src/app/torneo-corrente.ts` | `src/app/current-tournament.ts` |
| `src/features/public/comune.tsx` | `src/components/common.tsx` (shared by several features) |
| `src/features/gestore/` | `src/features/manager/` |
| `src/lib/fasce.ts` | `src/lib/windows.ts` |
| `src/lib/prossimoPasso.ts` | `src/lib/nextStep.ts` |
| `src/lib/torneo.ts` | `src/lib/tournament.ts` |
| `*/logica.ts`, `*/contesto.ts`, `*/parti.tsx`, `*/tipi.ts`, `*/dati.ts`, `*/contenuto.tsx` | `logic.ts`, `context.ts`, `parts.tsx`, `types.ts`, `data.ts`, `content.tsx` |
| Pages and components | English PascalCase: `AccediPage` → `SignInPage`, `ProfiloPage` → `ProfilePage`, `InvitoPage` → `InvitePage`, `UtentiPage` → `UsersPage`, `TorneoPage` → `TournamentPage`, `ClassifichePage` → `StandingsPage`, `CalendarioPage` → `SchedulePage`, `TabellonePage` → `BracketPage`, `PartitePage` → `MatchesPage`, `PartitaPage` → `MatchPage`, `DisponibilitaPage` → `AvailabilityPage`, `CoppiaPage` → `TeamPage`, `OrganizzaPage` → `OrganizerPage`, `RichiestePage` → `RequestsPage`, `GiornataPage` → `DayPage`, `RicorrenzePage` → `RecurrencesPage`, `ImpostazioniPage` → `SettingsPage`, `DaFare` → `TodoFeed`, `RigaAttenzione` → `AttentionRow`, … |
| `supabase/migrations/*_rpc_prenotazioni.sql`, `*_rpc_occupazioni.sql`, `*_rpc_risultati.sql`, `*_rpc_torneo.sql` | `*_rpc_requests.sql`, `*_rpc_bookings.sql`, `*_rpc_results.sql`, `*_rpc_tournament.sql` |
| `scripts/locale.mjs` (`npm run locale`) | `scripts/local.mjs` (`npm run local`) |
| `docs/contratto-api.md` | `docs/api-contract.md` |
