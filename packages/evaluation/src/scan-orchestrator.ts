import {
  buildComparableFromMarkText,
  compareTrademarkPair,
} from "@trademark-engine/comparison";
import { explainFromEvidence } from "@trademark-engine/explanations";
import { normalizeMark } from "@trademark-engine/normalization";
import { stage1Prune } from "@trademark-engine/pruning";
import {
  applyStrategyCap,
  defaultRetrievalProfile,
  unionCandidates,
  type RankedCandidate,
  type StrategyResultRow,
} from "@trademark-engine/retrieval";
import { pickLengthBucketThreshold } from "@trademark-engine/domain";
import {
  groupIntoFamilies,
  rankResults,
  scoreFromFeatures,
} from "@trademark-engine/risk-engine";
import type {
  RetrievalStrategy,
  TrademarkFeatureVector,
  TrademarkRiskOutput,
} from "@trademark-engine/domain";

export type CorpusCandidate = {
  id: string;
  markText: string;
  niceClasses?: readonly number[];
  status?: string;
  ownerKey?: string | null;
};

export type EngineScanResult = {
  candidateId: string;
  markText: string;
  niceClasses: readonly number[];
  status: string;
  score: TrademarkRiskOutput;
  evidenceCodes: readonly string[];
  explanations: readonly string[];
  features: TrademarkFeatureVector;
  retrievalFamilies: string[];
  familyMemberCount: number;
};

export type EngineScanOutput = {
  results: EngineScanResult[];
  uniqueCandidateCount: number;
  discardedCount: number;
  warnings: string[];
  engineVersion: string;
};

function familiesFor(
  queryCompact: string,
  candidateCompact: string,
  features: TrademarkFeatureVector,
): RetrievalStrategy[] {
  const families: RetrievalStrategy[] = [];
  if (queryCompact && queryCompact === candidateCompact) {
    families.push("exact_forms");
  }
  if (
    (features.orthographic.trigramDice ?? 0) >= 0.25 ||
    (features.orthographic.jaroWinklerSimilarity ?? 0) >= 0.85
  ) {
    families.push("trigram");
  }
  if (
    (features.token.tokenJaccard ?? 0) > 0 ||
    (features.token.dominantTokenOverlap ?? 0) > 0
  ) {
    families.push("token");
  }
  if (
    (features.phonetic.primaryKeyMatch ?? 0) > 0 ||
    (features.phonetic.skeletonMatch ?? 0) > 0
  ) {
    families.push("phonetic");
  }
  if ((features.exact.transliterationMatch ?? 0) > 0) {
    families.push("transliteration");
  }
  return families;
}

/**
 * In-memory logical full-corpus scan. Production replaces the linear pass with
 * indexed SQL strategies; this still applies caps → union → prune → score → rank → families.
 */
export function runLogicalScan(
  markText: string,
  corpus: readonly CorpusCandidate[],
  options?: {
    selectedNiceClasses?: readonly number[];
    engineVersion?: string;
  },
): EngineScanOutput {
  const profile = defaultRetrievalProfile();
  const proposedNorm = normalizeMark(markText);
  const proposed = buildComparableFromMarkText(markText, options?.selectedNiceClasses);
  const warnings: string[] = [];
  const cap = pickLengthBucketThreshold(proposedNorm.compact.length, profile.strategyCaps);

  const strategyRows: Record<string, StrategyResultRow[]> = {};

  for (const row of corpus) {
    if (!row.markText.trim()) continue;
    const candNorm = normalizeMark(row.markText);
    const candidate = buildComparableFromMarkText(row.markText, row.niceClasses);
    const comparison = compareTrademarkPair(proposed, candidate, {
      ...(options?.selectedNiceClasses !== undefined
        ? { proposedNiceClasses: options.selectedNiceClasses }
        : {}),
      ...(row.niceClasses !== undefined ? { candidateNiceClasses: row.niceClasses } : {}),
    });
    const families = familiesFor(proposedNorm.compact, candNorm.compact, comparison.features);
    for (const strategy of families) {
      const list = strategyRows[strategy] ?? (strategyRows[strategy] = []);
      list.push({
        trademarkId: row.id,
        strategy,
        rank: list.length + 1,
        score: comparison.features.orthographic.jaroWinklerSimilarity ?? 0,
      });
    }
  }

  const cappedByStrategy: Record<string, StrategyResultRow[]> = {};
  for (const [strategy, rows] of Object.entries(strategyRows)) {
    const ranked: RankedCandidate[] = [...rows]
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({
        trademarkId: row.trademarkId,
        score: row.score,
        evidence: [{ strategy: row.strategy, rank: index + 1, score: row.score }],
      }));
    const capped = applyStrategyCap(ranked, cap);
    if (capped.capReached) {
      warnings.push(`strategy_cap_reached:${strategy}`);
    }
    cappedByStrategy[strategy] = capped.kept.map((item, index) => ({
      trademarkId: item.trademarkId,
      strategy: item.evidence[0]!.strategy,
      rank: index + 1,
      score: item.score,
    }));
  }

  const union = unionCandidates(cappedByStrategy);

  const enriched = union.map((entry) => {
    const row = corpus.find((candidate) => candidate.id === entry.trademarkId)!;
    const candNorm = normalizeMark(row.markText);
    const candidate = buildComparableFromMarkText(row.markText, row.niceClasses);
    const strategies = entry.evidence.map((e) => e.strategy);
    const comparison = compareTrademarkPair(proposed, candidate, {
      ...(options?.selectedNiceClasses !== undefined
        ? { proposedNiceClasses: options.selectedNiceClasses }
        : {}),
      ...(row.niceClasses !== undefined ? { candidateNiceClasses: row.niceClasses } : {}),
      retrieval: {
        strategies,
        maxStrategyRank: Math.min(...entry.evidence.map((e) => e.rank)),
        evidenceCount: entry.evidence.length,
        independentFamilyHits: strategies,
      },
    });
    return {
      id: entry.trademarkId,
      markText: row.markText,
      niceClasses: row.niceClasses ?? [],
      status: row.status ?? "unknown",
      ownerKey: row.ownerKey ?? null,
      comparison,
      retrievalFamilies: strategies,
      lengths: {
        proposed: proposedNorm.compact.length,
        candidate: candNorm.compact.length,
      },
      features: {
        exactMatch: proposedNorm.compact === candNorm.compact,
        phoneticKeyMatch: (comparison.features.phonetic.primaryKeyMatch ?? 0) > 0,
        transliterationExact: (comparison.features.exact.transliterationMatch ?? 0) >= 1,
        trigramDice: comparison.features.orthographic.trigramDice ?? 0,
        prefixScore: comparison.features.token.prefixOverlap ?? 0,
        suffixScore: comparison.features.token.suffixOverlap ?? 0,
        missingData: false,
        coreTokenHit:
          (comparison.features.token.significantOverlap ?? 0) > 0 ||
          (comparison.features.token.coreCompactMatch ?? 0) >= 1 ||
          (comparison.features.token.dominantTokenOverlap ?? 0) >= 1,
        noiseOnlyHit: (comparison.features.token.noiseOnlyOverlap ?? 0) >= 0.5,
      },
    };
  });

  const decisions = stage1Prune(
    enriched.map((item) => ({
      id: item.id,
      features: item.features,
      retrievalFamilies: item.retrievalFamilies,
      lengths: item.lengths,
    })),
  );

  const keptIds = new Set(
    decisions
      .filter((d) => d.decision === "keep" || d.decision === "promote")
      .map((d) => d.id),
  );
  const discardedCount = decisions.filter((d) => d.decision === "discard").length;

  const scored = enriched
    .filter((item) => keptIds.has(item.id))
    .map((item) => {
      const score = scoreFromFeatures(item.comparison.features);
      const explanations = explainFromEvidence(item.comparison.evidenceCodes, {
        proposedMark: markText,
        candidateMark: item.markText,
      });
      return {
        candidateId: item.id,
        markText: item.markText,
        niceClasses: item.niceClasses,
        status: item.status,
        score,
        evidenceCodes: item.comparison.evidenceCodes,
        explanations,
        features: item.comparison.features,
        retrievalFamilies: item.retrievalFamilies,
        familyMemberCount: 1,
        id: item.id,
        experimentalConflictScore: score.experimentalConflictScore,
        confidence: score.confidence,
        riskBand: score.riskBand,
        independentChannelCount: item.retrievalFamilies.length,
        activeRight: item.status === "registered",
        ownerKey: item.ownerKey,
      };
    });

  const families = groupIntoFamilies(rankResults(scored));
  const results: EngineScanResult[] = families.map((group) => {
    const rep = group.representative;
    return {
      candidateId: rep.candidateId,
      markText: rep.markText,
      niceClasses: rep.niceClasses,
      status: rep.status,
      score: rep.score,
      evidenceCodes: rep.evidenceCodes,
      explanations: rep.explanations,
      features: rep.features,
      retrievalFamilies: rep.retrievalFamilies,
      familyMemberCount: group.memberCount,
    };
  });

  return {
    results,
    uniqueCandidateCount: union.length,
    discardedCount,
    warnings,
    engineVersion: options?.engineVersion ?? "0.1.0",
  };
}
