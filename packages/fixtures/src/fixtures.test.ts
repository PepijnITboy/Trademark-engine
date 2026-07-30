import { describe, expect, it } from "vitest";
import { CRITICAL_PAIRS, SAMPLE_CORPUS_ROWS } from "./fixtures.js";

describe("fixtures", () => {
  it("exports critical pairs covering required kinds", () => {
    const kinds = new Set(CRITICAL_PAIRS.map((p) => p.kind));
    for (const kind of [
      "exact",
      "one-letter",
      "separators",
      "phonetic",
      "diacritics",
      "tokens",
      "conceptual",
      "transliteration",
      "negative",
    ] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
  });

  it("includes transliteration golden pair ФЛОКС/FLOKS", () => {
    const pair = CRITICAL_PAIRS.find(
      (p) => p.query === "ФЛОКС" && p.candidate === "FLOKS",
    );
    expect(pair?.mustRetrieve).toBe(true);
  });

  it("includes phonetic confusable pair ZKAN/SCAN", () => {
    const pair = CRITICAL_PAIRS.find(
      (p) => p.query === "ZKAN" && p.candidate === "SCAN",
    );
    expect(pair?.mustRetrieve).toBe(true);
    expect(SAMPLE_CORPUS_ROWS.some((row) => row.markText === "SCAN")).toBe(true);
    expect(SAMPLE_CORPUS_ROWS.some((row) => row.markText === "ZKAN")).toBe(true);
  });

  it("exports sample corpus rows", () => {
    expect(SAMPLE_CORPUS_ROWS.length).toBeGreaterThanOrEqual(5);
    expect(SAMPLE_CORPUS_ROWS.every((row) => row.id && row.markText)).toBe(true);
  });
});
