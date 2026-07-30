import { HYPOTHESIS_VERSION, type LanguageHypothesis } from "./types.js";

const SCRIPT_RANGES: ReadonlyArray<{ script: string; evidence: string; re: RegExp }> = [
  { script: "Cyrl", evidence: "SCRIPT_CYRL", re: /\p{Script=Cyrillic}/u },
  { script: "Grek", evidence: "SCRIPT_GREK", re: /\p{Script=Greek}/u },
  { script: "Latn", evidence: "SCRIPT_LATN", re: /\p{Script=Latin}/u },
  { script: "Hans", evidence: "SCRIPT_HANS", re: /\p{Script=Han}/u },
  { script: "Arab", evidence: "SCRIPT_ARAB", re: /\p{Script=Arabic}/u },
];

const LOCALE_PATTERNS: ReadonlyArray<{
  locale: string;
  evidence: string;
  re: RegExp;
}> = [
  { locale: "nl", evidence: "PATTERN_NL_IJ", re: /ij/i },
  { locale: "nl", evidence: "PATTERN_NL_HEID", re: /heid\b/i },
  { locale: "nl", evidence: "PATTERN_NL_VAN", re: /\bvan\b/i },
  { locale: "nl", evidence: "PATTERN_NL_ZO", re: /-zo\b|zo\b/i },
  { locale: "de", evidence: "PATTERN_DE_SCH", re: /sch/i },
  { locale: "de", evidence: "PATTERN_DE_UNG", re: /ung\b/i },
  { locale: "de", evidence: "PATTERN_DE_STRASSE", re: /straße|strasse/i },
  { locale: "fr", evidence: "PATTERN_FR_EAU", re: /eau\b/i },
  { locale: "fr", evidence: "PATTERN_FR_QUE", re: /que\b/i },
  { locale: "fr", evidence: "PATTERN_FR_EUX", re: /eux\b/i },
];

function detectScripts(input: string): string[] {
  const evidence: string[] = [];
  for (const { re, evidence: code } of SCRIPT_RANGES) {
    if (re.test(input)) {
      evidence.push(code);
    }
  }
  return evidence;
}

function mergeHypothesis(
  map: Map<string, LanguageHypothesis>,
  locale: string,
  probability: number,
  evidence: string,
): void {
  const existing = map.get(locale);
  if (existing) {
    existing.probability = Math.max(existing.probability, probability);
    if (!existing.evidenceCodes.includes(evidence)) {
      existing.evidenceCodes.push(evidence);
    }
    return;
  }
  map.set(locale, {
    locale,
    probability,
    evidenceCodes: [evidence],
    hypothesisVersion: HYPOTHESIS_VERSION,
  });
}

/**
 * Deterministic locale hypotheses from script tags and simple letter patterns.
 */
export function hypothesizeLanguages(
  input: string,
  explicitLocales?: string[],
): LanguageHypothesis[] {
  const hypotheses = new Map<string, LanguageHypothesis>();
  const scriptEvidence = detectScripts(input);

  if (explicitLocales && explicitLocales.length > 0) {
    for (const locale of explicitLocales) {
      mergeHypothesis(hypotheses, locale, 0.95, "EXPLICIT_LOCALE");
    }
    return [...hypotheses.values()].sort((a, b) => b.probability - a.probability);
  }

  for (const code of scriptEvidence) {
    if (code === "SCRIPT_CYRL" || code === "SCRIPT_HANS" || code === "SCRIPT_ARAB") {
      mergeHypothesis(hypotheses, "und-x-phonetic", 0.55, code);
    } else {
      mergeHypothesis(hypotheses, "und", 0.35, code);
    }
  }

  for (const { locale, evidence, re } of LOCALE_PATTERNS) {
    if (re.test(input)) {
      mergeHypothesis(hypotheses, locale, 0.72, evidence);
    }
  }

  if (hypotheses.size === 0) {
    mergeHypothesis(hypotheses, "und", 0.25, "FALLBACK_UNKNOWN");
  }

  return [...hypotheses.values()].sort((a, b) => b.probability - a.probability);
}
