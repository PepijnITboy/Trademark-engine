import {
  RISK_BANDS,
  SCORE_VERSION,
  type ConfidenceLevel,
  type RiskBand,
  type TrademarkFeatureVector,
  type TrademarkRiskOutput,
} from "@trademark-engine/domain";
import type { GoodsServicesComparisonResult } from "@trademark-engine/goods-services";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function bandForScore(score: number): RiskBand {
  if (score >= 80) {
    return "very_strong";
  }
  if (score >= 65) {
    return "strong";
  }
  if (score >= 45) {
    return "relevant";
  }
  if (score >= 25) {
    return "weak";
  }
  return "low";
}

function maxNullable(values: Array<number | null>): number {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? 0 : Math.max(...present);
}

function exactScore(exact: TrademarkFeatureVector["exact"]): number {
  const values = [
    exact.normalizedMatch,
    exact.compactMatch,
    exact.caseFoldedMatch,
    exact.transliterationMatch,
  ];
  return maxNullable(values) * 100;
}

function orthographicScore(orthographic: TrademarkFeatureVector["orthographic"]): number {
  const values = [
    orthographic.levenshteinSimilarity,
    orthographic.damerauLevenshteinSimilarity,
    orthographic.jaroWinklerSimilarity,
    orthographic.weightedEditSimilarity,
    orthographic.trigramDice,
    orthographic.lcsSimilarity,
  ];
  return maxNullable(values) * 100;
}

/** True edit-based ortho — excludes LCS/trigram and prefix-biased Jaro–Winkler. */
function editOrthographicScore(orthographic: TrademarkFeatureVector["orthographic"]): number {
  return (
    maxNullable([
      orthographic.levenshteinSimilarity,
      orthographic.damerauLevenshteinSimilarity,
      orthographic.weightedEditSimilarity,
    ]) * 100
  );
}

/** Token family from significant/core features — not full-string affix noise. */
function tokenScore(token: TrademarkFeatureVector["token"]): number {
  if ((token.coreEmpty ?? 0) >= 1) {
    return 0;
  }

  const rawDominant = token.dominantTokenOverlap ?? 0;
  let dominant = rawDominant;
  const jaccard = token.tokenJaccard ?? 0;
  const significant = token.significantOverlap ?? 0;
  const core = token.coreCompactMatch ?? 0;
  const secondary = token.secondarySignificantOverlap ?? 0;

  // Multi-token query vs single-fragment candidate (well-being↔BEING): dominant
  // can equal the longer half while cores differ — do not treat as full identity.
  // Sole-significant cores (VAN LUMINA↔LUMINA, CAFÉ ZORVEX↔ZORVEX) keep core=1.
  if (dominant >= 1 && core < 1 && significant > 0 && significant < 1) {
    dominant = significant;
  }

  const primaryToken = Math.max(dominant, jaccard, significant, core);
  // Shared non-dominant token alone (e.g. SOLARA in LUMINA SOLARA vs VILLA SOLARA)
  // is weaker than dominant/core identity — do not treat as exact token conflict.
  const secondaryContribution =
    dominant >= 1 || core >= 1 ? secondary : secondary * 0.55;

  let score = Math.max(primaryToken, secondaryContribution);

  // Dual-core second half (LUMINA―SOLARA↔SOLARA): exact shared significant that is
  // not the proposed dominant — lift above weak without restoring BEING@100
  // (rawDominant=1 path stays scaled above).
  if (
    rawDominant < 1 &&
    core < 1 &&
    significant >= 0.5 &&
    significant < 1 &&
    jaccard >= 0.5
  ) {
    score = Math.max(score, 0.75);
  }

  return score * 100;
}

function phoneticScore(phonetic: TrademarkFeatureVector["phonetic"]): number {
  const primary = phonetic.primaryKeyMatch ?? 0;
  const secondary = phonetic.secondaryKeyMatch ?? 0;
  const pronunciation = phonetic.pronunciationSimilarity ?? 0;
  const skeleton = phonetic.skeletonMatch ?? 0;
  return Math.max(primary, secondary, pronunciation, skeleton) * 100;
}

function conceptualScore(conceptual: TrademarkFeatureVector["conceptual"]): number {
  const translation = conceptual.translationProximity ?? 0;
  const lexicon = conceptual.lexiconOverlap ?? 0;
  return Math.max(translation, lexicon) * 100;
}

function goodsScore(
  goods: TrademarkFeatureVector["goodsServices"],
  goodsComparison?: GoodsServicesComparisonResult,
): number {
  const overlap = goodsComparison?.niceClassOverlap ?? goods.niceClassOverlap ?? 0;
  const concrete = goodsComparison?.concreteSimilarity;

  if (concrete === null || concrete === undefined) {
    return overlap * 60;
  }

  return clamp(overlap * 40 + concrete * 60, 0, 100);
}

function redundancyAdjustedScore(scores: {
  exact: number;
  orthographic: number;
  token: number;
  phonetic: number;
}): number {
  const ranked = [
    { family: "exact", score: scores.exact },
    { family: "orthographic", score: scores.orthographic },
    { family: "token", score: scores.token },
    { family: "phonetic", score: scores.phonetic },
  ].sort((a, b) => b.score - a.score);

  const primary = ranked[0]?.score ?? 0;
  const secondary = ranked[1]?.score ?? 0;

  if (primary >= 95 && secondary >= 70) {
    return clamp(primary + secondary * 0.15, 0, 100);
  }

  return primary;
}

function tokenSignal(token: TrademarkFeatureVector["token"]): number {
  return Math.max(
    token.dominantTokenOverlap ?? 0,
    token.tokenJaccard ?? 0,
    token.significantOverlap ?? 0,
    token.coreCompactMatch ?? 0,
  );
}

function isTokenWeak(token: TrademarkFeatureVector["token"]): boolean {
  return tokenSignal(token) < 0.25;
}

function isNoiseOnlyDriven(token: TrademarkFeatureVector["token"]): boolean {
  const noiseOnly = token.noiseOnlyOverlap ?? 0;
  const significant = token.significantOverlap ?? 0;
  const core = token.coreCompactMatch ?? 0;
  const dominant = token.dominantTokenOverlap ?? 0;
  return noiseOnly >= 0.5 && significant < 0.25 && core < 1 && dominant < 1;
}

/** Strong token identity — partial jaccard on a shared short fragment is not enough. */
function hasStrongTokenSupport(token: TrademarkFeatureVector["token"]): boolean {
  return (
    (token.coreCompactMatch ?? 0) >= 1 ||
    (token.dominantTokenOverlap ?? 0) >= 1 ||
    tokenSignal(token) >= 0.5
  );
}

function isPhoneticAloneDriven(
  phonetic: number,
  editOrtho: number,
  orthographic: TrademarkFeatureVector["orthographic"],
  token: TrademarkFeatureVector["token"],
  exact: number,
): boolean {
  if (phonetic < 80 || exact >= 95 || hasStrongTokenSupport(token)) {
    return false;
  }
  // Strong true-edit support ⇒ not phonetic-alone.
  if (editOrtho >= 80) {
    return false;
  }
  // Near-core stem exemption: JW+affix alone is too loose (WELL PANE vs
  // well-being: JW≈85, prefix≈0.44, lev≈0.56 → phonetic-only VS). Require
  // corroborating edit-ortho; true near-cores already clear the ≥80 gate via
  // core-form comparison (ZORVEX Soft Drinks ↔ ZORVEC).
  const jw = (orthographic.jaroWinklerSimilarity ?? 0) * 100;
  const affix = Math.max(token.prefixOverlap ?? 0, token.suffixOverlap ?? 0);
  if (jw >= 85 && affix >= 0.4 && editOrtho >= 70) {
    return false;
  }
  return true;
}

function isSurfaceOrthoInflated(
  orthographic: TrademarkFeatureVector["orthographic"],
  editOrtho: number,
  token: TrademarkFeatureVector["token"],
  exact: number,
): boolean {
  if (!isTokenWeak(token) || exact >= 95) {
    return false;
  }

  const lcs = (orthographic.lcsSimilarity ?? 0) * 100;
  const trigram = (orthographic.trigramDice ?? 0) * 100;
  // LCS/trigram coincidence without true edit support (not prefix-affix —
  // shared stems on near-cores are handled by phoneticAlone exemptions).
  return (lcs >= 80 || trigram >= 80) && editOrtho < 75;
}

function descriptivePenalty(
  token: TrademarkFeatureVector["token"],
  editOrtho: number,
): number {
  const dominant = token.dominantTokenOverlap ?? 0;

  if (isNoiseOnlyDriven(token)) {
    return 25;
  }

  const signal = tokenSignal(token);
  if (signal >= 0.5) {
    return 0;
  }

  // High edit-ortho is a distinctive string conflict (e.g. ZORVEX vs ZORVEC).
  // LCS/trigram-only inflation must not skip the penalty.
  if (editOrtho >= 80) {
    return 0;
  }

  const descriptiveOnly =
    (token.sharedRareTokenCount ?? 0) === 0 && signal < 0.25 && dominant < 0.2;

  return descriptiveOnly ? 20 : 0;
}

function deriveConfidence(
  score: number,
  goodsComparison: GoodsServicesComparisonResult | undefined,
  vector: TrademarkFeatureVector,
  flags: { phoneticAlone: boolean; surfaceInflated: boolean; exactIdentity: boolean },
): ConfidenceLevel {
  const goodsMissing =
    goodsComparison?.warnings.some((warning) => warning.includes("missing")) ??
    vector.goodsServices.coverage === "unknown";

  // Exact compact/normalized identity remains decisive even for weak-only marks
  // (BUSINESS/COFFEE/BRAND after WEAK_LEXICON → coreEmpty).
  if ((vector.token.coreEmpty ?? 0) >= 1 && !flags.exactIdentity) {
    return "low";
  }

  if (flags.phoneticAlone || flags.surfaceInflated) {
    return "low";
  }

  if ((vector.token.noiseOnlyOverlap ?? 0) >= 0.5 && (vector.token.significantOverlap ?? 0) < 0.25) {
    return score >= 70 ? "medium" : "low";
  }

  if (goodsMissing) {
    return score >= 70 ? "medium" : "low";
  }

  if (score >= 80) {
    return "high";
  }
  if (score >= 50) {
    return "medium";
  }
  return "low";
}

export function scoreFromFeatures(
  vector: TrademarkFeatureVector,
  goodsComparison?: GoodsServicesComparisonResult,
): TrademarkRiskOutput {
  const exact = exactScore(vector.exact);
  // Exact identity wins over coreEmpty/weak-lexicon penalties (BUSINESS self-match).
  if (exact >= 95) {
    const experimentalConflictScore = 100;
    return {
      experimentalConflictScore,
      riskBand: bandForScore(experimentalConflictScore),
      confidence: deriveConfidence(experimentalConflictScore, goodsComparison, vector, {
        phoneticAlone: false,
        surfaceInflated: false,
        exactIdentity: true,
      }),
    };
  }

  const editOrtho = editOrthographicScore(vector.orthographic);
  // When token support is weak, JW/LCS/trigram are prefix-coincidence prone
  // (noise particles, shared stems). Prefer true edit distance as ortho family.
  const orthographic = isTokenWeak(vector.token)
    ? editOrtho
    : orthographicScore(vector.orthographic);
  const token = tokenScore(vector.token);
  const phonetic = phoneticScore(vector.phonetic);
  const conceptual = conceptualScore(vector.conceptual);
  const goods = goodsScore(vector.goodsServices, goodsComparison);

  let base = redundancyAdjustedScore({ exact, orthographic, token, phonetic });

  if (goods > 0) {
    base = clamp(base * 0.85 + goods * 0.15, 0, 100);
  }

  if (conceptual > 0 && exact < 50 && orthographic < 50 && phonetic < 50) {
    base = Math.min(base, 44);
  }

  // No distinctive core: full-string ortho/phonetic must not alone yield very_strong.
  if ((vector.token.coreEmpty ?? 0) >= 1) {
    base = Math.min(base, 55);
  }

  // Noise-only token overlap: full-string ortho/phonetic must not alone yield very_strong.
  if (isNoiseOnlyDriven(vector.token)) {
    base = Math.min(base, 55);
  }

  const phoneticAlone = isPhoneticAloneDriven(
    phonetic,
    editOrtho,
    vector.orthographic,
    vector.token,
    exact,
  );
  const surfaceInflated = isSurfaceOrthoInflated(
    vector.orthographic,
    editOrtho,
    vector.token,
    exact,
  );

  // Phonetic key match without edit-ortho or token support (SER*/SURF* walls).
  if (phoneticAlone) {
    base = Math.min(base, 55);
  }

  // LCS/trigram/prefix inflation without edit-ortho or token support.
  if (surfaceInflated) {
    base = Math.min(base, 55);
  }

  base -= descriptivePenalty(vector.token, editOrtho);
  base = clamp(base, 0, 100);

  const experimentalConflictScore = Math.round(base * 100) / 100;

  return {
    experimentalConflictScore,
    riskBand: bandForScore(experimentalConflictScore),
    confidence: deriveConfidence(experimentalConflictScore, goodsComparison, vector, {
      phoneticAlone,
      surfaceInflated,
      exactIdentity: false,
    }),
  };
}

export function isValidRiskBand(band: RiskBand): boolean {
  return RISK_BANDS.includes(band);
}

export { SCORE_VERSION };
