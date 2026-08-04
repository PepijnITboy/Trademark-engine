import {
  DEFAULT_CANDIDATE_LIMIT,
  DEFAULT_TOP_N,
  selectTopCandidates,
  toCompactCandidate,
} from "./candidates.js";
import {
  filterToKnownCandidates,
  parseAttorneyModelResponse,
} from "./parse.js";
import {
  PROMPT_VERSION,
  buildSchemaCorrectionUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompts.js";
import type {
  AnalyzeTrademarkRisksInput,
  AttorneyAnalysisResult,
  AttorneyCompletionRequest,
} from "./types.js";

export function skippedAttorneyAnalysis(
  candidatesConsidered: number,
  reason: string,
): AttorneyAnalysisResult {
  return {
    status: "skipped",
    promptVersion: PROMPT_VERSION,
    candidatesConsidered,
    topRisks: [],
    error: reason,
  };
}

export function failedAttorneyAnalysis(
  candidatesConsidered: number,
  reason: string,
  model?: string,
): AttorneyAnalysisResult {
  return {
    status: "failed",
    promptVersion: PROMPT_VERSION,
    ...(model !== undefined ? { model } : {}),
    candidatesConsidered,
    topRisks: [],
    error: reason,
  };
}

export async function analyzeTrademarkRisks(
  input: AnalyzeTrademarkRisksInput,
): Promise<AttorneyAnalysisResult> {
  const candidateLimit = input.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
  const topN = input.topN ?? DEFAULT_TOP_N;
  const temperature = input.temperature ?? 0;

  const selected = selectTopCandidates(input.candidates, candidateLimit);
  const compact = selected.map(toCompactCandidate);
  const allowedIds = new Set(compact.map((item) => item.candidateId));

  if (compact.length === 0) {
    return {
      status: "completed",
      promptVersion: PROMPT_VERSION,
      model: input.model,
      candidatesConsidered: 0,
      overallAdvice: {
        text: "Geen conflicterende kandidaten beschikbaar voor advocaatanalyse.",
        aanbeveling: "laag_risico",
      },
      topRisks: [],
    };
  }

  const system = buildSystemPrompt();
  const user = buildUserPrompt({
    proposed: input.proposed,
    candidates: compact,
    topN,
  });

  const baseRequest: AttorneyCompletionRequest = {
    model: input.model,
    temperature,
    system,
    messages: [{ role: "user", content: user }],
  };

  try {
    const first = await input.client.complete(baseRequest);
    try {
      const parsed = filterToKnownCandidates(
        parseAttorneyModelResponse(first),
        allowedIds,
        topN,
      );
      return {
        status: "completed",
        promptVersion: PROMPT_VERSION,
        model: input.model,
        candidatesConsidered: compact.length,
        overallAdvice: parsed.overallAdvice,
        topRisks: parsed.topRisks,
      };
    } catch (firstError) {
      const correction = buildSchemaCorrectionUserPrompt(first);
      const second = await input.client.complete({
        ...baseRequest,
        messages: [
          { role: "user", content: user },
          { role: "assistant", content: first },
          { role: "user", content: correction },
        ],
      });
      try {
        const parsed = filterToKnownCandidates(
          parseAttorneyModelResponse(second),
          allowedIds,
          topN,
        );
        return {
          status: "completed",
          promptVersion: PROMPT_VERSION,
          model: input.model,
          candidatesConsidered: compact.length,
          overallAdvice: parsed.overallAdvice,
          topRisks: parsed.topRisks,
        };
      } catch (secondError) {
        const message =
          secondError instanceof Error
            ? secondError.message
            : firstError instanceof Error
              ? firstError.message
              : "Attorney analysis parse failed";
        return failedAttorneyAnalysis(compact.length, message, input.model);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attorney analysis failed";
    return failedAttorneyAnalysis(compact.length, message, input.model);
  }
}
