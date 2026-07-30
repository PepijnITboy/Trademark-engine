import { describe, expect, it } from "vitest";
import { explainFromEvidence, knownEvidenceCodes } from "./explain.js";

describe("explainFromEvidence", () => {
  it("maps exact_normalized to a known sentence", () => {
    const sentences = explainFromEvidence(["exact_normalized"], {
      proposedMark: "ZENZO",
      candidateMark: "ZENZO",
    });

    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain("ZENZO");
    expect(sentences[0]?.toLowerCase()).toContain("normal");
  });

  it("does not emit free-form legal conclusions", () => {
    const sentences = explainFromEvidence(knownEvidenceCodes(), {
      proposedMark: "A",
      candidateMark: "B",
    });

    for (const sentence of sentences) {
      expect(sentence.toLowerCase()).not.toMatch(/infringement|conflict of law|likelihood/);
    }
  });
});
