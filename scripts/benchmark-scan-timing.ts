/**
 * Benchmark scan wall-clock and per-stage timings against a running API.
 *
 * Usage:
 *   pnpm bench:scan-timing                 # 100 engine scans (attorney off in API env)
 *   pnpm bench:scan-timing -- --count=5    # fewer scans
 *   pnpm bench:scan-timing -- --count=5 --out=tmp/attorney-bench.json
 *
 * Attorney on/off is controlled by the API process env (ATTORNEY_ANALYSIS_ENABLED),
 * not by this script.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const API_BASE = process.env.BENCH_API_BASE ?? "http://127.0.0.1:3000";
const POLL_MS = Number(process.env.BENCH_POLL_MS ?? 150);
const NICE_CLASSES = [9, 25, 32, 35, 41, 42] as const;

const MARK_POOL = [
  "ZENZO", "ACME", "NOVA", "LUMEN", "PIXEL", "ORBIS", "VISTA", "AETHER", "KAIRO", "SOLIS",
  "BRISK", "FLORA", "MINTY", "QUORUM", "RADIX", "SIGMA", "TORUS", "ULTRA", "VEXOR", "WAVES",
  "YONDER", "ZEPHYR", "ALPINE", "BOLTIX", "CIRRUS", "DRIFT", "ECHO", "FABLE", "GLINT", "HELIX",
  "IVORY", "JOLT", "KINDLY", "LARIX", "MIRAGE", "NEXUS", "ONYX", "PRISM", "QUILL", "RIVER",
  "SPARK", "TANGO", "UMBRA", "VORTEX", "WILLOW", "XENON", "YELLOW", "ZINCO", "ARROW", "BLAZE",
  "CROWN", "DELTA", "EMBER", "FROST", "GRAVITY", "HARMONY", "IMPACT", "JADE", "KNIGHT", "LOTUS",
  "MAPLE", "NEBULA", "ORBIT", "PULSE", "QUEST", "RAPTOR", "STORM", "TITAN", "UNITY", "VALOR",
  "WINTER", "XRAY", "YACHT", "ZODIAC", "AURORA", "BROOK", "CASCADE", "DAWN", "ECLIPSE", "FORGE",
  "GLACIER", "HAVEN", "IRON", "JUNIPER", "KESTREL", "LAGOON", "MEADOW", "NORTH", "OCEAN", "PEAK",
  "QUARTZ", "RIDGE", "SUMMIT", "TIMBER", "VALLEY", "WOODS", "ALPACA", "BAMBOO", "CEDAR", "DOVER",
] as const;

interface StageTiming {
  id: string;
  status: string;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface ScanTimingResult {
  markText: string;
  scanId: string;
  status: string;
  durationMs: number;
  createdAt: string;
  completedAt: string | null;
  stages: StageTiming[];
  error?: string;
}

interface Stats {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
}

function parseArgs(argv: string[]): { count: number; out: string; concurrency: number } {
  let count = 100;
  let out = "tmp/scan-timing-bench.json";
  let concurrency = 1;

  for (const arg of argv) {
    if (arg.startsWith("--count=")) {
      count = Math.max(1, Number(arg.slice("--count=".length)) || 100);
    } else if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
    } else if (arg.startsWith("--concurrency=")) {
      concurrency = Math.max(1, Math.min(4, Number(arg.slice("--concurrency=".length)) || 1));
    }
  }

  return { count, out, concurrency };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function summarize(values: number[]): Stats | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    count: values.length,
    mean: Math.round(mean),
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

function pickMarks(count: number): string[] {
  const marks: string[] = [];
  for (let i = 0; i < count; i++) {
    const base = MARK_POOL[i % MARK_POOL.length]!;
    const suffix = i >= MARK_POOL.length ? String(Math.floor(i / MARK_POOL.length) + 1) : "";
    marks.push(`${base}${suffix}`);
  }
  return marks;
}

function niceClassFor(index: number): number {
  return NICE_CLASSES[index % NICE_CLASSES.length]!;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function stageDurationMs(stage: {
  startedAt?: string | null;
  completedAt?: string | null;
}): number | null {
  if (!stage.startedAt || !stage.completedAt) {
    return null;
  }
  const start = Date.parse(stage.startedAt);
  const end = Date.parse(stage.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return Math.max(0, end - start);
}

async function runOneScan(markText: string, niceClass: number): Promise<ScanTimingResult> {
  const created = await requestJson<{
    id: string;
    status: string;
  }>("/api/scans", {
    method: "POST",
    body: JSON.stringify({
      markText,
      selectedNiceClasses: [niceClass],
    }),
  });

  const wallStart = Date.now();
  let detail: {
    id: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    error?: string;
  } | null = null;
  let progress: {
    stages: Array<{
      id: string;
      status: string;
      startedAt?: string;
      completedAt?: string;
    }>;
  } | null = null;

  for (;;) {
    detail = await requestJson(`/api/scans/${created.id}`);
    progress = await requestJson(`/api/scans/${created.id}/progress`);
    if (detail.status === "completed" || detail.status === "failed") {
      break;
    }
    if (Date.now() - wallStart > 15 * 60_000) {
      throw new Error(`Scan ${created.id} timed out after 15 minutes`);
    }
    await sleep(POLL_MS);
  }

  const durationMs =
    detail.completedAt && detail.createdAt
      ? Math.max(0, Date.parse(detail.completedAt) - Date.parse(detail.createdAt))
      : Date.now() - wallStart;

  return {
    markText,
    scanId: created.id,
    status: detail.status,
    durationMs,
    createdAt: detail.createdAt,
    completedAt: detail.completedAt,
    stages: (progress?.stages ?? []).map((stage) => ({
      id: stage.id,
      status: stage.status,
      durationMs: stageDurationMs(stage),
      startedAt: stage.startedAt ?? null,
      completedAt: stage.completedAt ?? null,
    })),
    ...(detail.error ? { error: detail.error } : {}),
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index]!, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );
  return results;
}

function buildReport(results: ScanTimingResult[]) {
  const ok = results.filter((item) => item.status === "completed");
  const failed = results.filter((item) => item.status !== "completed");
  const totalStats = summarize(ok.map((item) => item.durationMs));

  const stageIds = Array.from(
    new Set(ok.flatMap((item) => item.stages.map((stage) => stage.id))),
  );
  const perStage: Record<string, Stats> = {};
  for (const stageId of stageIds) {
    const values = ok
      .map((item) => item.stages.find((stage) => stage.id === stageId)?.durationMs)
      .filter((value): value is number => typeof value === "number");
    const stats = summarize(values);
    if (stats) {
      perStage[stageId] = stats;
    }
  }

  const attorneyStats = perStage.attorney_analysis ?? null;
  const varianceFlag =
    attorneyStats !== null &&
    attorneyStats.count >= 3 &&
    attorneyStats.p50 > 0 &&
    attorneyStats.p95 / attorneyStats.p50 >= 2.5;

  return {
    apiBase: API_BASE,
    generatedAt: new Date().toISOString(),
    scanCount: results.length,
    completedCount: ok.length,
    failedCount: failed.length,
    total: totalStats,
    perStage,
    attorney: attorneyStats,
    needsMoreAttorneySamples: varianceFlag,
    results,
  };
}

function printSummary(report: ReturnType<typeof buildReport>): void {
  console.log("\n=== Scan timing benchmark ===");
  console.log(`API: ${report.apiBase}`);
  console.log(
    `Scans: ${report.scanCount} (completed=${report.completedCount}, failed=${report.failedCount})`,
  );
  if (report.total) {
    console.log(
      `Total ms: mean=${report.total.mean} p50=${report.total.p50} p95=${report.total.p95} min=${report.total.min} max=${report.total.max}`,
    );
  }
  console.log("\nPer-stage ms:");
  for (const [stageId, stats] of Object.entries(report.perStage)) {
    console.log(
      `  ${stageId.padEnd(28)} mean=${String(stats.mean).padStart(6)} p50=${String(stats.p50).padStart(6)} p95=${String(stats.p95).padStart(6)} n=${stats.count}`,
    );
  }
  if (report.attorney) {
    console.log(
      `\nAttorney stage: mean=${report.attorney.mean} p50=${report.attorney.p50} p95=${report.attorney.p95}`,
    );
  }
  if (report.needsMoreAttorneySamples) {
    console.log(
      "\nWARNING: attorney p95/p50 >= 2.5 — more live samples recommended before hard-coding weights.",
    );
  }
}

async function main(): Promise<void> {
  const { count, out, concurrency } = parseArgs(process.argv.slice(2));
  const marks = pickMarks(count);

  console.log(
    `Benchmarking ${count} scan(s) against ${API_BASE} (concurrency=${concurrency})…`,
  );

  const results = await mapPool(marks, concurrency, async (markText, index) => {
    const niceClass = niceClassFor(index);
    process.stdout.write(`[${index + 1}/${count}] ${markText} (class ${niceClass})… `);
    try {
      const result = await runOneScan(markText, niceClass);
      console.log(`${result.status} ${result.durationMs}ms`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`error ${message}`);
      return {
        markText,
        scanId: "",
        status: "failed",
        durationMs: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        stages: [],
        error: message,
      } satisfies ScanTimingResult;
    }
  });

  const report = buildReport(results);
  const outPath = resolve(process.cwd(), out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(report);
  console.log(`\nWrote ${outPath}`);

  if (report.failedCount > 0 && report.completedCount === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
