# Brief: Risultato (block inside `/t/:tid/partite/:mid`, anchor `#risultato`)

Glossary and consolidated assumptions: [README.md](README.md). Lives in states S5–S8 of [programma-partita.md](programma-partita.md).

## 1. Job and audience

- **Entering**: one of the 4 players, right after the match, often on the court bench, sweaty, phone in one hand, sometimes in sunlight. Needs to type 2–3 sets correctly in under 30 seconds without confusing which pair is which.
- **Confirming**: an opponent (the other pair of the inserter), later the same day, often from a Da fare item or WhatsApp link. Needs to verify the score at a glance and confirm, or contest with a reason.
- **Resolving**: the organizer, at a desktop, for contested or stuck matches: sets the official result, assigns a forfeit (tavolino), or clears a result.

## 2. Outcome and proof

- Primary actions: "Invia risultato" (player), "Conferma risultato" (opponent), "Imposta risultato ufficiale" / "Assegna tavolino" (organizer).
- Success: zero invalid submissions reach the server (live validation with `validaRisultato` and `config.formatoSet`); no pair-order mistakes because pair names label every column; standings update immediately after confirmation (Realtime on `partite`).
- Product truth: only `giocata`/`tavolino` results count; the inserter's own pair cannot confirm; `confirm_result` also cancels any pending request of that match.

## 3. Selected direction consequences

- Score entry is a compact table: one row per set, two columns headed by the pair names (Rossi/Bianchi | Verdi/Neri), separated by a vertical white court line like the net; set rows separated by horizontal court lines. No cards.
- Numbers on tabular numerals, large (the score is the content). The winning game count per set gains weight, not colour.
- Lime only for the submit/confirm button and the focused stepper; "Contesta" is a quiet destructive-toned secondary.
- Validation messages appear inline under the set row with `TriangleAlert` + text; never a red-only cell.

## 4. Scope and anti-goals

- In: per-set steppers with numeric input, super tie-break row when configured, live validation and winner preview, submit, correct (inserter side, before confirmation), confirm, contest with reason, dispute view, organizer tools (official result, forfeit A/B, clear).
- Out: point-by-point scoring, statistics per player, photos of the scoreboard, comments thread.
- Anti-goal: free-text score field; a modal for entering scores.

## 5. States and realistic ranges

- Formats: `setPerVincere` 1–3 (default 2 → max 3 sets); `superTieBreak` on/off (default on: decisive set to 10, by 2). Normal set games 0–7; super tie-break 0–~20.
- States: not yet playable (S4, collapsed "Dopo la partita potrai inserire il risultato"), empty entry, partial (incomplete match: submit disabled with reason), valid (winner preview), submitting, submitted/awaiting confirmation, confirmed (`giocata`), contested (`contestata`), forfeit (`tavolino`), organizer-cleared (back to the open state), error.

## 6. Interaction and layout

- **Steppers**: each cell is a number with "−" and "+" buttons (≥ 44 px) and the number itself is an input (`inputMode="numeric"`); tapping the number selects it for typing. Min 0; max 7 (normal) / 30 (super tie-break).
- **Rows**: "Set 1", "Set 2", then "Set 3" or "Super tie-break" (when `superTieBreak` and the set is decisive). The third row appears only when the first two sets are split; if the match is already decided after two sets, it stays hidden.
- **Live validation** (on each change, debounced to blur for typed input): per-row messages from `validaRisultato` ("Set 2: punteggio non valido (6-0…6-4, 7-5, 7-6)"; "Super tie-break a 10, con 2 punti di scarto"); global: "La partita non è ancora conclusa".
- **Winner preview** under the table: "Vincono Rossi/Bianchi 2 set a 1" with `Trophy` icon; this is the last thing read before the button.
- **Submit**: lime "Invia risultato" → state S6b. Inserter side sees "Aspettiamo la conferma di Verdi o Neri" + "Correggi risultato" (re-opens entry prefilled) + "Sollecita su WhatsApp" ("Ho inserito il risultato 6-4 3-6 10-7, confermate qui → <link>").
- **Confirm (opponent)**: the score shown large with pair names, "Inserito da Marco Rossi, sab 14/11 alle 19:10". Lime "Conferma risultato"; secondary "Non è corretto". "Non è corretto" expands inline (not a modal) a required reason field and "Invia contestazione" (destructive tone); explains "Il risultato passa all'organizzatore, che deciderà."
- **Contested**: both pairs see the score as entered, the reason, who contested, and "La decide l'organizzatore". No actions for players.
- **Final**: "Risultato: 6-4 3-6 10-7 · vincono Rossi/Bianchi" + "Confermato da Luca Verdi" or "Deciso dall'organizzatore: <nota>" or "Tavolino: vince Verdi/Neri".
- **Organizer tools**: a section "Strumenti organizzatore" (heading, below the player block, separated by a court line; visible only to org). Contains: the same set table prefilled with the entered score; "Nota" field; lime "Imposta risultato ufficiale"; "Assegna tavolino" with a segmented choice of the winning pair (names, not A/B) and confirm via AlertDialog; "Cancella risultato" (AlertDialog, destructive) which returns the match to its open state. On contested matches this section is expanded and placed first for the org.
- **390**: the set table spans the width; pair names wrap to two lines above their columns; steppers stacked "−  6  +" horizontally per cell; sticky submit at the bottom when the keyboard is closed.
- **820/1440**: table at a fixed comfortable width (not full bleed); organizer tools to the right of the player block on 1440 when the match is contested.
- **Accessibility**: each stepper has a label "Set 1, game di Rossi/Bianchi"; changes announce the new value; validation messages are linked with `aria-describedby`; the winner preview is a polite live region.

## 7. Italian microcopy

- "Inserisci il risultato", "Set 1", "Set 2", "Super tie-break", "Invia risultato", "Correggi risultato", "Conferma risultato", "Non è corretto", "Motivo (obbligatorio)", "Invia contestazione", "Strumenti organizzatore", "Imposta risultato ufficiale", "Assegna tavolino", "Vince", "Cancella risultato".
- Helper: "Scrivi i game nell'ordine: prima Rossi/Bianchi, poi Verdi/Neri. Vale dopo la conferma di un avversario."
- Waiting: "Aspettiamo la conferma di Verdi o Neri." · Dispute: "Contestato da Luca Verdi: «Il secondo set era 6-3». Ora decide l'organizzatore."
- Errors: `INVALID_SCORE`: server message verbatim; `ALREADY_CONFIRMED`: "Il risultato è già stato confermato."; `BAD_STATE`: "La partita è cambiata nel frattempo: ricarico."; `NOT_AUTHORIZED` (own pair tries to confirm): "Deve confermare un giocatore dell'altra coppia."
- AlertDialogs: "Assegnare il tavolino a Verdi/Neri? Il risultato diventa ufficiale." → "Assegna tavolino" / "Annulla"; "Cancellare il risultato? La partita torna da giocare." → "Cancella risultato" / "Tieni".

## 8. Open decisions / assumptions

- **ASSUNZIONE R1**: Stepper ranges: 0–7 for normal sets, 0–30 for the super tie-break; typed values outside are rejected inline.
- **ASSUNZIONE R2**: Result entry is available in `da programmare`, `richiesta` and `programmata`; for a `programmata` match it is collapsed until the scheduled start time.
- **ASSUNZIONE R3**: The inserter's pair can correct the result (new `submit_result`) until an opponent confirms or contests.
- **ASSUNZIONE R4**: A contest requires a non-empty reason.
- **ASSUNZIONE R5**: The forfeit score is decided by the server (`assign_forfeit`); the UI only picks the winning pair and shows the resulting score afterwards.
- **ASSUNZIONE R6**: There is no automatic confirmation after a timeout; the organizer is alerted instead (see H6).
