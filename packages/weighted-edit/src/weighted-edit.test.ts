import { describe, expect, it } from "vitest";
import { weightedEdit } from "./weighted-edit.js";

describe("weightedEdit", () => {
  it("assigns low cost to ZENZO vs SENZO", () => {
    const result = weightedEdit("ZENZO", "SENZO", "nl");
    expect(result.rawCost).toBeLessThan(1);
    expect(result.normalizedSimilarity).toBeGreaterThan(0.7);
  });

  it("applies ph-f rule for PHLOX vs FLOKS", () => {
    const result = weightedEdit("PHLOX", "FLOKS", "generic");
    expect(result.appliedRuleIds).toContain("ph-f");
    expect(result.rawCost).toBeLessThan(2);
  });

  it("links scan and zkan via s-z and c-k under en", () => {
    const result = weightedEdit("scan", "zkan", "en");
    expect(result.appliedRuleIds).toEqual(expect.arrayContaining(["s-z", "c-k"]));
    expect(result.rawCost).toBeLessThan(1);
    expect(result.normalizedSimilarity).toBeGreaterThan(0.7);
  });

  it("links scan and zkan under generic locale", () => {
    const result = weightedEdit("scan", "zkan", "generic");
    expect(result.appliedRuleIds).toContain("s-z");
    expect(result.normalizedSimilarity).toBeGreaterThan(0.7);
  });

  it("handles empty strings without NaN", () => {
    const bothEmpty = weightedEdit("", "");
    expect(bothEmpty.rawCost).toBe(0);
    expect(Number.isNaN(bothEmpty.normalizedSimilarity)).toBe(false);

    const oneEmpty = weightedEdit("abc", "");
    expect(oneEmpty.rawCost).toBe(3);
    expect(Number.isNaN(oneEmpty.normalizedSimilarity)).toBe(false);
  });
});
