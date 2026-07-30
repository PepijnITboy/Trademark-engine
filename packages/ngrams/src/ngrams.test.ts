import { describe, expect, it } from "vitest";
import { diceCoefficient, trigramDice, trigrams } from "./index.js";

describe("@trademark-engine/ngrams", () => {
  it("returns trigram dice of 1 for identical strings", () => {
    expect(trigramDice("zenzo", "zenzo")).toBe(1);
    expect(diceCoefficient(trigrams("abc"), trigrams("abc"))).toBe(1);
  });

  it("builds character n-grams", () => {
    expect(trigrams("abcde")).toEqual(["abc", "bcd", "cde"]);
  });
});
