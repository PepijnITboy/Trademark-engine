export type StageProgressStatus = "pending" | "running" | "complete" | "failed";

export const SCAN_STAGE_WEIGHTS: Readonly<Record<string, number>> = {
  validate: 5,
  normalize: 5,
  exact_retrieval: 12,
  transliteration_retrieval: 6,
  trigram_retrieval: 12,
  phonetic_retrieval: 10,
  union: 5,
  pruning: 10,
  comparison: 15,
  scoring: 8,
  attorney_analysis: 10,
  complete: 2,
};

export const SCAN_STAGE_DEFINITIONS = [
  { id: "validate", label: "Validate input" },
  { id: "normalize", label: "Normalize mark" },
  { id: "exact_retrieval", label: "Exact retrieval" },
  { id: "transliteration_retrieval", label: "Transliteration retrieval" },
  { id: "trigram_retrieval", label: "Trigram retrieval" },
  { id: "phonetic_retrieval", label: "Phonetic retrieval" },
  { id: "union", label: "Union candidates" },
  { id: "pruning", label: "Prune candidates" },
  { id: "comparison", label: "Compare pairs" },
  { id: "scoring", label: "Score & rank" },
  { id: "attorney_analysis", label: "Anthropic attorney analysis" },
  { id: "complete", label: "Complete" },
] as const;

export function computeEta(
  weights: Readonly<Record<string, number>>,
  stageStatuses: Readonly<Record<string, StageProgressStatus>>,
  elapsedMs: number,
): number | null {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0 || elapsedMs <= 0) {
    return null;
  }

  let completedWeight = 0;
  let runningWeight = 0;

  for (const [stageId, weight] of Object.entries(weights)) {
    const status = stageStatuses[stageId];
    if (status === "complete") {
      completedWeight += weight;
    } else if (status === "running") {
      runningWeight += weight;
    }
  }

  const progressFraction = (completedWeight + runningWeight * 0.5) / totalWeight;
  if (progressFraction <= 0) {
    return null;
  }

  const estimatedTotalMs = elapsedMs / progressFraction;
  return Math.max(0, Math.round(estimatedTotalMs - elapsedMs));
}

export function computePercentComplete(
  weights: Readonly<Record<string, number>>,
  stageStatuses: Readonly<Record<string, StageProgressStatus>>,
): number {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  let completedWeight = 0;
  for (const [stageId, weight] of Object.entries(weights)) {
    const status = stageStatuses[stageId];
    if (status === "complete") {
      completedWeight += weight;
    } else if (status === "running") {
      completedWeight += weight * 0.5;
    }
  }

  return Math.min(100, Math.round((completedWeight / totalWeight) * 100));
}
