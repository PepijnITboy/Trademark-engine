import {
  CYRILLIC_TO_LATIN,
  GREEK_TO_LATIN,
  TRANSLITERATION_VERSION,
} from "./maps.js";

export type TransliterationResult = {
  variants: string[];
  version: string;
};

const COMBINING_MARK = /\p{M}/u;
const HAN = /\p{Script=Han}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const GREEK = /\p{Script=Greek}/u;

function applyMap(input: string, map: Readonly<Record<string, string>>): string {
  let out = "";
  for (const ch of input) {
    const lower = ch.toLowerCase();
    const mapped = map[lower];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (ch === ch.toUpperCase() && lower !== ch) {
      const upperMapped = map[lower];
      if (upperMapped !== undefined) {
        out += upperMapped.toUpperCase();
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(COMBINING_MARK, "");
}

function compactWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function cjkHexFallback(input: string): string {
  const codepoints = [...input]
    .filter((ch) => HAN.test(ch))
    .map((ch) => ch.codePointAt(0)!.toString(16).toUpperCase())
    .join("-");
  return codepoints ? `U+${codepoints.replace(/-/g, "-U+")}` : input;
}

function transliterateScript(input: string): string {
  if (CYRILLIC.test(input)) {
    return applyMap(input, CYRILLIC_TO_LATIN);
  }
  if (GREEK.test(input)) {
    return applyMap(input, GREEK_TO_LATIN);
  }
  return input;
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Deterministic rule-based transliteration to Latin variants.
 */
export function transliterateToLatin(input: string): TransliterationResult {
  const variants: string[] = [];

  if (!input) {
    return { variants: [""], version: TRANSLITERATION_VERSION };
  }

  // NFKC first so compatibility symbols expand (㎾→kW) before Latin folding /
  // alnum strip in downstream compactLatinForm (otherwise ㎾h → "h").
  const nfkc = input.normalize("NFKC");
  const scriptConverted = transliterateScript(nfkc);
  variants.push(scriptConverted.toUpperCase());

  const diacriticsStripped = stripDiacritics(scriptConverted);
  if (diacriticsStripped !== scriptConverted) {
    variants.push(diacriticsStripped.toUpperCase());
  }

  if (HAN.test(nfkc)) {
    variants.push(nfkc);
    variants.push(cjkHexFallback(nfkc));
    const noSpaces = compactWhitespace(nfkc).replace(/\s+/g, "");
    if (noSpaces !== nfkc) {
      variants.push(noSpaces);
    }
  }

  const latinOnly = stripDiacritics(nfkc);
  if (/^[\p{Script=Latin}\p{N}\p{P}\p{Zs}]+$/u.test(latinOnly)) {
    variants.push(latinOnly.toUpperCase());
  }

  return {
    variants: uniqueNonEmpty(variants),
    version: TRANSLITERATION_VERSION,
  };
}
