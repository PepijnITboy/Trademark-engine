import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPECTED_TOTAL_MS,
  PRE_COMPLETE_CAP,
  SCAN_STAGE_WEIGHTS,
  computeProgressTarget,
  computeSoftFloor,
  resolveExpectedTotalMs,
  resolveStageBand,
} from "../src/composables/useSmoothScanProgress";
import {
  PROGRESS_CHECKPOINTS,
  checkpointState,
  resolveActiveCheckpoint,
} from "../src/components/scan-progress/checkpoints";
import type { ScanStage } from "../src/api/client";

function stagesFrom(
  map: Record<string, ScanStage["status"]>,
): ScanStage[] {
  return Object.keys(SCAN_STAGE_WEIGHTS).map((id) => ({
    id,
    label: id,
    status: map[id] ?? "pending",
  }));
}

function completeThrough(lastCompleteId: string): Record<string, ScanStage["status"]> {
  const map: Record<string, ScanStage["status"]> = {};
  for (const id of Object.keys(SCAN_STAGE_WEIGHTS)) {
    map[id] = "complete";
    if (id === lastCompleteId) {
      break;
    }
  }
  return map;
}

describe("SCAN_STAGE_WEIGHTS", () => {
  it("sums to 100 and includes attorney_analysis", () => {
    const sum = Object.values(SCAN_STAGE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(SCAN_STAGE_WEIGHTS.attorney_analysis).toBe(10);
    expect(Object.keys(SCAN_STAGE_WEIGHTS)).toEqual([
      "validate",
      "normalize",
      "exact_retrieval",
      "transliteration_retrieval",
      "trigram_retrieval",
      "phonetic_retrieval",
      "union",
      "pruning",
      "comparison",
      "scoring",
      "attorney_analysis",
      "complete",
    ]);
  });
});

describe("computeSoftFloor", () => {
  it("gives half-credit while a stage is running", () => {
    const floor = computeSoftFloor(
      stagesFrom({
        validate: "complete",
        normalize: "complete",
        exact_retrieval: "running",
      }),
    );
    // 5+5 complete + 12*0.5 running = 16
    expect(floor).toBe(16);
  });

  it("scales for batch scans", () => {
    const floor = computeSoftFloor(
      stagesFrom({
        validate: "complete",
        normalize: "complete",
      }),
      0,
      2,
    );
    expect(floor).toBe(5);
  });
});

describe("resolveStageBand", () => {
  it("returns the cumulative band for the running stage", () => {
    const stages = stagesFrom({
      ...completeThrough("scoring"),
      attorney_analysis: "running",
    });
    const band = resolveStageBand(stages);
    expect(band).toEqual({ start: 88, end: 98 });
  });
});

describe("resolveExpectedTotalMs", () => {
  it("uses elapsed + remaining when ETA is known", () => {
    expect(resolveExpectedTotalMs(10_000, 50_000)).toBe(60_000);
  });

  it("clamps to a wide window for long model stages", () => {
    expect(resolveExpectedTotalMs(500, 500)).toBe(2_000);
    expect(resolveExpectedTotalMs(100_000, 700_000)).toBe(600_000);
  });

  it("falls back to the calibrated default when remaining is unknown", () => {
    expect(resolveExpectedTotalMs(5_000, null)).toBe(DEFAULT_EXPECTED_TOTAL_MS);
  });

  it("smooths with EMA when a previous estimate exists", () => {
    const next = resolveExpectedTotalMs(20_000, 40_000, 80_000);
    // 0.35 * 60_000 + 0.65 * 80_000 = 73_000
    expect(next).toBe(73_000);
  });
});

describe("computeProgressTarget", () => {
  it("returns 100 when completed", () => {
    expect(
      computeProgressTarget({
        stages: stagesFrom(completeThrough("complete")),
        elapsedMs: 0,
        stageElapsedMs: 0,
        estimatedRemainingMs: 0,
        apiPercentComplete: 100,
        scanCompleted: true,
      }),
    ).toBe(100);
  });

  it("stays under the pre-complete cap until done", () => {
    const stages = stagesFrom({
      ...completeThrough("scoring"),
      attorney_analysis: "running",
    });
    const early = computeProgressTarget({
      stages,
      elapsedMs: 40_000,
      stageElapsedMs: 20_000,
      estimatedRemainingMs: 60_000,
      apiPercentComplete: 93,
      scanCompleted: false,
    });
    expect(early).toBeGreaterThan(88);
    expect(early).toBeLessThan(PRE_COMPLETE_CAP);
  });

  it("does not park at the cap while attorney is still running with remaining ETA", () => {
    const stages = stagesFrom({
      ...completeThrough("scoring"),
      attorney_analysis: "running",
    });
    const target = computeProgressTarget({
      stages,
      elapsedMs: 40_000,
      stageElapsedMs: 25_000,
      estimatedRemainingMs: 70_000,
      apiPercentComplete: 93,
      scanCompleted: false,
    });
    expect(target).toBeLessThan(PRE_COMPLETE_CAP - 1);
    expect(target).toBeGreaterThanOrEqual(88);
  });

  it("keeps climbing through a long attorney phase as ETA shrinks", () => {
    const stages = stagesFrom({
      ...completeThrough("scoring"),
      attorney_analysis: "running",
    });

    const samples: number[] = [];
    const total = 90_000;
    for (let elapsed = 5_000; elapsed <= total; elapsed += 10_000) {
      const remaining = Math.max(0, total - elapsed);
      samples.push(
        computeProgressTarget({
          stages,
          elapsedMs: 30_000 + elapsed,
          stageElapsedMs: elapsed,
          estimatedRemainingMs: remaining,
          apiPercentComplete: 93,
          scanCompleted: false,
        }),
      );
    }

    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!);
    }
    expect(samples[samples.length - 1]! - samples[0]!).toBeGreaterThan(2);
    expect(samples[samples.length - 1]!).toBeLessThanOrEqual(PRE_COMPLETE_CAP);
  });

  it("moves within an early stage band without jumping to the end", () => {
    const stages = stagesFrom({
      validate: "complete",
      normalize: "complete",
      exact_retrieval: "running",
    });
    const target = computeProgressTarget({
      stages,
      elapsedMs: 2_000,
      stageElapsedMs: 1_000,
      estimatedRemainingMs: 20_000,
      apiPercentComplete: 16,
      scanCompleted: false,
    });
    expect(target).toBeGreaterThanOrEqual(10);
    expect(target).toBeLessThan(40);
  });
});

describe("checkpoints", () => {
  it("marks checkpoints complete by percent thresholds", () => {
    expect(checkpointState(PROGRESS_CHECKPOINTS[0]!, 10, false)).toBe("active");
    expect(checkpointState(PROGRESS_CHECKPOINTS[0]!, 22, false)).toBe("complete");
    expect(checkpointState(PROGRESS_CHECKPOINTS[1]!, 30, false)).toBe("active");
    expect(resolveActiveCheckpoint(30, false).id).toBe("similarity");
  });

  it("returns final checkpoint when scan completed", () => {
    expect(resolveActiveCheckpoint(50, true).id).toBe("final");
    expect(PROGRESS_CHECKPOINTS).toHaveLength(4);
  });
});

describe("checkpoint layout contract", () => {
  it("keeps narrative checkpoint positions evenly spaced on the bar", () => {
    expect(PROGRESS_CHECKPOINTS.map((c) => c.threshold)).toEqual([22, 48, 72, 95]);
  });
});
