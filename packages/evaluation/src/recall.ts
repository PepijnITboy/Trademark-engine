export function computeRecallAtK(
  relevantIds: readonly string[],
  rankedIds: readonly string[],
  k: number,
): number {
  if (relevantIds.length === 0) {
    return 1;
  }

  const relevant = new Set(relevantIds);
  const topK = rankedIds.slice(0, Math.max(0, k));
  let hits = 0;

  for (const id of topK) {
    if (relevant.has(id)) {
      hits += 1;
    }
  }

  return hits / relevant.size;
}

export interface CriticalPairEvaluation {
  readonly query: string;
  readonly candidate: string;
  readonly mustRetrieve: boolean;
  readonly retrieved: boolean;
}

export function criticalHitRecall(
  pairs: readonly CriticalPairEvaluation[],
  retrievedSets: Readonly<Record<string, readonly string[]>>,
): number {
  const mustRetrieve = pairs.filter((pair) => pair.mustRetrieve);
  if (mustRetrieve.length === 0) {
    return 1;
  }

  let hits = 0;
  for (const pair of mustRetrieve) {
    const retrieved = new Set(retrievedSets[pair.query] ?? []);
    if (retrieved.has(pair.candidate)) {
      hits += 1;
    }
  }

  return hits / mustRetrieve.length;
}
