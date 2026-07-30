export type LengthBucket =
  | "very_short"
  | "short"
  | "medium"
  | "long"
  | "very_long";

export interface LengthBucketThresholds<T> {
  readonly veryShort: T;
  readonly short: T;
  readonly medium: T;
  readonly long: T;
  readonly veryLong: T;
}

export function lengthBucketFor(charCount: number): LengthBucket {
  if (charCount <= 3) {
    return "very_short";
  }
  if (charCount <= 5) {
    return "short";
  }
  if (charCount <= 10) {
    return "medium";
  }
  if (charCount <= 20) {
    return "long";
  }
  return "very_long";
}

export function pickLengthBucketThreshold<T>(
  charCount: number,
  thresholds: LengthBucketThresholds<T>,
): T {
  switch (lengthBucketFor(charCount)) {
    case "very_short":
      return thresholds.veryShort;
    case "short":
      return thresholds.short;
    case "medium":
      return thresholds.medium;
    case "long":
      return thresholds.long;
    case "very_long":
      return thresholds.veryLong;
  }
}
