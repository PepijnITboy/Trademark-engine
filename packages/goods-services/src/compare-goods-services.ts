export const GOODS_SERVICES_VERSION = "1.0.0";

export type GoodsServicesRelationship =
  | "identical"
  | "high"
  | "medium"
  | "low"
  | "none"
  | "unknown";

export type GoodsServicesConfidence = "high" | "medium" | "low";

export interface CompareGoodsServicesInput {
  readonly proposedNiceClasses: readonly number[];
  readonly proposedTexts?: readonly string[];
  readonly candidateNiceClasses: readonly number[];
  readonly candidateTexts?: readonly string[];
}

export interface GoodsServicesComparisonResult {
  readonly relationship: GoodsServicesRelationship;
  readonly niceClassOverlap: number;
  readonly relatedClassSignal: number;
  readonly concreteSimilarity: number | null;
  readonly concreteTermCoverage: number | null;
  readonly confidence: GoodsServicesConfidence;
  readonly warnings: readonly string[];
  readonly version: string;
}

/** Adjacent Nice classes often share commercial overlap (e.g. 32/33 beverages). */
const RELATED_CLASS_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [32, 33],
  [9, 42],
  [25, 35],
  [29, 30],
  [16, 41],
  [5, 10],
];

function normalizeTexts(texts: readonly string[] | undefined): readonly string[] {
  if (!texts || texts.length === 0) {
    return [];
  }

  return texts
    .map((text) =>
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^\p{L}\p{N}\s]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function tokenize(text: string): Set<string> {
  const tokens = text.split(/\s+/).filter((token) => token.length >= 2);
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function niceClassOverlap(
  proposed: readonly number[],
  candidate: readonly number[],
): number {
  const proposedSet = new Set(proposed);
  const candidateSet = new Set(candidate);

  if (proposedSet.size === 0 && candidateSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const cls of proposedSet) {
    if (candidateSet.has(cls)) {
      intersection += 1;
    }
  }

  const union = proposedSet.size + candidateSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function relatedClassSignal(
  proposed: readonly number[],
  candidate: readonly number[],
): number {
  const proposedSet = new Set(proposed);
  const candidateSet = new Set(candidate);

  if (proposedSet.size === 0 || candidateSet.size === 0) {
    return 0;
  }

  let relatedHits = 0;
  let possiblePairs = 0;

  for (const cls of proposedSet) {
    for (const other of candidateSet) {
      if (cls === other) {
        continue;
      }

      possiblePairs += 1;
      const isRelated = RELATED_CLASS_PAIRS.some(
        ([a, b]) => (a === cls && b === other) || (a === other && b === cls),
      );
      if (isRelated) {
        relatedHits += 1;
      }
    }
  }

  return possiblePairs === 0 ? 0 : relatedHits / possiblePairs;
}

function computeConcreteMetrics(
  proposedTexts: readonly string[],
  candidateTexts: readonly string[],
): { similarity: number; coverage: number } {
  const proposedTokens = new Set<string>();
  const candidateTokens = new Set<string>();

  for (const text of proposedTexts) {
    for (const token of tokenize(text)) {
      proposedTokens.add(token);
    }
  }

  for (const text of candidateTexts) {
    for (const token of tokenize(text)) {
      candidateTokens.add(token);
    }
  }

  const similarity = jaccard(proposedTokens, candidateTokens);

  let covered = 0;
  for (const token of proposedTokens) {
    if (candidateTokens.has(token)) {
      covered += 1;
    }
  }

  const coverage = proposedTokens.size === 0 ? 0 : covered / proposedTokens.size;
  return { similarity, coverage };
}

function deriveRelationship(
  classOverlap: number,
  relatedSignal: number,
  concreteSimilarity: number | null,
  hasConcrete: boolean,
  hasAnyClasses: boolean,
): GoodsServicesRelationship {
  if (!hasAnyClasses && !hasConcrete) {
    return "unknown";
  }

  if (hasConcrete && concreteSimilarity !== null && concreteSimilarity >= 0.9 && classOverlap >= 0.5) {
    return "identical";
  }

  if (classOverlap >= 0.75 || (classOverlap >= 0.5 && relatedSignal >= 0.5)) {
    if (hasConcrete && concreteSimilarity !== null) {
      if (concreteSimilarity >= 0.7) {
        return "high";
      }
      if (concreteSimilarity >= 0.4) {
        return "medium";
      }
      if (concreteSimilarity >= 0.15) {
        return "low";
      }
      return "none";
    }
    return classOverlap >= 0.75 ? "high" : "medium";
  }

  if (relatedSignal >= 0.5 || classOverlap >= 0.25) {
    return hasConcrete && concreteSimilarity !== null && concreteSimilarity >= 0.4
      ? "medium"
      : "low";
  }

  if (classOverlap > 0 || relatedSignal > 0) {
    return "low";
  }

  return hasConcrete && concreteSimilarity !== null && concreteSimilarity > 0 ? "low" : "none";
}

function deriveConfidence(
  hasConcrete: boolean,
  classOverlap: number,
  warnings: readonly string[],
): GoodsServicesConfidence {
  if (warnings.length > 0 || !hasConcrete) {
    return classOverlap > 0 ? "medium" : "low";
  }
  return "high";
}

export function compareGoodsServices(
  input: CompareGoodsServicesInput,
): GoodsServicesComparisonResult {
  const warnings: string[] = [];
  const proposedTexts = normalizeTexts(input.proposedTexts);
  const candidateTexts = normalizeTexts(input.candidateTexts);

  const hasProposedConcrete = proposedTexts.length > 0;
  const hasCandidateConcrete = candidateTexts.length > 0;
  const hasConcrete = hasProposedConcrete && hasCandidateConcrete;

  if (!hasProposedConcrete) {
    warnings.push("missing_proposed_goods_text");
  }
  if (!hasCandidateConcrete) {
    warnings.push("missing_candidate_goods_text");
  }

  const classOverlap = niceClassOverlap(
    input.proposedNiceClasses,
    input.candidateNiceClasses,
  );
  const relatedSignal = relatedClassSignal(
    input.proposedNiceClasses,
    input.candidateNiceClasses,
  );

  let concreteSimilarity: number | null = null;
  let concreteTermCoverage: number | null = null;

  if (hasConcrete) {
    const metrics = computeConcreteMetrics(proposedTexts, candidateTexts);
    concreteSimilarity = metrics.similarity;
    concreteTermCoverage = metrics.coverage;
  }

  const hasAnyClasses =
    input.proposedNiceClasses.length > 0 || input.candidateNiceClasses.length > 0;

  const relationship = deriveRelationship(
    classOverlap,
    relatedSignal,
    concreteSimilarity,
    hasConcrete,
    hasAnyClasses,
  );

  const confidence = deriveConfidence(hasConcrete, classOverlap, warnings);

  return {
    relationship,
    niceClassOverlap: classOverlap,
    relatedClassSignal: relatedSignal,
    concreteSimilarity,
    concreteTermCoverage,
    confidence,
    warnings,
    version: GOODS_SERVICES_VERSION,
  };
}
