import type { TrademarkFeatureVector } from "@trademark-engine/domain";
import type { EngineCandidateInput } from "./types.js";

export function emptyFeatures(): TrademarkFeatureVector {
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

export function makeCandidate(
  overrides: Partial<EngineCandidateInput> &
    Pick<EngineCandidateInput, "candidateId" | "markText">,
): EngineCandidateInput {
  return {
    niceClasses: [32],
    status: "registered",
    score: {
      experimentalConflictScore: 70,
      riskBand: "strong",
      confidence: "high",
    },
    evidenceCodes: ["EXACT_COMPACT", "PHONETIC_NEAR"],
    explanations: ["Strong orthographic similarity."],
    features: emptyFeatures(),
    ...overrides,
  };
}

export function validModelJson(candidateId = "c1", markText = "ZENZO"): string {
  return JSON.stringify({
    overallAdvice: {
      text: "Er is relevant verwarringsgevaar met nabije merken in klasse 32.",
      aanbeveling: "nader_onderzoek",
    },
    topRisks: [
      {
        rank: 1,
        candidateId,
        markText,
        engineScore: 70,
        riskLevel: "hoog",
        summary: "Hoog risico: sterke auditieve nabijheid in dezelfde Nice-klasse.",
        dimensions: {
          visueel: {
            score: "matig",
            toelichting: "De tekens delen letterstructuur maar wijken visueel af.",
          },
          auditief: {
            score: "sterk",
            toelichting: "De uitspraak ligt dicht bij elkaar voor het publiek.",
          },
          conceptueel: {
            score: "zwak",
            toelichting: "Geen duidelijke conceptuele overlap.",
          },
          warenDiensten: {
            score: "sterk",
            toelichting: "Waren- en dienstenovereenstemming in klasse 32.",
          },
        },
        confusionRisk:
          "Er bestaat verwarringsgevaar door auditieve nabijheid en klasse-overlap.",
        whySelected: "Hoogste engine-score met sterke phonetic evidence.",
      },
    ],
  });
}
