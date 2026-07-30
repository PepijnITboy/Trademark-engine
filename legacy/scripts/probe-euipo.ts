/**
 * Live sandbox probe: loads .env, acquires OAuth token, searches trademarks.
 *
 *   pnpm euipo:probe
 *   pnpm euipo:probe -- --query 'wordMarkSpecification.verbalElement==TEST'
 */
import { config as loadDotenv } from 'dotenv';
import { EuipoClient } from '../src/euipo/client.js';

loadDotenv();

const queryArgIndex = process.argv.indexOf('--query');
const query =
  queryArgIndex >= 0 && process.argv[queryArgIndex + 1]
    ? process.argv[queryArgIndex + 1]
    : undefined;

const client = new EuipoClient();

const probe = await client.probe();
if (!probe.ok) {
  console.error('EUIPO sandbox probe FAILED:', probe.error);
  process.exit(1);
}

console.log('EUIPO sandbox probe OK — totalElements:', probe.totalElements);

const search = (await client.search({
  size: 10,
  page: 0,
  ...(query ? { query } : {}),
})) as {
  trademarks?: Array<{
    applicationNumber?: string;
    status?: string;
    wordMarkSpecification?: { verbalElement?: string };
  }>;
  totalElements?: number;
};

const items = search.trademarks ?? [];
console.log(`Sample (${items.length} of ${search.totalElements ?? '?'}):`);
for (const item of items.slice(0, 5)) {
  const name = item.wordMarkSpecification?.verbalElement ?? '(no verbal element)';
  console.log(`- ${item.applicationNumber ?? '?'} | ${item.status ?? '?'} | ${name}`);
}
