import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOP_N,
  selectTopCandidates,
  serializeCompactCandidates,
  toCompactCandidate,
} from "./candidates.js";
import { makeCandidate } from "./test-helpers.js";

describe("DEFAULT_TOP_N", () => {
  it("defaults to 10 attorney risks", () => {
    expect(DEFAULT_TOP_N).toBe(10);
  });
});

describe("selectTopCandidates", () => {
  it("returns up to the limit in original order", () => {
    const results = [
      makeCandidate({ candidateId: "a", markText: "A" }),
      makeCandidate({ candidateId: "b", markText: "B" }),
      makeCandidate({ candidateId: "c", markText: "C" }),
    ];
    expect(selectTopCandidates(results, 2).map((r) => r.candidateId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns all when fewer than limit", () => {
    const results = [makeCandidate({ candidateId: "a", markText: "A" })];
    expect(selectTopCandidates(results, 1000)).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    expect(selectTopCandidates([], 1000)).toEqual([]);
  });
});

describe("toCompactCandidate / serializeCompactCandidates", () => {
  it("maps a stable compact shape", () => {
    const compact = toCompactCandidate(
      makeCandidate({
        candidateId: "c1",
        markText: "ZENZO",
        evidenceCodes: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        explanations: ["one", "two", "three"],
      }),
    );

    expect(compact.evidenceCodes).toHaveLength(8);
    expect(compact.explanations).toEqual(["one", "two"]);
    expect(compact.features.niceClassSupport).toBe("overlap");
  });

  it("serializes with identical bytes for the same input", () => {
    const candidates = [
      toCompactCandidate(makeCandidate({ candidateId: "c1", markText: "ZENZO" })),
      toCompactCandidate(makeCandidate({ candidateId: "c2", markText: "SENZO" })),
    ];

    expect(serializeCompactCandidates(candidates)).toBe(
      serializeCompactCandidates(candidates),
    );
    expect(serializeCompactCandidates(candidates)).toContain('"candidateId":"c1"');
    expect(serializeCompactCandidates(candidates).indexOf("c1")).toBeLessThan(
      serializeCompactCandidates(candidates).indexOf("c2"),
    );
  });
});
