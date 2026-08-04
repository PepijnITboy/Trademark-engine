import {
  serializeCompactCandidates,
  toCompactCandidate,
} from "./candidates.js";
import { OUTPUT_JSON_SCHEMA_DESCRIPTION } from "./schema.js";
import type {
  CompactCandidate,
  EngineCandidateInput,
  ProposedMarkContext,
} from "./types.js";

export const PROMPT_VERSION = "v1";

export function buildSystemPrompt(): string {
  return [
    `PROMPT_VERSION=${PROMPT_VERSION}`,
    "Je bent een ervaren EU/Benelux merkrechtadvocaat.",
    "Je geeft een gestructureerde risicoanalyse over conflicterende merken.",
    "Geen marketingtaal. Geen emoji. Geen herhaalde disclaimers.",
    "",
    "Juridisch kader:",
    "- Beoordeel holistisch: visuele, auditieve en conceptuele overeenkomst, plus waren- en dienstenovereenstemming.",
    "- Focus op verwarringsgevaar bij het relevante publiek.",
    "- Houd rekening met onderscheidend vermogen van de tekens.",
    "",
    "Stijlregels:",
    "- Zakelijk Nederlands.",
    "- Korte zinnen.",
    "- Gebruik vaste terminologie: verwarringsgevaar, onderscheidend vermogen, waren- en dienstenovereenstemming.",
    "- Varieer niet met synoniemen voor dezelfde begrippen.",
    "- Vermijd fillers zoals \"het is interessant dat\".",
    "",
    "Selectieregels:",
    "- Kies uitsluitend candidateId-waarden uit de aangeleverde kandidatenlijst.",
    "- Baseer ranking op engine-scores en evidence, niet op gevoel.",
    "- Bij gelijke scores: lagere index in de kandidatenlijst eerst.",
    "- Selecteer maximaal TOP_N risico's. Als er minder kandidaten zijn, beoordeel allen.",
    "- Neem engineScore over uit de kandidaat; herbereken die score niet.",
    "",
    "Normalisatie van tekst:",
    "- summary begint exact met een van: \"Hoog risico:\", \"Relevant risico:\", \"Laag risico:\".",
    "- summary is één zin, HARD max 160 tekens (niet langer).",
    "- Vul altijd alle dimension-keys: visueel, auditief, conceptueel, warenDiensten.",
    "- Elke dimension-score is precies: sterk, matig, zwak of niet.",
    "- riskLevel is precies: hoog, middel of laag.",
    "",
    "Outputregels:",
    "- Antwoord uitsluitend met geldige JSON volgens dit schema:",
    OUTPUT_JSON_SCHEMA_DESCRIPTION,
    "- Geen markdown, geen code fences, geen tekst buiten JSON.",
    "- Houd toelichtingen kort (max 1-2 zinnen) zodat de volledige JSON niet afbreekt.",
    "- Sluit altijd af met een complete, parsebare JSON-object (geen truncated output).",
  ].join("\n");
}

export function buildUserPrompt(input: {
  readonly proposed: ProposedMarkContext;
  readonly candidates: readonly CompactCandidate[];
  readonly topN: number;
}): string {
  const niceClasses = [...(input.proposed.selectedNiceClasses ?? [])];
  const goodsServices = [...(input.proposed.goodsServices ?? [])];

  const proposedBlock = {
    markText: input.proposed.markText,
    selectedNiceClasses: niceClasses,
    goodsServices,
  };

  return [
    "VOORGESTELD_MERK",
    JSON.stringify(proposedBlock),
    "",
    "KANDIDATEN",
    serializeCompactCandidates(input.candidates),
    "",
    "OPDRACHT",
    `Selecteer de top ${input.topN} grootste merkrechtrisico's (of allen als er minder kandidaten zijn).`,
    "Vul het JSON-schema volledig in.",
    `TOP_N=${input.topN}`,
    `KANDIDAAT_AANTAL=${input.candidates.length}`,
  ].join("\n");
}

export function buildUserPromptFromEngine(input: {
  readonly proposed: ProposedMarkContext;
  readonly engineCandidates: readonly EngineCandidateInput[];
  readonly topN: number;
}): string {
  const compact = input.engineCandidates.map(toCompactCandidate);
  return buildUserPrompt({
    proposed: input.proposed,
    candidates: compact,
    topN: input.topN,
  });
}

export function buildSchemaCorrectionUserPrompt(invalidResponse: string): string {
  return [
    "CORRIGEER",
    "Je vorige antwoord voldeed niet aan het schema.",
    "Geef opnieuw uitsluitend geldige JSON volgens het schema.",
    "Geen markdown. Geen uitleg buiten JSON.",
    "",
    "VORIG_ANTWOORD",
    invalidResponse,
  ].join("\n");
}
