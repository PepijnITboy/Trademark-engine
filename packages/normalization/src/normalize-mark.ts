import { NORMALIZATION_VERSION } from "@trademark-engine/domain";

const COMBINING_MARK = /\p{M}/gu;
const PUNCTUATION_AND_SEPARATORS = /[\p{P}\p{S}]+/gu;
const WHITESPACE = /\s+/g;
const NON_ASCII = /[^\x00-\x7F]/g;
const COMPACT_NON_ALNUM = /[^\p{L}\p{N}]+/gu;

/** Compatibility folds for Latin letters that NFD/NFKC leave intact. */
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

const SCRIPT_DETECTORS: ReadonlyArray<{ readonly script: string; readonly pattern: RegExp }> = [
  { script: "Latn", pattern: /\p{Script=Latin}/u },
  { script: "Cyrl", pattern: /\p{Script=Cyrillic}/u },
  { script: "Grek", pattern: /\p{Script=Greek}/u },
  { script: "Arab", pattern: /\p{Script=Arabic}/u },
  { script: "Hebr", pattern: /\p{Script=Hebrew}/u },
  { script: "Deva", pattern: /\p{Script=Devanagari}/u },
  { script: "Hani", pattern: /\p{Script=Han}/u },
  { script: "Zyyy", pattern: /[\p{Script=Common}\p{Script=Inherited}]/u },
];

export interface NormalizedMark {
  readonly raw: string;
  readonly unicodeNfc: string;
  readonly unicodeNfkc: string;
  readonly caseFolded: string;
  readonly diacriticsFolded: string;
  readonly punctuationFolded: string;
  readonly whitespaceFolded: string;
  readonly asciiFolded: string;
  readonly compact: string;
  readonly scripts: readonly string[];
  readonly normalizationVersion: string;
}

function stripCombiningMarks(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARK, "");
}

function foldSpecialLatin(value: string): string {
  let out = "";
  for (const ch of value) {
    out += SPECIAL_LATIN_FOLDS[ch] ?? ch;
  }
  return out;
}

function foldPunctuation(value: string): string {
  return value.replace(PUNCTUATION_AND_SEPARATORS, " ");
}

function foldWhitespace(value: string): string {
  return value.replace(WHITESPACE, " ").trim();
}

function foldAscii(value: string): string {
  return value.replace(NON_ASCII, "");
}

function toCompact(value: string): string {
  return value.toLocaleLowerCase("und").replace(COMPACT_NON_ALNUM, "");
}

/** Trailing legal-form tokens stripped before compact (SpA/BV/Inc glue). */
const TRAILING_LEGAL_FORMS = new Set([
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
  "co",
  "company",
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
  "group",
]);

/**
 * Drop trailing legal-form words from whitespace-folded text so compact does
 * not glue SpA/Inc onto the distinctive stem (QUORIX SpA → quorix, not quorixspa).
 * Only whole tokens — never strip agglutinated endings (banco/visa stay intact).
 */
function stripTrailingLegalTokens(whitespaceFolded: string): string {
  const parts = whitespaceFolded.split(/\s+/).filter(Boolean);
  while (parts.length >= 2) {
    const last = toCompact(parts[parts.length - 1]!);
    if (!last || !TRAILING_LEGAL_FORMS.has(last)) {
      break;
    }
    parts.pop();
  }
  return parts.join(" ");
}

function detectScripts(value: string): string[] {
  const found = SCRIPT_DETECTORS.filter(({ pattern }) => pattern.test(value)).map(
    ({ script }) => script,
  );

  return found.length > 0 ? found : ["Zyyy"];
}

export function normalizeMark(raw: string): NormalizedMark {
  const unicodeNfc = raw.normalize("NFC");
  const unicodeNfkc = raw.normalize("NFKC");
  // Fold from NFKC so compatibility chars (ﬁ, ﬀ, ㎾, …) expand before compact/ascii.
  const caseFolded = unicodeNfkc.toLocaleLowerCase("und");
  const diacriticsFolded = foldSpecialLatin(stripCombiningMarks(caseFolded));
  const punctuationFolded = foldPunctuation(diacriticsFolded);
  const whitespaceFolded = foldWhitespace(punctuationFolded);
  const asciiFolded = foldAscii(diacriticsFolded);
  const legalStripped = stripTrailingLegalTokens(whitespaceFolded);
  let compact = toCompact(legalStripped);
  // Guard: never let symbol/compatibility collapse yield empty/near-empty compact
  // when NFKC still has alphanumerics (e.g. legacy ascii-strip of ㎾h → "h").
  if (compact.length < 2) {
    const nfkcAlnum = toCompact(foldSpecialLatin(stripCombiningMarks(caseFolded)));
    if (nfkcAlnum.length >= 2) {
      compact = nfkcAlnum;
    }
  }

  return {
    raw,
    unicodeNfc,
    unicodeNfkc,
    caseFolded,
    diacriticsFolded,
    punctuationFolded,
    whitespaceFolded,
    asciiFolded,
    compact,
    scripts: detectScripts(raw),
    normalizationVersion: NORMALIZATION_VERSION,
  };
}
