export function charNgrams(value: string, n: number): string[] {
  if (n <= 0) {
    throw new Error("n must be positive");
  }

  if (value.length < n) {
    return [];
  }

  const grams: string[] = [];
  for (let i = 0; i <= value.length - n; i += 1) {
    grams.push(value.slice(i, i + n));
  }

  return grams;
}

export function bigrams(value: string): string[] {
  return charNgrams(value, 2);
}

export function trigrams(value: string): string[] {
  return charNgrams(value, 3);
}

function toSet(values: readonly string[]): Set<string> {
  return new Set(values);
}

export function jaccard(a: readonly string[], b: readonly string[]): number {
  const setA = toSet(a);
  const setB = toSet(b);

  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection += 1;
    }
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

export function diceCoefficient(a: readonly string[], b: readonly string[]): number {
  const setA = toSet(a);
  const setB = toSet(b);

  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection += 1;
    }
  }

  const denominator = setA.size + setB.size;
  return denominator === 0 ? 1 : (2 * intersection) / denominator;
}

export function trigramDice(a: string, b: string): number {
  return diceCoefficient(trigrams(a), trigrams(b));
}

export function trigramJaccard(a: string, b: string): number {
  return jaccard(trigrams(a), trigrams(b));
}
