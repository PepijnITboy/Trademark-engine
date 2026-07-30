import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { normalizeMark } from "./index.js";

describe("@trademark-engine/normalization", () => {
  it("produces identical compact form for ZEN-ZO and ZEN ZO and ZENZO", () => {
    const a = normalizeMark("ZEN-ZO");
    const b = normalizeMark("ZEN ZO");
    const c = normalizeMark("ZENZO");

    expect(a.compact).toBe("zenzo");
    expect(b.compact).toBe("zenzo");
    expect(c.compact).toBe("zenzo");
  });

  it("folds CAFÉ to cafe in diacriticsFolded and compact", () => {
    const result = normalizeMark("CAFÉ");

    expect(result.diacriticsFolded).toBe("cafe");
    expect(result.compact).toBe("cafe");
  });

  it("folds special Latin letters (ß æ œ ø đ) into ASCII-compatible forms", () => {
    expect(normalizeMark("Weißbier").compact).toBe("weissbier");
    expect(normalizeMark("Weißbier").asciiFolded).toBe("weissbier");
    expect(normalizeMark("œuf").compact).toBe("oeuf");
    expect(normalizeMark("ØÆ").compact).toBe("oae");
    expect(normalizeMark("Đaković").compact).toBe("dakovic");
  });

  it("builds compact from NFKC so compatibility characters expand", () => {
    expect(normalizeMark("ﬁle").compact).toBe("file");
    expect(normalizeMark("ﬀ").compact).toBe("ff");
    expect(normalizeMark("㎾h").compact).toBe("kwh");
    expect(normalizeMark("㎾h").compact.length).toBeGreaterThanOrEqual(2);
  });

  it("strips trailing legal-form tokens from compact without agglutinated false cuts", () => {
    expect(normalizeMark("QUORIX SpA").compact).toBe("quorix");
    expect(normalizeMark("NEXORA Inc.").compact).toBe("nexora");
    expect(normalizeMark("ZORVEX BV").compact).toBe("zorvex");
    // Whole-token only — do not peel legal-looking endings off single words.
    expect(normalizeMark("BANCO").compact).toBe("banco");
    expect(normalizeMark("VISA").compact).toBe("visa");
  });

  it("detects Cyrillic script for ФЛОКС", () => {
    const result = normalizeMark("ФЛОКС");

    expect(result.scripts).toContain("Cyrl");
  });

  it("does not throw for empty string", () => {
    expect(() => normalizeMark("")).not.toThrow();

    const result = normalizeMark("");
    expect(result.compact).toBe("");
    expect(result.caseFolded).toBe("");
  });

  it("is idempotent on caseFolded path for printable strings", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 256 }), (input) => {
        const once = normalizeMark(input);
        const twice = normalizeMark(once.caseFolded);

        expect(twice.caseFolded).toBe(once.caseFolded);
      }),
      { numRuns: 200 },
    );
  });
});
