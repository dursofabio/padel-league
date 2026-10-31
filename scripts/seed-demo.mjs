/**
 * Dati dimostrativi per un progetto Supabase (locale o hosted), via service role.
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=... npm run seed:demo
 *
 * Utenti: admin@demo.it, org@demo.it, gestore@demo.it, p1@demo.it … p40@demo.it (20 coppie in 2 gironi),
 * password DEMO_PASSWORD (obbligatoria fuori dal locale; in locale "password").
 * Rieseguibile: gli utenti esistenti vengono riusati, il torneo "Campionato Demo" viene ricreato.
 *
 *   node seed-demo.mjs --rimuovi
 * cancella gli utenti demo, i tornei a cui partecipano e le loro richieste.
 * I promemoria (cron.mjs) non vengono mai spediti agli indirizzi @demo.it.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('Serve SUPABASE_SECRET_KEY (chiave segreta / service_role del progetto)');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const DOMINIO = 'demo.it';
const locale = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
const PASSWORD = process.env.DEMO_PASSWORD || (locale ? 'password' : '');
const RIMUOVI = process.argv.includes('--rimuovi');
if (!RIMUOVI && PASSWORD.length < 8) {
  console.error('Serve DEMO_PASSWORD (almeno 8 caratteri) per un progetto non locale');
  process.exit(1);
}

const check = ({ data, error }, cosa) => {
  if (error) throw new Error(`${cosa}: ${error.message}`);
  return data;
};

// date locali del circolo
const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
const day = (n) => fmt(new Date(Date.now() + n * 86400_000));

// stessi valori di CONFIG_DEFAULT in src/lib/config.ts
const CONFIG_DEFAULT = {
  puntiVittoria: 3,
  puntiSconfitta: 0,
  puntiSconfittaSetDecisivo: 1,
  formatoSet: { setPerVincere: 2, superTieBreak: true },
  spareggi: ['punti', 'scontroDiretto', 'diffSet', 'diffGame', 'sorteggio'],
  criterioQualificazione: 'perPosizione',
  fasiFinali: [
    { nome: 'Gold', posti: 8 },
    { nome: 'Silver', posti: 8 },
  ],
  consentiFuoriGriglia: true,
  passoFuoriGriglia: 30,
  scadenzaRichiesteOre: 48,
  annullamentoGiocatoreOre: 24,
};

// ------------------------------------------------------------------ utenti
const utenti = [
  ['admin', 'Anna Admin', ['admin', 'giocatore']],
  ['org', 'Oscar Organizzatore', ['organizzatore', 'giocatore']],
  ['gestore', 'Gino Gestore', ['gestore', 'giocatore']],
  ...[
    'Marco Rossi', 'Luca Bianchi', 'Giulia Romano', 'Paolo Ferrari', 'Sara Esposito', 'Andrea Ricci',
    'Francesca Marino', 'Davide Greco', 'Chiara Bruno', 'Matteo Gallo', 'Elena Conti', 'Stefano De Luca',
    'Laura Costa', 'Roberto Giordano', 'Valentina Mancini', 'Alessandro Rizzo', 'Martina Lombardi', 'Simone Moretti',
    'Federica Barbieri', 'Giorgio Fontana', 'Silvia Santoro', 'Fabio Mariani', 'Alessia Rinaldi', 'Claudio Caruso',
    'Monica Ferrara', 'Massimo Galli', 'Paola Martini', 'Riccardo Leone', 'Ilaria Longo', 'Enrico Gentile',
    'Barbara Martinelli', 'Daniele Vitale', 'Cristina Lombardo', 'Franco Serra', 'Roberta Coppola', 'Antonio De Santis',
    'Elisa D’Angelo', 'Giuseppe Marchetti', 'Anna Parisi', 'Maurizio Villa',
  ].map((nome, i) => [`p${i + 1}`, nome, ['giocatore']]),
];

async function utenteEsistente(email) {
  for (let page = 1; ; page++) {
    const { users } = check(await sb.auth.admin.listUsers({ page, perPage: 200 }), 'listUsers');
    const u = users.find((x) => x.email === email);
    if (u) return u;
    if (users.length < 200) return null;
  }
}

async function utentiDemo() {
  const tutti = [];
  for (let page = 1; ; page++) {
    const { users } = check(await sb.auth.admin.listUsers({ page, perPage: 200 }), 'listUsers');
    tutti.push(...users.filter((u) => u.email?.endsWith(`@${DOMINIO}`)));
    if (users.length < 200) return tutti;
  }
}

if (RIMUOVI) {
  const demo = await utentiDemo();
  const ids = demo.map((u) => u.id);
  if (ids.length) {
    // tournaments with demo players (squadre/richieste reference profiles without cascade)
    const sg = check(await sb.from('squadra_giocatori').select('torneo_id').in('user_id', ids), 'squadre demo');
    const sq = check(await sb.from('squadre').select('torneo_id').in('creato_da', ids), 'squadre create');
    const tornei = [...new Set([...sg, ...sq].map((r) => r.torneo_id))];
    if (tornei.length) check(await sb.from('tornei').delete().in('id', tornei), 'tornei demo');
    check(await sb.from('richieste').delete().in('creato_da', ids), 'richieste demo');
    check(await sb.from('occupazioni').delete().in('creato_da', ids), 'occupazioni demo');
    for (const u of demo) check(await sb.auth.admin.deleteUser(u.id), `elimina ${u.email}`);
    console.log(`Rimossi ${demo.length} utenti demo e ${tornei.length} tornei con giocatori demo`);
  } else {
    console.log('Nessun utente demo da rimuovere');
  }
  process.exit(0);
}

const id = {};
for (const [nick, nome, roles] of utenti) {
  const email = `${nick}@${DOMINIO}`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: nome },
  });
  const user = error ? await utenteEsistente(email) : data.user;
  if (!user) throw new Error(`createUser ${email}: ${error?.message}`);
  // reused users get the current demo password
  if (error) check(await sb.auth.admin.updateUserById(user.id, { password: PASSWORD }), `password ${email}`);
  id[nick] = user.id;
  // the auth trigger creates the profile; the service role may set the roles
  check(await sb.from('profiles').upsert({ id: user.id, nome, email, roles }), `profilo ${email}`);
}

// ------------------------------------------------------------------ campi (come supabase/seed.sql)
check(
  await sb.from('campi').upsert(
    [
      { id: 'c1', nome: 'Campo 1', primo_slot: '13:30', ultimo_slot: '21:00', durata: 90, giorni_attivi: [0, 1, 2, 3, 4, 5, 6], eccezioni: [], ordine: 1 },
      { id: 'c2', nome: 'Campo 2', primo_slot: '14:00', ultimo_slot: '20:00', durata: 90, giorni_attivi: [0, 1, 2, 3, 4, 5, 6], eccezioni: [], ordine: 2 },
    ],
    { onConflict: 'id', ignoreDuplicates: true },
  ),
  'campi',
);

// ------------------------------------------------------------------ torneo
check(await sb.from('tornei').delete().eq('nome', 'Campionato Demo'), 'pulizia torneo');
const torneo = check(
  await sb
    .from('tornei')
    .insert({ nome: 'Campionato Demo', stato: 'iscrizioni', config: CONFIG_DEFAULT, sorteggio: {}, fasi_generate: [] })
    .select('id')
    .single(),
  'torneo',
);
const T = torneo.id;

// 9 giornate per girone, split by the app across the group-stage periods: 3 periods of 3 weeks
check(
  await sb.from('periodi').insert([
    { torneo_id: T, fase: 'gironi', turno: null, inizio: day(0), fine: day(20), etichetta: 'Periodo 1' },
    { torneo_id: T, fase: 'gironi', turno: null, inizio: day(21), fine: day(41), etichetta: 'Periodo 2' },
    { torneo_id: T, fase: 'gironi', turno: null, inizio: day(42), fine: day(62), etichetta: 'Periodo 3' },
  ]),
  'periodi',
);

// 20 pairs in 2 groups of 10, as in the real championship: p1+p2, p3+p4, …
const NOMI_COPPIE = [
  'Le Bandejas', 'Vibora Team', 'Chiquita', 'Por Tres', 'Smash Brothers', 'Bajada Club', 'Doppio Vetro', 'Gli Spallettoni',
  'Rete e Muro', 'Pala d’Oro', 'Volée Volanti', 'I Globo', 'Contropiede', 'Parete Sud', 'Golpe Bajo', 'Los Remates',
  'Tie Break', 'Fuori Gabbia', 'La Rulo', 'Punto d’Oro',
];
const squadre = NOMI_COPPIE.map((nome, i) => [nome, `p${2 * i + 1}`, `p${2 * i + 2}`, i < 10 ? 'A' : 'B']);
for (const [nome, g1, g2, girone] of squadre) {
  const s = check(
    await sb.from('squadre').insert({ torneo_id: T, nome, girone, stato: 'approvata', creato_da: id[g1] }).select('id').single(),
    `squadra ${nome}`,
  );
  check(
    await sb.from('squadra_giocatori').insert([
      { squadra_id: s.id, torneo_id: T, user_id: id[g1], ordine: 1 },
      { squadra_id: s.id, torneo_id: T, user_id: id[g2], ordine: 2 },
    ]),
    `giocatori ${nome}`,
  );
}

// disponibilità for the next 14 days, varied but reproducible (fixed-seed PRNG):
// weekday evenings, longer windows at weekends, a few players who never fill them in.
let seme = 42;
const rnd = () => {
  seme = (seme + 0x6d2b79f5) | 0;
  let t = Math.imul(seme ^ (seme >>> 15), 1 | seme);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const FERIALI = ['17:00-21:00', '18:00-21:00', '18:30-21:00', '19:00-21:00', '13:30-15:30'];
const FESTIVI = ['13:30-17:00', '14:00-19:00', '15:00-21:00', '16:00-20:00'];
const domani = day(1);
const giocatori = Object.keys(id).filter((k) => /^p\d+$/.test(k));
const disponibilita = [];
for (const g of giocatori) {
  if (['p39', 'p40', 'p27'].includes(g)) continue; // nothing entered yet: they get the reminder
  const fasce = {};
  for (let n = 1; n <= 14; n++) {
    const festivo = [0, 6].includes(new Date(day(n) + 'T12:00:00').getDay());
    if (rnd() < (festivo ? 0.55 : 0.4)) {
      const scelta = festivo ? FESTIVI : FERIALI;
      fasce[day(n)] = [scelta[Math.floor(rnd() * scelta.length)]];
    }
  }
  disponibilita.push({ torneo_id: T, user_id: id[g], fasce });
}
// guided scenario: tomorrow p1, p2, p3 free 14:00–19:00, p4 only 14:00–17:00 (Le Bandejas vs Vibora Team)
for (const g of ['p1', 'p2', 'p3', 'p4']) {
  disponibilita.find((r) => r.user_id === id[g]).fasce[domani] = [g === 'p4' ? '14:00-17:00' : '14:00-19:00'];
}
check(await sb.from('disponibilita').upsert(disponibilita), 'disponibilità');

// lezione domani 16:00–17:00 sul campo 1
check(
  await sb.from('occupazioni').delete().eq('campo_id', 'c1').eq('data', domani).eq('inizio', '16:00').eq('tipo', 'lezione'),
  'pulizia lezione',
);
check(
  await sb.from('occupazioni').insert({
    campo_id: 'c1',
    data: domani,
    inizio: '16:00',
    fine: '17:00',
    tipo: 'lezione',
    nota: 'Scuola padel',
    creato_da: id.gestore,
  }),
  'lezione',
);

console.log(`Seed completato. Torneo ${T} (domani = ${domani})`);
