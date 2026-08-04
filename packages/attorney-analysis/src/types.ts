import type {
  ConfidenceLevel,
  RiskBand,
  TrademarkFeatureVector,
  TrademarkRiskOutput,
} from "@trademark-engine/domain";

/** Minimal engine result shape consumed by attorney analysis. */
export interface EngineCandidateInput {
  readonly candidateId: string;
  readonly markText: string;
  readonly niceClasses: readonly number[];
  readonly status: string;
  readonly score: TrademarkRiskOutput;
  readonly evidenceCodes: readonly string[];
  readonly explanations: readonly string[];
  readonly features: TrademarkFeatureVector;
}

export interface CompactCandidateScore {
  readonly experimentalConflictScore: number;
  readonly riskBand: RiskBand;
  readonly confidence: ConfidenceLevel;
}

export interface CompactFeatureHighlights {
  readonly exactCompactMatch: number | null;
  readonly jaroWinklerSimilarity: number | null;
  readonly pronunciationSimilarity: number | null;
  readonly niceClassOverlap: number | null;
  readonly niceClassSupport: string;
}

export interface CompactCandidate {
  readonly candidateId: string;
  readonly markText: string;
  readonly niceClasses: readonly number[];
  readonly status: string;
  readonly score: CompactCandidateScore;
  readonly evidenceCodes: readonly string[];
  readonly explanations: readonly string[];
  readonly features: CompactFeatureHighlights;
}

export type RiskLevel = "hoog" | "middel" | "laag";

export type DimensionStrength = "sterk" | "matig" | "zwak" | "niet";

export type Aanbeveling =
  | "indienen_risicovol"
  | "indienen_met_aanpassing"
  | "nader_onderzoek"
  | "laag_risico";

export interface DimensionAssessment {
  readonly score: DimensionStrength;
  readonly toelichting: string;
}

export interface RiskDimensions {
  readonly visueel: DimensionAssessment;
  readonly auditief: DimensionAssessment;
  readonly conceptueel: DimensionAssessment;
  readonly warenDiensten: DimensionAssessment;
}

export interface AttorneyRiskItem {
  readonly rank: number;
  readonly candidateId: string;
  readonly markText: string;
  readonly engineScore: number;
  readonly riskLevel: RiskLevel;
  readonly summary: string;
  readonly dimensions: RiskDimensions;
  readonly confusionRisk: string;
  readonly whySelected: string;
}

export interface OverallAdvice {
  readonly text: string;
  readonly aanbeveling: Aanbeveling;
}

export type AttorneyAnalysisStatus = "completed" | "skipped" | "failed";

export interface AttorneyAnalysisResult {
  readonly status: AttorneyAnalysisStatus;
  readonly promptVersion: string;
  readonly model?: string;
  readonly candidatesConsidered: number;
  readonly overallAdvice?: OverallAdvice;
  readonly topRisks: readonly AttorneyRiskItem[];
  readonly error?: string;
}

export interface ProposedMarkContext {
  readonly markText: string;
  readonly selectedNiceClasses?: readonly number[];
  readonly goodsServices?: readonly string[];
}

export interface AnalyzeTrademarkRisksInput {
  readonly proposed: ProposedMarkContext;
  readonly candidates: readonly EngineCandidateInput[];
  readonly candidateLimit?: number;
  readonly topN?: number;
  readonly model: string;
  readonly temperature?: number;
  readonly client: AttorneyAnalysisClient;
}

export interface AttorneyCompletionRequest {
  readonly model: string;
  readonly temperature: number;
  readonly system: string;
  readonly messages: readonly {
    readonly role: "user" | "assistant";
    readonly content: string;
  }[];
}

export interface AttorneyAnalysisClient {
  complete(request: AttorneyCompletionRequest): Promise<string>;
}
