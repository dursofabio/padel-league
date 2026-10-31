# Brief: Home "Da fare" (`/`)

Status labels, icons and tones: see the glossary in [README.md](README.md). Assumptions are marked **ASSUNZIONE** and collected in the README.

## 1. Job and audience

- Anyone logged in, on any role mix: a player opening the app from a WhatsApp link on the phone, a court manager at the desk between customers, the organizer at a desktop at night. Same route, same list.
- Arrives with one question: "Does anything need me now?" Visitor mode is check-and-act: glance, do one or two things, leave in under a minute.
- Multi-role users (e.g. gestore who also plays) must not switch "mode" to find their work: the feed merges every role.

## 2. Outcome and proof

- Primary action: complete the most urgent item without leaving the feed when it is a one-tap decision (accept a request, confirm a result, confirm a 4/4 request, approve a team); otherwise one tap opens the exact screen.
- Success: the feed reaches the empty state; nobody wonders "what now?" (Product Principle 3): every item says what is missing, from whom, and until when.
- Product truth: items are derived only from server data (`matches_v`, `richieste` + `request_players`, `disponibilita`, `squadre`, `periodi`) by a pure function, so the feed is identical on every device and testable.

## 3. Selected direction consequences

- Neutral ground; each item is a full-width row separated by a white court line, not a card. No nested containers, no coloured side borders.
- The single lime button sits on the item that needs it; at most one lime button per row, and the topmost actionable row is the only one where lime reads first. Secondary actions are quiet (outline/text).
- Urgency is said in words and an icon ("Scade tra 3 h", `AlarmClock`), plus a time on tabular numerals; never only by colour.
- No eyebrow labels over the list. Section headings, when present ("Urgente", "Da fare", "Per sapere"), are plain headings.
- The turf-blue top bar carries the tournament name; the feed itself does not repeat it.

## 4. Scope and anti-goals

- In: the feed, its three priority groups, inline actions, role filter for multi-role users, empty/loading/error/offline states, realtime refresh (TanStack invalidation on `richieste`, `request_players`, `partite`, `squadre`, `disponibilita`).
- In: `deriveAttention()` in `src/lib/attention.ts` (pure, unit-tested) as the single source for the feed and for tab badges.
- Out: notifications history, read/unread state, chat, settings. No dashboard tiles, no hero numbers, no "statistiche".
- Anti-goal: a list of all my matches (that is `/t/:tid/partite`). The feed shows only what needs attention or is imminent.

## 5. States and realistic ranges

- Player: typically 0–6 items (≤ 9 group matches per period, usually 1–3 open at once). Gestore: 0–15 pending requests on a busy week. Organizer: 0–20 items before aggregation, ≤ 8 after (aggregates per period).
- States: loading (skeleton of 3 rows), empty per role, error (retry), offline (last data + "Sei offline: i dati potrebbero non essere aggiornati"), item action busy, item action failed (inline error under that row), item resolved (row collapses after a short "Fatto" confirmation, announced via `aria-live="polite"`).
- No tournament / not registered: empty state teaches ("Iscrivi la tua coppia" when `stato = iscrizioni`, otherwise "Segui il torneo").

## 6. `deriveAttention` (src/lib/attention.ts)

Pure, synchronous, no I/O, no `Date.now()` inside (time is an input). Returns data only; copy is rendered by the component from `kind` + `refs`.

### Inputs

```ts
type Role = 'admin' | 'organizzatore' | 'gestore' | 'giocatore';

interface AttentionInput {
  now: number;                       // epoch ms
  today: string;                     // 'yyyy-mm-dd' Europe/Rome (passed in, not computed)
  uid: string;
  roles: Role[];                     // admin is NOT implicitly organizer/gestore here
  torneo: { id: string; nome: string; stato: 'iscrizioni' | 'gironi' | 'fasiFinali' | 'concluso';
            fasiGenerate: string[]; fasiFinali: { nome: string }[] } | null;
  periodi: { id: string; fase: string; turno: number | null; inizio: string; fine: string; etichetta: string }[];
  squadre: { id: string; nome: string; stato: 'in attesa partner' | 'da approvare' | 'approvata' | 'ritirata';
             girone: string | null; creatoDa: string; giocatori: string[] }[];
  partite: {                         // rows of matches_v for the tournament
    id: string; codice: string; fase: string; girone: string | null; turno: number | null;
    squadraA: string | null; squadraB: string | null; giocatoriA: string[]; giocatoriB: string[];
    periodoId: string | null; stato: StatoPartita; richiestaId: string | null;
    set: { a: number; b: number }[] | null; inseritoDa: string | null; confermatoDa: string | null;
    contestatoDa: string | null; updatedAt: string;
    prog: { campoId: string; data: string; inizio: string; fine: string } | null;
  }[];
  richieste: {                       // player: requests of own matches; gestore: all 'attesa' + future 'confermata'
    id: string; partitaId: string; campoId: string; data: string; inizio: string; fine: string;
    fuoriGriglia: boolean; controproposta: boolean; stato: StatoRichiesta; scadenza: string; createdAt: string;
    creatoDa: string; giocatori: { userId: string; accettataAt: string | null }[];
  }[];
  mieFasce: Record<string, string[]> | null;   // own disponibilita.fasce for this tournament, null = no row
  promemoriaRisultatoOre?: number;   // default 48 (organizer "results not confirmed" threshold)
}
```

### Output

```ts
type AttentionRole = 'giocatore' | 'gestore' | 'organizzatore';
type Priority = 0 | 1 | 2 | 3;       // 0 Urgente, 1 Da fare, 2 Presto, 3 Per sapere

type AttentionKind =
  // giocatore
  | 'accetta-richiesta' | 'conferma-risultato' | 'inserisci-risultato' | 'segna-disponibilita'
  | 'programma-partita' | 'completa-coppia' | 'richiesta-in-corso' | 'attesa-conferma-avversari'
  | 'coppia-da-approvare' | 'prossima-partita'
  // gestore
  | 'conferma-richiesta' | 'partite-oggi'
  // organizzatore
  | 'risultato-contestato' | 'squadra-da-approvare' | 'partite-in-ritardo' | 'periodo-in-scadenza'
  | 'risultati-non-confermati' | 'passo-torneo';

interface AttentionItem {
  id: string;                         // `${kind}:${refId}` — stable across renders, used as React key
  kind: AttentionKind;
  role: AttentionRole;
  priority: Priority;
  deadline: string | null;            // ISO instant; date-only deadlines become `${date}T23:59` Europe/Rome
  refs: { torneoId: string; partitaId?: string; richiestaId?: string; squadraId?: string; periodoId?: string };
  count?: number;                     // aggregated kinds only
  mancanti?: string[];                // user ids still missing (acceptances / availability)
  motivo?: 'rifiutata' | 'conflitto' | 'scaduta' | 'annullata' | 'in-ritardo';  // programma-partita
  passo?: 'periodi' | 'approva-squadre' | 'gironi' | 'calendario' | 'finali' | 'sincronizza';
  action:
    | { type: 'inline'; rpc: 'accept_request' | 'confirm_result' | 'confirm_request' | 'approve_team'; id: string }
    | { type: 'navigate'; to: string };   // hash route
}

function deriveAttention(input: AttentionInput): AttentionItem[];
function countByRole(items: AttentionItem[]): Record<AttentionRole, number>; // tab badges: priority ≤ 1 only
```

### Rules (one row per kind)

"Mine" = `uid ∈ giocatoriA ∪ giocatoriB`. "Open period" = `fine ≥ today`. "Live request" = `stato = 'attesa'` and `scadenza > now`. A `richiesta` match whose request is not live is treated as `da programmare` (lazy expiry).

| kind | Condition | Base priority | Deadline | Action |
|---|---|---|---|---|
| `accetta-richiesta` | live request of a mine match, my `accettataAt` is null | 1 | `scadenza` | inline `accept_request` |
| `conferma-risultato` | mine, `set` ≠ null, `confermatoDa` null, `stato ≠ contestata`, `inseritoDa` on the other side | 1 | none | inline `confirm_result` |
| `inserisci-risultato` | mine, `stato = programmata`, `set` null, `prog.data + prog.fine < now` | 1 | period end | navigate `/t/:tid/partite/:mid#risultato` |
| `segna-disponibilita` | I have ≥ 1 mine match `da programmare` in an open period P and `mieFasce` has no date in `[max(today, P.inizio), P.fine]` | 1 | P end | navigate `/t/:tid/disponibilita?periodo=P` |
| `programma-partita` | mine, both pairs known, 4 players, effective state `da programmare` | 2; 1 if period ends within 7 days; 0 if period ended (`motivo: 'in-ritardo'`) | period end | navigate `/t/:tid/partite/:mid` |
| `completa-coppia` | my team `in attesa partner` and `creatoDa = uid` | 1 | none | navigate `/t/:tid/coppia` |
| `richiesta-in-corso` | live request of a mine match, I accepted, < 4 accepted | 2 (`mancanti` set) | `scadenza` | navigate match |
| `richiesta-in-corso` | live request, 4/4 accepted (waiting for the court) | 3 | `scadenza` | navigate match |
| `attesa-conferma-avversari` | mine, `set` ≠ null, unconfirmed, `inseritoDa` on my side | 3 | none | navigate match |
| `coppia-da-approvare` | my team `da approvare` | 3 | none | navigate `/t/:tid/coppia` |
| `prossima-partita` | mine, `programmata`, start in `(now, now + 72h]` | 3 | start instant | navigate match |
| `conferma-richiesta` | role gestore, live request, 4/4 accepted | 1 | `scadenza` | inline `confirm_request` if `!fuoriGriglia && !controproposta`, else navigate `/campo?r=:id` |
| `partite-oggi` | role gestore, ≥ 1 `confermata` request with `data = today` (aggregate, `count`) | 3 | none | navigate `/campo/giorno/today` |
| `risultato-contestato` | role org, `stato = contestata` (one per match) | 1 | none | navigate match |
| `squadra-da-approvare` | role org, team `da approvare` | 1 | none | inline `approve_team` |
| `partite-in-ritardo` | role org, per ended period with matches not `giocata`/`tavolino` (`count`) | 1 | none | navigate `/t/:tid/organizza/monitoraggio?periodo=P` |
| `periodo-in-scadenza` | role org, per open period ending within 7 days with `da programmare` matches (`count`) | 2 | period end | same as above |
| `risultati-non-confermati` | role org, results unconfirmed with `updatedAt < now − promemoriaRisultatoOre` (aggregate, `count`) | 2 | none | navigate monitoraggio |
| `passo-torneo` | role org, `prossimoPasso(torneo, …) ≠ null` (shared with Panoramica, see organizzatore brief) | 1 | none | navigate the step's route |

`programma-partita.motivo`: when the most recent request (by `createdAt`) of the match is `rifiutata`, `conflitto`, `scaduta` (or expired `attesa`) or `annullata`, and no newer request exists, set `motivo` to that state so the row can say why ("Il campo ha rifiutato 14:00 di sab 14/11: scegli un altro slot").

### Ordering

1. Promotion: any item with priority 1 or 2 whose `deadline − now ≤ 24 h` becomes priority 0.
2. Sort by `priority` asc, then `deadline` asc (null last), then a fixed kind order (the table order above), then `id` asc. Deterministic: same input, same output.
3. Duplicates are impossible by construction (`id` is unique); one match yields at most one player item (precedence: `accetta-richiesta` > `conferma-risultato` > `inserisci-risultato` > `richiesta-in-corso` > `attesa-conferma-avversari` > `programma-partita` > `prossima-partita`).

### Tests to write

Empty input → `[]`; each kind's positive and negative case; lazy expiry (`attesa` past `scadenza` → `programma-partita` with `motivo: 'scaduta'`); 24 h promotion; multi-role merge order; opponent-side check for `conferma-risultato`; `segna-disponibilita` ignores past dates in `mieFasce`; admin without gestore role gets no gestore items.

## 7. Interaction and layout

- **Row anatomy**: icon (glossary) + one-line title naming the match by pair names ("Rossi/Bianchi contro Verdi/Neri") + one line of what's missing and deadline ("Manca Luca · scade tra 5 h") + action on the right (mobile: below, full-width when lime). Tap on the row body navigates; the button does the inline action. Targets ≥ 44 px.
- **Groups**: "Urgente" (priority 0), "Da fare" (1), "Presto" (2), "Per sapere" (3, max 3 rows then "Mostra altre N"). Headings only for groups that have rows.
- **390**: single column under the turf-blue top bar; bottom tab bar; role filter as a segmented control ("Tutto · Partite · Campo · Organizza") only when the user has ≥ 2 roles, otherwise hidden.
- **820**: same list, max readable width, actions inline right; gestore with tablet layout still lands here first, with "Apri richieste" as the shortcut in the `conferma-richiesta` group heading row.
- **1440**: sidebar navigation; feed as the main column (≈ 720 px measure); right column shows "Prossime partite" (next 3 `programmata`, read-only) only for players. No tiles.
- **Inline action feedback**: button shows busy state; on success the row text changes to the result ("Accettata · ora 3/4") for ~2 s, then the row leaves (motion: height collapse 200 ms, reduced-motion: instant). On `EXPIRED`/`BAD_STATE` the row shows the server message and refreshes.
- **Realtime**: new items slide into their group without moving focus; screen readers get one polite summary ("1 nuova cosa da fare").

## 8. Italian microcopy

- Page title: "Da fare". Groups: "Urgente", "Da fare", "Presto", "Per sapere".
- Rows: "Accetta l'orario proposto" · button "Accetta"; "Conferma il risultato 6-4 3-6 10-7" · "Conferma" / "Contesta"; "Inserisci il risultato" · "Inserisci"; "Segna le tue disponibilità per Periodo 2" · "Segna disponibilità"; "Programma la partita" · "Trova un orario"; "Invita il tuo compagno" · "Invia invito"; "Aspettiamo Luca e Marta · scade tra 20 h" · "Sollecita su WhatsApp"; "Richiesta da confermare" · "Conferma"; "Contestazione da risolvere" · "Risolvi"; "3 partite in ritardo nel Periodo 1" · "Vedi".
- Deadlines: "scade tra 45 min", "scade tra 5 h", "scade domani alle 18:30", "entro sab 14/11", "in ritardo dal 10/11".
- Empty (player): "Niente da fare adesso. Quando qualcuno propone un orario o inserisce un risultato lo trovi qui." + link "Vedi le tue partite".
- Empty (gestore): "Nessuna richiesta da confermare." + "Apri la giornata di oggi".
- Empty (org): "Il torneo procede da solo. Nessuna contestazione e nessuna partita in ritardo."
- Not registered: "Non sei ancora iscritto a questo torneo." + "Iscrivi la tua coppia" (only in `iscrizioni`) or "Segui classifiche e calendario".
- Errors: "Non riesco a caricare le tue cose da fare. Controlla la connessione e riprova." · "Questa richiesta è scaduta nel frattempo: scegli un altro orario dalla partita."

## 9. Open decisions / assumptions

- **ASSUNZIONE H1**: No manual dismissal; an item leaves the feed only when its condition is resolved. "Per sapere" items are capped at 3 visible with "Mostra altre".
- **ASSUNZIONE H2**: Urgency threshold is 24 h before the deadline (promotes to "Urgente"); a period is "in scadenza" when it ends within 7 days.
- **ASSUNZIONE H3**: Players can still request a slot after their period has ended, until the organizer decides (tavolino or result); the item shows "In ritardo".
- **ASSUNZIONE H4**: Confirming an opponent's result inline from the feed is allowed because the full score and pair order are shown in the row; contesting always opens the match.
- **ASSUNZIONE H5**: The gestore can confirm inline from the feed only on-grid, non-counterproposal requests at 4/4; off-grid and counterproposals open the inbox detail to show impact.
- **ASSUNZIONE H6**: The organizer is alerted about unconfirmed results after 48 h from `updated_at` (`promemoriaRisultatoOre`, not yet in `TorneoConfig`; constant until then).
- **ASSUNZIONE H7**: Admin role alone produces no feed items (admin work lives in `/admin/utenti`); `deriveAttention` treats roles literally, unlike SQL `has_role`.
- **ASSUNZIONE H8**: Approving a team inline (`approve_team`) is a direct update of `squadre.stato` allowed to the organizer by the contract; it is not an RPC.
