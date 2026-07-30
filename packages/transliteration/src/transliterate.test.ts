import { describe, expect, it } from "vitest";
import { transliterateToLatin } from "./transliterate.js";

describe("transliterateToLatin", () => {
  it("transliterates Cyrillic ФЛОКС to FLOKS-like Latin", () => {
    const { variants } = transliterateToLatin("ФЛОКС");
    const joined = variants.join(" ");
    expect(joined).toMatch(/FLOKS/i);
  });

  it("transliterates Greek ΑΛΦΑ to ALFA", () => {
    const { variants } = transliterateToLatin("ΑΛΦΑ");
    expect(variants.some((v) => v.includes("ALFA"))).toBe(true);
  });

  it("keeps plain Latin LUNA unchanged", () => {
    const { variants } = transliterateToLatin("LUNA");
    expect(variants).toContain("LUNA");
  });

  it("strips diacritics from Latin input", () => {
    const { variants } = transliterateToLatin("Zén");
    expect(variants.some((v) => v.includes("ZEN"))).toBe(true);
  });

  it("returns version metadata", () => {
    const result = transliterateToLatin("TEST");
    expect(result.version).toMatch(/^2026\./);
  });

  it("NFKC-expands compatibility symbols before Latin variants", () => {
    const { variants } = transliterateToLatin("㎾h");
    const joined = variants.join(" ").toLowerCase();
    expect(joined).toMatch(/kwh|kw/);
    expect(variants.every((v) => !/^h$/i.test(v.trim()))).toBe(true);
  });
});
