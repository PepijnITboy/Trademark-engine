import { describe, expect, it } from "vitest";
import type {
  AttorneyAnalysisClient,
  EngineCandidateInput,
} from "@trademark-engine/attorney-analysis";
import type { TrademarkFeatureVector } from "@trademark-engine/domain";
import { runAttorneyAnalysisStage } from "./attorney-stage.js";

function emptyFeatures(): TrademarkFeatureVector {
  return {
    exact: {
      normalizedMatch: null,
      compactMatch: 0,
      caseFoldedMatch: null,
      transliterationMatch: null,
    },
    orthographic: {
      levenshteinSimilarity: null,
      damerauLevenshteinSimilarity: null,
      jaroSimilarity: null,
      jaroWinklerSimilarity: 0.8,
      weightedEditSimilarity: null,
      trigramDice: null,
      lcsSimilarity: null,
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
      houseMarkCore: null,
      secondarySignificantOverlap: null,
    },
    phonetic: {
      primaryKeyMatch: null,
      secondaryKeyMatch: null,
      pronunciationSimilarity: 0.7,
      skeletonMatch: null,
    },
    conceptual: {
      lexiconOverlap: null,
      translationProximity: null,
      descriptiveOverlap: null,
    },
    goodsServices: {
      niceClassOverlap: 1,
      conceptOverlap: null,
      coverage: "unknown",
      relatedClassSignal: null,
      niceClassSupport: "overlap",
    },
    context: {
      statusRelevance: null,
      dateProximity: null,
      registryRelevance: null,
    },
    retrieval: {
      strategies: ["exact_forms"],
      maxStrategyRank: 1,
      evidenceCount: 1,
      independentFamilyHits: ["exact_forms"],
    },
    metadata: {
      engineVersion: "0.1.0",
      normalizationVersion: "0.1.0",
      scoreVersion: "0.1.0",
      computedAt: "1970-01-01T00:00:00.000Z",
      evidenceIds: [],
    },
  };
}

function candidate(id: string, markText: string): EngineCandidateInput {
  return {
    candidateId: id,
    markText,
    niceClasses: [32],
    status: "registered",
    score: {
      experimentalConflictScore: 72,
      riskBand: "strong",
      confidence: "high",
    },
    evidenceCodes: ["PHONETIC_NEAR"],
    explanations: ["Near phonetic match"],
    features: emptyFeatures(),
  };
}

function modelJson(ids: string[]): string {
  return JSON.stringify({
    overallAdvice: {
      text: "Relevant verwarringsgevaar aanwezig.",
      aanbeveling: "nader_onderzoek",
    },
    topRisks: ids.map((id, index) => ({
      rank: index + 1,
      candidateId: id,
      markText: id,
      engineScore: 72,
      riskLevel: "hoog",
      summary: "Hoog risico: nabij merk in dezelfde klasse.",
      dimensions: {
        visueel: { score: "matig", toelichting: "Visuele nabijheid." },
        auditief: { score: "sterk", toelichting: "Auditieve nabijheid." },
        conceptueel: { score: "zwak", toelichting: "Beperkte conceptuele overlap." },
        warenDiensten: {
          score: "sterk",
          toelichting: "Waren- en dienstenovereenstemming.",
        },
      },
      confusionRisk: "Er bestaat verwarringsgevaar.",
      whySelected: "Hoge engine-score.",
    })),
  });
}

describe("runAttorneyAnalysisStage", () => {
  it("skips without API key or client", async () => {
    const result = await runAttorneyAnalysisStage({
      proposed: { markText: "ZENZO" },
      results: [candidate("c1", "ZENZO")],
      config: {
        enabled: true,
        model: "claude-test",
        candidateLimit: 1000,
        topN: 5,
        temperature: 0,
      },
    });

    expect(result.status).toBe("skipped");
    expect(result.error).toMatch(/ANTHROPIC_API_KEY/);
    expect(result.topRisks).toEqual([]);
  });

  it("skips when disabled", async () => {
    const result = await runAttorneyAnalysisStage({
      proposed: { markText: "ZENZO" },
      results: [candidate("c1", "ZENZO")],
      config: {
        enabled: false,
        apiKey: "sk-test",
        model: "claude-test",
        candidateLimit: 1000,
        topN: 5,
        temperature: 0,
      },
    });

    expect(result.status).toBe("skipped");
    expect(result.error).toMatch(/disabled/i);
  });

  it("returns mock top risks when client is injected", async () => {
    const client: AttorneyAnalysisClient = {
      async complete() {
        return modelJson(["c1", "c2"]);
      },
    };

    const result = await runAttorneyAnalysisStage({
      proposed: { markText: "ZENZO", selectedNiceClasses: [32] },
      results: [candidate("c1", "c1"), candidate("c2", "c2")],
      config: {
        enabled: true,
        model: "claude-test",
        candidateLimit: 1000,
        topN: 5,
        temperature: 0,
        client,
      },
    });

    expect(result.status).toBe("completed");
    expect(result.candidatesConsidered).toBe(2);
    expect(result.topRisks).toHaveLength(2);
    expect(result.topRisks[0]?.dimensions.visueel.score).toBe("matig");
  });

  it("handles fewer than five candidates", async () => {
    const client: AttorneyAnalysisClient = {
      async complete() {
        return modelJson(["only"]);
      },
    };

    const result = await runAttorneyAnalysisStage({
      proposed: { markText: "ZENZO" },
      results: [candidate("only", "ONLY")],
      config: {
        enabled: true,
        model: "claude-test",
        candidateLimit: 1000,
        topN: 5,
        temperature: 0,
        client,
      },
    });

    expect(result.status).toBe("completed");
    expect(result.candidatesConsidered).toBe(1);
    expect(result.topRisks).toHaveLength(1);
  });
});
