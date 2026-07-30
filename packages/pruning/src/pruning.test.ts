import { describe, expect, it } from "vitest";
import { stage1Prune } from "./stage1-prune.js";

describe("stage1Prune", () => {
  it("keeps short phonetic candidate when core token also hits", () => {
    const [decision] = stage1Prune([
      {
        id: "senzo",
        features: {
          exactMatch: false,
          phoneticKeyMatch: true,
          transliterationExact: false,
          trigramDice: 0.05,
          prefixScore: 0.8,
          suffixScore: 0.2,
          missingData: false,
          coreTokenHit: true,
        },
        retrievalFamilies: ["phonetic"],
        lengths: { proposed: 5, candidate: 5 },
      },
    ]);

    expect(decision?.decision).not.toBe("discard");
    expect(decision?.reasons).toContain("protect:phonetic_key");
    expect(decision?.reasons).toContain("protect:core_token");
  });

  it("does not auto-protect phonetic-only without core or exact", () => {
    const [decision] = stage1Prune([
      {
        id: "servex-phonetic-only",
        features: {
          exactMatch: false,
          phoneticKeyMatch: true,
          transliterationExact: false,
          trigramDice: 0.05,
          prefixScore: 0.1,
          suffixScore: 0.1,
          missingData: false,
          coreTokenHit: false,
        },
        retrievalFamilies: ["phonetic"],
        lengths: { proposed: 7, candidate: 7 },
      },
    ]);

    expect(decision?.reasons).toContain("weak:phonetic_only");
    expect(decision?.reasons).not.toContain("protect:phonetic_key");
    expect(decision?.decision).toBe("discard");
  });

  it("keeps exact protected candidates", () => {
    const [decision] = stage1Prune([
      {
        id: "zenzo-exact",
        features: {
          exactMatch: true,
          phoneticKeyMatch: true,
          transliterationExact: true,
          trigramDice: 1,
          prefixScore: 1,
          suffixScore: 1,
          missingData: false,
        },
        retrievalFamilies: ["exact_forms"],
        lengths: { proposed: 5, candidate: 5 },
      },
    ]);

    expect(decision?.decision).toBe("keep");
    expect(decision?.reasons).toContain("protect:exact_match");
  });

  it("promotes multi-family candidates", () => {
    const [decision] = stage1Prune([
      {
        id: "multi",
        features: {
          exactMatch: false,
          phoneticKeyMatch: false,
          transliterationExact: false,
          trigramDice: 0.4,
          prefixScore: 0.5,
          suffixScore: 0.5,
          missingData: false,
        },
        retrievalFamilies: ["trigram", "phonetic"],
        lengths: { proposed: 6, candidate: 6 },
      },
    ]);

    expect(decision?.decision).toBe("promote");
    expect(decision?.reasons).toContain("protect:multi_family");
  });

  it("discards short length-ratio mismatches unless compact exact", () => {
    const [r2] = stage1Prune([
      {
        id: "r2",
        features: {
          exactMatch: false,
          phoneticKeyMatch: false,
          transliterationExact: false,
          trigramDice: 0.5,
          prefixScore: 0.5,
          suffixScore: 0,
          missingData: false,
          coreTokenHit: true,
        },
        retrievalFamilies: ["trigram"],
        lengths: { proposed: 4, candidate: 2 },
      },
    ]);
    expect(r2?.decision).toBe("discard");
    expect(r2?.reasons).toContain("weak:length_ratio");

    const [exactShort] = stage1Prune([
      {
        id: "exact-short",
        features: {
          exactMatch: true,
          phoneticKeyMatch: false,
          transliterationExact: false,
          trigramDice: 1,
          prefixScore: 1,
          suffixScore: 1,
          missingData: false,
        },
        retrievalFamilies: ["exact_forms"],
        lengths: { proposed: 4, candidate: 2 },
      },
    ]);
    expect(exactShort?.decision).toBe("keep");
  });

  it("keeps near-core Soft Drinks length pairs (candidate longer than shortMark)", () => {
    const [zorvec] = stage1Prune([
      {
        id: "zorvec",
        features: {
          exactMatch: false,
          phoneticKeyMatch: true,
          transliterationExact: false,
          trigramDice: 0.4,
          prefixScore: 0.83,
          suffixScore: 0,
          missingData: false,
          coreTokenHit: false,
        },
        retrievalFamilies: ["trigram"],
        lengths: { proposed: 16, candidate: 6 },
      },
    ]);
    expect(zorvec?.decision).not.toBe("discard");
  });
});
