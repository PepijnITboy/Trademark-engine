import type {
  CompactCandidate,
  EngineCandidateInput,
} from "./types.js";

export const DEFAULT_CANDIDATE_LIMIT = 1000;
export const DEFAULT_TOP_N = 10;
export const MAX_EVIDENCE_CODES = 8;
export const MAX_EXPLANATIONS = 2;

export function selectTopCandidates(
  results: readonly EngineCandidateInput[],
  limit: number = DEFAULT_CANDIDATE_LIMIT,
): EngineCandidateInput[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  return results.slice(0, safeLimit);
}

export function toCompactCandidate(result: EngineCandidateInput): CompactCandidate {
  return {
    candidateId: result.candidateId,
    markText: result.markText,
    niceClasses: [...result.niceClasses],
    status: result.status,
    score: {
      experimentalConflictScore: result.score.experimentalConflictScore,
      riskBand: result.score.riskBand,
      confidence: result.score.confidence,
    },
    evidenceCodes: [...result.evidenceCodes].slice(0, MAX_EVIDENCE_CODES),
    explanations: [...result.explanations].slice(0, MAX_EXPLANATIONS),
    features: {
      exactCompactMatch: result.features.exact.compactMatch,
      jaroWinklerSimilarity: result.features.orthographic.jaroWinklerSimilarity,
      pronunciationSimilarity: result.features.phonetic.pronunciationSimilarity,
      niceClassOverlap: result.features.goodsServices.niceClassOverlap,
      niceClassSupport: result.features.goodsServices.niceClassSupport,
    },
  };
}

/** Stable JSON serialization with fixed key order for prompt determinism. */
export function serializeCompactCandidates(
  candidates: readonly CompactCandidate[],
): string {
  const payload = candidates.map((c) => ({
    candidateId: c.candidateId,
    markText: c.markText,
    niceClasses: [...c.niceClasses],
    status: c.status,
    score: {
      experimentalConflictScore: c.score.experimentalConflictScore,
      riskBand: c.score.riskBand,
      confidence: c.score.confidence,
    },
    evidenceCodes: [...c.evidenceCodes],
    explanations: [...c.explanations],
    features: {
      exactCompactMatch: c.features.exactCompactMatch,
      jaroWinklerSimilarity: c.features.jaroWinklerSimilarity,
      pronunciationSimilarity: c.features.pronunciationSimilarity,
      niceClassOverlap: c.features.niceClassOverlap,
      niceClassSupport: c.features.niceClassSupport,
    },
  }));
  return JSON.stringify(payload);
}
