import { describe, expect, it } from "vitest";
import { groupIntoFamilies, rankResults, type RankableResult } from "./ranking.js";

function item(
  partial: Partial<RankableResult> & Pick<RankableResult, "id" | "markText" | "experimentalConflictScore">,
): RankableResult {
  return {
    confidence: "medium",
    riskBand: "relevant",
    independentChannelCount: 1,
    activeRight: false,
    ...partial,
  };
}

describe("rankResults", () => {
  it("orders by experimental conflict score then confidence then id", () => {
    const ranked = rankResults([
      item({ id: "b", markText: "B", experimentalConflictScore: 70, confidence: "high" }),
      item({ id: "a", markText: "A", experimentalConflictScore: 90, confidence: "low" }),
      item({ id: "c", markText: "C", experimentalConflictScore: 70, confidence: "low" }),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("is deterministic for identical scores", () => {
    const input = [
      item({ id: "z", markText: "Z", experimentalConflictScore: 50 }),
      item({ id: "m", markText: "M", experimentalConflictScore: 50 }),
      item({ id: "a", markText: "A", experimentalConflictScore: 50 }),
    ];
    expect(rankResults(input).map((r) => r.id)).toEqual(["a", "m", "z"]);
    expect(rankResults(input).map((r) => r.id)).toEqual(["a", "m", "z"]);
  });
});

describe("groupIntoFamilies", () => {
  it("collapses identical normalized names into one family", () => {
    const groups = groupIntoFamilies([
      item({ id: "1", markText: "ZENZO", experimentalConflictScore: 90 }),
      item({ id: "2", markText: "Zen-Zo", experimentalConflictScore: 88 }),
      item({ id: "3", markText: "SENZO", experimentalConflictScore: 70 }),
    ]);
    const zenzo = groups.find((g) => g.familyKey.includes("zenzo"));
    expect(zenzo?.memberCount).toBe(2);
    expect(groups.some((g) => g.representative.markText.toUpperCase().includes("SENZO"))).toBe(
      true,
    );
  });
});
