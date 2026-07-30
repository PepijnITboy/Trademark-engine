/**
 * Shared comparison types for the trademark engine.
 * Risk bands and evidence stay separate from any single blended "legal success" score.
 */

export type ConflictRiskBand =
  | 'critical'
  | 'strong'
  | 'relevant'
  | 'borderline'
  | 'weak'
  | 'irrelevant';

export interface ComparisonEvidence {
  readonly id: string;
  readonly type: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface TrademarkCompareInput {
  readonly markA: string;
  readonly markB: string;
}

export interface SimilarityScores {
  readonly exact: number;
  readonly levenshtein: number;
  readonly jaro: number;
  readonly jaroWinkler: number;
  readonly combined: number;
}

export interface ComparisonResult {
  readonly riskBand: ConflictRiskBand;
  readonly similarity: SimilarityScores;
  readonly evidence: readonly ComparisonEvidence[];
  readonly normalized: {
    readonly markA: string;
    readonly markB: string;
  };
}
