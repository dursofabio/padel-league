# Brief: Disponibilità (`/t/:tid/disponibilita`)

Glossary and consolidated assumptions: [README.md](README.md).

## 1. Job and audience

- A player, often 50+, on the phone, sometimes outdoors, usually right after a WhatsApp nudge ("segna le disponibilità") or a `segna-disponibilita` item in Da fare.
- Need: say once, for the whole period, when they can play; nothing about specific matches or opponents. Mode: a short editing session (2–5 minutes) at the start of a period, plus quick fixes later.
- They must understand one rule: a time window that fully covers a slot counts as accepting that slot for all their matches (the server auto-accepts covered players on `create_request`).

## 2. Outcome and proof

- Primary action: add windows (fasce) to days fast, with presets and "copy to every same weekday", then save once.
- Success: within one save the player's matches show 4/4 slots wherever their partners have also filled in; the post-save confirmation says so when it can.
- Data truth: one row per player and tournament in `disponibilita` with `fasce = {"2026-11-14": ["14:00-19:00", …]}`; overlapping or touching windows are merged (existing `aggiungiFascia` logic); past dates are dropped on save.

## 3. Selected direction consequences

- Each day is a row separated by a white court line; the day's windows are drawn on a thin horizontal time rail (08–24) with the 2 courts' slot starts marked as tick lines, so the player sees which grid slots a window covers (the stagger shows as alternating ticks every 30').
- Window chips use the turf-blue selected treatment; removing a chip is an explicit "×" button with a label, not swipe-only.
- Lime only for the "Salva" button in the unsaved-changes bar and for the focused/selected day; presets and "Aggiungi" are secondary.
- No cards per day, no coloured side borders; weekend days are labelled in text, not tinted.

## 4. Scope and anti-goals

- In: period selector, day list (mobile) / week strip (desktop), add range, presets, remove window, copy to same weekday, clear day, unsaved-changes bar, save, WhatsApp "Ricorda al gruppo".
- Out: per-match availability, recurring weekly templates across periods, other players' availability (visible only as aggregated slot states in the match grid).
- Anti-goal: a calendar month view; drag-to-paint grids that are hard on touch and for older users.

## 5. States and realistic ranges

- Periods: 1–4 per tournament (group phase often 1–2 periods of 3–6 weeks; finals one per round, 7–14 days). Days shown: 7–45. Windows per day: 0–3 (typically 1).
- States: no open period ("Nessun periodo aperto"), first time (no row: all days empty, guidance visible), loaded, dirty (unsaved bar), saving, saved, save error, conflict with an edit from another device (Realtime update on `disponibilita` while dirty), offline.
- Days in the past: hidden; today: shown with "oggi".

## 6. Interaction and layout

- **Period selector**: segmented control when ≤ 3 open periods, select otherwise; label "Periodo 2 · 10/11 – 30/11". Default: the earliest open period that contains one of my unscheduled matches, else the earliest open period. Changing period while dirty keeps edits (they are per date, not per period).
- **Add range**: per day, "Aggiungi orario" opens an inline row (not a modal): two time selects "dalle" / "alle" in 30' steps (15' when `passoFuoriGriglia = 15`), plus preset buttons. End ≤ start shows inline error and disables "Aggiungi". Added windows merge with existing ones and the merge is visible ("Unito a 18:00–23:00").
- **Presets**: "Pausa pranzo 12–15", "Pomeriggio 14–18:30", "Sera 18–23", "Tutto il giorno 8–23"; one tap adds to that day.
- **Copy to same weekday**: on a day with windows, "Copia su tutti i sabati" replaces the windows on the other Saturdays of the selected period; a toast with "Annulla" restores the previous state (client-side, before save).
- **Clear day**: "Svuota" removes all windows of the day; undo via toast.
- **Unsaved-changes bar**: appears when dirty, sticky at the bottom (above the tab bar on mobile): "Modifiche non salvate (3 giorni)" + lime "Salva" + "Annulla modifiche". Leaving the route while dirty shows an AlertDialog ("Esci senza salvare?"); closing the tab triggers the browser prompt.
- **Saved feedback**: "Disponibilità salvate." If computable from cached match data: "Ora hai 3 orari 4/4 per Rossi/Bianchi contro Verdi/Neri" with a link to that match.
- **390**: vertical list of days, each row: date ("sab 14/11"), time rail, chips, "Aggiungi orario" and overflow menu (Copia su tutti i sabati, Svuota). Preset buttons wrap in two rows.
- **820**: single list (no multi-column), wider rail with hour labels; presets and actions inline on the row.
- **1440**: week strip: 7 columns (lun–dom) per week of the period, time running top-to-bottom 08–24 with windows as blocks and slot-start tick lines; click a day column to open the add row in a side sheet; keyboard: arrows move between days, Enter opens add. A list toggle ("Vista elenco") keeps the mobile layout available.
- **Accessibility**: each chip is "14:00–19:00, rimuovi" for screen readers; time rail is decorative (`aria-hidden`) because chips carry the same info; the unsaved bar is announced once when it appears.
- **Conflict**: if a Realtime update arrives while dirty, show inline notice "Hai modificato le disponibilità da un altro dispositivo" with "Usa quelle salvate" / "Tieni le mie"; saving keeps the local version (last write wins, upsert).

## 7. Italian microcopy

- Title: "Le mie disponibilità". Intro (one line): "Segna quando puoi giocare. Vale per tutte le tue partite del periodo e conta già come accettazione degli orari che copre."
- Buttons: "Aggiungi orario", "Aggiungi", "Copia su tutti i sabati", "Svuota", "Salva", "Annulla modifiche", "Ricorda al gruppo".
- Labels: "dalle", "alle", "oggi", "Nessun orario".
- Empty (no period): "Non c'è un periodo di gioco aperto. Quando l'organizzatore apre il prossimo, lo trovi qui."
- First time: "Inizia dai giorni in cui giochi di solito, poi usa «Copia su tutti i …»."
- Errors: "L'orario di fine deve venire dopo quello di inizio." · "Non sono riuscito a salvare. Le modifiche sono ancora qui: riprova." · "Sei offline: salva quando torna la connessione."
- WhatsApp: "Segna le tue disponibilità per Periodo 2 (10/11–30/11), così troviamo subito un orario: <link>"

## 8. Open decisions / assumptions

- **ASSUNZIONE D1**: Presets are fixed in code (Pausa pranzo 12–15, Pomeriggio 14–18:30, Sera 18–23, Tutto il giorno 8–23); not configurable by the organizer.
- **ASSUNZIONE D2**: Time selects use 30' steps, 15' only when the tournament allows off-grid requests with a 15' step; range 08:00–24:00.
- **ASSUNZIONE D3**: Saving is explicit (one "Salva"), not autosave, because a partial edit would change auto-acceptances immediately.
- **ASSUNZIONE D4**: "Copia su tutti i <giorno>" replaces (does not merge) windows on the same weekday within the selected period only, with client-side undo.
- **ASSUNZIONE D5**: The desktop week strip is a view of the same data; editing in it uses the same add row (in a side sheet), no drag-to-create in v1.
- **ASSUNZIONE D6**: The post-save "N orari 4/4" message is shown only when the match data is already cached; otherwise a plain confirmation.
