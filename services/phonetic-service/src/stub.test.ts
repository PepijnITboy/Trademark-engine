import { describe, expect, it } from "vitest";
import { stubPhonemes, ENGINE_VERSION } from "./stub.js";

describe("stubPhonemes", () => {
  it("returns deterministic phonemes for latin text", () => {
    const first = stubPhonemes("ZENZO", "en");
    const second = stubPhonemes("ZENZO", "en");

    expect(first).toEqual(second);
    expect(first.engineVersion).toBe(ENGINE_VERSION);
    expect(first.phonemes.join("")).toBe("zenzo");
    expect(first.ipa).toBe("[en:zenzo]");
  });

  it("strips diacritics before phoneme generation", () => {
    const result = stubPhonemes("ZÉNZO", "nl");
    expect(result.phonemes.join("")).toBe("zenzo");
    expect(result.ipa).toBe("[nl:zenzo]");
  });
});
