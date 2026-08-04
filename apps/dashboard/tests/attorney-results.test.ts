import { describe, expect, it } from "vitest";
import {
  formatAanbeveling,
  formatDimensionLabel,
  formatDimensionScore,
  formatNiceClasses,
  formatRiskLevel,
  sortRisksByRank,
} from "../src/components/scan-results/formatters";
import { buildAttorneyCopyText } from "../src/components/scan-results/copy";

describe("attorney result formatters", () => {
  it("formats aanbeveling to Dutch labels", () => {
    expect(formatAanbeveling("indienen_risicovol")).toBe("Indienen — risicovol");
    expect(formatAanbeveling("laag_risico")).toBe("Laag risico");
    expect(formatAanbeveling(undefined)).toBe("Geen aanbeveling");
  });

  it("formats risk levels", () => {
    expect(formatRiskLevel("hoog")).toBe("Hoog");
    expect(formatRiskLevel("middel")).toBe("Middel");
    expect(formatRiskLevel("laag")).toBe("Laag");
  });

  it("formats dimension scores and labels", () => {
    expect(formatDimensionScore("sterk")).toBe("Sterk");
    expect(formatDimensionLabel("warenDiensten")).toBe("Waren & diensten");
  });

  it("formats nice classes", () => {
    expect(formatNiceClasses([32, 33])).toBe("32, 33");
    expect(formatNiceClasses([])).toBe("—");
  });

  it("sorts risks by rank", () => {
    const sorted = sortRisksByRank([
      { rank: 3, markText: "C" },
      { rank: 1, markText: "A" },
      { rank: 2, markText: "B" },
    ]);
    expect(sorted.map((item) => item.markText)).toEqual(["A", "B", "C"]);
  });
});

describe("buildAttorneyCopyText", () => {
  it("includes verdict and risks without engine dump", () => {
    const text = buildAttorneyCopyText({
      scanId: "abc",
      sections: [
        {
          markText: "ZENZO",
          attorney: {
            status: "completed",
            candidatesConsidered: 120,
            overallAdvice: "Hoog risico op verwarring.",
            aanbeveling: "indienen_risicovol",
            topRisks: [
              {
                rank: 1,
                candidateId: "c1",
                markText: "SENZO",
                engineScore: 88,
                riskLevel: "hoog",
                summary: "Hoog risico: nabij merk.",
                confusionRisk: "Verwarringsgevaar aanwezig.",
                whySelected: "Hoge score + klasse-overlap.",
                dimensions: {
                  visueel: { score: "sterk", toelichting: "Visueel dichtbij." },
                  auditief: { score: "matig", toelichting: "Klinkt vergelijkbaar." },
                  conceptueel: { score: "zwak", toelichting: "Beperkt conceptueel." },
                  warenDiensten: { score: "sterk", toelichting: "Zelfde klasse." },
                },
              },
            ],
          },
          niceByCandidateId: { c1: [32] },
        },
      ],
    });

    expect(text).toContain("ZENZO");
    expect(text).toContain("Indienen — risicovol");
    expect(text).toContain("SENZO");
    expect(text).toContain("Nice 32");
    expect(text).not.toMatch(/engine candidates/i);
    expect(text).not.toMatch(/experimentalConflictScore/);
  });

  it("describes skipped attorney without inventing risks", () => {
    const text = buildAttorneyCopyText({
      scanId: "abc",
      sections: [
        {
          markText: "ZENZO",
          attorney: {
            status: "skipped",
            candidatesConsidered: 0,
            topRisks: [],
            error: "Attorney analysis disabled",
          },
          niceByCandidateId: {},
        },
      ],
    });

    expect(text).toContain("Geen attorney-analyse");
    expect(text).not.toMatch(/^1\./m);
  });
});
