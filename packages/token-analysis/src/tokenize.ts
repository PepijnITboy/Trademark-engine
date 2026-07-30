import { TOKEN_ANALYSIS_VERSION, type TokenRole } from "@trademark-engine/domain";

export const COMPANY_SUFFIXES = new Set([
  "bv",
  "nv",
  "ltd",
  "limited",
  "llc",
  "gmbh",
  "ag",
  "sas",
  "sarl",
  "spa",
  "sl",
  "group",
  "company",
  "co",
  "corporation",
  "corp",
  "holding",
  "holdings",
  "inc",
  "llp",
  "plc",
  "oy",
  "ab",
  "sa",
  "srl",
  "kg",
  "kgaa",
]);

export const WEAK_LEXICON = new Set([
  "drinks",
  "beverages",
  "beverage",
  "food",
  "shop",
  "store",
  "company",
  "group",
  "premium",
  "original",
  "ginger",
  "spritz",
  "beer",
  "wine",
  "cafe",
  "café",
  "bar",
  "official",
  "international",
  "soft",
  // Category / house-mark leftovers that sole-significant core retrieval floods.
  "business",
  "coffee",
  "brand",
  "water",
  "juice",
  "organic",
  "natural",
  "fresh",
  "quality",
  "collection",
  // Corporate fluff (Partners/Solutions drown distinctive cores).
  "partners",
  "solutions",
  "technologies",
  "technology",
  "trading",
  "consulting",
  "ventures",
  "laboratories",
  "laboratory",
  "industries",
  "industry",
  "enterprises",
  "enterprise",
  "services",
  "service",
  "systems",
  "system",
  "networks",
  "network",
  "capital",
  "global",
  "worldwide",
]);

/** Non-distinctive function / particle words (nl/de/fr/en starters). */
export const FUNCTION_WORDS = new Set([
  "van",
  "von",
  "der",
  "ter",
  "de",
  "den",
  "des",
  "du",
  "het",
  "the",
  "of",
  "and",
  "und",
  "et",
  "une",
  "un",
  "una",
  "la",
  "le",
  "les",
  "el",
  "y",
  "da",
  "di",
  "del",
  "della",
  "ki", // short particle / initialism lead (KI STELLARIS)
  // Possessive / determiner leftovers after weak category strip (MY-BRAND→my).
  "my",
  "our",
  "your",
  "their",
  "his",
  "her",
  "its",
  // Demonstratives left after weak category strip (THIS BRAND→this).
  "this",
  "that",
  "these",
  "those",
]);

export type Token = {
  raw: string;
  normalized: string;
  index: number;
  role: TokenRole;
};

export type MergedHypothesis = {
  tokens: string[];
  merged: string;
  reason: string;
};

export type DominanceCandidate = {
  readonly token: string;
  readonly weight: number;
  readonly index: number;
  readonly role: TokenRole;
};

export type TokenAnalysisFlags = {
  readonly coreEmpty: boolean;
  readonly allNoise: boolean;
  readonly compoundHypothesisUsed: boolean;
};

export type TokenizeMarkResult = {
  tokens: Token[];
  mergedHypotheses: MergedHypothesis[];
  companySuffixTokens: Token[];
  weakTokens: Token[];
  significantTokens: Token[];
  noiseTokens: Token[];
  dominantToken: string | null;
  coreCompact: string;
  dominanceCandidates: DominanceCandidate[];
  analysisFlags: TokenAnalysisFlags;
  tokenAnalysisVersion: string;
};

const COMBINING_MARK = /\p{M}/gu;
const HAS_LETTER = /\p{L}/u;
const PURE_NUMERAL = /^\p{N}+$/u;
const NOISE_ROLES: ReadonlySet<TokenRole> = new Set([
  "descriptive_weak",
  "legal_form",
  "function_word",
  "numeral",
]);

/** Compatibility folds mirrored from normalization (ß/ø/…) after NFKC. */
const SPECIAL_LATIN_FOLDS: Readonly<Record<string, string>> = {
  ß: "ss",
  ø: "o",
  æ: "ae",
  œ: "oe",
  đ: "d",
  ð: "d",
  þ: "th",
  ł: "l",
  ı: "i",
  ŋ: "n",
};

export function foldForToken(text: string): string {
  let folded = text.normalize("NFKC").normalize("NFD").replace(COMBINING_MARK, "");
  let out = "";
  for (const ch of folded.toLocaleLowerCase("und")) {
    out += SPECIAL_LATIN_FOLDS[ch] ?? ch;
  }
  return out.replace(/[^\p{L}\p{N}]+/gu, "");
}

function splitRawTokens(text: string): string[] {
  // Letter-bounded joiners: dashes, equals/wave, underscore, middot,
  // plus (+ / NFKC ＋), and Sm/Po math ops (⋆ × ÷ ±).
  // Short halves are gated in retrieval (CORE_FRAGMENT_MIN_LENGTH) so
  // R2_D2 / well_being do not flood fragment core exact slots.
  return text
    .split(/[\s/\\|,;:\u2010-\u2015\u2212]+/u)
    .flatMap((part) =>
      part.split(
        /(?<=[\p{L}\p{N}])[\-‐‑‒–—―=+\u301C\uFF5E\u223C\u2248_\u00B7\u22C5\u2022\u22C6\u00D7\u00F7\u00B1](?=[\p{L}\p{N}])/u,
      ),
    )
    .map((part) => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

export function assignTokenRole(normalized: string): TokenRole {
  if (!normalized) {
    return "unknown";
  }
  if (PURE_NUMERAL.test(normalized)) {
    return "numeral";
  }
  if (COMPANY_SUFFIXES.has(normalized)) {
    return "legal_form";
  }
  if (FUNCTION_WORDS.has(normalized)) {
    return "function_word";
  }
  if (WEAK_LEXICON.has(normalized)) {
    return "descriptive_weak";
  }
  if (HAS_LETTER.test(normalized)) {
    return "distinctive";
  }
  return "unknown";
}

function isSignificantRole(role: TokenRole): boolean {
  return role === "distinctive" || role === "unknown";
}

function dominanceWeight(token: Token, tokenCount: number): number {
  const roleWeight = token.role === "distinctive" ? 1 : token.role === "unknown" ? 0.7 : 0;
  if (roleWeight === 0) {
    return 0;
  }
  // Length dominates: short leading leftovers must not outrank longer cores
  // (e.g. mistaken particle "von" vs "lumina" before lexicon coverage).
  const lengthScore = token.normalized.length * 3 * roleWeight;
  const positionBoost = (tokenCount - token.index) * 0.35 * roleWeight;
  const shortPenalty = token.normalized.length <= 3 ? 5 * roleWeight : 0;
  return lengthScore + positionBoost - shortPenalty;
}

function buildDominanceCandidates(
  significant: readonly Token[],
  tokenCount: number,
): DominanceCandidate[] {
  return [...significant]
    .map((token) => ({
      token: token.normalized,
      weight: dominanceWeight(token, tokenCount),
      index: token.index,
      role: token.role,
    }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, 5);
}

function buildMergedHypotheses(
  tokens: readonly Token[],
  compoundSplits: readonly MergedHypothesis[],
): MergedHypothesis[] {
  const hypotheses: MergedHypothesis[] = [...compoundSplits];
  const normalized = tokens.map((t) => t.normalized).filter(Boolean);

  if (normalized.length >= 2) {
    hypotheses.push({
      tokens: normalized.slice(0, 2),
      merged: normalized.slice(0, 2).join(""),
      reason: "adjacent-token-merge",
    });
  }

  const significant = tokens
    .filter((t) => isSignificantRole(t.role))
    .map((t) => t.normalized)
    .filter(Boolean);
  if (significant.length >= 2) {
    hypotheses.push({
      tokens: significant,
      merged: significant.join(""),
      reason: "significant-merge",
    });
  }

  return hypotheses;
}

/**
 * Hypothesis: single agglutinated token may end with a known weak/legal suffix.
 * Does not rewrite the primary token list — only records a split hypothesis.
 */
function buildCompoundSplitHypotheses(tokens: readonly Token[]): MergedHypothesis[] {
  const hypotheses: MergedHypothesis[] = [];
  const noiseSuffixes = [...COMPANY_SUFFIXES, ...WEAK_LEXICON].sort(
    (a, b) => b.length - a.length,
  );

  for (const token of tokens) {
    if (tokens.length !== 1 && token.role !== "distinctive") {
      continue;
    }
    if (token.normalized.length < 6) {
      continue;
    }
    for (const suffix of noiseSuffixes) {
      if (suffix.length < 3) {
        continue;
      }
      if (
        token.normalized.endsWith(suffix) &&
        token.normalized.length - suffix.length >= 3
      ) {
        const head = token.normalized.slice(0, token.normalized.length - suffix.length);
        if (head.length >= 3 && assignTokenRole(head) === "distinctive") {
          hypotheses.push({
            tokens: [head, suffix],
            merged: token.normalized,
            reason: "agglutinated-noise-suffix-split",
          });
          break;
        }
      }
    }
  }

  return hypotheses;
}

/**
 * Tokenize a mark into roles, significant/noise sets, core forms, and dominance candidates.
 */
export function tokenizeMark(text: string): TokenizeMarkResult {
  // NFKC before split/trim so compatibility symbols (㎾, ﬁ, …) expand instead of
  // being stripped as leading non-letters (㎾h → "h").
  const rawParts = splitRawTokens(text.normalize("NFKC"));
  const tokens: Token[] = rawParts.map((raw, index) => {
    const normalized = foldForToken(raw);
    return {
      raw,
      normalized,
      index,
      role: assignTokenRole(normalized),
    };
  });

  const companySuffixTokens = tokens.filter((t) => t.role === "legal_form");
  const weakTokens = tokens.filter((t) => t.role === "descriptive_weak");
  const significantTokens = tokens.filter(
    (t) => t.normalized.length > 0 && isSignificantRole(t.role),
  );
  const noiseTokens = tokens.filter((t) => NOISE_ROLES.has(t.role));

  const compoundSplits = buildCompoundSplitHypotheses(tokens);
  const mergedHypotheses = buildMergedHypotheses(tokens, compoundSplits);

  const dominanceCandidates = buildDominanceCandidates(significantTokens, tokens.length);
  const dominantToken = dominanceCandidates[0]?.token ?? null;
  const coreCompact = significantTokens.map((t) => t.normalized).join("");

  const coreEmpty = significantTokens.length === 0;
  const allNoise = tokens.length > 0 && coreEmpty;

  return {
    tokens,
    mergedHypotheses,
    companySuffixTokens,
    weakTokens,
    significantTokens,
    noiseTokens,
    dominantToken,
    coreCompact,
    dominanceCandidates,
    analysisFlags: {
      coreEmpty,
      allNoise,
      compoundHypothesisUsed: compoundSplits.length > 0,
    },
    tokenAnalysisVersion: TOKEN_ANALYSIS_VERSION,
  };
}
