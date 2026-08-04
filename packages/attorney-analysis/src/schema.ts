import { z } from "zod";

const dimensionStrengthSchema = z.enum(["sterk", "matig", "zwak", "niet"]);

/** Soft LLM limits — parse truncates overlong strings instead of failing. */
export const ATTORNEY_FIELD_LIMITS = {
  summary: 160,
  toelichting: 400,
  confusionRisk: 500,
  whySelected: 300,
  overallAdviceText: 800,
} as const;

const dimensionAssessmentSchema = z.object({
  score: dimensionStrengthSchema,
  toelichting: z.string().min(1).max(ATTORNEY_FIELD_LIMITS.toelichting),
});

const riskDimensionsSchema = z.object({
  visueel: dimensionAssessmentSchema,
  auditief: dimensionAssessmentSchema,
  conceptueel: dimensionAssessmentSchema,
  warenDiensten: dimensionAssessmentSchema,
});

export const attorneyRiskItemSchema = z.object({
  rank: z.number().int().min(1).max(10),
  candidateId: z.string().min(1),
  markText: z.string().min(1),
  engineScore: z.number(),
  riskLevel: z.enum(["hoog", "middel", "laag"]),
  summary: z.string().min(1).max(ATTORNEY_FIELD_LIMITS.summary),
  dimensions: riskDimensionsSchema,
  confusionRisk: z.string().min(1).max(ATTORNEY_FIELD_LIMITS.confusionRisk),
  whySelected: z.string().min(1).max(ATTORNEY_FIELD_LIMITS.whySelected),
});

export const overallAdviceSchema = z.object({
  text: z.string().min(1).max(ATTORNEY_FIELD_LIMITS.overallAdviceText),
  aanbeveling: z.enum([
    "indienen_risicovol",
    "indienen_met_aanpassing",
    "nader_onderzoek",
    "laag_risico",
  ]),
});

export const attorneyModelResponseSchema = z.object({
  overallAdvice: overallAdviceSchema,
  topRisks: z.array(attorneyRiskItemSchema).max(10),
});

export type AttorneyModelResponse = z.infer<typeof attorneyModelResponseSchema>;

export const OUTPUT_JSON_SCHEMA_DESCRIPTION = `{
  "overallAdvice": {
    "text": "korte alinea in zakelijk Nederlands",
    "aanbeveling": "indienen_risicovol | indienen_met_aanpassing | nader_onderzoek | laag_risico"
  },
  "topRisks": [
    {
      "rank": 1,
      "candidateId": "id-uit-kandidatenlijst",
      "markText": "merktekst",
      "engineScore": 0,
      "riskLevel": "hoog | middel | laag",
      "summary": "Hoog risico: ... | Relevant risico: ... | Laag risico: ...",
      "dimensions": {
        "visueel": { "score": "sterk|matig|zwak|niet", "toelichting": "1-2 zinnen" },
        "auditief": { "score": "sterk|matig|zwak|niet", "toelichting": "1-2 zinnen" },
        "conceptueel": { "score": "sterk|matig|zwak|niet", "toelichting": "1-2 zinnen" },
        "warenDiensten": { "score": "sterk|matig|zwak|niet", "toelichting": "1-2 zinnen" }
      },
      "confusionRisk": "1-2 zinnen over verwarringsgevaar",
      "whySelected": "1 zin waarom dit in de top-N zit"
    }
  ]
}`;
