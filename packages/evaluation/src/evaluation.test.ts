import { describe, expect, it } from "vitest";
import { CRITICAL_PAIRS } from "@trademark-engine/fixtures";
import { computeRecallAtK, criticalHitRecall } from "./recall.js";

describe("evaluation metrics", () => {
  it("computeRecallAtK on tiny fixture", () => {
    const recall = computeRecallAtK(["eu-001", "eu-002"], ["eu-002", "eu-003", "eu-001"], 2);
    expect(recall).toBe(0.5);
  });

  it("criticalHitRecall on tiny fixture", () => {
    const pairs = CRITICAL_PAIRS.filter((pair) => pair.query === "ZENZO").map((pair) => ({
      query: pair.query,
      candidate: pair.candidate,
      mustRetrieve: pair.mustRetrieve,
    }));

    const recall = criticalHitRecall(pairs, {
      ZENZO: ["SENZO", "ZEN-ZO", "ZÉNZO"],
    });

    expect(recall).toBeGreaterThan(0);
  });
});
