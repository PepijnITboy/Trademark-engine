/**
 * Back-compat entrypoint: run the rate-limited single-process scrape.
 * (Old multi-process parallel mode exceeded EUIPO burst 200/min.)
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extra = process.argv.slice(2).filter((a) => a !== '--');

console.log('Starting safe EUIPO scrape (shared 140/min soft cap, concurrency=2)…');

const child = spawn(
  'pnpm',
  ['exec', 'tsx', 'scripts/scrape-europa-wordmarks.ts', '--concurrency=2', ...extra],
  { cwd: root, env: process.env, stdio: 'inherit' },
);

child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
