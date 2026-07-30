import { describe, expect, it } from "vitest";
import { foldForToken, tokenizeMark } from "./tokenize.js";

describe("foldForToken", () => {
  it("keeps non-ASCII letters", () => {
    expect(foldForToken("Zén")).toBe("zen");
    expect(foldForToken("Москва")).toMatch(/\p{L}/u);
  });
});

describe("tokenizeMark", () => {
  it("parses Zén-Zo Drinks B.V. into suffix, weak, and significant tokens", () => {
    const result = tokenizeMark("Zén-Zo Drinks B.V.");

    expect(result.companySuffixTokens.map((t) => t.normalized)).toContain("bv");
    expect(result.weakTokens.map((t) => t.normalized)).toContain("drinks");

    const significant = result.significantTokens.map((t) => t.normalized);
    const merged = result.mergedHypotheses.map((h) => h.merged);

    const hasZenZo =
      significant.includes("zenzo") ||
      significant.includes("zen") ||
      merged.some((m) => m === "zenzo" || m.includes("zen"));

    expect(hasZenZo).toBe(true);
    expect(result.dominantToken).toBeTruthy();
  });

  it("classifies common company suffixes", () => {
    const result = tokenizeMark("Example GmbH");
    expect(result.companySuffixTokens.map((t) => t.normalized)).toContain("gmbh");
    expect(result.tokens.find((t) => t.normalized === "gmbh")?.role).toBe("legal_form");
  });

  it("single distinctive core: ZORVEX", () => {
    const result = tokenizeMark("ZORVEX");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["zorvex"]);
    expect(result.coreCompact).toBe("zorvex");
    expect(result.analysisFlags.coreEmpty).toBe(false);
    expect(result.dominantToken).toBe("zorvex");
  });

  it("distinctive + weak: ZORVEX DRINKS", () => {
    const result = tokenizeMark("ZORVEX DRINKS");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["zorvex"]);
    expect(result.noiseTokens.map((t) => t.normalized)).toContain("drinks");
    expect(result.coreCompact).toBe("zorvex");
    expect(result.dominantToken).toBe("zorvex");
  });

  it("legal form is noise: ZORVEX BV", () => {
    const result = tokenizeMark("ZORVEX BV");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["zorvex"]);
    expect(result.companySuffixTokens.map((t) => t.normalized)).toContain("bv");
    expect(result.coreCompact).toBe("zorvex");
  });

  it("all-weak marks set coreEmpty: PREMIUM ORIGINAL BEVERAGES", () => {
    const result = tokenizeMark("PREMIUM ORIGINAL BEVERAGES");
    expect(result.significantTokens).toHaveLength(0);
    expect(result.analysisFlags.coreEmpty).toBe(true);
    expect(result.analysisFlags.allNoise).toBe(true);
    expect(result.coreCompact).toBe("");
    expect(result.dominantToken).toBeNull();
  });

  it("agglutinated weak suffix yields compound hypothesis: ZORVEXDRINKS", () => {
    const result = tokenizeMark("ZORVEXDRINKS");
    expect(result.analysisFlags.compoundHypothesisUsed).toBe(true);
    expect(
      result.mergedHypotheses.some((h) => h.reason === "agglutinated-noise-suffix-split"),
    ).toBe(true);
    const split = result.mergedHypotheses.find(
      (h) => h.reason === "agglutinated-noise-suffix-split",
    );
    expect(split?.tokens).toEqual(["zorvex", "drinks"]);
  });

  it("hyphen + soft: Soft is weak, ZOR/VEX remain significant", () => {
    const result = tokenizeMark("ZOR-VEX Soft");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["zor", "vex"]);
    expect(result.weakTokens.map((t) => t.normalized)).toContain("soft");
    expect(result.coreCompact).toBe("zorvex");
    expect(result.dominantToken).not.toBe("soft");
  });

  it("short + long significant: both kept, candidates include both", () => {
    const result = tokenizeMark("KI STELLARIS");
    expect(result.tokens.find((t) => t.normalized === "ki")?.role).toBe("function_word");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["stellaris"]);
    expect(result.coreCompact).toBe("stellaris");
    expect(result.dominantToken).toBe("stellaris");
  });

  it("function word VAN is noise: VAN LUMINA", () => {
    const result = tokenizeMark("VAN LUMINA");
    expect(result.tokens.find((t) => t.normalized === "van")?.role).toBe("function_word");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["lumina"]);
    expect(result.coreCompact).toBe("lumina");
    expect(result.dominantToken).toBe("lumina");
  });

  it("particles von/ter/des/du are noise and longer core dominates", () => {
    const vonDer = tokenizeMark("VON DER LUMINA");
    expect(vonDer.tokens.find((t) => t.normalized === "von")?.role).toBe("function_word");
    expect(vonDer.tokens.find((t) => t.normalized === "der")?.role).toBe("function_word");
    expect(vonDer.significantTokens.map((t) => t.normalized)).toEqual(["lumina"]);
    expect(vonDer.dominantToken).toBe("lumina");
    expect(vonDer.coreCompact).toBe("lumina");

    const vonTer = tokenizeMark("VON TER STELLARIS");
    expect(vonTer.tokens.find((t) => t.normalized === "ter")?.role).toBe("function_word");
    expect(vonTer.dominantToken).toBe("stellaris");
    expect(vonTer.coreCompact).toBe("stellaris");

    const desLes = tokenizeMark("DES LES LUMINA");
    expect(desLes.tokens.find((t) => t.normalized === "des")?.role).toBe("function_word");
    expect(desLes.dominantToken).toBe("lumina");
  });

  it("dominance prefers longer distinctive core over short leading leftover", () => {
    // Simulate pre-lexicon short lead + longer core via unknown short token weight path.
    const result = tokenizeMark("AB LUMINARA");
    expect(result.dominantToken).toBe("luminara");
  });

  it("numeral is noise: ZORVEX 365", () => {
    const result = tokenizeMark("ZORVEX 365");
    expect(result.tokens.find((t) => t.normalized === "365")?.role).toBe("numeral");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["zorvex"]);
    expect(result.coreCompact).toBe("zorvex");
  });

  it("two significants: LUMINA SOLARA keeps both", () => {
    const result = tokenizeMark("LUMINA SOLARA");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["lumina", "solara"]);
    expect(result.dominanceCandidates.map((c) => c.token)).toEqual(
      expect.arrayContaining(["lumina", "solara"]),
    );
    expect(result.coreCompact).toBe("luminasolara");
  });

  it("splits unicode dash dual-core marks", () => {
    const result = tokenizeMark("LUMINA―SOLARA");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["lumina", "solara"]);
    expect(result.coreCompact).toBe("luminasolara");
  });

  it("splits Sm/Po math joiners between alphanumerics", () => {
    for (const mark of ["LUMINA⋆SOLARA", "LUMINA×SOLARA", "LUMINA÷SOLARA", "LUMINA±SOLARA"]) {
      expect(tokenizeMark(mark).significantTokens.map((t) => t.normalized)).toEqual([
        "lumina",
        "solara",
      ]);
    }
  });

  it("splits underscore and plus like hyphen for weak+core compounds", () => {
    for (const mark of ["SOFT_ZORVEX", "SOFT-ZORVEX", "ZORVEX＋DRINKS", "ZORVEX+DRINKS"]) {
      const result = tokenizeMark(mark);
      expect(result.significantTokens.map((t) => t.normalized)).toEqual(["zorvex"]);
      expect(result.coreCompact).toBe("zorvex");
    }
    const van = tokenizeMark("VAN_LUMINA");
    expect(van.significantTokens.map((t) => t.normalized)).toEqual(["lumina"]);
    expect(van.coreCompact).toBe("lumina");
  });

  it("splits equals/wave/underscore/middot joiners between alphanumerics", () => {
    expect(tokenizeMark("LUMINA＝SOLARA").significantTokens.map((t) => t.normalized)).toEqual([
      "lumina",
      "solara",
    ]);
    expect(tokenizeMark("LUMINA〜SOLARA").significantTokens.map((t) => t.normalized)).toEqual([
      "lumina",
      "solara",
    ]);
    expect(tokenizeMark("LUMINA_SOLARA").significantTokens.map((t) => t.normalized)).toEqual([
      "lumina",
      "solara",
    ]);
    expect(tokenizeMark("LUMINA·SOLARA").significantTokens.map((t) => t.normalized)).toEqual([
      "lumina",
      "solara",
    ]);
    const underscored = tokenizeMark("ZORVEX_DRINKS");
    expect(underscored.significantTokens.map((t) => t.normalized)).toEqual(["zorvex"]);
    expect(underscored.coreCompact).toBe("zorvex");
    expect(underscored.weakTokens.map((t) => t.normalized)).toContain("drinks");
  });

  it("folds NFKC/special Latin inside tokens", () => {
    expect(tokenizeMark("Weißbier").significantTokens[0]?.normalized).toBe("weissbier");
    expect(tokenizeMark("ﬁle").significantTokens[0]?.normalized).toBe("file");
  });

  it("expands compatibility symbols before edge trim (㎾h)", () => {
    const result = tokenizeMark("㎾h");
    expect(result.significantTokens.map((t) => t.normalized)).toEqual(["kwh"]);
    expect(result.coreCompact).toBe("kwh");
  });

  it("treats category leftovers as weak so sole-significant cores empty", () => {
    const business = tokenizeMark("INTERNATIONAL BUSINESS");
    expect(business.analysisFlags.coreEmpty).toBe(true);
    expect(business.coreCompact).toBe("");

    const coffee = tokenizeMark("PREMIUM COFFEE");
    expect(coffee.analysisFlags.coreEmpty).toBe(true);

    const brand = tokenizeMark("THE BRAND");
    expect(brand.analysisFlags.coreEmpty).toBe(true);
  });

  it("treats possessive pronouns as function words after weak category strip", () => {
    const myBrand = tokenizeMark("MY BRAND");
    expect(myBrand.tokens.find((t) => t.normalized === "my")?.role).toBe("function_word");
    expect(myBrand.analysisFlags.coreEmpty).toBe(true);

    const ourCoffee = tokenizeMark("OUR COFFEE");
    expect(ourCoffee.tokens.find((t) => t.normalized === "our")?.role).toBe("function_word");
    expect(ourCoffee.analysisFlags.coreEmpty).toBe(true);
  });

  it("treats demonstratives as function words and keeps distinctive stems", () => {
    const thisBrand = tokenizeMark("THIS BRAND");
    expect(thisBrand.tokens.find((t) => t.normalized === "this")?.role).toBe("function_word");
    expect(thisBrand.analysisFlags.coreEmpty).toBe(true);

    const thisZorvex = tokenizeMark("THIS ZORVEX");
    expect(thisZorvex.significantTokens.map((t) => t.normalized)).toEqual(["zorvex"]);
    expect(thisZorvex.coreCompact).toBe("zorvex");
  });

  it("strips corporate fluff so distinctive cores remain sole significant", () => {
    const partners = tokenizeMark("ZORVEC Partners");
    expect(partners.significantTokens.map((t) => t.normalized)).toEqual(["zorvec"]);
    expect(partners.coreCompact).toBe("zorvec");
    expect(partners.weakTokens.map((t) => t.normalized)).toContain("partners");

    const trading = tokenizeMark("ZORVEX Trading Company");
    expect(trading.significantTokens.map((t) => t.normalized)).toEqual(["zorvex"]);
    expect(trading.coreCompact).toBe("zorvex");
  });
});
