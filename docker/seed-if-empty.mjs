/**
 * Loads the demo tournament (scripts/seed-demo.mjs) when the database has no tournaments,
 * or always when SEED_DEMO=force. Run by the `seed` service of compose.yaml.
 */
import { spawnSync } from 'node:child_process';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function waitFor(path) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${url}${path}`, { headers });
      if (r.ok) return r;
    } catch {
      // gateway or service not up yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${url}${path} not reachable`);
}

await waitFor('/auth/v1/health');
const tournaments = await (await waitFor('/rest/v1/tournaments?select=id&limit=1')).json();

if (process.env.SEED_DEMO !== 'force' && tournaments.length > 0) {
  console.log('Data already present: demo seed skipped (SEED_DEMO=force to reload it).');
  process.exit(0);
}

console.log('→ loading demo data');
const r = spawnSync(process.execPath, ['scripts/seed-demo.mjs'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
