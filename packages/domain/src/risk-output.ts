export type RiskBand =
  | "very_strong"
  | "strong"
  | "relevant"
  | "weak"
  | "low";

export type ConfidenceLevel = "high" | "medium" | "low";

export const RISK_BANDS: readonly RiskBand[] = [
  "very_strong",
  "strong",
  "relevant",
  "weak",
  "low",
] as const;

export interface TrademarkRiskOutput {
  readonly experimentalConflictScore: number;
  readonly riskBand: RiskBand;
  readonly confidence: ConfidenceLevel;
}
