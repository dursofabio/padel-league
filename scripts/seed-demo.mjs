/**
 * Dati dimostrativi per un progetto Supabase (locale o hosted), via service role.
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=... npm run seed:demo
 *
 * Utenti: admin@demo.it, org@demo.it, gestore@demo.it, p1@demo.it … p8@demo.it, password "password".
 * Rieseguibile: gli utenti esistenti vengono riusati, il torneo "Campionato Demo" viene ricreato.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('Serve SUPABASE_SECRET_KEY (chiave segreta / service_role del progetto)');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

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
  ...Array.from({ length: 8 }, (_, i) => [`p${i + 1}`, `Giocatore ${i + 1}`, ['giocatore']]),
];

async function utenteEsistente(email) {
  for (let page = 1; ; page++) {
    const { users } = check(await sb.auth.admin.listUsers({ page, perPage: 200 }), 'listUsers');
    const u = users.find((x) => x.email === email);
    if (u) return u;
    if (users.length < 200) return null;
  }
}

const id = {};
for (const [nick, nome, roles] of utenti) {
  const email = `${nick}@demo.it`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: 'password',
    email_confirm: true,
    user_metadata: { full_name: nome },
  });
  const user = error ? await utenteEsistente(email) : data.user;
  if (!user) throw new Error(`createUser ${email}: ${error?.message}`);
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

check(
  await sb.from('periodi').insert({ torneo_id: T, fase: 'gironi', turno: null, inizio: day(0), fine: day(27), etichetta: 'Periodo 1' }),
  'periodo',
);

const squadre = [
  ['Le Bandejas', 'p1', 'p2'],
  ['Vibora Team', 'p3', 'p4'],
  ['Chiquita', 'p5', 'p6'],
  ['Por Tres', 'p7', 'p8'],
];
for (const [nome, g1, g2] of squadre) {
  const s = check(
    await sb.from('squadre').insert({ torneo_id: T, nome, girone: 'A', stato: 'approvata', creato_da: id[g1] }).select('id').single(),
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

// disponibilità: domani 14:00–19:00 per p1, p2, p3; p4 solo 14:00–17:00
const domani = day(1);
check(
  await sb.from('disponibilita').upsert([
    ...['p1', 'p2', 'p3'].map((g) => ({ torneo_id: T, user_id: id[g], fasce: { [domani]: ['14:00-19:00'] } })),
    { torneo_id: T, user_id: id.p4, fasce: { [domani]: ['14:00-17:00'] } },
  ]),
  'disponibilità',
);

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
