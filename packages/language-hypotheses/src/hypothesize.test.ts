import { describe, expect, it } from "vitest";
import { hypothesizeLanguages } from "./hypothesize.js";

describe("hypothesizeLanguages", () => {
  it("assigns Dutch hypothesis for Dutch-looking suffix", () => {
    const result = hypothesizeLanguages("Zén-Zo Drinks");
    const nl = result.find((h) => h.locale === "nl");
    expect(nl).toBeDefined();
    expect(nl!.probability).toBeGreaterThan(0.5);
    expect(nl!.evidenceCodes.some((c) => c.startsWith("PATTERN_NL"))).toBe(true);
  });

  it("detects Cyrillic script with unknown phonetic locale", () => {
    const result = hypothesizeLanguages("ФЛОКС");
    const phonetic = result.find((h) => h.locale === "und-x-phonetic");
    expect(phonetic).toBeDefined();
    expect(phonetic!.evidenceCodes).toContain("SCRIPT_CYRL");
  });

  it("uses explicit locales with high probability", () => {
    const result = hypothesizeLanguages("anything", ["nl", "de"]);
    expect(result.every((h) => h.probability >= 0.9)).toBe(true);
    expect(result.map((h) => h.locale).sort()).toEqual(["de", "nl"]);
  });
});
