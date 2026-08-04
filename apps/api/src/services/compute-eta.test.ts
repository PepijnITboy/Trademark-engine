import { describe, expect, it } from "vitest";
import {
  SCAN_STAGE_WEIGHTS,
  computeEta,
  computePercentComplete,
} from "./compute-eta.js";

describe("computeEta", () => {
  it("returns null when no progress has been made", () => {
    const statuses = Object.fromEntries(
      Object.keys(SCAN_STAGE_WEIGHTS).map((id) => [id, "pending" as const]),
    );

    expect(computeEta(SCAN_STAGE_WEIGHTS, statuses, 1_000)).toBeNull();
  });

  it("estimates remaining time from completed weight", () => {
    const statuses: Record<string, "pending" | "running" | "complete" | "failed"> = {
      validate: "complete",
      normalize: "complete",
      exact_retrieval: "running",
      trigram_retrieval: "pending",
      phonetic_retrieval: "pending",
      union: "pending",
      pruning: "pending",
      comparison: "pending",
      scoring: "pending",
      complete: "pending",
    };

    const remaining = computeEta(SCAN_STAGE_WEIGHTS, statuses, 10_000);
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThan(0);
  });

  it("returns zero remaining time when all stages are complete", () => {
    const statuses = Object.fromEntries(
      Object.keys(SCAN_STAGE_WEIGHTS).map((id) => [id, "complete" as const]),
    );

    expect(computeEta(SCAN_STAGE_WEIGHTS, statuses, 5_000)).toBe(0);
  });
});

describe("computePercentComplete", () => {
  it("reports half credit for running stages", () => {
    const statuses: Record<string, "pending" | "running" | "complete" | "failed"> = {
      validate: "complete",
      normalize: "running",
      exact_retrieval: "pending",
      trigram_retrieval: "pending",
      phonetic_retrieval: "pending",
      union: "pending",
      pruning: "pending",
      comparison: "pending",
      scoring: "pending",
      attorney_analysis: "pending",
      complete: "pending",
    };

    expect(computePercentComplete(SCAN_STAGE_WEIGHTS, statuses)).toBe(8);
  });

  it("includes attorney_analysis in stage weights", () => {
    expect(SCAN_STAGE_WEIGHTS.attorney_analysis).toBe(10);
    const total = Object.values(SCAN_STAGE_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });
});
