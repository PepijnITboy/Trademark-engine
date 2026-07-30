export type ExplanationLocale = "en" | "nl";

export interface ExplanationContext {
  readonly locale?: ExplanationLocale;
  readonly proposedMark?: string;
  readonly candidateMark?: string;
}

type TemplateMap = Readonly<Record<string, readonly string[]>>;

const EN_TEMPLATES: TemplateMap = {
  exact_normalized: [
    "The marks match after normalization ({proposedMark} vs {candidateMark}).",
  ],
  exact_compact: ["The compact forms of the marks are identical."],
  exact_transliteration: ["The marks match after transliteration to Latin."],
  orthographic_high: ["The marks are highly similar in spelling."],
  orthographic_medium: ["The marks show moderate orthographic similarity."],
  phonetic_primary_match: ["The primary phonetic keys of the marks match."],
  phonetic_secondary_match: ["The secondary phonetic keys of the marks match."],
  phonetic_similar: ["The marks sound similar when pronounced."],
  token_dominant_overlap: ["The dominant tokens of the marks overlap."],
  token_prefix_overlap: ["The marks share a common prefix token."],
  token_suffix_overlap: ["The marks share a common suffix token."],
  token_core_overlap: ["The marks share a distinctive core element."],
  token_noise_only: [
    "Overlap appears only on descriptive, legal-form, or other non-distinctive elements.",
  ],
  token_core_empty: ["No distinctive core element could be identified in one or both marks."],
  token_secondary_overlap: ["The marks share an additional distinctive token beyond the primary dominant."],
  conceptual_translation: [
    "The marks may convey a similar meaning via translation (e.g. LION/LÖWE).",
  ],
  goods_class_overlap: ["The Nice classes of the marks overlap."],
  goods_missing: [
    "Goods and services text is incomplete; class overlap was used where available.",
  ],
  retrieval_multi_strategy: ["The candidate was found by multiple retrieval strategies."],
  descriptive_only: ["Similarity appears driven mainly by descriptive or weak tokens."],
  missing_data: ["Some comparison inputs were missing; confidence is reduced."],
};

const NL_TEMPLATES: TemplateMap = {
  exact_normalized: [
    "De merken komen overeen na normalisatie ({proposedMark} vs {candidateMark}).",
  ],
  exact_compact: ["De compacte vormen van de merken zijn identiek."],
  exact_transliteration: ["De merken komen overeen na transliteratie naar Latijn."],
  orthographic_high: ["De merken lijken sterk op elkaar in spelling."],
  orthographic_medium: ["De merken vertonen matige orthografische gelijkenis."],
  phonetic_primary_match: ["De primaire fonetische sleutels van de merken komen overeen."],
  phonetic_secondary_match: ["De secundaire fonetische sleutels van de merken komen overeen."],
  phonetic_similar: ["De merken klinken vergelijkbaar bij uitspreken."],
  token_dominant_overlap: ["De dominante tokens van de merken overlappen."],
  token_prefix_overlap: ["De merken delen een gemeenschappelijk prefix-token."],
  token_suffix_overlap: ["De merken delen een gemeenschappelijk suffix-token."],
  token_core_overlap: ["De merken delen een onderscheidend kernelement."],
  token_noise_only: [
    "Overlap lijkt alleen op beschrijvende, rechtsvorm- of andere niet-onderscheidende elementen.",
  ],
  token_core_empty: [
    "In een of beide merken kon geen onderscheidend kernelement worden vastgesteld.",
  ],
  token_secondary_overlap: [
    "De merken delen een extra onderscheidend token naast het primaire dominante token.",
  ],
  conceptual_translation: [
    "De merken kunnen een vergelijkbare betekenis overbrengen via vertaling (bijv. LION/LÖWE).",
  ],
  goods_class_overlap: ["De Nice-klassen van de merken overlappen."],
  goods_missing: [
    "Goederen- en dienstentekst is onvolledig; klasse-overlap werd gebruikt waar beschikbaar.",
  ],
  retrieval_multi_strategy: ["De kandidaat werd gevonden via meerdere retrieval-strategieën."],
  descriptive_only: ["Gelijkheid lijkt vooral gedreven door beschrijvende of zwakke tokens."],
  missing_data: ["Sommige vergelijkingsinvoer ontbrak; het vertrouwen is verlaagd."],
};

function interpolate(template: string, context: ExplanationContext): string {
  return template
    .replace("{proposedMark}", context.proposedMark ?? "—")
    .replace("{candidateMark}", context.candidateMark ?? "—");
}

export function explainFromEvidence(
  codes: readonly string[],
  context: ExplanationContext = {},
): string[] {
  const locale = context.locale ?? "en";
  const templates = locale === "nl" ? NL_TEMPLATES : EN_TEMPLATES;
  const sentences: string[] = [];

  for (const code of codes) {
    const options = templates[code];
    if (!options || options.length === 0) {
      continue;
    }
    sentences.push(interpolate(options[0]!, context));
  }

  return sentences;
}

export function knownEvidenceCodes(): readonly string[] {
  return Object.keys(EN_TEMPLATES);
}
