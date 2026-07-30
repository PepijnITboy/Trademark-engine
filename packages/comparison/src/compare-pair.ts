import {
  ENGINE_VERSION,
  NORMALIZATION_VERSION,
  SCORE_VERSION,
  type RetrievalStrategy,
  type TrademarkFeatureVector,
} from "@trademark-engine/domain";
import { compareGoodsServices } from "@trademark-engine/goods-services";
import { trigramDice } from "@trademark-engine/ngrams";
import { normalizeMark, type NormalizedMark } from "@trademark-engine/normalization";
import {
  colognePhonetic,
  consonantSkeleton,
  doubleMetaphone,
  dutchReplacementKey,
} from "@trademark-engine/phonetics";
import { createTsStringMetricEngine } from "@trademark-engine/string-metrics";
import { tokenizeMark, type TokenizeMarkResult } from "@trademark-engine/token-analysis";
import { transliterateToLatin, type TransliterationResult } from "@trademark-engine/transliteration";
import { loadDefaultRules, weightedEdit } from "@trademark-engine/weighted-edit";

const metrics = createTsStringMetricEngine();
const weightedRules = loadDefaultRules();

/** Small cross-language meaning pairs for conceptual stub scoring. */
const TRANSLATION_EQUIVALENTS: Readonly<Record<string, readonly string[]>> = {
  lion: ["lowe", "löwe", "leeuw"],
  lowe: ["lion", "leeuw"],
  löwe: ["lion", "leeuw"],
  leeuw: ["lion", "lowe", "löwe"],
  sun: ["sonne", "zon", "sol"],
  moon: ["mond", "luna"],
};

export interface ComparableMark {
  readonly markText: string;
  readonly niceClasses?: readonly number[];
  readonly normalized: NormalizedMark;
  readonly tokens: TokenizeMarkResult;
  readonly transliteration: TransliterationResult;
  readonly phonetics: {
    readonly primary: string;
    readonly secondary: string;
    readonly cologne: string;
    readonly skeleton: string;
    readonly dutchKey: string;
  };
}

export interface ComparisonContext {
  readonly proposedNiceClasses?: readonly number[];
  readonly proposedGoodsTexts?: readonly string[];
  readonly candidateNiceClasses?: readonly number[];
  readonly candidateGoodsTexts?: readonly string[];
  readonly locale?: string;
  readonly retrieval?: {
    readonly strategies: readonly RetrievalStrategy[];
    readonly maxStrategyRank: number;
    readonly evidenceCount: number;
    readonly independentFamilyHits: readonly string[];
  };
}

export interface TrademarkPairComparison {
  readonly features: TrademarkFeatureVector;
  readonly evidenceCodes: readonly string[];
}

function binaryMatch(a: string, b: string): number | null {
  if (!a || !b) {
    return null;
  }
  return a === b ? 1 : 0;
}

function similarityOrNull(a: string, b: string, compute: () => number): number | null {
  if (!a || !b) {
    return null;
  }
  return compute();
}

function prefixOverlap(a: string, b: string): number | null {
  if (!a || !b) {
    return null;
  }

  const max = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) {
      break;
    }
    shared += 1;
  }

  return shared / Math.max(a.length, b.length);
}

function suffixOverlap(a: string, b: string): number | null {
  if (!a || !b) {
    return null;
  }

  const max = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 0; i < max; i += 1) {
    if (a[a.length - 1 - i] !== b[b.length - 1 - i]) {
      break;
    }
    shared += 1;
  }

  return shared / Math.max(a.length, b.length);
}

function tokenJaccard(
  proposed: TokenizeMarkResult,
  candidate: TokenizeMarkResult,
): number | null {
  const a = new Set(proposed.significantTokens.map((token) => token.normalized));
  const b = new Set(candidate.significantTokens.map((token) => token.normalized));

  if (a.size === 0 && b.size === 0) {
    return null;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function setOverlapRatio(left: ReadonlySet<string>, right: ReadonlySet<string>): number | null {
  if (left.size === 0 && right.size === 0) {
    return null;
  }
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function significantOverlap(
  proposed: TokenizeMarkResult,
  candidate: TokenizeMarkResult,
): number | null {
  return setOverlapRatio(
    new Set(proposed.significantTokens.map((token) => token.normalized)),
    new Set(candidate.significantTokens.map((token) => token.normalized)),
  );
}

function noiseOnlyOverlap(
  proposed: TokenizeMarkResult,
  candidate: TokenizeMarkResult,
): number | null {
  const significant = significantOverlap(proposed, candidate);
  if (significant !== null && significant > 0) {
    return 0;
  }

  return setOverlapRatio(
    new Set(proposed.noiseTokens.map((token) => token.normalized)),
    new Set(candidate.noiseTokens.map((token) => token.normalized)),
  );
}

function secondarySignificantOverlap(
  proposed: TokenizeMarkResult,
  candidate: TokenizeMarkResult,
): number | null {
  const dropPrimary = (result: TokenizeMarkResult): Set<string> => {
    const primary = result.dominantToken;
    return new Set(
      result.significantTokens
        .map((token) => token.normalized)
        .filter((token) => token !== primary),
    );
  };

  const left = dropPrimary(proposed);
  const right = dropPrimary(candidate);
  if (left.size === 0 && right.size === 0) {
    return null;
  }
  return setOverlapRatio(left, right);
}

function dominantTokenOverlap(
  proposed: TokenizeMarkResult,
  candidate: TokenizeMarkResult,
): number | null {
  if (!proposed.dominantToken || !candidate.dominantToken) {
    return null;
  }

  return proposed.dominantToken === candidate.dominantToken ? 1 : 0;
}

function coreCompactMatch(
  proposed: TokenizeMarkResult,
  candidate: TokenizeMarkResult,
): number | null {
  if (!proposed.coreCompact || !candidate.coreCompact) {
    return proposed.analysisFlags.coreEmpty || candidate.analysisFlags.coreEmpty ? null : 0;
  }
  return proposed.coreCompact === candidate.coreCompact ? 1 : 0;
}

function coreEmptyFlag(
  proposed: TokenizeMarkResult,
  candidate: TokenizeMarkResult,
): number {
  return proposed.analysisFlags.coreEmpty || candidate.analysisFlags.coreEmpty ? 1 : 0;
}

function transliterationExact(proposed: ComparableMark, candidate: ComparableMark): number | null {
  const left = proposed.transliteration.variants.map((value) => value.toLowerCase());
  const right = candidate.transliteration.variants.map((value) => value.toLowerCase());

  if (left.length === 0 || right.length === 0) {
    return null;
  }

  for (const variant of left) {
    if (right.includes(variant)) {
      return 1;
    }
  }

  return 0;
}

function compactLatinForm(mark: ComparableMark): string {
  const variant = mark.transliteration.variants[0];
  if (!variant) {
    return mark.normalized.compact;
  }
  // NFKC before alnum strip so compatibility leftovers (㎾H) expand to kwh,
  // not collapse to a trailing letter that false-matches short corpus marks.
  const compact = variant
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  // Prefer normalized compact when Latin collapse is shorter (symbol residue).
  if (
    mark.normalized.compact &&
    compact &&
    compact.length < mark.normalized.compact.length &&
    mark.normalized.compact.includes(compact)
  ) {
    return mark.normalized.compact;
  }
  return compact || mark.normalized.compact;
}

/** Prefer Latin core for affix when significant tokens are non-Latin. */
function coreForAffix(mark: ComparableMark, latin: string, native: string): string {
  const core = mark.tokens.coreCompact;
  if (core && latin && core !== latin) {
    const coreIsLatin = /^[\p{Script=Latin}\p{N}]*$/u.test(core);
    if (!coreIsLatin) {
      return latin;
    }
  }
  return core || latin || native;
}

/** Forms used for string metrics: native, Latin translit, and noise-stripped core. */
function comparisonForms(mark: ComparableMark): readonly string[] {
  const native = mark.normalized.compact;
  const latin = compactLatinForm(mark);
  const core = mark.tokens.coreCompact;
  const forms: string[] = [];
  const seen = new Set<string>();
  for (const value of [native, latin, core]) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    forms.push(value);
  }
  return forms;
}

/** Best similarity across native/Latin/core form pairs (cross-script + noise-safe). */
function bestFormSimilarity(
  leftForms: readonly string[],
  rightForms: readonly string[],
  compute: (a: string, b: string) => number,
): number | null {
  let best: number | null = null;
  for (const left of leftForms) {
    for (const right of rightForms) {
      if (!left || !right) {
        continue;
      }
      let score = compute(left, right);
      // Prefix short-stem inflation (LUMINA↔LUMIN, STELLARIS↔STELLA): downweight.
      const [shorter, longer] =
        left.length <= right.length ? [left, right] : [right, left];
      if (
        shorter.length >= 4 &&
        longer.length - shorter.length >= 1 &&
        longer.startsWith(shorter)
      ) {
        score *= 0.7;
      }
      if (best === null || score > best) {
        best = score;
      }
    }
  }
  return best;
}

function translationProximity(proposed: ComparableMark, candidate: ComparableMark): number | null {
  const proposedTokens = proposed.tokens.significantTokens.map((token) => token.normalized);
  const candidateTokens = candidate.tokens.significantTokens.map((token) => token.normalized);

  if (proposedTokens.length === 0 || candidateTokens.length === 0) {
    const proposedWord = proposed.normalized.compact;
    const candidateWord = candidate.normalized.compact;
    const equivalents = TRANSLATION_EQUIVALENTS[proposedWord] ?? [];
    if (equivalents.includes(candidateWord)) {
      return 1;
    }
    return null;
  }

  for (const left of proposedTokens) {
    const equivalents = TRANSLATION_EQUIVALENTS[left] ?? [];
    for (const right of candidateTokens) {
      if (left === right || equivalents.includes(right)) {
        return 1;
      }
    }
  }

  return 0;
}

function phoneticSimilarity(proposed: ComparableMark, candidate: ComparableMark): number | null {
  const left = proposed.phonetics.primary;
  const right = candidate.phonetics.primary;
  if (!left || !right) {
    return null;
  }

  if (left === right) {
    return 1;
  }

  return similarityOrNull(left, right, () =>
    metrics.jaroWinkler(left, right).similarity,
  );
}

function collectEvidence(params: {
  exact: TrademarkFeatureVector["exact"];
  orthographic: TrademarkFeatureVector["orthographic"];
  token: TrademarkFeatureVector["token"];
  phonetic: TrademarkFeatureVector["phonetic"];
  conceptual: TrademarkFeatureVector["conceptual"];
  goodsWarnings: readonly string[];
  retrievalCount: number;
}): string[] {
  const codes: string[] = [];

  if (params.exact.normalizedMatch === 1) {
    codes.push("exact_normalized");
  }
  if (params.exact.compactMatch === 1) {
    codes.push("exact_compact");
  }
  if (params.exact.transliterationMatch === 1) {
    codes.push("exact_transliteration");
  }
  if ((params.orthographic.jaroWinklerSimilarity ?? 0) >= 0.85) {
    codes.push("orthographic_high");
  } else if ((params.orthographic.jaroWinklerSimilarity ?? 0) >= 0.65) {
    codes.push("orthographic_medium");
  }
  if (params.phonetic.primaryKeyMatch === 1) {
    codes.push("phonetic_primary_match");
  }
  if (params.phonetic.secondaryKeyMatch === 1) {
    codes.push("phonetic_secondary_match");
  }
  if ((params.phonetic.pronunciationSimilarity ?? 0) >= 0.7) {
    codes.push("phonetic_similar");
  }
  if (params.token.dominantTokenOverlap === 1) {
    codes.push("token_dominant_overlap");
  }
  if ((params.token.significantOverlap ?? 0) >= 0.5) {
    codes.push("token_core_overlap");
  }
  if ((params.token.noiseOnlyOverlap ?? 0) >= 0.5) {
    codes.push("token_noise_only");
  }
  if ((params.token.coreEmpty ?? 0) >= 1) {
    codes.push("token_core_empty");
  }
  if ((params.token.secondarySignificantOverlap ?? 0) > 0) {
    codes.push("token_secondary_overlap");
  }
  if ((params.token.prefixOverlap ?? 0) >= 0.8) {
    codes.push("token_prefix_overlap");
  }
  if ((params.token.suffixOverlap ?? 0) >= 0.8) {
    codes.push("token_suffix_overlap");
  }
  if (params.conceptual.translationProximity === 1) {
    codes.push("conceptual_translation");
  }
  if (params.goodsWarnings.length > 0) {
    codes.push("goods_missing");
  } else if ((params.exact.normalizedMatch ?? 0) >= 0) {
    codes.push("goods_class_overlap");
  }
  if (params.retrievalCount >= 2) {
    codes.push("retrieval_multi_strategy");
  }

  return codes;
}

export function buildComparableFromMarkText(
  markText: string,
  niceClasses?: readonly number[],
): ComparableMark {
  const normalized = normalizeMark(markText);
  const tokens = tokenizeMark(markText);
  const transliteration = transliterateToLatin(markText);
  const latinCompact = transliteration.variants[0]
    ? transliteration.variants[0].toLocaleLowerCase("und").replace(/[^\p{L}\p{N}]+/gu, "")
    : "";
  const coreIsLatin =
    !!tokens.coreCompact && /^[\p{Script=Latin}\p{N}]*$/u.test(tokens.coreCompact);
  // Prefer Latin significant core, then Latin translit — corpus phonetics are Latin-indexed.
  const phoneticInput =
    (coreIsLatin ? tokens.coreCompact : "") ||
    latinCompact ||
    normalized.diacriticsFolded ||
    normalized.compact;
  const metaphone = doubleMetaphone(phoneticInput);

  const phonetics = {
    primary: metaphone.primary,
    secondary: metaphone.secondary,
    cologne: colognePhonetic(phoneticInput),
    skeleton: consonantSkeleton(phoneticInput),
    dutchKey: dutchReplacementKey(phoneticInput),
  };

  const result: ComparableMark = {
    markText,
    normalized,
    tokens,
    transliteration,
    phonetics,
  };

  if (niceClasses !== undefined) {
    return { ...result, niceClasses };
  }

  return result;
}

export function compareTrademarkPair(
  proposed: ComparableMark,
  existing: ComparableMark,
  context: ComparisonContext = {},
): TrademarkPairComparison {
  const locale = context.locale ?? "en";
  const left = proposed.normalized.compact;
  const right = existing.normalized.compact;
  const leftLatin = compactLatinForm(proposed);
  const rightLatin = compactLatinForm(existing);
  const leftForms = comparisonForms(proposed);
  const rightForms = comparisonForms(existing);

  const exact: TrademarkFeatureVector["exact"] = {
    normalizedMatch: binaryMatch(
      proposed.normalized.diacriticsFolded.replace(/\s+/g, ""),
      existing.normalized.diacriticsFolded.replace(/\s+/g, ""),
    ),
    compactMatch: binaryMatch(left, right),
    caseFoldedMatch: binaryMatch(
      proposed.normalized.caseFolded.replace(/\s+/g, ""),
      existing.normalized.caseFolded.replace(/\s+/g, ""),
    ),
    transliterationMatch: transliterationExact(proposed, existing),
  };

  const orthographic: TrademarkFeatureVector["orthographic"] = {
    levenshteinSimilarity: bestFormSimilarity(leftForms, rightForms, (a, b) =>
      metrics.levenshtein(a, b).similarity,
    ),
    damerauLevenshteinSimilarity: bestFormSimilarity(leftForms, rightForms, (a, b) =>
      metrics.damerauLevenshtein(a, b).similarity,
    ),
    jaroSimilarity: bestFormSimilarity(leftForms, rightForms, (a, b) =>
      metrics.jaro(a, b).similarity,
    ),
    jaroWinklerSimilarity: bestFormSimilarity(leftForms, rightForms, (a, b) =>
      metrics.jaroWinkler(a, b).similarity,
    ),
    weightedEditSimilarity: bestFormSimilarity(leftForms, rightForms, (a, b) =>
      weightedEdit(a, b, locale, weightedRules).normalizedSimilarity,
    ),
    trigramDice: bestFormSimilarity(leftForms, rightForms, (a, b) => trigramDice(a, b)),
    lcsSimilarity: bestFormSimilarity(leftForms, rightForms, (a, b) =>
      metrics.lcsLength(a, b).similarity,
    ),
  };

  // Affix on significant cores — noise particles (VAN/BV/Soft) must not inflate prefix.
  // Non-Latin cores fall back to Latin transliteration for cross-script affix.
  const leftCore = coreForAffix(proposed, leftLatin, left);
  const rightCore = coreForAffix(existing, rightLatin, right);

  const token: TrademarkFeatureVector["token"] = {
    dominantTokenOverlap: dominantTokenOverlap(proposed.tokens, existing.tokens),
    tokenJaccard: tokenJaccard(proposed.tokens, existing.tokens),
    sharedRareTokenCount:
      proposed.tokens.significantTokens.length > 0 &&
      existing.tokens.significantTokens.length > 0
        ? proposed.tokens.significantTokens.filter((leftToken) =>
            existing.tokens.significantTokens.some(
              (rightToken) => rightToken.normalized === leftToken.normalized,
            ),
          ).length
        : null,
    prefixOverlap: prefixOverlap(leftCore, rightCore),
    suffixOverlap: suffixOverlap(leftCore, rightCore),
    significantOverlap: significantOverlap(proposed.tokens, existing.tokens),
    noiseOnlyOverlap: noiseOnlyOverlap(proposed.tokens, existing.tokens),
    coreCompactMatch: coreCompactMatch(proposed.tokens, existing.tokens),
    coreEmpty: coreEmptyFlag(proposed.tokens, existing.tokens),
    secondarySignificantOverlap: secondarySignificantOverlap(
      proposed.tokens,
      existing.tokens,
    ),
  };

  const phonetic: TrademarkFeatureVector["phonetic"] = {
    primaryKeyMatch: binaryMatch(proposed.phonetics.primary, existing.phonetics.primary),
    secondaryKeyMatch: binaryMatch(proposed.phonetics.secondary, existing.phonetics.secondary),
    pronunciationSimilarity: phoneticSimilarity(proposed, existing),
    skeletonMatch: binaryMatch(proposed.phonetics.skeleton, existing.phonetics.skeleton),
  };

  const conceptual: TrademarkFeatureVector["conceptual"] = {
    lexiconOverlap: token.tokenJaccard,
    translationProximity: translationProximity(proposed, existing),
    descriptiveOverlap:
      proposed.tokens.weakTokens.length > 0 || existing.tokens.weakTokens.length > 0
        ? Math.min(
            proposed.tokens.weakTokens.length / Math.max(proposed.tokens.tokens.length, 1),
            existing.tokens.weakTokens.length / Math.max(existing.tokens.tokens.length, 1),
          )
        : null,
  };

  const goodsComparison = compareGoodsServices({
    proposedNiceClasses: context.proposedNiceClasses ?? proposed.niceClasses ?? [],
    candidateNiceClasses: context.candidateNiceClasses ?? existing.niceClasses ?? [],
    ...(context.proposedGoodsTexts !== undefined
      ? { proposedTexts: context.proposedGoodsTexts }
      : {}),
    ...(context.candidateGoodsTexts !== undefined
      ? { candidateTexts: context.candidateGoodsTexts }
      : {}),
  });

  const hasConcreteGoods =
    !goodsComparison.warnings.includes("missing_proposed_goods_text") &&
    !goodsComparison.warnings.includes("missing_candidate_goods_text");

  const goodsServices: TrademarkFeatureVector["goodsServices"] = {
    niceClassOverlap: goodsComparison.niceClassOverlap,
    conceptOverlap: goodsComparison.concreteSimilarity,
    coverage: hasConcreteGoods ? "full" : "unknown",
  };

  const retrieval = context.retrieval ?? {
    strategies: [] as RetrievalStrategy[],
    maxStrategyRank: null as number | null,
    evidenceCount: 0,
    independentFamilyHits: [] as string[],
  };

  const features: TrademarkFeatureVector = {
    exact,
    orthographic,
    token,
    phonetic,
    conceptual,
    goodsServices,
    context: {
      statusRelevance: null,
      dateProximity: null,
      registryRelevance: null,
    },
    retrieval: {
      strategies: retrieval.strategies,
      maxStrategyRank: retrieval.maxStrategyRank,
      evidenceCount: retrieval.evidenceCount,
      independentFamilyHits: retrieval.independentFamilyHits,
    },
    metadata: {
      engineVersion: ENGINE_VERSION,
      normalizationVersion: NORMALIZATION_VERSION,
      scoreVersion: SCORE_VERSION,
      computedAt: new Date(0).toISOString(),
      evidenceIds: [],
    },
  };

  const evidenceCodes = collectEvidence({
    exact,
    orthographic,
    token,
    phonetic,
    conceptual,
    goodsWarnings: goodsComparison.warnings,
    retrievalCount: retrieval.evidenceCount,
  });

  return { features, evidenceCodes };
}
