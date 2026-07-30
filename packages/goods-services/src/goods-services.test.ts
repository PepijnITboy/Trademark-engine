import { describe, expect, it } from "vitest";
import { compareGoodsServices } from "./compare-goods-services.js";

describe("compareGoodsServices", () => {
  it("returns null concreteSimilarity and warning when goods text is missing", () => {
    const result = compareGoodsServices({
      proposedNiceClasses: [32],
      candidateNiceClasses: [32],
      candidateTexts: ["non-alcoholic beverages"],
    });

    expect(result.concreteSimilarity).toBeNull();
    expect(result.concreteTermCoverage).toBeNull();
    expect(result.warnings).toContain("missing_proposed_goods_text");
  });

  it("returns overlap 1 for identical Nice classes", () => {
    const result = compareGoodsServices({
      proposedNiceClasses: [32, 33],
      proposedTexts: ["beer", "soft drinks"],
      candidateNiceClasses: [32, 33],
      candidateTexts: ["beer", "mineral water"],
    });

    expect(result.niceClassOverlap).toBe(1);
  });

  it("never treats missing goods as zero similarity", () => {
    const result = compareGoodsServices({
      proposedNiceClasses: [25],
      candidateNiceClasses: [25],
    });

    expect(result.concreteSimilarity).toBeNull();
    expect(result.concreteSimilarity).not.toBe(0);
  });
});
