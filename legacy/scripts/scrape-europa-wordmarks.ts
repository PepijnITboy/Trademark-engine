/**
 * Safe Europa woordmerk-scrape respecting EUIPO Default Plan limits (live headers):
 *   x-burstlimit-limit = 200 / minute
 *   x-ratelimit-limit  = 25000 / day
 *
 * Soft caps: 140/min and 24000/day, shared in-process.
 * Concurrency default 2. Uses unfinished worker ranges to avoid wasting quota.
 *
 *   pnpm euipo:scrape-europa
 *   pnpm euipo:scrape-europa -- --concurrency=2
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { EuipoClient } from '../src/euipo/client.js';
import {
  EuipoRateLimitError,
  getSharedEuipoRateLimiter,
} from '../src/euipo/rate-limiter.js';

loadDotenv();

const PAGE_SIZE = 100;
const SYNC_ID = 'euipo_wordmarks_safe';
const WORKERS = 4;
const TOTAL_PAGES_FALLBACK = 13_543;
const SEARCH_FIELDS =
  'trademarks(applicationNumber,markFeature,status,wordMarkSpecification,niceClasses,applicationDate,registrationDate),page,size,totalElements,totalPages';

interface EuipoSearchItem {
  applicationNumber?: string;
  status?: string;
  niceClasses?: number[];
  applicationDate?: string;
  registrationDate?: string;
  wordMarkSpecification?: { verbalElement?: string };
}

interface SearchBody {
  trademarks?: EuipoSearchItem[];
  totalElements?: number;
  totalPages?: number;
}

interface EuropaRow {
  application_number: string;
  mark_name: string;
  status: string | null;
  nice_classes: number[];
  application_date: string | null;
  registration_date: string | null;
}

function argValue(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function mapRow(item: EuipoSearchItem): EuropaRow | null {
  const applicationNumber = item.applicationNumber?.trim();
  if (!applicationNumber) return null;
  return {
    application_number: applicationNumber,
    mark_name: item.wordMarkSpecification?.verbalElement?.trim() ?? '',
    status: item.status ?? null,
    nice_classes: Array.isArray(item.niceClasses)
      ? item.niceClasses.filter((n) => Number.isInteger(n))
      : [],
    application_date: item.applicationDate?.slice(0, 10) ?? null,
    registration_date: item.registrationDate?.slice(0, 10) ?? null,
  };
}

function createSupabase(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function upsertBatch(supabase: SupabaseClient, rows: EuropaRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('test_database_europa').upsert(rows, {
    onConflict: 'application_number',
  });
  if (error) throw new Error(`upsert failed: ${error.message}`);
}

/**
 * Build only unfinished pages from the 4 prior worker ranges.
 * Range i owns [i*rangeSize, (i+1)*rangeSize); resume at worker next_page.
 */
async function buildPageQueue(supabase: SupabaseClient, totalPages: number): Promise<number[]> {
  const rangeSize = Math.ceil(totalPages / WORKERS);
  const { data: workers } = await supabase
    .from('test_database_europa_sync')
    .select('id,next_page')
    .like('id', 'euipo_wordmarks_w%');

  const byWorker = new Map<number, number>();
  for (const row of workers ?? []) {
    const id = String(row.id).replace('euipo_wordmarks_w', '');
    const workerId = Number(id);
    if (Number.isInteger(workerId)) byWorker.set(workerId, Number(row.next_page));
  }

  const pages: number[] = [];
  for (let workerId = 0; workerId < WORKERS; workerId += 1) {
    const start = workerId * rangeSize;
    const end = Math.min(totalPages, (workerId + 1) * rangeSize);
    const resume = Math.max(start, Math.min(byWorker.get(workerId) ?? start, end));
    for (let p = resume; p < end; p += 1) pages.push(p);
  }

  return pages;
}

async function saveProgress(
  supabase: SupabaseClient,
  nextPage: number,
  totalElements: number,
  lastError: string | null = null,
): Promise<number> {
  const { count } = await supabase
    .from('test_database_europa')
    .select('*', { count: 'exact', head: true });

  const payload = {
    id: SYNC_ID,
    next_page: nextPage,
    total_imported: count ?? 0,
    total_elements: totalElements,
    last_error: lastError,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('test_database_europa_sync').upsert(payload);
  if (error) throw new Error(`progress save failed: ${error.message}`);

  await supabase
    .from('test_database_europa_sync')
    .update({
      total_imported: count ?? 0,
      total_elements: totalElements,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'euipo_wordmarks');

  return count ?? 0;
}

async function bumpWorkerCursor(supabase: SupabaseClient, page: number, totalPages: number): Promise<void> {
  const rangeSize = Math.ceil(totalPages / WORKERS);
  const workerId = Math.min(WORKERS - 1, Math.floor(page / rangeSize));
  const id = `euipo_wordmarks_w${workerId}`;
  const { data } = await supabase.from('test_database_europa_sync').select('next_page').eq('id', id).maybeSingle();
  const current = Number(data?.next_page ?? 0);
  if (page + 1 > current) {
    await supabase
      .from('test_database_europa_sync')
      .upsert({
        id,
        next_page: page + 1,
        updated_at: new Date().toISOString(),
      });
  }
}

async function searchWithRetry(
  euipo: EuipoClient,
  page: number,
  attempts = 4,
): Promise<SearchBody> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return (await euipo.search({
        page,
        size: PAGE_SIZE,
        query: 'markFeature==WORD',
        fields: SEARCH_FIELDS,
        sort: 'applicationNumber:asc',
      })) as SearchBody;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('daily soft cap')) throw error;

      const retryable =
        message.includes('timed out') ||
        message.includes('(401)') ||
        message.includes('(429)') ||
        message.includes('(500)') ||
        message.includes('(502)') ||
        message.includes('(503)') ||
        message.includes('network') ||
        message.includes('OAuth token');
      if (!retryable || attempt === attempts) break;

      let waitMs = Math.min(45_000, 2000 * 2 ** (attempt - 1));
      const retryAfterMatch = message.match(/retry-after (\d+)s/);
      if (retryAfterMatch?.[1]) waitMs = Math.max(waitMs, Number(retryAfterMatch[1]) * 1000);
      console.warn(`retry page ${page} #${attempt}: ${message.slice(0, 100)} — ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const concurrency = Math.min(3, Math.max(1, Number(argValue('--concurrency') ?? '2')));
const supabase = createSupabase();
const euipo = new EuipoClient();
const limiter = getSharedEuipoRateLimiter();

const probe = (await euipo.search({
  page: 0,
  size: PAGE_SIZE,
  query: 'markFeature==WORD',
  fields: SEARCH_FIELDS,
})) as SearchBody;
const totalElements = probe.totalElements ?? 1_354_265;
const totalPages = probe.totalPages ?? TOTAL_PAGES_FALLBACK;

const queue = await buildPageQueue(supabase, totalPages);
console.log('EUIPO Default Plan hard limits: burst 200/min, daily 25000');
console.log(
  `Soft caps: 140/min + 24000/day | concurrency=${concurrency} | remaining pages=${queue.length}/${totalPages}`,
);
if (queue.length > 0) {
  console.log(`First remaining page=${queue[0]}, last=${queue[queue.length - 1]}`);
}

let claimIndex = 0;
let pagesDone = 0;
let stop = false;
let claimLock = Promise.resolve();

function claimNext(): Promise<number | null> {
  const run = claimLock.then(() => {
    if (stop || claimIndex >= queue.length) return null;
    const page = queue[claimIndex]!;
    claimIndex += 1;
    return page;
  });
  claimLock = run.then(() => undefined).catch(() => undefined);
  return run;
}

async function worker(name: string): Promise<void> {
  for (;;) {
    const page = await claimNext();
    if (page === null) return;

    try {
      let body: SearchBody;
      try {
        body = await searchWithRetry(euipo, page);
      } catch (error) {
        if (
          error instanceof EuipoRateLimitError ||
          (error instanceof Error && error.message.includes('daily soft cap'))
        ) {
          stop = true;
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[${name}] SKIP page ${page}: ${message.slice(0, 140)}`);
        await bumpWorkerCursor(supabase, page, totalPages);
        await saveProgress(supabase, page + 1, totalElements, `skipped ${page}`);
        continue;
      }

      const rows = (body.trademarks ?? []).map(mapRow).filter((r): r is EuropaRow => r !== null);
      await upsertBatch(supabase, rows);
      pagesDone += 1;
      await bumpWorkerCursor(supabase, page, totalPages);
      const dbCount = await saveProgress(supabase, page + 1, totalElements, null);

      if (pagesDone === 1 || pagesDone % 20 === 0) {
        const stats = limiter.stats;
        console.log(
          `[${name}] page ${page}/${totalPages} +${rows.length} | done=${pagesDone}/${queue.length} db=${dbCount} (${((dbCount / totalElements) * 100).toFixed(2)}%) | window=${stats.perMinute}/140 day=${stats.dayCount}/24000`,
        );
      }
    } catch (error) {
      throw error;
    }
  }
}

try {
  if (queue.length === 0) {
    console.log('Nothing left to scrape.');
  } else {
    await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(`c${i}`)));
  }
  const dbCount = await saveProgress(supabase, totalPages, totalElements, null);
  console.log(`Complete. pagesDone=${pagesDone} dbRows=${dbCount}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Stopped:', message);
  await saveProgress(supabase, queue[claimIndex] ?? totalPages, totalElements, message);
  process.exitCode = message.includes('daily soft cap') ? 0 : 1;
}
