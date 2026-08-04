import { onUnmounted, ref, type Ref } from "vue";
import type { ScanProgressResponse, ScanStage } from "../api/client";

/** Mirror of API stage weights — sum must stay 100. */
export const SCAN_STAGE_WEIGHTS: Readonly<Record<string, number>> = {
  validate: 5,
  normalize: 5,
  exact_retrieval: 12,
  transliteration_retrieval: 6,
  trigram_retrieval: 12,
  phonetic_retrieval: 10,
  union: 5,
  pruning: 10,
  comparison: 15,
  scoring: 8,
  attorney_analysis: 10,
  complete: 2,
};

/** Leave headroom until scan status is completed. */
export const PRE_COMPLETE_CAP = 96;
/**
 * Fallback when API ETA is unknown.
 * Calibrated from engine-only benches (attorney off); live ETA stretches when attorney is on.
 */
export const DEFAULT_EXPECTED_TOTAL_MS = 5_000;

export const MIN_EXPECTED_TOTAL_MS = 2_000;
export const MAX_EXPECTED_TOTAL_MS = 600_000;
const EMA_ALPHA = 0.35;

export interface StageBand {
  start: number;
  end: number;
}

/** Soft floor: completed weight + half-credit for running (matches API percent). */
export function computeSoftFloor(
  stages: readonly Pick<ScanStage, "id" | "status">[],
  markIndex = 0,
  markTotal = 1,
): number {
  const totalWeight = Object.values(SCAN_STAGE_WEIGHTS).reduce(
    (sum, weight) => sum + weight,
    0,
  );

  let creditedWeight = 0;
  for (const [stageId, weight] of Object.entries(SCAN_STAGE_WEIGHTS)) {
    const status = stages.find((stage) => stage.id === stageId)?.status ?? "pending";
    if (status === "complete") {
      creditedWeight += weight;
    } else if (status === "running") {
      creditedWeight += weight * 0.5;
    }
  }

  let floor = (creditedWeight / totalWeight) * 100;
  if (markTotal > 1) {
    floor = ((markIndex + floor / 100) / markTotal) * 100;
  }

  return clamp(round2(floor), 0, 100);
}

/** Cumulative percent band for the currently running stage. */
export function resolveStageBand(
  stages: readonly Pick<ScanStage, "id" | "status">[],
): StageBand | null {
  const totalWeight = Object.values(SCAN_STAGE_WEIGHTS).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  if (totalWeight <= 0) {
    return null;
  }

  let cumulative = 0;
  for (const [stageId, weight] of Object.entries(SCAN_STAGE_WEIGHTS)) {
    const status = stages.find((stage) => stage.id === stageId)?.status ?? "pending";
    const start = (cumulative / totalWeight) * 100;
    const end = ((cumulative + weight) / totalWeight) * 100;
    if (status === "running") {
      return { start: round2(start), end: round2(end) };
    }
    if (status === "complete") {
      cumulative += weight;
    }
  }

  // No running stage: band from completed floor to next pending stage if any
  cumulative = 0;
  for (const [stageId, weight] of Object.entries(SCAN_STAGE_WEIGHTS)) {
    const status = stages.find((stage) => stage.id === stageId)?.status ?? "pending";
    if (status === "complete") {
      cumulative += weight;
      continue;
    }
    const start = (cumulative / totalWeight) * 100;
    const end = ((cumulative + weight) / totalWeight) * 100;
    return { start: round2(start), end: round2(end) };
  }

  return { start: 100, end: 100 };
}

/**
 * Expected total duration from elapsed + remaining ETA.
 * Optional previous estimate applies EMA to avoid stutter.
 */
export function resolveExpectedTotalMs(
  elapsedMs: number,
  estimatedRemainingMs: number | null,
  previousEstimateMs?: number,
): number {
  if (estimatedRemainingMs === null || estimatedRemainingMs === undefined) {
    return previousEstimateMs ?? DEFAULT_EXPECTED_TOTAL_MS;
  }

  const raw = clamp(
    Math.max(0, elapsedMs) + Math.max(0, estimatedRemainingMs),
    MIN_EXPECTED_TOTAL_MS,
    MAX_EXPECTED_TOTAL_MS,
  );

  if (previousEstimateMs === undefined) {
    return round2(raw);
  }

  return round2(EMA_ALPHA * raw + (1 - EMA_ALPHA) * previousEstimateMs);
}

export interface ProgressTargetInput {
  stages: readonly Pick<ScanStage, "id" | "status">[];
  elapsedMs: number;
  stageElapsedMs: number;
  estimatedRemainingMs: number | null;
  apiPercentComplete: number;
  scanCompleted: boolean;
  markIndex?: number;
  markTotal?: number;
  previousExpectedTotalMs?: number;
}

/**
 * Stage-band progress: truth floor + ETA fill within the current band.
 * Never parks at PRE_COMPLETE_CAP while a late stage still has remaining work.
 */
export function computeProgressTarget(input: ProgressTargetInput): number {
  if (input.scanCompleted) {
    return 100;
  }

  const markIndex = input.markIndex ?? 0;
  const markTotal = input.markTotal ?? 1;
  const softFloor = computeSoftFloor(input.stages, markIndex, markTotal);
  const truthFloor = Math.max(softFloor, input.apiPercentComplete * 0.95);

  const band = resolveStageBand(input.stages);
  const bandEndCap = Math.min(
    PRE_COMPLETE_CAP,
    (band?.end ?? PRE_COMPLETE_CAP) - 0.5,
  );
  const bandStart = band?.start ?? 0;

  const expectedTotalMs = resolveExpectedTotalMs(
    input.elapsedMs,
    input.estimatedRemainingMs,
    input.previousExpectedTotalMs,
  );

  // Prefer stage-local progress so long late stages crawl their own band.
  const stageDenom = Math.max(
    1,
    input.stageElapsedMs + Math.max(0, input.estimatedRemainingMs ?? 0),
  );
  let t: number;
  if (input.estimatedRemainingMs !== null && input.estimatedRemainingMs !== undefined) {
    t = clamp(input.stageElapsedMs / stageDenom, 0, 1);
  } else {
    t = clamp(input.elapsedMs / Math.max(1, expectedTotalMs), 0, 1);
  }

  const eased = easeInOut(t);
  // Crawl from the higher of band start / truth floor toward band end.
  const low = Math.min(bandEndCap, Math.max(truthFloor, bandStart));
  const high = Math.max(low, bandEndCap);
  const raw = low + (high - low) * eased;

  return clamp(round2(Math.max(raw, truthFloor)), 0, PRE_COMPLETE_CAP);
}

/** @deprecated Use computeProgressTarget */
export function computeOptimisticPercent(
  elapsedMs: number,
  expectedTotalMs: number,
  softFloor: number,
  scanCompleted: boolean,
): number {
  return computeProgressTarget({
    stages: [],
    elapsedMs,
    stageElapsedMs: elapsedMs,
    estimatedRemainingMs:
      expectedTotalMs > elapsedMs ? expectedTotalMs - elapsedMs : 0,
    apiPercentComplete: softFloor,
    scanCompleted,
  });
}

/** @deprecated Use computeProgressTarget */
export const computeAsymptoticPercent = computeOptimisticPercent;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useSmoothScanProgress(
  progress: Ref<ScanProgressResponse | undefined>,
  scanStatus: Ref<string | undefined>,
) {
  const displayPercent = ref(0);
  const finishing = ref(false);
  const readyToNavigate = ref(false);

  let rafId = 0;
  let startedAt = 0;
  let finishStartedAt = 0;
  let stageStartedAt = 0;
  let lastRunningStageId: string | null = null;
  let previousExpectedTotalMs: number | undefined;

  function tick(now: number) {
    const data = progress.value;
    const completed = scanStatus.value === "completed";

    if (!startedAt) {
      startedAt = now;
    }

    if (!data && !completed) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const stages = data?.stages ?? [];
    const markIndex = data?.currentMarkIndex ?? 0;
    const markTotal = data?.markTotal ?? 1;
    const runningId =
      stages.find((stage) => stage.status === "running")?.id ?? null;

    if (runningId !== lastRunningStageId) {
      lastRunningStageId = runningId;
      stageStartedAt = now;
    }
    if (!stageStartedAt) {
      stageStartedAt = now;
    }

    const elapsedMs = now - startedAt;
    const stageElapsedMs = now - stageStartedAt;
    const estimatedRemainingMs = data?.estimatedRemainingMs ?? null;

    previousExpectedTotalMs = resolveExpectedTotalMs(
      elapsedMs,
      estimatedRemainingMs,
      previousExpectedTotalMs,
    );

    let target = computeProgressTarget({
      stages,
      elapsedMs,
      stageElapsedMs,
      estimatedRemainingMs,
      apiPercentComplete: data?.percentComplete ?? 0,
      scanCompleted: completed,
      markIndex,
      markTotal,
      previousExpectedTotalMs,
    });

    if (completed) {
      if (!finishing.value) {
        finishing.value = true;
        finishStartedAt = now;
      }
      target = 100;
      if (now - finishStartedAt >= 700 && displayPercent.value >= 99.4) {
        readyToNavigate.value = true;
      }
    }

    const current = displayPercent.value;
    const delta = Math.max(0, target - current);
    const catchUp = delta > 10 ? 0.14 : 0.09;
    displayPercent.value = Math.max(current, Math.min(100, current + delta * catchUp));

    if (completed && displayPercent.value >= 99.8) {
      displayPercent.value = 100;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  onUnmounted(() => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  });

  return {
    displayPercent,
    finishing,
    readyToNavigate,
  };
}
