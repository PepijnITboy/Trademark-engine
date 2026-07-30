import { describe, expect, it } from "vitest";
import {
  applyStrategyCap,
  buildCoreRetrievalKeys,
  buildExactLookupKeys,
  buildPhoneticLookupKeys,
  buildTransliterationLookupKeys,
  mergeHitsReservingCore,
  unionCandidates,
} from "./retrieval.js";

describe("retrieval helpers", () => {
  it("union preserves evidence from multiple strategies", () => {
    const unioned = unionCandidates({
      trigram: [
        { trademarkId: "eu-001", strategy: "trigram", rank: 2, score: 0.6 },
      ],
      phonetic: [
        { trademarkId: "eu-001", strategy: "phonetic", rank: 1, score: 0.9 },
        { trademarkId: "eu-002", strategy: "phonetic", rank: 3, score: 0.5 },
      ],
    });

    const first = unioned.find((row) => row.trademarkId === "eu-001");
    expect(first?.evidence).toHaveLength(2);
    expect(first?.evidence.map((item) => item.strategy).sort()).toEqual([
      "phonetic",
      "trigram",
    ]);
  });

  it("applyStrategyCap keeps top ranked rows after cap", () => {
    const ranked = [
      { trademarkId: "a", score: 0.9, evidence: [] },
      { trademarkId: "b", score: 0.8, evidence: [] },
      { trademarkId: "c", score: 0.7, evidence: [] },
    ];

    const result = applyStrategyCap(ranked, 2);
    expect(result.preCapCount).toBe(3);
    expect(result.postCapCount).toBe(2);
    expect(result.capReached).toBe(true);
    expect(result.kept.map((row) => row.trademarkId)).toEqual(["a", "b"]);
  });

  it("buildExactLookupKeys compacts ZENZO forms", () => {
    const keys = buildExactLookupKeys({
      compact: "zenzo",
      caseFolded: "zén-zo",
      diacriticsFolded: "zen-zo",
      asciiFolded: "zn-zo",
    });

    expect(keys.compact).toBe("zenzo");
    expect(keys.diacriticsFolded).toBe("zenzo");
  });

  it("buildPhoneticLookupKeys shares keys for zkan and scan", () => {
    const zkan = buildPhoneticLookupKeys("zkan");
    const scan = buildPhoneticLookupKeys("scan");

    expect(zkan.keys.length).toBeGreaterThan(0);
    expect(zkan.algorithms).toEqual(expect.arrayContaining(["double_metaphone", "nysiis"]));
    expect(zkan.keys.some((key) => scan.keys.includes(key))).toBe(true);
  });

  it("buildTransliterationLookupKeys maps Cyrillic/Greek to Latin compact", () => {
    const cyrillic = buildTransliterationLookupKeys("ФЛОКС");
    const greek = buildTransliterationLookupKeys("ΑΛΦΑ");

    expect(cyrillic).toContain("floks");
    expect(greek).toContain("alfa");
  });

  it("buildPhoneticLookupKeys includes Latin transliteration for Cyrillic", () => {
    const cyrillic = buildPhoneticLookupKeys("ФЛОКС");
    const latin = buildPhoneticLookupKeys("FLOKS");
    expect(cyrillic.keys.some((key) => latin.keys.includes(key))).toBe(true);
  });

  it("buildCoreRetrievalKeys strips noise particles and descriptives", () => {
    const softDrinks = buildCoreRetrievalKeys("ZORVEX Soft Drinks");
    const vanSoft = buildCoreRetrievalKeys("VAN LUMINA Soft");
    const cafe = buildCoreRetrievalKeys("CAFÉ ZORVEX");

    expect(softDrinks.coreCompact).toBe("zorvex");
    expect(softDrinks.keys).toContain("zorvex");
    expect(softDrinks.keys).not.toContain("softdrinks");
    expect(vanSoft.keys).toContain("lumina");
    expect(vanSoft.keys).not.toContain("van");
    expect(cafe.keys).toContain("zorvex");
  });

  it("does not emit short delimiter-fragment core keys", () => {
    const wellbeing = buildCoreRetrievalKeys("well-being");
    expect(wellbeing.keys).toEqual(["wellbeing"]);
    expect(wellbeing.keys).not.toContain("well");
    expect(wellbeing.keys).not.toContain("being");
    expect(buildCoreRetrievalKeys("well_being").keys).toEqual(["wellbeing"]);

    const r2d2 = buildCoreRetrievalKeys("R2-D2");
    const r2underscore = buildCoreRetrievalKeys("R2_D2");
    expect(r2d2.keys).toEqual(["r2d2"]);
    expect(r2d2.keys).toEqual(r2underscore.keys);

    // Weak half after underscore: core is distinctive stem only.
    expect(buildCoreRetrievalKeys("ZORVEX_DRINKS").keys).toEqual(["zorvex"]);

    // Dual long cores still get per-token keys (dash, underscore, middot).
    for (const mark of ["LUMINA―SOLARA", "LUMINA_SOLARA", "LUMINA·SOLARA"]) {
      const dual = buildCoreRetrievalKeys(mark);
      expect(dual.keys).toEqual(expect.arrayContaining(["luminasolara", "lumina", "solara"]));
    }
  });

  it("mergeHitsReservingCore keeps core hits when full-string noise fills cap", () => {
    const fullHits = Array.from({ length: 10 }, (_, index) => ({
      trademarkId: `noise-${index}`,
      score: 1 - index * 0.01,
    }));
    const coreHits = [
      { trademarkId: "core-hit", score: 0.5 },
      { trademarkId: "noise-0", score: 0.9 },
    ];

    const merged = mergeHitsReservingCore(fullHits, coreHits, 5, 0.4);
    expect(merged).toHaveLength(5);
    expect(merged.some((hit) => hit.trademarkId === "core-hit")).toBe(true);
  });
});
