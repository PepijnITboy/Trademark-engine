import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  filterToKnownCandidates,
  parseAttorneyModelResponse,
} from "./parse.js";
import { validModelJson } from "./test-helpers.js";

describe("parseAttorneyModelResponse", () => {
  it("parses bare JSON", () => {
    const parsed = parseAttorneyModelResponse(validModelJson());
    expect(parsed.topRisks[0]?.candidateId).toBe("c1");
    expect(parsed.overallAdvice.aanbeveling).toBe("nader_onderzoek");
  });

  it("extracts JSON from fenced markdown", () => {
    const raw = `Here you go:\n\`\`\`json\n${validModelJson()}\n\`\`\`\n`;
    expect(parseAttorneyModelResponse(raw).topRisks).toHaveLength(1);
  });

  it("rejects free-form text without JSON", () => {
    expect(() => extractJsonObject("geen json hier")).toThrow(/JSON object/);
  });

  it("truncates overlong summaries instead of failing the whole analysis", () => {
    const longSummary =
      "Hoog risico: " + "x".repeat(200);
    expect(longSummary.length).toBeGreaterThan(160);

    const payload = JSON.parse(validModelJson()) as {
      topRisks: Array<{ summary: string }>;
    };
    payload.topRisks[0]!.summary = longSummary;

    const parsed = parseAttorneyModelResponse(JSON.stringify(payload));
    expect(parsed.topRisks[0]!.summary.length).toBeLessThanOrEqual(160);
    expect(parsed.topRisks[0]!.summary.startsWith("Hoog risico:")).toBe(true);
  });

  it("detects truncated JSON that fails to parse", () => {
    // Brace-balanced but syntactically broken (truncated mid-object).
    const truncated =
      '{"overallAdvice": {"text": "Er is risico", "aanbeveling": "nader_onderzoek"}, "topRisks": [{"rank": 1, "markText": "ZEN}';
    expect(() => parseAttorneyModelResponse(truncated)).toThrow(
      /truncated|JSON parse failed/i,
    );
  });
});

describe("filterToKnownCandidates", () => {
  it("drops unknown ids and re-ranks", () => {
    const parsed = parseAttorneyModelResponse(validModelJson("unknown", "X"));
    const filtered = filterToKnownCandidates(parsed, new Set(["c1"]), 5);
    expect(filtered.topRisks).toEqual([]);
  });

  it("keeps known ids", () => {
    const parsed = parseAttorneyModelResponse(validModelJson("c1", "ZENZO"));
    const filtered = filterToKnownCandidates(parsed, new Set(["c1"]), 5);
    expect(filtered.topRisks[0]?.rank).toBe(1);
  });
});
