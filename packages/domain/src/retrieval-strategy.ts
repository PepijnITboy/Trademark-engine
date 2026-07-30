export type RetrievalStrategy =
  | "exact_forms"
  | "trigram"
  | "prefix"
  | "suffix"
  | "token"
  | "edit_variant"
  | "phonetic"
  | "consonant_skeleton"
  | "transliteration"
  | "sound_ngrams"
  | "goods_assisted";

export const RETRIEVAL_STRATEGIES: readonly RetrievalStrategy[] = [
  "exact_forms",
  "trigram",
  "prefix",
  "suffix",
  "token",
  "edit_variant",
  "phonetic",
  "consonant_skeleton",
  "transliteration",
  "sound_ngrams",
  "goods_assisted",
] as const;
