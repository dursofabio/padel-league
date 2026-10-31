/**
 * Demo data for a Supabase project (local or hosted), via the service role.
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=... npm run seed:demo
 *
 * Users: admin@demo.it, org@demo.it, gestore@demo.it, p1@demo.it … p40@demo.it (20 pairs in 2 groups),
 * password DEMO_PASSWORD (required outside local; "password" locally).
 * Re-runnable: existing users are reused, the "Campionato Demo" tournament is recreated.
 * Names (users, teams, tournament, courts, periods) are user-facing data and stay Italian.
 *
 *   node seed-demo.mjs --remove
 * deletes the demo users, the tournaments they play in and their requests.
 * Reminders (cron.mjs) are never sent to @demo.it addresses.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('SUPABASE_SECRET_KEY is required (secret / service_role key of the project)');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const DOMAIN = 'demo.it';
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
const PASSWORD = process.env.DEMO_PASSWORD || (isLocal ? 'password' : '');
const REMOVE = process.argv.includes('--remove');
if (!REMOVE && PASSWORD.length < 8) {
  console.error('DEMO_PASSWORD (at least 8 characters) is required for a non-local project');
  process.exit(1);
}

const check = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

// local dates of the club
const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
const day = (n) => fmt(new Date(Date.now() + n * 86400_000));

// same values as the client default config (src/lib/config.ts) and private.config_default()
const CONFIG_DEFAULT = {
  pointsWin: 3,
  pointsLoss: 0,
  pointsLossDecidingSet: 1,
  setFormat: { setsToWin: 2, superTieBreak: true },
  tiebreakers: ['points', 'headToHead', 'setDiff', 'gameDiff', 'draw'],
  qualificationRule: 'byPosition',
  finals: [
    { name: 'Gold', spots: 8 },
    { name: 'Silver', spots: 8 },
  ],
  allowOffGrid: true,
  offGridStep: 30,
  requestExpiryHours: 48,
  playerCancelHours: 24,
};

// ------------------------------------------------------------------ users
// the nick is the local part of the email (gestore@demo.it is the court manager)
const users = [
  ['admin', 'Anna Admin', ['admin', 'player']],
  ['org', 'Oscar Organizzatore', ['organizer', 'player']],
  ['gestore', 'Gino Gestore', ['manager', 'player']],
  ...[
    'Marco Rossi', 'Luca Bianchi', 'Giulia Romano', 'Paolo Ferrari', 'Sara Esposito', 'Andrea Ricci',
    'Francesca Marino', 'Davide Greco', 'Chiara Bruno', 'Matteo Gallo', 'Elena Conti', 'Stefano De Luca',
    'Laura Costa', 'Roberto Giordano', 'Valentina Mancini', 'Alessandro Rizzo', 'Martina Lombardi', 'Simone Moretti',
    'Federica Barbieri', 'Giorgio Fontana', 'Silvia Santoro', 'Fabio Mariani', 'Alessia Rinaldi', 'Claudio Caruso',
    'Monica Ferrara', 'Massimo Galli', 'Paola Martini', 'Riccardo Leone', 'Ilaria Longo', 'Enrico Gentile',
    'Barbara Martinelli', 'Daniele Vitale', 'Cristina Lombardo', 'Franco Serra', 'Roberta Coppola', 'Antonio De Santis',
    'Elisa D’Angelo', 'Giuseppe Marchetti', 'Anna Parisi', 'Maurizio Villa',
  ].map((name, i) => [`p${i + 1}`, name, ['player']]),
];

async function findUser(email) {
  for (let page = 1; ; page++) {
    const { users } = check(await sb.auth.admin.listUsers({ page, perPage: 200 }), 'listUsers');
    const u = users.find((x) => x.email === email);
    if (u) return u;
    if (users.length < 200) return null;
  }
}

async function demoUsers() {
  const all = [];
  for (let page = 1; ; page++) {
    const { users } = check(await sb.auth.admin.listUsers({ page, perPage: 200 }), 'listUsers');
    all.push(...users.filter((u) => u.email?.endsWith(`@${DOMAIN}`)));
    if (users.length < 200) return all;
  }
}

if (REMOVE) {
  const demo = await demoUsers();
  const ids = demo.map((u) => u.id);
  if (ids.length) {
    // tournaments with demo players (teams/requests reference profiles without cascade)
    const tp = check(await sb.from('team_players').select('tournament_id').in('user_id', ids), 'demo team players');
    const tm = check(await sb.from('teams').select('tournament_id').in('created_by', ids), 'demo teams');
    const tournaments = [...new Set([...tp, ...tm].map((r) => r.tournament_id))];
    if (tournaments.length) check(await sb.from('tournaments').delete().in('id', tournaments), 'demo tournaments');
    check(await sb.from('requests').delete().in('created_by', ids), 'demo requests');
    check(await sb.from('bookings').delete().in('created_by', ids), 'demo bookings');
    for (const u of demo) check(await sb.auth.admin.deleteUser(u.id), `delete ${u.email}`);
    console.log(`Removed ${demo.length} demo users and ${tournaments.length} tournaments with demo players`);
  } else {
    console.log('No demo users to remove');
  }
  process.exit(0);
}

const id = {};
for (const [nick, name, roles] of users) {
  const email = `${nick}@${DOMAIN}`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  const user = error ? await findUser(email) : data.user;
  if (!user) throw new Error(`createUser ${email}: ${error?.message}`);
  // reused users get the current demo password
  if (error) check(await sb.auth.admin.updateUserById(user.id, { password: PASSWORD }), `password ${email}`);
  id[nick] = user.id;
  // the auth trigger creates the profile; the service role may set the roles
  check(await sb.from('profiles').upsert({ id: user.id, name, email, roles }), `profile ${email}`);
}

// ------------------------------------------------------------------ courts (as in supabase/seed.sql)
check(
  await sb.from('courts').upsert(
    [
      { id: 'c1', name: 'Campo 1', first_slot: '13:30', last_slot: '21:00', slot_minutes: 90, active_days: [0, 1, 2, 3, 4, 5, 6], closed_dates: [], sort_order: 1 },
      { id: 'c2', name: 'Campo 2', first_slot: '14:00', last_slot: '20:00', slot_minutes: 90, active_days: [0, 1, 2, 3, 4, 5, 6], closed_dates: [], sort_order: 2 },
    ],
    { onConflict: 'id', ignoreDuplicates: true },
  ),
  'courts',
);

// ------------------------------------------------------------------ tournament
check(await sb.from('tournaments').delete().eq('name', 'Campionato Demo'), 'tournament cleanup');
const tournament = check(
  await sb
    .from('tournaments')
    .insert({ name: 'Campionato Demo', status: 'registration', config: CONFIG_DEFAULT, draw: {}, generated_phases: [] })
    .select('id')
    .single(),
  'tournament',
);
const T = tournament.id;

// 9 rounds per group, split by the app across the group-stage periods: 3 periods of 3 weeks
check(
  await sb.from('periods').insert([
    { tournament_id: T, phase: 'groups', round: null, starts_on: day(0), ends_on: day(20), label: 'Periodo 1' },
    { tournament_id: T, phase: 'groups', round: null, starts_on: day(21), ends_on: day(41), label: 'Periodo 2' },
    { tournament_id: T, phase: 'groups', round: null, starts_on: day(42), ends_on: day(62), label: 'Periodo 3' },
  ]),
  'periods',
);

// 20 pairs in 2 groups of 10, as in the real championship: p1+p2, p3+p4, …
const TEAM_NAMES = [
  'Le Bandejas', 'Vibora Team', 'Chiquita', 'Por Tres', 'Smash Brothers', 'Bajada Club', 'Doppio Vetro', 'Gli Spallettoni',
  'Rete e Muro', 'Pala d’Oro', 'Volée Volanti', 'I Globo', 'Contropiede', 'Parete Sud', 'Golpe Bajo', 'Los Remates',
  'Tie Break', 'Fuori Gabbia', 'La Rulo', 'Punto d’Oro',
];
const teams = TEAM_NAMES.map((name, i) => [name, `p${2 * i + 1}`, `p${2 * i + 2}`, i < 10 ? 'A' : 'B']);
for (const [name, p1, p2, group] of teams) {
  const t = check(
    await sb.from('teams').insert({ tournament_id: T, name, group_name: group, status: 'approved', created_by: id[p1] }).select('id').single(),
    `team ${name}`,
  );
  check(
    await sb.from('team_players').insert([
      { team_id: t.id, tournament_id: T, user_id: id[p1], position: 1 },
      { team_id: t.id, tournament_id: T, user_id: id[p2], position: 2 },
    ]),
    `players ${name}`,
  );
}

// availability for the next 14 days, varied but reproducible (fixed-seed PRNG):
// weekday evenings, longer windows at weekends, a few players who never fill them in.
let seed = 42;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const WEEKDAY_WINDOWS = ['17:00-21:00', '18:00-21:00', '18:30-21:00', '19:00-21:00', '13:30-15:30'];
const WEEKEND_WINDOWS = ['13:30-17:00', '14:00-19:00', '15:00-21:00', '16:00-20:00'];
const tomorrow = day(1);
const players = Object.keys(id).filter((k) => /^p\d+$/.test(k));
const availability = [];
for (const p of players) {
  if (['p39', 'p40', 'p27'].includes(p)) continue; // nothing entered yet: they get the reminder
  const windows = {};
  for (let n = 1; n <= 14; n++) {
    const weekend = [0, 6].includes(new Date(day(n) + 'T12:00:00').getDay());
    if (rnd() < (weekend ? 0.55 : 0.4)) {
      const choice = weekend ? WEEKEND_WINDOWS : WEEKDAY_WINDOWS;
      windows[day(n)] = [choice[Math.floor(rnd() * choice.length)]];
    }
  }
  availability.push({ tournament_id: T, user_id: id[p], windows });
}
// guided scenario: tomorrow p1, p2, p3 free 14:00–19:00, p4 only 14:00–17:00 (Le Bandejas vs Vibora Team)
for (const p of ['p1', 'p2', 'p3', 'p4']) {
  availability.find((r) => r.user_id === id[p]).windows[tomorrow] = [p === 'p4' ? '14:00-17:00' : '14:00-19:00'];
}
check(await sb.from('availability').upsert(availability), 'availability');

// lesson tomorrow 16:00–17:00 on court 1
check(
  await sb.from('bookings').delete().eq('court_id', 'c1').eq('date', tomorrow).eq('start_time', '16:00').eq('type', 'lesson'),
  'lesson cleanup',
);
check(
  await sb.from('bookings').insert({
    court_id: 'c1',
    date: tomorrow,
    start_time: '16:00',
    end_time: '17:00',
    type: 'lesson',
    note: 'Scuola padel',
    created_by: id.gestore,
  }),
  'lesson',
);

console.log(`Seed done. Tournament ${T} (tomorrow = ${tomorrow})`);
