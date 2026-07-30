import { describe, expect, it } from "vitest";
import { resolveMarkTexts } from "./scan-store.js";

describe("resolveMarkTexts", () => {
  it("splits comma-separated markText and dedupes case-insensitively", () => {
    expect(resolveMarkTexts({ markText: "ZENZO, senzo, XENZO, ZENZO" })).toEqual([
      "ZENZO",
      "senzo",
      "XENZO",
    ]);
  });

  it("prefers markTexts array and caps at 10", () => {
    const markTexts = Array.from({ length: 12 }, (_, index) => `MARK${index + 1}`);
    expect(resolveMarkTexts({ markTexts })).toHaveLength(10);
    expect(resolveMarkTexts({ markTexts })[0]).toBe("MARK1");
    expect(resolveMarkTexts({ markTexts })[9]).toBe("MARK10");
  });

  it("returns empty for blank input", () => {
    expect(resolveMarkTexts({ markText: " ,  , " })).toEqual([]);
  });
});
