export type TokenRole =
  | "distinctive"
  | "descriptive_weak"
  | "legal_form"
  | "function_word"
  | "numeral"
  | "unknown";

export interface ClassifiedToken {
  readonly text: string;
  readonly role: TokenRole;
  readonly index: number;
}
