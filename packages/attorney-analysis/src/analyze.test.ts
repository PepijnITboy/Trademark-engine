import { describe, expect, it, vi } from "vitest";
import { analyzeTrademarkRisks } from "./analyze.js";
import { buildSystemPrompt, buildUserPromptFromEngine } from "./prompts.js";
import { makeCandidate, validModelJson } from "./test-helpers.js";
import type { AttorneyAnalysisClient, AttorneyCompletionRequest } from "./types.js";

describe("analyzeTrademarkRisks", () => {
  it("sends identical deterministic requests for the same input", async () => {
    const requests: AttorneyCompletionRequest[] = [];
    const client: AttorneyAnalysisClient = {
      async complete(request) {
        requests.push(request);
        return validModelJson("c1", "ZENZO");
      },
    };

    const candidates = [makeCandidate({ candidateId: "c1", markText: "ZENZO" })];
    const base = {
      proposed: { markText: "ZENZO", selectedNiceClasses: [32] as const },
      candidates,
      model: "claude-sonnet-4-6",
      temperature: 0,
      topN: 5,
      client,
    };

    await analyzeTrademarkRisks(base);
    await analyzeTrademarkRisks(base);

    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual(requests[1]);
    expect(requests[0]?.temperature).toBe(0);
    expect(requests[0]?.system).toBe(buildSystemPrompt());
    expect(requests[0]?.messages[0]?.content).toBe(
      buildUserPromptFromEngine({
        proposed: base.proposed,
        engineCandidates: candidates,
        topN: 5,
      }),
    );
  });

  it("returns structured top risks from a valid model response", async () => {
    const client: AttorneyAnalysisClient = {
      async complete() {
        return validModelJson("c1", "ZENZO");
      },
    };

    const result = await analyzeTrademarkRisks({
      proposed: { markText: "ZENZO" },
      candidates: [makeCandidate({ candidateId: "c1", markText: "ZENZO" })],
      model: "claude-test",
      client,
    });

    expect(result.status).toBe("completed");
    expect(result.candidatesConsidered).toBe(1);
    expect(result.topRisks).toHaveLength(1);
    expect(result.topRisks[0]?.riskLevel).toBe("hoog");
    expect(result.topRisks[0]?.dimensions.auditief.score).toBe("sterk");
    expect(result.overallAdvice?.aanbeveling).toBe("nader_onderzoek");
  });

  it("handles fewer than five candidates", async () => {
    const client: AttorneyAnalysisClient = {
      async complete() {
        return validModelJson("c2", "SENZO");
      },
    };

    const result = await analyzeTrademarkRisks({
      proposed: { markText: "ZENZO" },
      candidates: [
        makeCandidate({ candidateId: "c1", markText: "A" }),
        makeCandidate({ candidateId: "c2", markText: "SENZO" }),
      ],
      topN: 5,
      model: "claude-test",
      client,
    });

    expect(result.status).toBe("completed");
    expect(result.candidatesConsidered).toBe(2);
    expect(result.topRisks.length).toBeLessThanOrEqual(2);
  });

  it("returns completed empty analysis when there are no candidates", async () => {
    const complete = vi.fn();
    const result = await analyzeTrademarkRisks({
      proposed: { markText: "ZENZO" },
      candidates: [],
      model: "claude-test",
      client: { complete },
    });

    expect(complete).not.toHaveBeenCalled();
    expect(result.status).toBe("completed");
    expect(result.topRisks).toEqual([]);
    expect(result.overallAdvice?.aanbeveling).toBe("laag_risico");
  });

  it("retries once on schema failure then succeeds", async () => {
    let calls = 0;
    const client: AttorneyAnalysisClient = {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return "not-json";
        }
        return validModelJson("c1", "ZENZO");
      },
    };

    const result = await analyzeTrademarkRisks({
      proposed: { markText: "ZENZO" },
      candidates: [makeCandidate({ candidateId: "c1", markText: "ZENZO" })],
      model: "claude-test",
      client,
    });

    expect(calls).toBe(2);
    expect(result.status).toBe("completed");
    expect(result.topRisks).toHaveLength(1);
  });

  it("fails after retry still invalid", async () => {
    const client: AttorneyAnalysisClient = {
      async complete() {
        return "still-not-json";
      },
    };

    const result = await analyzeTrademarkRisks({
      proposed: { markText: "ZENZO" },
      candidates: [makeCandidate({ candidateId: "c1", markText: "ZENZO" })],
      model: "claude-test",
      client,
    });

    expect(result.status).toBe("failed");
    expect(result.topRisks).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});
