import { z } from "zod";

export const corpusRowSchema = z.object({
  application_number: z.string(),
  mark_name: z.string(),
  status: z.string(),
  nice_classes: z.array(z.number().int()),
  application_date: z.string().nullable(),
  registration_date: z.string().nullable(),
});

export type CorpusRow = z.infer<typeof corpusRowSchema>;

export const CORPUS_SOURCE_EUROPA_LOCAL = "europa_local";
export const MAPPING_VERSION = "1.0.0";
