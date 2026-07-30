import { describe, expect, it } from "vitest";
import { buildComparableFromMarkText, compareTrademarkPair } from "./compare-pair.js";

describe("compareTrademarkPair", () => {
  it("scores ZENZO vs ZENZO as exact high similarity", () => {
    const proposed = buildComparableFromMarkText("ZENZO", [32]);
    const existing = buildComparableFromMarkText("ZENZO", [32]);

    const result = compareTrademarkPair(proposed, existing, {
      proposedNiceClasses: [32],
      candidateNiceClasses: [32],
      proposedGoodsTexts: ["soft drinks"],
      candidateGoodsTexts: ["non-alcoholic beverages"],
    });

    expect(result.features.exact.compactMatch).toBe(1);
    expect(result.features.exact.normalizedMatch).toBe(1);
    expect(result.evidenceCodes).toContain("exact_normalized");
    expect((result.features.orthographic.jaroWinklerSimilarity ?? 0)).toBeGreaterThanOrEqual(0.99);
  });

  it("scores ZENZO vs SENZO with high orthographic and phonetic signals", () => {
    const proposed = buildComparableFromMarkText("ZENZO");
    const existing = buildComparableFromMarkText("SENZO");

    const result = compareTrademarkPair(proposed, existing);

    expect(result.features.orthographic.jaroWinklerSimilarity ?? 0).toBeGreaterThan(0.7);
    expect(result.features.phonetic.primaryKeyMatch).toBe(1);
    expect(result.features.phonetic.pronunciationSimilarity ?? 0).toBeGreaterThan(0.7);
    expect(result.evidenceCodes).toContain("orthographic_high");
    expect(result.evidenceCodes).toContain("phonetic_primary_match");
  });

  it("returns null goods concept overlap when goods text is missing", () => {
    const proposed = buildComparableFromMarkText("ZENZO", [32]);
    const existing = buildComparableFromMarkText("ZENZO", [32]);

    const result = compareTrademarkPair(proposed, existing, {
      proposedNiceClasses: [32],
      candidateNiceClasses: [32],
    });

    expect(result.features.goodsServices.conceptOverlap).toBeNull();
    expect(result.evidenceCodes).toContain("goods_missing");
  });

  it("marks coreEmpty and noise-only for all-weak marks", () => {
    const proposed = buildComparableFromMarkText("PREMIUM ORIGINAL BEVERAGES");
    const existing = buildComparableFromMarkText("PREMIUM CARE");

    const result = compareTrademarkPair(proposed, existing);
    expect(result.features.token.coreEmpty).toBe(1);
    expect(result.evidenceCodes).toContain("token_core_empty");
  });

  it("scores distinctive cores without soft dominance", () => {
    const proposed = buildComparableFromMarkText("ZOR-VEX Soft");
    const existing = buildComparableFromMarkText("HEX SOFT");

    const result = compareTrademarkPair(proposed, existing);
    expect(result.features.token.dominantTokenOverlap).not.toBe(1);
    expect(proposed.tokens.dominantToken).not.toBe("soft");
  });

  it("computes affix on significant cores, ignoring noise particles", () => {
    const proposed = buildComparableFromMarkText("VAN LUMINA");
    const particleFriend = buildComparableFromMarkText("VANINA");
    const coreFriend = buildComparableFromMarkText("LUMINA");

    const vsParticle = compareTrademarkPair(proposed, particleFriend);
    const vsCore = compareTrademarkPair(proposed, coreFriend);

    // Full-string "vanlumina"↔"vanina" would share a VAN prefix; cores must not.
    expect(vsParticle.features.token.prefixOverlap ?? 0).toBeLessThan(0.2);
    expect(vsCore.features.token.dominantTokenOverlap).toBe(1);
    expect(vsCore.features.token.coreCompactMatch).toBe(1);
  });

  it("keeps strong core prefix between multi-token near-cores", () => {
    const proposed = buildComparableFromMarkText("ZORVEX DRINKS");
    const existing = buildComparableFromMarkText("ZORVEC");

    const result = compareTrademarkPair(proposed, existing);
    expect(result.features.token.prefixOverlap ?? 0).toBeGreaterThanOrEqual(0.7);
  });

  it("scores cross-script transliteration against Latin corpus forms", () => {
    const proposed = buildComparableFromMarkText("ФЛОКС");
    const existing = buildComparableFromMarkText("FLOX");

    const result = compareTrademarkPair(proposed, existing);
    expect(result.features.orthographic.trigramDice ?? 0).toBeGreaterThanOrEqual(0.4);
    expect(result.features.orthographic.jaroWinklerSimilarity ?? 0).toBeGreaterThan(0.8);
    expect(result.features.token.prefixOverlap ?? 0).toBeGreaterThan(0.4);
    expect(proposed.phonetics.primary).toBe(existing.phonetics.primary);
  });

  it("marks exact transliteration match for Cyrillic→Latin identity", () => {
    const proposed = buildComparableFromMarkText("ФЛОКС");
    const existing = buildComparableFromMarkText("FLOKS");

    const result = compareTrademarkPair(proposed, existing);
    expect(result.features.exact.transliterationMatch).toBe(1);
  });

  it("compares noise-stripped cores for multi-descriptive queries", () => {
    const proposed = buildComparableFromMarkText("ZORVEX Soft Drinks");
    const existing = buildComparableFromMarkText("ZORVEC");

    const result = compareTrademarkPair(proposed, existing);
    expect(result.features.orthographic.levenshteinSimilarity ?? 0).toBeGreaterThanOrEqual(0.8);
    expect(result.features.token.prefixOverlap ?? 0).toBeGreaterThanOrEqual(0.7);
    expect(proposed.phonetics.primary).toBe(existing.phonetics.primary);
  });

  it("demotes short-stem orthographic inflation vs longer cores", () => {
    const proposed = buildComparableFromMarkText("LUMINA");
    const shortStem = buildComparableFromMarkText("LUMIN");
    const near = buildComparableFromMarkText("LUMINA");

    const vsShort = compareTrademarkPair(proposed, shortStem);
    const vsNear = compareTrademarkPair(proposed, near);

    expect(vsShort.features.orthographic.levenshteinSimilarity ?? 0).toBeLessThan(
      vsNear.features.orthographic.levenshteinSimilarity ?? 0,
    );
    expect(vsShort.features.orthographic.levenshteinSimilarity ?? 0).toBeLessThan(0.85);
  });

  it("is deterministic for identical input", () => {
    const proposed = buildComparableFromMarkText("LUNA");
    const existing = buildComparableFromMarkText("LUNA CAFE");

    const first = compareTrademarkPair(proposed, existing);
    const second = compareTrademarkPair(proposed, existing);
    expect(first.features).toEqual(second.features);
    expect(first.evidenceCodes).toEqual(second.evidenceCodes);
  });

  it("does not treat ㎾h as exact-ortho match to bare H", () => {
    const proposed = buildComparableFromMarkText("㎾h");
    const existing = buildComparableFromMarkText("H");
    const near = buildComparableFromMarkText("KWH");

    const vsH = compareTrademarkPair(proposed, existing);
    const vsKwh = compareTrademarkPair(proposed, near);

    expect(vsH.features.orthographic.levenshteinSimilarity ?? 0).toBeLessThan(0.5);
    expect(vsKwh.features.exact.compactMatch).toBe(1);
    expect(vsKwh.features.orthographic.levenshteinSimilarity ?? 0).toBe(1);
  });
});

describe("buildComparableFromMarkText", () => {
  it("builds normalized and phonetic features", () => {
    const comparable = buildComparableFromMarkText("ZÉNZO", [32, 33]);
    expect(comparable.normalized.compact).toBe("zenzo");
    expect(comparable.phonetics.primary.length).toBeGreaterThan(0);
    expect(comparable.niceClasses).toEqual([32, 33]);
  });
});
