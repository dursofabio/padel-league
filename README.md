# Padel League – gestione del campionato di padel

Web app per gestire un campionato di padel a coppie: iscrizioni con link d'invito, fase a gironi
(calendario di Berger), programmazione delle partite tramite incrocio delle disponibilità con la
griglia dei campi, conferma del gestore, risultati con conferma degli avversari, classifiche e fasi
finali Gold/Silver.

- **Frontend:** React + TypeScript + Vite, SPA statica su **GitHub Pages** (hash routing `/#/...`)
- **Dati:** Firebase **Firestore** + **Auth** (email/password e Google), piano **Spark** (gratuito)
- **Logica server:** nessuna Cloud Function. Al suo posto ci sono le Security Rules, la logica client
  (transazioni del gestore) e un job **GitHub Actions** schedulato con Admin SDK

## Funzionalità

| Area | Cosa c'è |
|---|---|
| Ruoli | admin, organizzatore, gestore campo, giocatore, pubblico (senza login). Ruolo in `users/{uid}.role` |
| Squadre | Il primo giocatore crea la coppia e invia il link d'invito (anche via WhatsApp); il partner entra; l'organizzatore approva |
| Gironi | Assegnazione manuale o a sorte, calendario con l'algoritmo di Berger, giornate distribuite tra i periodi |
| Campi | Griglia generata da regola (primo slot, ultimo inizio, durata, giorni attivi, chiusure); slot mai salvati |
| Occupazioni | Timeline giornaliera dei campi sfalsati, occupazioni di qualsiasi durata, chiudi giornata, ricorrenze |
| Disponibilità | Fasce orarie per giorno con preset e "copia su ogni sabato", valide per tutte le partite del periodo |
| Prenotazione | Griglia colorata (verde/giallo/grigio/rosso/blu), richiesta con ID deterministico come lock, conferma del gestore in transazione, rifiuto, controproposta (slot libero più vicino), richieste fuori griglia con accettazione esplicita e impatto sugli slot |
| Risultati | Inserimento set per set, conferma da un avversario, contestazione, risoluzione/tavolino dell'organizzatore |
| Classifiche | Calcolate dal client; catena di spareggio configurabile (punti, scontro diretto, differenza set/game, …, sorteggio) |
| Fasi finali | Anteprima con tagli e tabelloni, risoluzione manuale dei pari merito, qualificazione per posizione o avulsa (media punti), incroci A1–B4/B2–A3 \| B1–A4/A2–B3, bye alle teste di serie, un periodo per turno |
| Capienza | Confronto slot disponibili nel periodo (al netto delle ricorrenze) e partite da giocare |
| Notifiche | Link WhatsApp generati dal client, badge in-app in tempo reale, email via cron |

## Struttura

```
src/
  lib/            logica pura, testata con Vitest
    slots.ts        griglia, incrocio disponibilità, colori, fuori griglia, controproposta, capienza
    berger.ts       calendario round-robin
    results.ts      validazione punteggi (set, super tie-break), statistiche
    standings.ts    classifica con catena di spareggio, classifica avulsa
    bracket.ts      qualificazione, teste di serie, tabellone con bye, avanzamento derivato
  services/       scritture su Firestore (transazioni di richiesta/conferma, occupazioni, risultati, torneo)
  pages/          viste: pubblico, giocatore, gestore, organizzatore, admin
firestore.rules   Security Rules (tutta la sicurezza è qui)
tests/            test delle Security Rules sull'emulatore
scripts/          cron (GitHub Actions) e seed dimostrativo per gli emulatori
.github/workflows deploy su Pages, CI, cron
```

## Messa in produzione

### 1. Progetto Firebase (piano Spark)

1. Crea un progetto su <https://console.firebase.google.com> e aggiungi un'app **Web**: ottieni
   `apiKey`, `authDomain`, `projectId`, `appId`, `messagingSenderId`.
2. **Authentication** → abilita *Email/password* e *Google*. In *Settings → Authorized domains*
   aggiungi `<utente>.github.io`.
3. **Firestore** → crea il database (modalità produzione).
4. Pubblica regole e indici:
   ```bash
   npx firebase login
   npx firebase deploy --only firestore:rules,firestore:indexes --project <projectId>
   ```
5. **App Check** (consigliato): registra l'app con reCAPTCHA v3, imposta la chiave del sito in
   `VITE_APPCHECK_SITE_KEY` e, dopo aver verificato il traffico, attiva l'enforcement su Firestore.
6. **Primo admin:** registrati nell'app, poi dalla console Firestore imposta `users/{tuo uid}.role = "admin"`.
   Da quel momento i ruoli si assegnano dalla pagina *Admin*.
7. Firebase Storage non serve (e sui progetti nuovi richiede il piano Blaze).

### 2. GitHub Pages

1. *Settings → Pages → Source: GitHub Actions*.
2. *Settings → Secrets and variables → Actions → Variables*: crea
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_APPCHECK_SITE_KEY`.
   Sono valori pubblici: la sicurezza dipende solo dalle Security Rules.
3. Ogni push su `main` esegue test, build e deploy (`.github/workflows/deploy.yml`).

### 3. Cron (sostituto delle Cloud Functions)

`.github/workflows/cron.yml` esegue `scripts/cron.mjs`:

| Frequenza | Task |
|---|---|
| ogni ora | `scadenze` (richieste senza risposta → `scaduta`, la partita torna da programmare), `ricorrenze` (materializzazione nei prossimi 28 giorni, idempotente) |
| ogni giorno | `nonGiocate` (segnala nel `log` le partite dei periodi terminati), `email` (promemoria disponibilità, periodi in scadenza, richieste in scadenza) |

Configurazione:
- secret `FIREBASE_SERVICE_ACCOUNT`: JSON di un service account del progetto (*Impostazioni progetto → Account di servizio*);
- secret SMTP facoltativi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (senza SMTP le email sono solo stampate nel log del job);
- variabili `APP_URL` (es. `https://<utente>.github.io/padel-league/`), `TZ` (default `Europe/Rome`) e **`CRON_ENABLED=true`** per attivare le esecuzioni schedulate.

Si può lanciare a mano da *Actions → Cron campionato → Run workflow*, anche in modalità simulazione.

## Sviluppo locale

```bash
npm install
(cd scripts && npm install)

# con gli emulatori Firebase (serve Java 11+)
npm run emulators                      # terminale 1
npm run seed:demo                      # terminale 2: utenti p1..p8@demo.it, org@, gestore@, admin@ (password "password")
VITE_FIREBASE_API_KEY=demo VITE_FIREBASE_PROJECT_ID=demo-padel VITE_FIREBASE_AUTH_DOMAIN=localhost \
VITE_FIREBASE_APP_ID=demo VITE_USE_EMULATORS=1 npm run dev

# oppure contro un progetto reale: copia .env.example in .env.local e compila
```

Test:

```bash
npm test             # logica pura (griglia, Berger, punteggi, classifiche, tabelloni)
npm run test:rules   # Security Rules sull'emulatore Firestore
npm run test:cron    # job schedulato sull'emulatore
```

## Note di implementazione rispetto alle specifiche

- **Array annidati:** Firestore non li ammette, quindi le fasce sono stringhe `"14:00-19:00"`
  (`fasce: { "2026-11-14": ["14:00-19:00"] }`) e i set sono mappe (`set: [{a: 6, b: 4}, …]`, game della coppia A e della coppia B).
- **Richieste:** oltre ai campi previsti salvano `fine` e `giocatori` (letti dalle rules per autorizzare
  accettazioni e conferma). Ogni richiesta ha le sue `accettazioni`: su griglia sono già 4/4 perché la
  disponibilità vale come accettazione; fuori griglia e nelle controproposte accettano esplicitamente
  quelli che non hanno una fascia che copre l'orario. Il gestore conferma solo con 4 su 4.
- **Partite:** salvano anche `giocatoriA`/`giocatoriB` (per verificare nelle rules che la conferma del
  risultato venga dalla coppia avversaria) e `programmazione` (campo, data, orario confermati).
- **Inviti:** i token stanno in `tornei/{id}/inviti/{token}` (leggibili solo conoscendo il token),
  per non renderli pubblici nella collezione delle squadre.
- **Tabellone:** l'avanzamento è derivato dal client. Poiché le rules delle richieste leggono i
  giocatori dalla partita, l'organizzatore usa *Sincronizza tabelloni* per scrivere le coppie qualificate
  nel turno successivo: da quel momento si apre la griglia di prenotazione.
- **Controlli affidati al client fidato:** le rules non possono iterare su array/mappe, quindi le
  sovrapposizioni sono verificate nella transazione del gestore (conferma, nuova occupazione). Le rules
  verificano invece che alla conferma l'occupazione `campionato` sia scritta nello stesso batch e che ci siano tutte le accettazioni.
- **Scadenza pigra:** una richiesta in `attesa` con `scadenza` passata è trattata come libera dal client
  e può essere sovrascritta (consentito dalle rules); il cron la porta a `scaduta`.

## Punti aperti (§15) e scelte di default

I default sono configurabili per torneo dalla pagina *Organizza → Configurazione*:

| Punto | Default attuale |
|---|---|
| Formato e punteggi | 2 set su 3, terzo set super tie-break; 3 punti vittoria, 0 sconfitta, +1 per sconfitta al set decisivo |
| Catena di spareggio | punti, scontro diretto, differenza set, differenza game, sorteggio |
| Scadenza richieste | 48 ore |
| Passo fuori griglia | 30 minuti |
| Periodi dei gironi | uno o più: le giornate si distribuiscono in blocchi consecutivi |
| Partite non giocate | segnalate in *Monitoraggio* e dal cron; l'organizzatore decide (tavolino o risultato) dalla pagina della partita |
| Ritiro di una coppia | stato `ritirata`; i risultati restano, le partite residue si chiudono a tavolino |
| Privacy | i profili (con telefono) sono leggibili dagli utenti autenticati: restringerli agli avversari richiede di spostare i contatti in un documento separato |
| Sostituzioni, finale 3°/4° posto, più circoli | non gestiti |
