export interface DistanceResult {
  readonly distance: number;
  readonly similarity: number;
}

export interface SimilarityResult {
  readonly similarity: number;
}

export interface SequenceResult {
  readonly length: number;
  readonly similarity: number;
}

export interface StringMetricEngine {
  levenshtein(a: string, b: string): DistanceResult;
  damerauLevenshtein(a: string, b: string): DistanceResult;
  jaro(a: string, b: string): SimilarityResult;
  jaroWinkler(a: string, b: string): SimilarityResult;
  lcsLength(a: string, b: string): SequenceResult;
}

function distanceSimilarity(distance: number, a: string, b: string): number {
  if (a.length === 0 && b.length === 0) {
    return 1;
  }

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 1;
  }

  return Math.max(0, Math.min(1, 1 - distance / maxLen));
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + substitutionCost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j]!;
    }
  }

  return previous[b.length]!;
}

function damerauLevenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) {
    return bLen;
  }
  if (bLen === 0) {
    return aLen;
  }

  const maxDist = aLen + bLen;
  const da: Record<string, number> = {};

  const score = Array.from({ length: aLen + 2 }, () =>
    new Array<number>(bLen + 2).fill(0),
  );

  score[0]![0] = maxDist;

  for (let i = 0; i <= aLen; i += 1) {
    score[i + 1]![0] = maxDist;
    score[i + 1]![1] = i;
  }
  for (let j = 0; j <= bLen; j += 1) {
    score[0]![j + 1] = maxDist;
    score[1]![j + 1] = j;
  }

  for (let i = 1; i <= aLen; i += 1) {
    let db = 0;

    for (let j = 1; j <= bLen; j += 1) {
      const i1 = da[b[j - 1]!] ?? 0;
      const j1 = db;
      let cost = 1;

      if (a[i - 1] === b[j - 1]) {
        cost = 0;
        db = j;
      }

      score[i + 1]![j + 1] = Math.min(
        score[i]![j]! + cost,
        score[i + 1]![j]! + 1,
        score[i]![j + 1]! + 1,
        score[i1]![j1]! + (i - i1 - 1) + 1 + (j - j1 - 1),
      );
    }

    da[a[i - 1]!] = i;
  }

  return score[aLen + 1]![bLen + 1]!;
}

function jaroSimilarity(a: string, b: string): number {
  if (a === b) {
    return 1;
  }
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const matchDistance = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;

  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);

    for (let j = start; j < end; j += 1) {
      if (bMatches[j] || a[i] !== b[j]) {
        continue;
      }

      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }

  if (matches === 0) {
    return 0;
  }

  let transpositions = 0;
  let k = 0;

  for (let i = 0; i < a.length; i += 1) {
    if (!aMatches[i]) {
      continue;
    }

    while (!bMatches[k]) {
      k += 1;
    }

    if (a[i] !== b[k]) {
      transpositions += 1;
    }

    k += 1;
  }

  const m = matches;
  return (
    (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3
  );
}

function jaroWinklerSimilarity(a: string, b: string, prefixScale = 0.1): number {
  const jaro = jaroSimilarity(a, b);

  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);

  while (prefix < maxPrefix && a[prefix] === b[prefix]) {
    prefix += 1;
  }

  return jaro + prefix * prefixScale * (1 - jaro);
}

function longestCommonSubsequenceLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const previous = new Array<number>(b.length + 1).fill(0);
  const current = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = previous[j - 1]! + 1;
      } else {
        current[j] = Math.max(previous[j]!, current[j - 1]!);
      }
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j]!;
    }
  }

  return previous[b.length]!;
}

export function createTsStringMetricEngine(): StringMetricEngine {
  return {
    levenshtein(a, b) {
      const distance = levenshteinDistance(a, b);
      return { distance, similarity: distanceSimilarity(distance, a, b) };
    },
    damerauLevenshtein(a, b) {
      const distance = damerauLevenshteinDistance(a, b);
      return { distance, similarity: distanceSimilarity(distance, a, b) };
    },
    jaro(a, b) {
      const similarity = jaroSimilarity(a, b);
      return { similarity: Math.max(0, Math.min(1, similarity)) };
    },
    jaroWinkler(a, b) {
      const similarity = jaroWinklerSimilarity(a, b);
      return { similarity: Math.max(0, Math.min(1, similarity)) };
    },
    lcsLength(a, b) {
      const length = longestCommonSubsequenceLength(a, b);
      const maxLen = Math.max(a.length, b.length);
      const similarity = maxLen === 0 ? 1 : Math.max(0, Math.min(1, length / maxLen));

      return { length, similarity };
    },
  };
}
