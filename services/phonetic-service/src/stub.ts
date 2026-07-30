/**
 * Deterministic Latin phoneme stub for CI and local development.
 * Swap this module for an espeak-ng adapter when real IPA output is required.
 */
export const ENGINE_VERSION = "espeak-stub-1";

const VOWEL_MAP: Readonly<Record<string, string>> = {
  a: "a",
  e: "e",
  i: "i",
  o: "o",
  u: "u",
  y: "i",
};

export interface PhonemeStubResult {
  readonly ipa: string;
  readonly phonemes: readonly string[];
  readonly engineVersion: typeof ENGINE_VERSION;
}

function isLatinLetter(char: string): boolean {
  return /^[a-z]$/i.test(char);
}

export function stubPhonemes(text: string, locale: string): PhonemeStubResult {
  const normalized = text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const phonemes: string[] = [];

  for (const char of normalized) {
    if (!isLatinLetter(char)) {
      continue;
    }

    const mapped = VOWEL_MAP[char];
    if (mapped) {
      phonemes.push(mapped);
      continue;
    }

    phonemes.push(char);
  }

  const ipa = `[${locale}:${phonemes.join("")}]`;

  return {
    ipa,
    phonemes,
    engineVersion: ENGINE_VERSION,
  };
}
