export type CriticalPairKind =
  | "exact"
  | "one-letter"
  | "separators"
  | "phonetic"
  | "diacritics"
  | "tokens"
  | "conceptual"
  | "transliteration"
  | "negative";

export type CriticalPair = {
  query: string;
  candidate: string;
  kind: CriticalPairKind;
  mustRetrieve: boolean;
};

export type SampleCorpusRow = {
  id: string;
  markText: string;
  localeHint?: string;
  niceClasses?: number[];
  status?: string;
};

export const CRITICAL_PAIRS: CriticalPair[] = [
  { query: "LUNA", candidate: "LUNA", kind: "exact", mustRetrieve: true },
  { query: "LUNA", candidate: "LUNA CAFE", kind: "tokens", mustRetrieve: true },
  { query: "ZENZO", candidate: "SENZO", kind: "one-letter", mustRetrieve: true },
  { query: "ZENZO", candidate: "ZEN-ZO", kind: "separators", mustRetrieve: true },
  { query: "ZENZO", candidate: "ZÉNZO", kind: "diacritics", mustRetrieve: true },
  { query: "ZENZO", candidate: "SENZO", kind: "phonetic", mustRetrieve: true },
  { query: "PHLOX", candidate: "FLOKS", kind: "phonetic", mustRetrieve: true },
  { query: "ZKAN", candidate: "SCAN", kind: "phonetic", mustRetrieve: true },
  { query: "SCAN", candidate: "ZKAN", kind: "phonetic", mustRetrieve: true },
  { query: "ФЛОКС", candidate: "FLOKS", kind: "transliteration", mustRetrieve: true },
  { query: "ΑΛΦΑ", candidate: "ALFA", kind: "transliteration", mustRetrieve: true },
  {
    query: "Zén-Zo Drinks B.V.",
    candidate: "ZENZO",
    kind: "conceptual",
    mustRetrieve: true,
  },
  {
    query: "Zén-Zo Drinks B.V.",
    candidate: "ZENZO DRINKS",
    kind: "tokens",
    mustRetrieve: true,
  },
  { query: "LUNA", candidate: "SOLAR", kind: "negative", mustRetrieve: false },
  { query: "ZENZO", candidate: "XKQWP", kind: "negative", mustRetrieve: false },
  { query: "APPLE", candidate: "ORANGE", kind: "negative", mustRetrieve: false },
];

export const SAMPLE_CORPUS_ROWS: SampleCorpusRow[] = [
  {
    id: "eu-001",
    markText: "LUNA",
    localeHint: "en",
    niceClasses: [25, 35],
    status: "registered",
  },
  {
    id: "eu-002",
    markText: "ZÉNZO",
    localeHint: "nl",
    niceClasses: [32, 33],
    status: "registered",
  },
  {
    id: "eu-003",
    markText: "Zén-Zo Drinks B.V.",
    localeHint: "nl",
    niceClasses: [32],
    status: "registered",
  },
  {
    id: "eu-004",
    markText: "SENZO",
    localeHint: "nl",
    niceClasses: [32],
    status: "registered",
  },
  {
    id: "eu-005",
    markText: "ФЛОКС",
    localeHint: "ru",
    niceClasses: [5],
    status: "registered",
  },
  {
    id: "eu-006",
    markText: "FLOKS",
    localeHint: "en",
    niceClasses: [5],
    status: "registered",
  },
  {
    id: "eu-007",
    markText: "ΑΛΦΑ",
    localeHint: "el",
    niceClasses: [9],
    status: "registered",
  },
  {
    id: "eu-008",
    markText: "ALFA",
    localeHint: "en",
    niceClasses: [9],
    status: "registered",
  },
  {
    id: "eu-009",
    markText: "SCHÖN",
    localeHint: "de",
    niceClasses: [3],
    status: "registered",
  },
  {
    id: "eu-010",
    markText: "PHLOX",
    localeHint: "en",
    niceClasses: [31],
    status: "pending",
  },
  {
    id: "eu-011",
    markText: "SCAN",
    localeHint: "en",
    niceClasses: [9, 42],
    status: "registered",
  },
  {
    id: "eu-012",
    markText: "ZKAN",
    localeHint: "nl",
    niceClasses: [9, 42],
    status: "registered",
  },
];
