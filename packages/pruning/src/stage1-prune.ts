import { PRUNING_PROFILE_VERSION } from "@trademark-engine/domain";

export type PruneDecision = "keep" | "discard" | "promote";

export interface CheapCandidateFeatures {
  readonly exactMatch: boolean;
  readonly phoneticKeyMatch: boolean;
  readonly transliterationExact: boolean;
  readonly trigramDice: number;
  readonly prefixScore: number;
  readonly suffixScore: number;
  readonly missingData: boolean;
  /** Significant/core token hit (role-aware). */
  readonly coreTokenHit?: boolean;
  /** Overlap appears noise-only without significant core overlap. */
  readonly noiseOnlyHit?: boolean;
}

export interface Stage1Candidate {
  readonly id: string;
  readonly features: CheapCandidateFeatures;
  readonly retrievalFamilies: readonly string[];
  readonly lengths: {
    readonly proposed: number;
    readonly candidate: number;
  };
}

export interface PruningProfile {
  readonly version: string;
  readonly weakTrigramThreshold: number;
  readonly minWeakSignalsToDiscard: number;
  readonly shortMarkMaxLength: number;
  readonly strongAffixThreshold: number;
}

export interface Stage1Decision {
  readonly id: string;
  readonly decision: PruneDecision;
  readonly ruleId: string;
  readonly reasons: readonly string[];
}

const DEFAULT_PROFILE: PruningProfile = {
  version: PRUNING_PROFILE_VERSION,
  weakTrigramThreshold: 0.12,
  minWeakSignalsToDiscard: 2,
  shortMarkMaxLength: 5,
  strongAffixThreshold: 0.85,
};

function isShortMark(lengths: Stage1Candidate["lengths"], profile: PruningProfile): boolean {
  return (
    lengths.proposed <= profile.shortMarkMaxLength ||
    lengths.candidate <= profile.shortMarkMaxLength
  );
}

function hasStrongAffix(features: CheapCandidateFeatures, profile: PruningProfile): boolean {
  return (
    features.prefixScore >= profile.strongAffixThreshold ||
    features.suffixScore >= profile.strongAffixThreshold
  );
}

function evaluateProtections(
  candidate: Stage1Candidate,
  profile: PruningProfile,
): readonly string[] {
  const reasons: string[] = [];
  const { features, retrievalFamilies, lengths } = candidate;

  if (features.exactMatch) {
    reasons.push("protect:exact_match");
  }
  // Phonetic alone is not protective — require token/exact corroboration.
  if (
    features.phoneticKeyMatch &&
    (features.coreTokenHit || features.exactMatch || features.transliterationExact)
  ) {
    reasons.push("protect:phonetic_key");
  }
  if (retrievalFamilies.length >= 2) {
    reasons.push("protect:multi_family");
  }
  if (isShortMark(lengths, profile) && hasStrongAffix(features, profile)) {
    reasons.push("protect:short_mark_affix");
  }
  if (features.transliterationExact) {
    reasons.push("protect:transliteration_exact");
  }
  if (features.coreTokenHit) {
    reasons.push("protect:core_token");
  }
  if (features.missingData) {
    reasons.push("protect:missing_data");
  }

  return reasons;
}

function weakSignals(
  candidate: Stage1Candidate,
  profile: PruningProfile,
): readonly string[] {
  const reasons: string[] = [];
  const { features } = candidate;

  if (features.trigramDice < profile.weakTrigramThreshold) {
    reasons.push("weak:low_trigram");
  }
  if (features.prefixScore < 0.2 && features.suffixScore < 0.2) {
    reasons.push("weak:low_affix");
  }
  if (!features.phoneticKeyMatch && !features.exactMatch) {
    reasons.push("weak:no_exact_or_phonetic");
  }
  if (features.phoneticKeyMatch && !features.coreTokenHit && !features.exactMatch) {
    reasons.push("weak:phonetic_only");
  }
  if (features.noiseOnlyHit && !features.coreTokenHit && !features.exactMatch) {
    reasons.push("weak:noise_only");
  }

  return reasons;
}

/** min/max compact length — short fragment walls (R2 vs R2D2, BERG vs VAN DER BERG). */
function lengthRatio(lengths: Stage1Candidate["lengths"]): number {
  const a = lengths.proposed;
  const b = lengths.candidate;
  if (a <= 0 || b <= 0) {
    return 1;
  }
  return Math.min(a, b) / Math.max(a, b);
}

/**
 * Extreme length mismatch without full compact exact.
 * Short-side guard keeps Soft Drinks→ZORVEC (candidate len 6) while dropping R2/BERG.
 */
function isExtremeLengthMismatch(
  candidate: Stage1Candidate,
  profile: PruningProfile,
): boolean {
  if (candidate.features.exactMatch || candidate.features.transliterationExact) {
    return false;
  }
  if (lengthRatio(candidate.lengths) > 0.5) {
    return false;
  }
  const shorter = Math.min(candidate.lengths.proposed, candidate.lengths.candidate);
  return shorter <= profile.shortMarkMaxLength;
}

export function stage1Prune(
  candidates: readonly Stage1Candidate[],
  profile: PruningProfile = DEFAULT_PROFILE,
): Stage1Decision[] {
  return candidates.map((candidate) => {
    if (isExtremeLengthMismatch(candidate, profile)) {
      return {
        id: candidate.id,
        decision: "discard",
        ruleId: `${profile.version}:discard_length_ratio`,
        reasons: ["weak:length_ratio"],
      };
    }

    const protections = evaluateProtections(candidate, profile);
    const weak = weakSignals(candidate, profile);

    if (protections.some((reason) => reason === "protect:multi_family")) {
      return {
        id: candidate.id,
        decision: "promote",
        ruleId: `${profile.version}:promote_multi_family`,
        reasons: protections,
      };
    }

    if (protections.length > 0) {
      return {
        id: candidate.id,
        decision: "keep",
        ruleId: `${profile.version}:keep_protected`,
        reasons: protections,
      };
    }

    const weakWithoutTrigramOnly =
      weak.filter((signal) => signal !== "weak:low_trigram").length >=
        profile.minWeakSignalsToDiscard &&
      weak.includes("weak:low_trigram");

    const multipleWeakNoTrigramOnly =
      weak.length >= profile.minWeakSignalsToDiscard &&
      !(
        weak.length === 1 &&
        weak[0] === "weak:low_trigram"
      );

    if (multipleWeakNoTrigramOnly || weakWithoutTrigramOnly) {
      return {
        id: candidate.id,
        decision: "discard",
        ruleId: `${profile.version}:discard_multi_weak`,
        reasons: weak,
      };
    }

    return {
      id: candidate.id,
      decision: "keep",
      ruleId: `${profile.version}:keep_default`,
      reasons: ["default:insufficient_discard_signals"],
    };
  });
}

export function defaultPruningProfile(): PruningProfile {
  return { ...DEFAULT_PROFILE };
}
