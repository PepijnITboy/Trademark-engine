import {
  analyzeTrademarkRisks,
  createAnthropicAttorneyClient,
  skippedAttorneyAnalysis,
  type AttorneyAnalysisClient,
  type AttorneyAnalysisResult,
  type EngineCandidateInput,
  type ProposedMarkContext,
} from "@trademark-engine/attorney-analysis";

export interface AttorneyStageConfig {
  readonly enabled: boolean;
  readonly apiKey?: string;
  readonly model: string;
  readonly candidateLimit: number;
  readonly topN: number;
  readonly temperature: number;
  /** Injected client for tests; skips live Anthropic SDK. */
  readonly client?: AttorneyAnalysisClient;
}

export async function runAttorneyAnalysisStage(options: {
  readonly proposed: ProposedMarkContext;
  readonly results: readonly EngineCandidateInput[];
  readonly config: AttorneyStageConfig;
}): Promise<AttorneyAnalysisResult> {
  const { proposed, results, config } = options;

  if (!config.enabled) {
    return skippedAttorneyAnalysis(
      Math.min(results.length, config.candidateLimit),
      "Attorney analysis disabled (ATTORNEY_ANALYSIS_ENABLED)",
    );
  }

  const client =
    config.client ??
    (config.apiKey
      ? createAnthropicAttorneyClient({ apiKey: config.apiKey })
      : undefined);

  if (!client) {
    return skippedAttorneyAnalysis(
      Math.min(results.length, config.candidateLimit),
      "ANTHROPIC_API_KEY not configured; engine results only",
    );
  }

  return analyzeTrademarkRisks({
    proposed,
    candidates: results,
    candidateLimit: config.candidateLimit,
    topN: config.topN,
    model: config.model,
    temperature: config.temperature,
    client,
  });
}

export function serializeAttorneyAnalysisForApi(result: AttorneyAnalysisResult) {
  return {
    status: result.status,
    promptVersion: result.promptVersion,
    ...(result.model !== undefined ? { model: result.model } : {}),
    candidatesConsidered: result.candidatesConsidered,
    ...(result.overallAdvice !== undefined
      ? {
          overallAdvice: result.overallAdvice.text,
          aanbeveling: result.overallAdvice.aanbeveling,
          overallAdviceDetail: result.overallAdvice,
        }
      : {}),
    topRisks: result.topRisks,
    ...(result.error !== undefined ? { error: result.error } : {}),
  };
}
