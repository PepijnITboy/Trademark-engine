import type { RetrievalStrategy } from "./retrieval-strategy.js";

export interface ExactFeatureFamily {
  readonly normalizedMatch: number | null;
  readonly compactMatch: number | null;
  readonly caseFoldedMatch: number | null;
  readonly transliterationMatch: number | null;
}

export interface OrthographicFeatureFamily {
  readonly levenshteinSimilarity: number | null;
  readonly damerauLevenshteinSimilarity: number | null;
  readonly jaroSimilarity: number | null;
  readonly jaroWinklerSimilarity: number | null;
  readonly weightedEditSimilarity: number | null;
  readonly trigramDice: number | null;
  readonly lcsSimilarity: number | null;
}

export interface TokenFeatureFamily {
  readonly dominantTokenOverlap: number | null;
  readonly tokenJaccard: number | null;
  readonly sharedRareTokenCount: number | null;
  readonly prefixOverlap: number | null;
  readonly suffixOverlap: number | null;
  /** Overlap on significant (distinctive/unknown) token sets, 0–1. */
  readonly significantOverlap: number | null;
  /** Overlap only on noise roles with no significant overlap, 0–1. */
  readonly noiseOnlyOverlap: number | null;
  /** Exact match of significant-only core compact forms, 0|1. */
  readonly coreCompactMatch: number | null;
  /** Proposed and/or candidate has empty significant core, 0|1. */
  readonly coreEmpty: number | null;
  /** Overlap on significant tokens excluding the primary dominant, 0–1. */
  readonly secondarySignificantOverlap: number | null;
}

export interface PhoneticFeatureFamily {
  readonly primaryKeyMatch: number | null;
  readonly secondaryKeyMatch: number | null;
  readonly pronunciationSimilarity: number | null;
  readonly skeletonMatch: number | null;
}

export interface ConceptualFeatureFamily {
  readonly lexiconOverlap: number | null;
  readonly translationProximity: number | null;
  readonly descriptiveOverlap: number | null;
}

export interface GoodsServicesFeatureFamily {
  readonly niceClassOverlap: number | null;
  readonly conceptOverlap: number | null;
  readonly coverage: "full" | "partial" | "unknown";
}

export interface ContextFeatureFamily {
  readonly statusRelevance: number | null;
  readonly dateProximity: number | null;
  readonly registryRelevance: number | null;
}

export interface RetrievalFeatureFamily {
  readonly strategies: readonly RetrievalStrategy[];
  readonly maxStrategyRank: number | null;
  readonly evidenceCount: number;
  readonly independentFamilyHits: readonly string[];
}

export interface FeatureVectorMetadata {
  readonly engineVersion: string;
  readonly normalizationVersion: string;
  readonly scoreVersion: string;
  readonly computedAt: string;
  readonly evidenceIds: readonly string[];
}

export interface TrademarkFeatureVector {
  readonly exact: ExactFeatureFamily;
  readonly orthographic: OrthographicFeatureFamily;
  readonly token: TokenFeatureFamily;
  readonly phonetic: PhoneticFeatureFamily;
  readonly conceptual: ConceptualFeatureFamily;
  readonly goodsServices: GoodsServicesFeatureFamily;
  readonly context: ContextFeatureFamily;
  readonly retrieval: RetrievalFeatureFamily;
  readonly metadata: FeatureVectorMetadata;
}
