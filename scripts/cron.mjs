/**
 * Promemoria email del campionato (GitHub Actions, una volta al giorno).
 *
 * Scadenze, ricorrenze e partite non giocate girano nel database con pg_cron
 * (vedi supabase/migrations/*_cron.sql). Qui resta solo l'invio delle email:
 * il contenuto è calcolato dalla RPC `email_promemoria()` (solo service_role)
 * → [{ email, nome, righe: string[] }].
 *
 * Variabili d'ambiente:
 *   SUPABASE_URL          URL del progetto (https://<ref>.supabase.co)
 *   SUPABASE_SECRET_KEY   chiave segreta / service_role (secret)
 *   APP_URL               URL pubblico dell'app (link in fondo all'email, facoltativo)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *                         se SMTP_HOST manca le email sono solo stampate nel log
 *   DRY_RUN=1             non invia nulla, stampa le email
 */
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const DRY = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
const log = (...a) => console.log(new Date().toISOString(), ...a);

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Servono SUPABASE_URL e SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.rpc('email_promemoria');
if (error) {
  console.error('email_promemoria:', error.message);
  process.exit(1);
}
const posta = Array.isArray(data) ? data : [];

const smtp =
  process.env.SMTP_HOST && !DRY
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;

let inviate = 0;
let errori = 0;
for (const { email, nome, righe } of posta) {
  if (!email || !righe?.length) continue;
  const text = [
    `Ciao ${nome || ''},`,
    '',
    ...righe.map((r) => `• ${r}`),
    '',
    APP_URL ? `Apri l'app: ${APP_URL}` : null,
    'Campionato di padel',
  ]
    .filter((r) => r !== null)
    .join('\n');
  if (!smtp) {
    log(`[email simulata] ${email}\n${text}`);
    continue;
  }
  try {
    await smtp.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Campionato di padel: promemoria',
      text,
    });
    inviate++;
  } catch (e) {
    errori++;
    console.error(`invio a ${email} fallito:`, e.message);
  }
}
log(`email: ${posta.length} destinatari, ${inviate} inviate${DRY ? ' (dry run)' : ''}${errori ? `, ${errori} errori` : ''}`);
if (errori) process.exitCode = 1;
