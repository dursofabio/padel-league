# Brief: Organizzatore, admin, profilo, coppia e invito

Routes: `/t/:tid/organizza/{panoramica,configurazione,periodi,squadre,calendario,monitoraggio,finali}`, `/admin/utenti`, `/profilo`, `/t/:tid/coppia`, `/invito/:token`. Glossary and consolidated assumptions: [README.md](README.md).

## 1. Job and audience

- **Organizer**: one volunteer, at a desktop in the evening, sometimes checking from the phone at the club. Sets up the tournament once, then intervenes on exceptions (late matches, disputes, ties) and runs the phase changes. Not a power user of admin software; needs to be told the next step.
- **Admin**: assigns roles a few times per season. **Every user**: edits name, phone and theme in Profilo. **Players**: create a pair and invite the partner (Coppia, Invito), usually on the phone via WhatsApp.

## 2. Outcome and proof

- Organizer primary action at any moment: the single next step on Panoramica ("Approva 3 coppie", "Genera il calendario", "Genera le fasi finali"), plus resolving exceptions surfaced in Monitoraggio and in Da fare.
- Success: the season runs from registrations to finals without the organizer reading docs; irreversible generations always show a preview first; capacity problems are seen before the calendar is generated.
- Product truth: generations are RPCs (`generate_calendar`, `generate_finals`, `sync_bracket`) fed by client-side pure logic (`berger.ts`, `bracket.ts`), and fail with `CALENDAR_EXISTS`/`PHASE_EXISTS`/`BAD_*` if repeated or invalid.

## 3. Selected direction consequences

- Desktop: turf-blue sidebar with the app sections; organizer sub-sections as a second-level list in the sidebar (not tabs over content). Content on the neutral ground, sections separated by court lines; forms in single columns with clear section headings (no eyebrows, no cards around fieldsets).
- **Phase stepper**: a horizontal sequence of steps drawn as a court line with stops; done steps `Check`, current step turf-blue with its name in bold, future steps muted; each stop has its text label. Not numbered "01/02".
- Lime only for the single next action on Panoramica and for the primary button of each form; destructive and irreversible actions use AlertDialog.
- Data (capacity, counts) as text with icons and tone, never progress rings or sparklines.

## 4. Scope and anti-goals

- In: all routes listed above, their empty/locked states, previews before generation, manual tie resolution, role management, theme selector.
- Out: multi-tournament management UI (one active tournament), multi-club, substitutes, 3rd/4th place final, email template editing, data export.
- Anti-goal: a dashboard of KPI tiles; one giant settings form with a single save at the bottom of a 3-screen page.

## 5. States and realistic ranges

- 20–24 pairs (40–48 players), 2 groups (1–4 supported), 90 group matches + 14 finals, 1–4 periods, tie-break chain of up to 7 criteria, final phases 1–3 (Gold, Silver) with 4–16 places.
- Tournament `stato`: `iscrizioni`, `gironi`, `fasiFinali`, `concluso`. Locks: groups and calendar locked after calendar generation; set format locked once any result exists.

## 6. Interaction and layout, per screen

### Panoramica

- Phase stepper: Configurazione · Periodi · Squadre · Gironi · Calendario · Partite dei gironi · Fasi finali · Concluso.
- **One next action** below it, from `prossimoPasso(torneo, periodi, squadre, partite)` (pure, in `src/lib/attention.ts`, shared with Da fare): first match wins — no group-phase period → `periodi` ("Aggiungi il periodo dei gironi"); teams `da approvare` → `approva-squadre` ("Approva 3 coppie"); approved teams without group → `gironi` ("Componi i gironi"); no group matches → `calendario` ("Genera il calendario"); groups concluded and phases not generated → `finali` ("Genera le fasi finali"); generated brackets whose derived pairs differ from stored ones → `sincronizza` ("Aggiorna i tabelloni"); else none ("Tutto in ordine").
- Below: exceptions summary as text rows linking to Monitoraggio ("2 contestazioni", "5 partite in ritardo nel Periodo 1", "3 risultati da confermare da più di 2 giorni").

### Configurazione

- Sections with headings: "Torneo" (nome), "Punteggi" (vittoria, sconfitta, bonus sconfitta al set decisivo), "Formato" (set per vincere, set decisivo a super tie-break), "Spareggi", "Fasi finali" (criterio; list of phases with nome + posti, add/remove), "Prenotazioni" (consenti fuori griglia, passo 15/30, scadenza richieste in ore).
- **Tie-break reorder**: an ordered list; each row has the criterion name and buttons "Sposta su" (`ArrowUp`), "Sposta giù" (`ArrowDown`), "Rimuovi" (`X`), all labelled for screen readers ("Sposta su: differenza set"); "Aggiungi criterio" select below with the unused ones. Focus stays on the moved item; a polite announcement says the new position ("Differenza set ora è 3ª"). "Punti" stays first and cannot be removed.
- Unsaved-changes bar (same pattern as Disponibilità) with lime "Salva configurazione". Locked fields show `Lock` + reason ("Bloccato: ci sono già risultati").
- Changing scoring or tie-breaks mid-season shows an inline note: "Le classifiche si ricalcolano subito con le nuove regole."

### Periodi

- List rows: "Periodo 1 · Gironi · 06/10 – 09/11" + capacity line: icon + tone + text, e.g. `CircleCheck` "Capienza buona: 45 partite, servono 8 slot a settimana, ce ne sono 70 (al netto delle ricorrenze)"; `TriangleAlert` "Margine stretto (2,1×): allunga il periodo o libera slot"; `OctagonAlert` "Capienza insufficiente (1,2×)".
- Add/edit in a side sheet: fase (Gironi / Gold / Silver), turno (finals), dal, al, etichetta (auto "Periodo 2" if empty). Delete via AlertDialog; blocked with reason when matches reference the period.

### Squadre

- Table (desktop) / list (mobile): Coppia, Giocatori, Stato (glossary label+icon), Girone, actions. Filter chips by stato with counts; "Da approvare" first.
- Inline: "Approva" (lime only on the first row needing it, secondary elsewhere), girone select (A/B/…; disabled after calendar), rename, "Elimina" before calendar (AlertDialog), "Ritira" after calendar (AlertDialog: "I risultati restano. Le partite residue si chiudono a tavolino dalle singole partite.").
- **Compose groups**: "Componi i gironi" opens a preview panel: number of groups, method "A sorte" (only method in v1); preview shows groups as side-by-side lists with counts; "Rimescola" reshuffles; "Conferma gironi" writes `girone` for each approved team. Manual tweaks remain possible afterwards via the select.

### Calendario

- Preconditions listed with check/cross icons: "20 coppie approvate in 2 gironi", "Gironi bilanciati (10 e 10)", "Periodo dei gironi presente", "Capienza sufficiente".
- Preview: per group "45 partite in 9 giornate"; distribution "Giornate 1–5 nel Periodo 1, 6–9 nel Periodo 2"; first matchday listed. Lime "Genera il calendario" → AlertDialog "Generare 90 partite? Dopo non potrai più cambiare i gironi." → result "90 partite create" + link to the public calendar.

### Monitoraggio

- Sections in priority order: "Contestazioni" (rows → match page with organizer tools open), "Partite in ritardo" (period ended, not played; actions: open match, "Scrivi alla coppia" WhatsApp), "Risultati da confermare" (age), "Da programmare" per open period with counts by state as a text list with glossary icons ("da programmare 12 · richiesta inviata 4 · programmata 9 · giocata 20").
- Filters: periodo, girone, stato. Desktop: table; mobile: rows.

### Finali

- Locked notice if groups are not concluded: "L'anteprima è provvisoria: mancano 6 partite dei gironi." Generation disabled with that reason.
- Per group: final standings with the cut line (as in public standings). **Ties**: rows in `pariMerito` grouped with a note and "Sposta su"/"Sposta giù" buttons within the tied block only; "Salva ordine (sorteggio)" stores `tornei.sorteggio`; "Azzera".
- Per phase: "Gold: 8/8 posti" with seeds ("1. A1 Rossi/Bianchi …"), bracket preview (same component as public, read-only), excluded pairs. Bye notice when places are not filled.
- Lime "Genera le fasi finali" (disabled until no unresolved ties) → AlertDialog listing what will be created ("14 partite: Gold 7, Silver 7"). After generation: "Aggiorna i tabelloni" (`sync_bracket`) with result "3 partite aggiornate: ora si possono programmare".

### Admin (`/admin/utenti`)

- Search by name/email; list rows: nome, email, telefono, role checkboxes "Giocatore · Gestore · Organizzatore · Admin". "Giocatore" always checked and disabled (roles ≥ {giocatore}). Each change saves immediately (`set_roles`) with row-level busy state and a toast "Ruoli di Marta aggiornati" + "Annulla" (re-sends the previous roles). Own "Admin" checkbox disabled with reason.

### Profilo (`/profilo`)

- Fields: "Nome e cognome", "Telefono" (hint: "Serve per i messaggi WhatsApp tra giocatori. Formato +39…"), email read-only, roles as text ("Sei: giocatore, gestore"). Lime "Salva".
- **Tema**: segmented control "Chiaro · Scuro · Come il dispositivo" (default the latter), applied instantly, no save needed.
- "Esci" at the bottom (secondary).

### Coppia (`/t/:tid/coppia`)

- No team, registrations open: "Iscrivi la tua coppia" — field "Nome della coppia", lime "Crea la coppia" (`create_team`) → invite state.
- `in attesa partner` (creator): invite link shown in a read-only field with "Copia link" and lime "Invia su WhatsApp" ("Ciao! Ti ho iscritto con me al <torneo> come coppia «<nome>». Entra qui → <link>"); "Rinomina"; "Elimina la coppia" (AlertDialog).
- `da approvare`: "Tu e Luca siete iscritti. Manca l'approvazione dell'organizzatore." Rename allowed.
- `approvata`: pair, girone, partner phone (WhatsApp link), next step "Segna le tue disponibilità".
- `ritirata`: notice, no actions. Registrations closed and no team: "Le iscrizioni sono chiuse."

### Invito (`/invito/:token`)

- Logged out: "Luca ti ha invitato nella coppia «I Bomber» per <torneo>." + "Accedi" / "Registrati"; after auth returns here.
- Valid: same sentence + lime "Entra nella coppia" (`join_team`) → redirect to `/t/:tid/coppia` with "Sei nella coppia «I Bomber»".
- Errors: `BAD_TOKEN`/null "Questo invito non è valido. Chiedi a chi te l'ha mandato un link nuovo." · `TEAM_FULL` "La coppia è già completa." · `ALREADY_IN_TEAM` "Sei già in una coppia di questo torneo." + link · `REGISTRATION_CLOSED` "Le iscrizioni sono chiuse."

### Breakpoints

- **1440**: sidebar + content (max ~960 px for forms, full width for tables).
- **820**: collapsible sidebar; tables become lists with key columns.
- **390**: organizer pages reachable from the "Torneo"/"Altro" tab as a list ("Organizza"); Panoramica, Squadre (approve) and Monitoraggio are fully usable; Configurazione and Finali work but are flagged "Meglio da computer" (not blocked).

## 7. Italian microcopy

- Buttons: "Approva", "Componi i gironi", "Rimescola", "Conferma gironi", "Genera il calendario", "Genera le fasi finali", "Aggiorna i tabelloni", "Salva configurazione", "Aggiungi periodo", "Aggiungi criterio", "Sposta su", "Sposta giù", "Rimuovi", "Salva ordine", "Ritira", "Crea la coppia", "Invia su WhatsApp", "Copia link", "Entra nella coppia", "Salva", "Esci".
- Empty: squadre "Nessuna coppia iscritta. Condividi il link del torneo nel gruppo WhatsApp." · monitoraggio "Nessuna partita in ritardo e nessuna contestazione." · periodi "Nessun periodo: aggiungine uno per dare una scadenza alle partite."
- Errors: `CALENDAR_EXISTS` "Il calendario esiste già." · `BAD_CALENDAR` "Il calendario non è valido: <messaggio>." · `PHASE_EXISTS` "Questa fase è già stata generata." · `BAD_BRACKET` "Il tabellone non è valido: <messaggio>." · `NOT_AUTHORIZED` "Serve il ruolo di organizzatore."

## 8. Open decisions / assumptions

- **ASSUNZIONE O1**: The organizer cannot write `tornei.stato` directly (not in the contract's writable columns); phase changes happen inside `generate_calendar` / `generate_finals`. Closing registrations and marking the tournament `concluso` need a backend decision (new RPC or contract change).
- **ASSUNZIONE O2**: Groups are composed at random only (with preview and reshuffle); no seeded/snake draw in v1.
- **ASSUNZIONE O3**: Matchdays are distributed across group periods in consecutive blocks, as in the current logic.
- **ASSUNZIONE O4**: Capacity thresholds stay as today: ≥ 3 slots per match = good, 1.5–3 = tight, < 1.5 = insufficient.
- **ASSUNZIONE O5**: Scoring and tie-break chain stay editable during the season (standings recompute); set format locks once any result exists.
- **ASSUNZIONE O6**: An admin cannot remove their own admin role; `giocatore` is always kept.
- **ASSUNZIONE O7**: The theme preference is stored per device (local storage), not in `profiles`.
- **ASSUNZIONE O8**: The team creator can rename the pair until it is approved; only while `in attesa partner` can they delete it.
- **ASSUNZIONE O9**: The phone number is optional; WhatsApp links fall back to "choose a contact" when it is missing.
- **ASSUNZIONE O10**: Organizer screens are usable on mobile but optimised for desktop; nothing is blocked by screen size.
