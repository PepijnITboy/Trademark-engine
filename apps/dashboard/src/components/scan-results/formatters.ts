export type Aanbeveling =
  | "indienen_risicovol"
  | "indienen_met_aanpassing"
  | "nader_onderzoek"
  | "laag_risico"
  | string;

export type RiskLevel = "hoog" | "middel" | "laag" | string;

export type DimensionScore = "sterk" | "matig" | "zwak" | "niet" | string;

const AANBEVELING_LABELS: Record<string, string> = {
  indienen_risicovol: "Indienen — risicovol",
  indienen_met_aanpassing: "Indienen met aanpassing",
  nader_onderzoek: "Nader onderzoek",
  laag_risico: "Laag risico",
};

const RISK_LEVEL_LABELS: Record<string, string> = {
  hoog: "Hoog",
  middel: "Middel",
  laag: "Laag",
};

const DIMENSION_SCORE_LABELS: Record<string, string> = {
  sterk: "Sterk",
  matig: "Matig",
  zwak: "Zwak",
  niet: "Niet",
};

const DIMENSION_LABELS: Record<string, string> = {
  visueel: "Visueel",
  auditief: "Auditief",
  conceptueel: "Conceptueel",
  warenDiensten: "Waren & diensten",
};

export function formatAanbeveling(value: Aanbeveling | undefined | null): string {
  if (!value) {
    return "Geen aanbeveling";
  }
  return AANBEVELING_LABELS[value] ?? value.replaceAll("_", " ");
}

export function formatRiskLevel(value: RiskLevel | undefined | null): string {
  if (!value) {
    return "—";
  }
  return RISK_LEVEL_LABELS[value] ?? value;
}

export function formatDimensionScore(value: DimensionScore | undefined | null): string {
  if (!value) {
    return "—";
  }
  return DIMENSION_SCORE_LABELS[value] ?? value;
}

export function formatDimensionLabel(key: string): string {
  return DIMENSION_LABELS[key] ?? key;
}

export function formatNiceClasses(classes: readonly number[] | undefined): string {
  if (!classes || classes.length === 0) {
    return "—";
  }
  return classes.join(", ");
}

export function sortRisksByRank<T extends { rank: number }>(risks: readonly T[]): T[] {
  return [...risks].sort((a, b) => a.rank - b.rank);
}
