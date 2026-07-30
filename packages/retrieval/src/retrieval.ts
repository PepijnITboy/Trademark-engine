import {
  RETRIEVAL_PROFILE_VERSION,
  lengthBucketFor,
  type LengthBucket,
  type LengthBucketThresholds,
  type RetrievalStrategy,
} from "@trademark-engine/domain";
import { normalizeMark } from "@trademark-engine/normalization";
import {
  buildPhoneticKeyRecords,
  PHONETIC_ALGORITHMS,
  type PhoneticKeyRecord,
} from "@trademark-engine/phonetics";
import { tokenizeMark } from "@trademark-engine/token-analysis";
import { transliterateToLatin } from "@trademark-engine/transliteration";

export interface RetrievalProfile {
  readonly version: string;
  readonly strategyCaps: LengthBucketThresholds<number>;
  readonly minTrigramSimilarity: number;
  readonly enabledStrategies: readonly RetrievalStrategy[];
}

export interface ExactLookupKeys {
  readonly compact: string;
  readonly caseFolded: string;
  readonly diacriticsFolded: string;
  readonly asciiFolded: string;
}

export interface PhoneticLookupKeys {
  readonly records: readonly PhoneticKeyRecord[];
  readonly keys: readonly string[];
  readonly algorithms: readonly string[];
}

export interface TrigramQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
}

export interface RetrievalEvidence {
  readonly strategy: RetrievalStrategy;
  readonly rank: number;
  readonly score: number;
}

export interface UnionCandidate {
  readonly trademarkId: string;
  readonly evidence: readonly RetrievalEvidence[];
}

export interface StrategyResultRow {
  readonly trademarkId: string;
  readonly strategy: RetrievalStrategy;
  readonly rank: number;
  readonly score: number;
}

export interface RankedCandidate {
  readonly trademarkId: string;
  readonly score: number;
  readonly evidence: readonly RetrievalEvidence[];
}

export interface StrategyCapResult {
  readonly kept: readonly RankedCandidate[];
  readonly preCapCount: number;
  readonly postCapCount: number;
  readonly capReached: boolean;
}

export function defaultRetrievalProfile(): RetrievalProfile {
  return {
    version: RETRIEVAL_PROFILE_VERSION,
    strategyCaps: {
      veryShort: 50,
      short: 75,
      medium: 100,
      long: 125,
      veryLong: 150,
    },
    minTrigramSimilarity: 0.15,
    enabledStrategies: [
      "exact_forms",
      "trigram",
      "prefix",
      "suffix",
      "token",
      "phonetic",
      "transliteration",
    ],
  };
}

export function lengthBucket(len: number): LengthBucket {
  return lengthBucketFor(len);
}

function compactKey(value: string): string {
  return value.toLocaleLowerCase("und").replace(/[^\p{L}\p{N}]+/gu, "");
}

export function buildExactLookupKeys(normalized: {
  readonly compact: string;
  readonly caseFolded: string;
  readonly diacriticsFolded: string;
  readonly asciiFolded: string;
}): ExactLookupKeys {
  return {
    compact: normalized.compact,
    caseFolded: compactKey(normalized.caseFolded),
    diacriticsFolded: compactKey(normalized.diacriticsFolded),
    asciiFolded: compactKey(normalized.asciiFolded),
  };
}

/**
 * Compact Latin lookup keys from script transliteration (Cyrillic/Greek/…).
 * Used so non-Latin queries can hit Latin-indexed corpus rows.
 */
export function buildTransliterationLookupKeys(markText: string): readonly string[] {
  const variants = transliterateToLatin(markText).variants;
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const variant of variants) {
    const key = compactKey(variant);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export interface CoreRetrievalKeys {
  readonly coreCompact: string;
  readonly significantTokens: readonly string[];
  /** Noise-stripped compact keys (core + each significant token), length ≥ 2. */
  readonly keys: readonly string[];
}

/** Min length for delimiter-split fragment keys (well/being, r2/d2). */
const CORE_FRAGMENT_MIN_LENGTH = 6;

/**
 * Significant-core lookup keys so noise particles/descriptives do not bury
 * distinctive stems in full-string trigram/phonetic retrieval.
 *
 * Delimiter compounds (well-being, R2-D2) only expose coreCompact plus long
 * standalone fragment keys — short halves must not flood reserved core slots.
 */
export function buildCoreRetrievalKeys(markText: string): CoreRetrievalKeys {
  const tokens = tokenizeMark(markText);
  const seen = new Set<string>();
  const keys: string[] = [];
  const add = (value: string, minLen: number): void => {
    const key = compactKey(value);
    if (!key || key.length < minLen || seen.has(key)) {
      return;
    }
    seen.add(key);
    keys.push(key);
  };

  if (tokens.coreCompact) {
    add(tokens.coreCompact, 2);
  }

  const significant = tokens.significantTokens.map((token) => token.normalized);
  const joined = significant.join("");
  const delimiterCompound =
    significant.length >= 2 && tokens.coreCompact === joined;

  for (const token of significant) {
    if (delimiterCompound) {
      // Hyphen/dash halves: only long distinctive cores as extra keys.
      if (token.length < CORE_FRAGMENT_MIN_LENGTH) {
        continue;
      }
      add(token, CORE_FRAGMENT_MIN_LENGTH);
      continue;
    }
    // Noise-stripped queries (ZORVEX Soft Drinks → zorvex): keep single cores.
    add(token, 3);
  }

  return {
    coreCompact: tokens.coreCompact,
    significantTokens: significant,
    keys,
  };
}

/**
 * Merge full-string and core-key hits, reserving cap slots for core so noise
 * on the full compact cannot crowd out distinctive-stem matches.
 */
export function mergeHitsReservingCore<T extends { trademarkId: string; score: number }>(
  fullHits: readonly T[],
  coreHits: readonly T[],
  cap: number,
  coreReserveFraction = 0.4,
): T[] {
  if (cap <= 0) {
    return [];
  }

  const coreReserve = Math.min(
    cap,
    Math.max(coreHits.length > 0 ? 1 : 0, Math.floor(cap * coreReserveFraction)),
  );
  const byScore = (a: T, b: T): number => b.score - a.score;
  const seen = new Set<string>();
  const out: T[] = [];

  for (const hit of [...coreHits].sort(byScore)) {
    if (out.length >= coreReserve) {
      break;
    }
    if (seen.has(hit.trademarkId)) {
      continue;
    }
    seen.add(hit.trademarkId);
    out.push(hit);
  }

  for (const hit of [...fullHits].sort(byScore)) {
    if (out.length >= cap) {
      break;
    }
    if (seen.has(hit.trademarkId)) {
      continue;
    }
    seen.add(hit.trademarkId);
    out.push(hit);
  }

  // Backfill unused slots from remaining core hits.
  for (const hit of [...coreHits].sort(byScore)) {
    if (out.length >= cap) {
      break;
    }
    if (seen.has(hit.trademarkId)) {
      continue;
    }
    seen.add(hit.trademarkId);
    out.push(hit);
  }

  return out.sort(byScore);
}

/** Build phonetic lookup keys from mark text (same algorithms as preprocess). */
export function buildPhoneticLookupKeys(markText: string): PhoneticLookupKeys {
  const normalized = normalizeMark(markText);
  const latinKeys = buildTransliterationLookupKeys(markText);
  // Corpus phonetic indexes are Latin — prefer transliterated form for non-Latin marks.
  const phoneticInput =
    latinKeys.find((key) => key && key !== normalized.compact) ??
    (normalized.diacriticsFolded || normalized.compact);

  const inputs = new Set<string>();
  if (phoneticInput) {
    inputs.add(phoneticInput);
  }
  for (const key of buildCoreRetrievalKeys(markText).keys) {
    inputs.add(key);
  }

  const records: PhoneticKeyRecord[] = [];
  for (const input of inputs) {
    records.push(...buildPhoneticKeyRecords(input));
  }
  const keys = [...new Set(records.map((record) => record.key))];
  return {
    records,
    keys,
    algorithms: [...PHONETIC_ALGORITHMS],
  };
}

export function buildTrigramQuery(
  trigrams: readonly string[],
  options?: { table?: string; minSimilarity?: number },
): TrigramQuery {
  const table = options?.table ?? "trademark_search_index";
  const minSimilarity = options?.minSimilarity ?? 0.15;

  if (trigrams.length === 0) {
    return {
      sql: `SELECT trademark_id, 0 AS score FROM ${table} WHERE FALSE`,
      params: [],
    };
  }

  const placeholders = trigrams.map((_, index) => `$${index + 2}`).join(", ");
  const sql = `
SELECT trademark_id,
       COUNT(*)::float / $1 AS score
FROM ${table}
WHERE trigram = ANY(ARRAY[${placeholders}]::text[])
GROUP BY trademark_id
HAVING COUNT(*)::float / $1 >= ${minSimilarity}
ORDER BY score DESC
`.trim();

  return {
    sql,
    params: [trigrams.length, ...trigrams],
  };
}

export function unionCandidates(
  resultsByStrategy: Readonly<Record<string, readonly StrategyResultRow[]>>,
): UnionCandidate[] {
  const byId = new Map<string, RetrievalEvidence[]>();

  for (const rows of Object.values(resultsByStrategy)) {
    for (const row of rows) {
      const existing = byId.get(row.trademarkId) ?? [];
      existing.push({
        strategy: row.strategy,
        rank: row.rank,
        score: row.score,
      });
      byId.set(row.trademarkId, existing);
    }
  }

  return [...byId.entries()]
    .map(([trademarkId, evidence]) => ({
      trademarkId,
      evidence: evidence.sort((a, b) => a.rank - b.rank),
    }))
    .sort((a, b) => {
      const bestA = Math.min(...a.evidence.map((item) => item.rank));
      const bestB = Math.min(...b.evidence.map((item) => item.rank));
      return bestA - bestB;
    });
}

export function applyStrategyCap(
  ranked: readonly RankedCandidate[],
  cap: number,
): StrategyCapResult {
  const preCapCount = ranked.length;
  const kept = ranked.slice(0, Math.max(0, cap));
  const postCapCount = kept.length;

  return {
    kept,
    preCapCount,
    postCapCount,
    capReached: preCapCount > cap,
  };
}
