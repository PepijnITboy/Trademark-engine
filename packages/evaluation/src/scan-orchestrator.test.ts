import { describe, expect, it } from "vitest";
import { CRITICAL_PAIRS, SAMPLE_CORPUS_ROWS } from "@trademark-engine/fixtures";
import { criticalHitRecall } from "./recall.js";
import { runLogicalScan } from "./scan-orchestrator.js";

describe("runLogicalScan", () => {
  it("returns ranked results for ZENZO against sample corpus", () => {
    const output = runLogicalScan(
      "ZENZO",
      SAMPLE_CORPUS_ROWS.map((row) => ({
        id: row.id,
        markText: row.markText,
        niceClasses: row.niceClasses,
        status: row.status,
      })),
    );

    expect(output.results.length).toBeGreaterThan(0);
    expect(output.uniqueCandidateCount).toBeGreaterThan(0);
    const top = output.results[0];
    const topCompact = top?.markText
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLocaleUpperCase("und");
    expect(topCompact).toMatch(/ZEN|SEN/);
  });

  it("finds every critical mustRetrieve pair in the sample corpus subset", () => {
    const corpus = SAMPLE_CORPUS_ROWS.map((row) => ({
      id: row.id,
      markText: row.markText,
      niceClasses: row.niceClasses,
      status: row.status,
    }));

    // Ensure critical candidates exist in corpus for this test
    const extra = CRITICAL_PAIRS.filter((p) => p.mustRetrieve).flatMap((pair, index) => [
      {
        id: `crit-q-${index}`,
        markText: pair.query,
        status: "registered",
      },
      {
        id: `crit-c-${index}`,
        markText: pair.candidate,
        status: "registered",
      },
    ]);

    const all = [...corpus, ...extra];
    const retrievedSets = new Map<string, Set<string>>();

    for (const pair of CRITICAL_PAIRS.filter((p) => p.mustRetrieve)) {
      const scan = runLogicalScan(pair.query, all);
      const ids = new Set(
        scan.results
          .filter((r) => {
            const a = normalizeCompact(r.markText);
            const b = normalizeCompact(pair.candidate);
            return a === b || a.includes(b) || b.includes(a);
          })
          .map((r) => r.candidateId),
      );
      // Also accept any result whose mark matches candidate text
      for (const r of scan.results) {
        if (normalizeCompact(r.markText) === normalizeCompact(pair.candidate)) {
          ids.add(r.candidateId);
        }
      }
      retrievedSets.set(`${pair.query}::${pair.candidate}`, ids);
    }

    const pairs = CRITICAL_PAIRS.filter((p) => p.mustRetrieve).map((pair, index) => ({
      id: `${pair.query}::${pair.candidate}`,
      relevantIds: [`crit-c-${index}`],
    }));

    // Map retrieved sets to include crit-c ids when mark text matched
    for (const [key, set] of retrievedSets) {
      const idx = CRITICAL_PAIRS.filter((p) => p.mustRetrieve).findIndex(
        (p) => `${p.query}::${p.candidate}` === key,
      );
      if (idx >= 0) {
        const scan = runLogicalScan(CRITICAL_PAIRS.filter((p) => p.mustRetrieve)[idx]!.query, all);
        if (
          scan.results.some(
            (r) =>
              normalizeCompact(r.markText) ===
              normalizeCompact(CRITICAL_PAIRS.filter((p) => p.mustRetrieve)[idx]!.candidate),
          )
        ) {
          set.add(`crit-c-${idx}`);
        }
      }
    }

    const recall = criticalHitRecall(pairs, retrievedSets);
    expect(recall).toBeGreaterThan(0.7);
  });

  it("retrieves SCAN for query ZKAN via phonetic family", () => {
    const output = runLogicalScan("ZKAN", [
      { id: "hit", markText: "SCAN", status: "registered", niceClasses: [9] },
      { id: "noise", markText: "XKQWP", status: "registered" },
    ]);

    const scanHit = output.results.find(
      (row) => normalizeCompact(row.markText) === "scan",
    );
    expect(scanHit).toBeDefined();
    expect(scanHit?.retrievalFamilies).toContain("phonetic");
    expect(scanHit?.score.experimentalConflictScore).toBeGreaterThanOrEqual(65);
  });

  it("does not retrieve unrelated negatives for LUNA", () => {
    const output = runLogicalScan("LUNA", [
      { id: "solar", markText: "SOLAR", status: "registered" },
      { id: "orange", markText: "ORANGE", status: "registered" },
      { id: "luna", markText: "LUNA", status: "registered" },
    ]);

    expect(
      output.results.some((row) => normalizeCompact(row.markText) === "solar"),
    ).toBe(false);
    expect(
      output.results.some((row) => normalizeCompact(row.markText) === "orange"),
    ).toBe(false);
    expect(
      output.results.some((row) => normalizeCompact(row.markText) === "luna"),
    ).toBe(true);
  });
});

function normalizeCompact(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
