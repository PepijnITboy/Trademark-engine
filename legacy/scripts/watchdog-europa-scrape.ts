/**
 * Watchdog for the safe (rate-limited) Europa scrape.
 */
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadDotenv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STALE_MS = 6 * 60_000;
const TARGET = 1_354_265;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function scrapeRunning(): boolean {
  try {
    const out = execSync(
      "pgrep -fl 'scrape-europa-wordmarks|scrape-europa-parallel' || true",
      { encoding: 'utf8' },
    );
    return /scrape-europa-wordmarks/.test(out);
  } catch {
    return false;
  }
}

function startScrape(): void {
  const child = spawn('pnpm', ['exec', 'tsx', 'scripts/scrape-europa-wordmarks.ts', '--concurrency=2'], {
    cwd: root,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  console.log(`[watchdog] started safe scrape pid=${child.pid}`);
}

async function checkOnce(): Promise<{ done: boolean; action: string; count: number }> {
  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count } = await supabase
    .from('test_database_europa')
    .select('*', { count: 'exact', head: true });
  const rowCount = count ?? 0;

  const { data: sync } = await supabase
    .from('test_database_europa_sync')
    .select('id,next_page,last_error,updated_at')
    .in('id', ['euipo_wordmarks_safe', 'euipo_wordmarks'])
    .order('id');

  const safe = (sync ?? []).find((s) => s.id === 'euipo_wordmarks_safe') ?? (sync ?? [])[0];
  const updated = safe?.updated_at ? Date.parse(String(safe.updated_at)) : 0;
  const stale = updated > 0 && Date.now() - updated > STALE_MS;
  const done = rowCount >= TARGET * 0.995 || Number(safe?.next_page ?? 0) >= 13_543;
  const running = scrapeRunning();

  let action = 'ok';
  if (done) action = 'complete';
  else if (!running || stale) {
    if (stale && running) {
      try {
        execSync('pkill -f scrape-europa-wordmarks || true');
        execSync('pkill -f scrape-europa-parallel || true');
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    startScrape();
    action = !running ? 'restarted_dead' : 'restarted_stale';
  }

  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      count: rowCount,
      pct: ((rowCount / TARGET) * 100).toFixed(2),
      next: safe?.next_page ?? null,
      running: scrapeRunning(),
      stale,
      done,
      action,
      err: safe?.last_error ? String(safe.last_error).slice(0, 100) : null,
    }),
  );

  return { done, action, count: rowCount };
}

const once = process.argv.includes('--once');
const result = await checkOnce();
if (!once && !result.done) {
  setInterval(() => {
    void checkOnce().then((r) => {
      if (r.done) {
        console.log('[watchdog] complete');
        process.exit(0);
      }
    });
  }, 3 * 60_000);
  console.log('[watchdog] monitoring every 3m');
}
