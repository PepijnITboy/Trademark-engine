import {
  buildPhoneticKeyRecords,
  colognePhonetic,
  consonantSkeleton,
  doubleMetaphone,
  dutchReplacementKey,
  type PhoneticKeyRecord,
} from "@trademark-engine/phonetics";
import { normalizeMark, type NormalizedMark } from "@trademark-engine/normalization";
import { tokenizeMark, type TokenizeMarkResult } from "@trademark-engine/token-analysis";
import {
  transliterateToLatin,
  type TransliterationResult,
} from "@trademark-engine/transliteration";

export interface PreprocessedMark {
  readonly markText: string;
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
  readonly phoneticKeyRecords: readonly PhoneticKeyRecord[];
}

export function phoneticKeyRecordsForMark(markText: string): PhoneticKeyRecord[] {
  const normalized = normalizeMark(markText);
  const phoneticInput = normalized.diacriticsFolded || normalized.compact;
  return buildPhoneticKeyRecords(phoneticInput);
}

export function preprocessMark(markText: string): PreprocessedMark {
  const normalized = normalizeMark(markText);
  const tokens = tokenizeMark(markText);
  const transliteration = transliterateToLatin(markText);
  const phoneticInput = normalized.diacriticsFolded || normalized.compact;
  const metaphone = doubleMetaphone(phoneticInput);
  const phoneticKeyRecords = buildPhoneticKeyRecords(phoneticInput);

  return {
    markText,
    normalized,
    tokens,
    transliteration,
    phonetics: {
      primary: metaphone.primary,
      secondary: metaphone.secondary,
      cologne: colognePhonetic(phoneticInput),
      skeleton: consonantSkeleton(phoneticInput),
      dutchKey: dutchReplacementKey(phoneticInput),
    },
    phoneticKeyRecords,
  };
}

export async function runPreprocessBatch(markTexts: readonly string[]): Promise<PreprocessedMark[]> {
  return markTexts.map((markText) => preprocessMark(markText));
}
