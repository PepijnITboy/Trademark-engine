import { describe, expect, it } from "vitest";
import { phoneticKeyRecordsForMark, preprocessMark } from "./preprocess.js";

describe("preprocessMark", () => {
  it("preprocesses ZENZO with normalization, tokens, transliteration, and phonetics", () => {
    const result = preprocessMark("ZENZO");

    expect(result.markText).toBe("ZENZO");
    expect(result.normalized.compact).toBeTruthy();
    expect(result.tokens.tokens.length).toBeGreaterThan(0);
    expect(result.transliteration.variants.length).toBeGreaterThan(0);
    expect(result.phonetics.primary).toBeTruthy();
    expect(result.phonetics.cologne).toBeTruthy();
    expect(result.phonetics.skeleton).toBeTruthy();
    expect(result.phoneticKeyRecords.length).toBeGreaterThan(0);
  });

  it("exports shared phonetic keys for zkan and scan", () => {
    const zkanKeys = new Set(phoneticKeyRecordsForMark("zkan").map((row) => row.key));
    const scanKeys = phoneticKeyRecordsForMark("scan").map((row) => row.key);
    expect(scanKeys.some((key) => zkanKeys.has(key))).toBe(true);
    expect(
      phoneticKeyRecordsForMark("zkan").some((row) => row.algorithm === "double_metaphone"),
    ).toBe(true);
    expect(phoneticKeyRecordsForMark("zkan").some((row) => row.algorithm === "nysiis")).toBe(
      true,
    );
  });
});
