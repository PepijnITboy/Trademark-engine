import {
  closeDb,
  corpusBridgeRun,
  createDb,
} from "@trademark-engine/database";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { bridgeSampleRows } from "./bridge-sample.js";
import { BRIDGE_SOURCE_STATUSES } from "./normalize-status.js";
import { corpusRowSchema, type CorpusRow } from "./types.js";

export interface SupabaseCorpusRow {
  readonly application_number: string;
  readonly mark_name: string;
  readonly status: string;
  readonly nice_classes: readonly number[] | null;
  readonly application_date: string | null;
  readonly registration_date: string | null;
}

export interface BridgeProgress {
  readonly fetched: number;
  readonly upserted: number;
  readonly unchanged: number;
  readonly elapsedMs: number;
}

export interface BridgeFirstNResult {
  readonly fetched: number;
  readonly upserted: number;
  readonly unchanged: number;
  readonly elapsedMs: number;
  readonly runId: string | null;
  readonly limit: number | null;
}

export interface BridgeFirstNOptions {
  /** Max rows to fetch. `0` or omit with env CORPUS_LIMIT=0 means uncapped (full corpus). */
  readonly limit?: number;
  readonly pageSize?: number;
  readonly onProgress?: (progress: BridgeProgress) => void;
  readonly supabaseUrl?: string;
  readonly supabaseKey?: string;
  readonly databaseUrl?: string;
}

/** Resolve row limit: `0` means uncapped (null). Default 100_000 when unset. */
export function resolveCorpusLimit(
  explicit?: number,
  envValue: string | undefined = process.env.CORPUS_LIMIT,
): number | null {
  if (explicit !== undefined) {
    return explicit === 0 ? null : explicit;
  }
  if (envValue === undefined || envValue === "") {
    return 100_000;
  }
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid CORPUS_LIMIT: ${envValue}`);
  }
  return parsed === 0 ? null : parsed;
}

export function mapSupabaseRowToCorpusRow(row: SupabaseCorpusRow): CorpusRow {
  return corpusRowSchema.parse({
    application_number: String(row.application_number),
    mark_name: row.mark_name ?? "",
    status: row.status ?? "unknown",
    nice_classes: Array.isArray(row.nice_classes) ? [...row.nice_classes] : [],
    application_date: row.application_date,
    registration_date: row.registration_date,
  });
}

export async function fetchCorpusPage(
  client: SupabaseClient,
  { from, to }: { from: number; to: number },
): Promise<CorpusRow[]> {
  // READ-ONLY: select only — never upsert/update/delete on test_database_europa
  // Filter 1: only REGISTERED + ACCEPTED
  const maxAttempts = 5;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await client
      .from("test_database_europa")
      .select(
        "application_number,mark_name,status,nice_classes,application_date,registration_date",
      )
      .in("status", [...BRIDGE_SOURCE_STATUSES])
      .order("application_number", { ascending: true })
      .range(from, to);

    if (!error) {
      return (data ?? []).map((row) => mapSupabaseRowToCorpusRow(row as SupabaseCorpusRow));
    }

    lastError = error;
    const message = error.message ?? String(error);
    const retryable =
      /timeout|canceling statement|fetch failed|network|5\d\d/i.test(message) ||
      attempt < maxAttempts;
    if (!retryable || attempt === maxAttempts) {
      break;
    }
    const backoffMs = Math.min(30_000, 500 * 2 ** (attempt - 1));
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }

  const detail =
    lastError instanceof Error
      ? lastError.message
      : typeof lastError === "object" && lastError && "message" in lastError
        ? String((lastError as { message: unknown }).message)
        : String(lastError);
  throw new Error(`Supabase fetch failed: ${detail}`);
}

export async function bridgeFirstNFromSupabase(
  options: BridgeFirstNOptions = {},
): Promise<BridgeFirstNResult> {
  const limit = resolveCorpusLimit(options.limit);
  const pageSize = options.pageSize ?? 1_000;
  const supabaseUrl = options.supabaseUrl ?? process.env.SUPABASE_URL;
  const supabaseKey = options.supabaseKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = createClient(supabaseUrl, supabaseKey);
  const db = createDb(databaseUrl);
  const startedAt = Date.now();
  const startedAtDate = new Date(startedAt);
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalUnchanged = 0;
  let runId: string | null = null;

  const checkpointBase = {
    limit,
    pageSize,
    filter: "status_allowlist_v1",
    statuses: [...BRIDGE_SOURCE_STATUSES],
  };

  try {
    const [run] = await db
      .insert(corpusBridgeRun)
      .values({
        mode: limit === null ? "full_mirror" : "changed",
        status: "running",
        recordsRead: 0,
        recordsUpserted: 0,
        recordsUnchanged: 0,
        recordsFailed: 0,
        checkpoint: checkpointBase,
        startedAt: startedAtDate,
      })
      .returning({ id: corpusBridgeRun.id });

    runId = run?.id ?? null;

    for (let offset = 0; limit === null || offset < limit; offset += pageSize) {
      const pageLimit =
        limit === null ? pageSize : Math.min(pageSize, limit - offset);
      const from = offset;
      const to = offset + pageLimit - 1;

      const rows = await fetchCorpusPage(client, { from, to });
      if (rows.length === 0) {
        break;
      }

      const result = await bridgeSampleRows(db, rows);
      totalFetched += rows.length;
      totalUpserted += result.upsertedCount;
      totalUnchanged += result.unchangedCount;

      const progress: BridgeProgress = {
        fetched: totalFetched,
        upserted: totalUpserted,
        unchanged: totalUnchanged,
        elapsedMs: Date.now() - startedAt,
      };
      options.onProgress?.(progress);

      if (rows.length < pageLimit) {
        break;
      }
    }

    if (runId) {
      await db
        .update(corpusBridgeRun)
        .set({
          status: "completed",
          recordsRead: totalFetched,
          recordsUpserted: totalUpserted,
          recordsUnchanged: totalUnchanged,
          completedAt: new Date(),
          checkpoint: { ...checkpointBase, fetched: totalFetched },
        })
        .where(eq(corpusBridgeRun.id, runId));
    }
  } catch (error) {
    if (runId) {
      await db
        .update(corpusBridgeRun)
        .set({
          status: "failed",
          recordsRead: totalFetched,
          recordsUpserted: totalUpserted,
          recordsUnchanged: totalUnchanged,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        })
        .where(eq(corpusBridgeRun.id, runId));
    }
    throw error;
  } finally {
    await closeDb(db);
  }

  return {
    fetched: totalFetched,
    upserted: totalUpserted,
    unchanged: totalUnchanged,
    elapsedMs: Date.now() - startedAt,
    runId,
    limit,
  };
}
