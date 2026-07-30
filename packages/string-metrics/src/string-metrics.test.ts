import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createTsStringMetricEngine } from "./index.js";

describe("@trademark-engine/string-metrics", () => {
  const engine = createTsStringMetricEngine();

  it("returns similarity 1 for identical strings", () => {
    expect(engine.levenshtein("zenzo", "zenzo").similarity).toBe(1);
    expect(engine.jaro("zenzo", "zenzo").similarity).toBe(1);
    expect(engine.jaroWinkler("zenzo", "zenzo").similarity).toBe(1);
    expect(engine.lcsLength("zenzo", "zenzo").similarity).toBe(1);
  });

  it("returns levenshtein distance 1 for ZENZO vs SENZO", () => {
    const result = engine.levenshtein("ZENZO", "SENZO");

    expect(result.distance).toBe(1);
    expect(result.similarity).toBeCloseTo(0.8, 5);
  });

  it("keeps similarity in [0, 1], distance >= 0, and self-maximal similarity", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const lev = engine.levenshtein(a, b);
        const dl = engine.damerauLevenshtein(a, b);
        const jaro = engine.jaro(a, b);
        const jaroWinkler = engine.jaroWinkler(a, b);
        const lcs = engine.lcsLength(a, b);

        expect(lev.distance).toBeGreaterThanOrEqual(0);
        expect(dl.distance).toBeGreaterThanOrEqual(0);
        expect(lev.similarity).toBeGreaterThanOrEqual(0);
        expect(lev.similarity).toBeLessThanOrEqual(1);
        expect(dl.similarity).toBeGreaterThanOrEqual(0);
        expect(dl.similarity).toBeLessThanOrEqual(1);
        expect(jaro.similarity).toBeGreaterThanOrEqual(0);
        expect(jaro.similarity).toBeLessThanOrEqual(1);
        expect(jaroWinkler.similarity).toBeGreaterThanOrEqual(0);
        expect(jaroWinkler.similarity).toBeLessThanOrEqual(1);
        expect(lcs.length).toBeGreaterThanOrEqual(0);
        expect(lcs.similarity).toBeGreaterThanOrEqual(0);
        expect(lcs.similarity).toBeLessThanOrEqual(1);

        expect(engine.levenshtein(a, a).similarity).toBe(1);
        expect(engine.jaro(a, a).similarity).toBe(1);
        expect(engine.jaroWinkler(a, a).similarity).toBe(1);
        expect(engine.lcsLength(a, a).similarity).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
