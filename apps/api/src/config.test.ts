import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./config.js";

describe("loadApiConfig attorney analysis", () => {
  it("defaults attorney analysis to disabled (cheap local/dev)", () => {
    const config = loadApiConfig({ PORT: "3000", LOG_LEVEL: "silent" });
    expect(config.attorneyAnalysisEnabled).toBe(false);
    expect(config.anthropicModel).toBe("claude-sonnet-4-6");
    expect(config.attorneyAnalysisCandidateLimit).toBe(1000);
    expect(config.attorneyAnalysisTopN).toBe(10);
    expect(config.attorneyAnalysisTemperature).toBe(0);
    expect(config.anthropicApiKey).toBeUndefined();
  });

  it("enables attorney analysis when ATTORNEY_ANALYSIS_ENABLED=1", () => {
    const config = loadApiConfig({
      PORT: "3000",
      LOG_LEVEL: "silent",
      ATTORNEY_ANALYSIS_ENABLED: "1",
    });
    expect(config.attorneyAnalysisEnabled).toBe(true);
  });

  it("reads anthropic env vars", () => {
    const config = loadApiConfig({
      PORT: "3000",
      LOG_LEVEL: "silent",
      ANTHROPIC_API_KEY: "sk-test",
      ANTHROPIC_MODEL: "claude-custom",
      ATTORNEY_ANALYSIS_ENABLED: "0",
      ATTORNEY_ANALYSIS_CANDIDATE_LIMIT: "500",
      ATTORNEY_ANALYSIS_TOP_N: "3",
      ATTORNEY_ANALYSIS_TEMPERATURE: "0",
    });

    expect(config.anthropicApiKey).toBe("sk-test");
    expect(config.anthropicModel).toBe("claude-custom");
    expect(config.attorneyAnalysisEnabled).toBe(false);
    expect(config.attorneyAnalysisCandidateLimit).toBe(500);
    expect(config.attorneyAnalysisTopN).toBe(3);
  });
});
