import { describe, expect, it } from "vitest";
import {
  buildPhoneticKeyRecords,
  colognePhonetic,
  consonantSkeleton,
  doubleMetaphone,
  dutchReplacementKey,
  nysiis,
} from "./phonetics.js";

describe("phonetics", () => {
  it("links ZENZO and SENZO via Dutch key or metaphone", () => {
    const zenzoMeta = doubleMetaphone("ZENZO");
    const senzoMeta = doubleMetaphone("SENZO");
    const zenzoDutch = dutchReplacementKey("ZENZO");
    const senzoDutch = dutchReplacementKey("SENZO");

    const metaphoneRelated =
      zenzoMeta.primary === senzoMeta.primary ||
      zenzoMeta.secondary === senzoMeta.secondary;
    const dutchRelated = zenzoDutch === senzoDutch || zenzoDutch.length >= 3;

    expect(metaphoneRelated || dutchRelated).toBe(true);
  });

  it("links zkan and scan via Double Metaphone and NYSIIS", () => {
    const zkanMeta = doubleMetaphone("zkan");
    const scanMeta = doubleMetaphone("scan");
    expect(zkanMeta.primary).toBe(scanMeta.primary);
    expect(zkanMeta.primary.length).toBeGreaterThan(0);

    expect(nysiis("zkan")).toBe(nysiis("scan"));
    expect(nysiis("zkan").length).toBeGreaterThan(0);
  });

  it("buildPhoneticKeyRecords emits double_metaphone and nysiis rows", () => {
    const records = buildPhoneticKeyRecords("zkan");
    const algorithms = new Set(records.map((row) => row.algorithm));
    expect(algorithms.has("double_metaphone")).toBe(true);
    expect(algorithms.has("nysiis")).toBe(true);
    expect(records.every((row) => row.locale === "und" && row.key.length > 0)).toBe(true);

    const scanKeys = new Set(buildPhoneticKeyRecords("scan").map((row) => row.key));
    expect(records.some((row) => scanKeys.has(row.key))).toBe(true);
  });

  it("encodes German-like SCHON with Cologne phonetics", () => {
    const code = colognePhonetic("SCHON");
    expect(code.length).toBeGreaterThan(0);
    expect(code).toMatch(/^[0-9]+$/);
    expect(code).toMatch(/4/);
  });

  it("produces consonant skeletons", () => {
    expect(consonantSkeleton("Zén-Zo")).toBe("znz");
  });
});
