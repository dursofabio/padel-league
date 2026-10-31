/**
 * League reminder emails (GitHub Actions, once a day).
 *
 * Request expiry, recurrences and unplayed matches run inside the database with pg_cron
 * (see supabase/migrations/*_cron.sql). Only sending the emails is left here:
 * the content is computed by the RPC `reminder_emails()` (service_role only)
 * → [{ email, name, lines: string[] }]. The email text is user-facing, so it stays Italian.
 *
 * Environment variables:
 *   SUPABASE_URL          project URL (https://<ref>.supabase.co)
 *   SUPABASE_SECRET_KEY   secret / service_role key (secret)
 *   APP_URL               public URL of the app (link at the bottom of the email, optional)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *                         without SMTP_HOST the emails are only printed to the log
 *   DRY_RUN=1             sends nothing, prints the emails
 */
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const DRY = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
const log = (...a) => console.log(new Date().toISOString(), ...a);

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.rpc('reminder_emails');
if (error) {
  console.error('reminder_emails:', error.message);
  process.exit(1);
}
const mail = Array.isArray(data) ? data : [];

const smtp =
  process.env.SMTP_HOST && !DRY
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;

let sent = 0;
let failed = 0;
for (const { email, name, lines } of mail) {
  if (!email || !lines?.length) continue;
  const text = [
    `Ciao ${name || ''},`,
    '',
    ...lines.map((l) => `• ${l}`),
    '',
    APP_URL ? `Apri l'app: ${APP_URL}` : null,
    'Campionato di padel',
  ]
    .filter((l) => l !== null)
    .join('\n');
  // demo users (scripts/seed-demo.mjs) never receive real email
  if (!smtp || email.endsWith('@demo.it')) {
    log(`[simulated email] ${email}\n${text}`);
    continue;
  }
  try {
    await smtp.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Campionato di padel: promemoria',
      text,
    });
    sent++;
  } catch (e) {
    failed++;
    console.error(`sending to ${email} failed:`, e.message);
  }
}
log(`email: ${mail.length} recipients, ${sent} sent${DRY ? ' (dry run)' : ''}${failed ? `, ${failed} failed` : ''}`);
if (failed) process.exitCode = 1;
