export type LanguageHypothesis = {
  locale: string;
  probability: number;
  evidenceCodes: string[];
  hypothesisVersion: string;
};

export const HYPOTHESIS_VERSION = "2026.07.30-v1";
