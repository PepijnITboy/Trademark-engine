import { describe, expect, it } from "vitest";
import {
  ENGINE_VERSION,
  NORMALIZATION_VERSION,
  SCORE_VERSION,
  type TrademarkFeatureVector,
} from "@trademark-engine/domain";
import { scoreFromFeatures } from "./score.js";

function emptyVector(overrides: Partial<{
  exact: Partial<TrademarkFeatureVector["exact"]>;
  orthographic: Partial<TrademarkFeatureVector["orthographic"]>;
  token: Partial<TrademarkFeatureVector["token"]>;
  phonetic: Partial<TrademarkFeatureVector["phonetic"]>;
  conceptual: Partial<TrademarkFeatureVector["conceptual"]>;
  goodsServices: Partial<TrademarkFeatureVector["goodsServices"]>;
}> = {}): TrademarkFeatureVector {
  return {
    exact: {
      normalizedMatch: null,
      compactMatch: null,
      caseFoldedMatch: null,
      transliterationMatch: null,
      ...overrides.exact,
    },
    orthographic: {
      levenshteinSimilarity: null,
      damerauLevenshteinSimilarity: null,
      jaroSimilarity: null,
      jaroWinklerSimilarity: null,
      weightedEditSimilarity: null,
      trigramDice: null,
      lcsSimilarity: null,
      ...overrides.orthographic,
    },
    token: {
      dominantTokenOverlap: null,
      tokenJaccard: null,
      sharedRareTokenCount: null,
      prefixOverlap: null,
      suffixOverlap: null,
      significantOverlap: null,
      noiseOnlyOverlap: null,
      coreCompactMatch: null,
      coreEmpty: null,
      secondarySignificantOverlap: null,
      ...overrides.token,
    },
    phonetic: {
      primaryKeyMatch: null,
      secondaryKeyMatch: null,
      pronunciationSimilarity: null,
      skeletonMatch: null,
      ...overrides.phonetic,
    },
    conceptual: {
      lexiconOverlap: null,
      translationProximity: null,
      descriptiveOverlap: null,
      ...overrides.conceptual,
    },
    goodsServices: {
      niceClassOverlap: null,
      conceptOverlap: null,
      coverage: "unknown",
      ...overrides.goodsServices,
    },
    context: {
      statusRelevance: null,
      dateProximity: null,
      registryRelevance: null,
    },
    retrieval: {
      strategies: [],
      maxStrategyRank: null,
      evidenceCount: 0,
      independentFamilyHits: [],
    },
    metadata: {
      engineVersion: ENGINE_VERSION,
      normalizationVersion: NORMALIZATION_VERSION,
      scoreVersion: SCORE_VERSION,
      computedAt: "2026-07-30T00:00:00.000Z",
      evidenceIds: [],
    },
  };
}

describe("scoreFromFeatures", () => {
  it("scores exact match as very_strong 100", () => {
    const output = scoreFromFeatures(
      emptyVector({
        exact: {
          normalizedMatch: 1,
          compactMatch: 1,
          caseFoldedMatch: 1,
          transliterationMatch: 1,
        },
      }),
    );

    expect(output.riskBand).toBe("very_strong");
    expect(output.experimentalConflictScore).toBe(100);
  });

  it("lifts non-dominant dual-core half above weak without restoring dominant fragments", () => {
    const secondCore = scoreFromFeatures(
      emptyVector({
        orthographic: { levenshteinSimilarity: 0.5 },
        token: {
          dominantTokenOverlap: 0,
          significantOverlap: 0.5,
          coreCompactMatch: 0,
          tokenJaccard: 0.5,
          noiseOnlyOverlap: 0,
          coreEmpty: 0,
        },
      }),
    );
    expect(secondCore.experimentalConflictScore).toBeGreaterThanOrEqual(75);

    const dominantFragment = scoreFromFeatures(
      emptyVector({
        orthographic: { levenshteinSimilarity: 0.56 },
        token: {
          dominantTokenOverlap: 1,
          significantOverlap: 0.5,
          coreCompactMatch: 0,
          tokenJaccard: 0.5,
          noiseOnlyOverlap: 0,
          coreEmpty: 0,
        },
      }),
    );
    expect(dominantFragment.experimentalConflictScore).toBeLessThan(80);
  });

  it("does not let dominant fragment alone score as exact token identity", () => {
    // well-being vs BEING: dominant match on longer half, partial sig, no core match.
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: {
          levenshteinSimilarity: 0.56,
          damerauLevenshteinSimilarity: 0.56,
          weightedEditSimilarity: 0.56,
          jaroWinklerSimilarity: 0.44,
        },
        token: {
          dominantTokenOverlap: 1,
          significantOverlap: 0.5,
          coreCompactMatch: 0,
          tokenJaccard: 0.5,
          noiseOnlyOverlap: 0,
          coreEmpty: 0,
          prefixOverlap: 0,
          suffixOverlap: 0.56,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeLessThan(80);
    expect(output.riskBand).not.toBe("very_strong");
  });

  it("keeps sole-significant core identity (VAN LUMINA↔LUMINA)", () => {
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: {
          levenshteinSimilarity: 1,
          jaroWinklerSimilarity: 1,
        },
        token: {
          dominantTokenOverlap: 1,
          significantOverlap: 1,
          coreCompactMatch: 1,
          noiseOnlyOverlap: 0,
          coreEmpty: 0,
          prefixOverlap: 1,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeGreaterThanOrEqual(95);
    expect(output.riskBand).toBe("very_strong");
  });

  it("preserves exact identity at 100 even when coreEmpty/weak", () => {
    const output = scoreFromFeatures(
      emptyVector({
        exact: {
          normalizedMatch: 1,
          compactMatch: 1,
          caseFoldedMatch: 1,
          transliterationMatch: 1,
        },
        orthographic: { levenshteinSimilarity: 1, jaroWinklerSimilarity: 1 },
        phonetic: { primaryKeyMatch: 1 },
        token: {
          coreEmpty: 1,
          significantOverlap: 0,
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          noiseOnlyOverlap: 1,
          tokenJaccard: 0,
          sharedRareTokenCount: 0,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBe(100);
    expect(output.riskBand).toBe("very_strong");
    expect(output.confidence).not.toBe("low");
  });

  it("applies descriptive-only penalty", () => {
    const baseline = scoreFromFeatures(
      emptyVector({
        orthographic: { jaroWinklerSimilarity: 0.55 },
        token: { tokenJaccard: 0.4, dominantTokenOverlap: 0.4 },
      }),
    );

    const descriptive = scoreFromFeatures(
      emptyVector({
        orthographic: { jaroWinklerSimilarity: 0.55 },
        token: {
          tokenJaccard: 0.1,
          dominantTokenOverlap: 0.05,
          sharedRareTokenCount: 0,
        },
      }),
    );

    expect(descriptive.experimentalConflictScore).toBeLessThan(
      baseline.experimentalConflictScore,
    );
  });

  it("lowers confidence when goods are missing", () => {
    const output = scoreFromFeatures(
      emptyVector({
        exact: { normalizedMatch: 1, compactMatch: 1, caseFoldedMatch: 1, transliterationMatch: 1 },
        goodsServices: { niceClassOverlap: 1, conceptOverlap: null, coverage: "unknown" },
      }),
      {
        relationship: "high",
        niceClassOverlap: 1,
        relatedClassSignal: 0,
        concreteSimilarity: null,
        concreteTermCoverage: null,
        confidence: "medium",
        warnings: ["missing_proposed_goods_text"],
        version: "1.0.0",
      },
    );

    expect(output.confidence).not.toBe("high");
  });

  it("caps noise-only overlap so ortho alone cannot be very_strong", () => {
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: { jaroWinklerSimilarity: 1 },
        phonetic: { primaryKeyMatch: 1 },
        token: {
          noiseOnlyOverlap: 1,
          significantOverlap: 0,
          coreCompactMatch: 0,
          dominantTokenOverlap: 0,
          tokenJaccard: 0,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeLessThanOrEqual(55);
    expect(output.riskBand).not.toBe("very_strong");
  });

  it("caps coreEmpty so ortho alone cannot be very_strong", () => {
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: { jaroWinklerSimilarity: 1 },
        token: {
          coreEmpty: 1,
          significantOverlap: 0,
          noiseOnlyOverlap: 0,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeLessThanOrEqual(55);
    expect(output.confidence).toBe("low");
  });

  it("keeps high score for distinctive core ortho matches", () => {
    // Realistic ZORVEX vs ZORVEC: high edit-ortho (lev), no exact token overlap.
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: {
          jaroWinklerSimilarity: 0.93,
          levenshteinSimilarity: 0.86,
          damerauLevenshteinSimilarity: 0.86,
        },
        phonetic: { primaryKeyMatch: 1 },
        token: {
          significantOverlap: 0,
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          noiseOnlyOverlap: 0,
          coreEmpty: 0,
          sharedRareTokenCount: 0,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeGreaterThanOrEqual(90);
    expect(output.riskBand).toBe("very_strong");
  });

  it("caps high Jaro–Winkler phonetic hits when edit distance is weak", () => {
    // VANILLA/CASTELLARI-style: JW+phonetic high, levenshtein modest, weak affix.
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: {
          jaroWinklerSimilarity: 0.84,
          levenshteinSimilarity: 0.45,
          lcsSimilarity: 0.55,
        },
        phonetic: { primaryKeyMatch: 1 },
        token: {
          significantOverlap: 0,
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          noiseOnlyOverlap: 0,
          prefixOverlap: 0.27,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeLessThanOrEqual(55);
    expect(output.riskBand).not.toBe("very_strong");
  });

  it("keeps multi-token near-core phonetic hits when edit-ortho corroborates", () => {
    // ZORVEX Soft Drinks vs ZORVEC via core forms: strong edit + JW + prefix.
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: {
          jaroWinklerSimilarity: 0.93,
          levenshteinSimilarity: 0.83,
          damerauLevenshteinSimilarity: 0.83,
          weightedEditSimilarity: 0.83,
        },
        phonetic: { primaryKeyMatch: 1 },
        token: {
          significantOverlap: 0,
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          noiseOnlyOverlap: 0,
          prefixOverlap: 0.83,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeGreaterThanOrEqual(80);
    expect(output.riskBand).toBe("very_strong");
  });

  it("caps JW+affix phonetic hits without edit-ortho corroboration", () => {
    // WELL PANE vs well-being: phonetic identity, JW≈85, weak prefix, modest lev.
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: {
          jaroWinklerSimilarity: 0.85,
          levenshteinSimilarity: 0.56,
          damerauLevenshteinSimilarity: 0.56,
          weightedEditSimilarity: 0.56,
          lcsSimilarity: 0.56,
        },
        phonetic: { primaryKeyMatch: 1, pronunciationSimilarity: 1 },
        token: {
          significantOverlap: 0.33,
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          noiseOnlyOverlap: 0,
          prefixOverlap: 0.44,
          tokenJaccard: 0.33,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeLessThanOrEqual(55);
    expect(output.riskBand).not.toBe("very_strong");
  });

  it("does not let JW outrank edit ortho when token support is weak", () => {
    // VAN LUMINA vs VANINA-style: high JW from shared particle letters, modest edit.
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: {
          jaroWinklerSimilarity: 0.92,
          levenshteinSimilarity: 0.67,
          damerauLevenshteinSimilarity: 0.67,
          weightedEditSimilarity: 0.67,
          lcsSimilarity: 0.67,
          trigramDice: 0.36,
        },
        phonetic: { pronunciationSimilarity: 0.73 },
        token: {
          significantOverlap: 0,
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          noiseOnlyOverlap: 0,
          prefixOverlap: 0,
          sharedRareTokenCount: 0,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeLessThan(65);
    expect(output.riskBand).not.toBe("very_strong");
    expect(output.riskBand).not.toBe("strong");
  });

  it("caps phonetic-alone matches without token or edit-ortho support", () => {
    const output = scoreFromFeatures(
      emptyVector({
        phonetic: { primaryKeyMatch: 1 },
        orthographic: { jaroWinklerSimilarity: 0.55, levenshteinSimilarity: 0.5 },
        token: {
          significantOverlap: 0,
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          noiseOnlyOverlap: 0,
          tokenJaccard: 0,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeLessThanOrEqual(55);
    expect(output.riskBand).not.toBe("very_strong");
    expect(output.confidence).toBe("low");
  });

  it("caps LCS/trigram inflation without edit-ortho or token support", () => {
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: {
          lcsSimilarity: 0.95,
          trigramDice: 0.9,
          jaroWinklerSimilarity: 0.5,
          levenshteinSimilarity: 0.5,
        },
        token: {
          significantOverlap: 0,
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          noiseOnlyOverlap: 0,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeLessThanOrEqual(55);
    expect(output.riskBand).not.toBe("very_strong");
  });

  it("does not treat high-edit near-matches as prefix inflation", () => {
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: { jaroWinklerSimilarity: 0.93, levenshteinSimilarity: 0.86 },
        token: {
          significantOverlap: 0,
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          noiseOnlyOverlap: 0,
          prefixOverlap: 0.8,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeGreaterThanOrEqual(80);
    expect(output.riskBand).toBe("very_strong");
  });

  it("does not let secondary-token-only overlap reach very_strong", () => {
    // LUMINA SOLARA vs VILLA SOLARA: shared secondary token, no dominant/core match.
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: {
          jaroWinklerSimilarity: 0.75,
          levenshteinSimilarity: 0.58,
          damerauLevenshteinSimilarity: 0.58,
          weightedEditSimilarity: 0.42,
        },
        token: {
          dominantTokenOverlap: 0,
          coreCompactMatch: 0,
          significantOverlap: 0.33,
          tokenJaccard: 0.33,
          secondarySignificantOverlap: 1,
          noiseOnlyOverlap: 0,
          sharedRareTokenCount: 1,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeLessThan(80);
    expect(output.riskBand).not.toBe("very_strong");
  });

  it("keeps dominant-token identity at very_strong", () => {
    const output = scoreFromFeatures(
      emptyVector({
        orthographic: { jaroWinklerSimilarity: 0.7, levenshteinSimilarity: 0.5 },
        token: {
          dominantTokenOverlap: 1,
          coreCompactMatch: 1,
          significantOverlap: 1,
          secondarySignificantOverlap: 0,
        },
      }),
    );

    expect(output.experimentalConflictScore).toBeGreaterThanOrEqual(95);
    expect(output.riskBand).toBe("very_strong");
  });

  it("is deterministic for identical input", () => {
    const vector = emptyVector({
      orthographic: { weightedEditSimilarity: 0.82 },
      phonetic: { primaryKeyMatch: 0.9 },
    });

    const first = scoreFromFeatures(vector);
    const second = scoreFromFeatures(vector);
    expect(first).toEqual(second);
  });
});
