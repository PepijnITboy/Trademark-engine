import { describe, expect, it } from "vitest";
import { toCompactCandidate } from "./candidates.js";
import {
  PROMPT_VERSION,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompts.js";
import { makeCandidate } from "./test-helpers.js";

describe("prompt builders", () => {
  it("system prompt is bit-stable and versioned", () => {
    const a = buildSystemPrompt();
    const b = buildSystemPrompt();
    expect(a).toBe(b);
    expect(a).toContain(`PROMPT_VERSION=${PROMPT_VERSION}`);
    expect(a).toContain("verwarringsgevaar");
    expect(a).toContain("Hoog risico:");
  });

  it("user prompt is bit-stable for the same input", () => {
    const candidates = [
      toCompactCandidate(makeCandidate({ candidateId: "c1", markText: "ZENZO" })),
    ];
    const input = {
      proposed: {
        markText: "ZENZO",
        selectedNiceClasses: [32],
        goodsServices: ["bier"],
      },
      candidates,
      topN: 5,
    };

    expect(buildUserPrompt(input)).toBe(buildUserPrompt(input));
    expect(buildUserPrompt(input)).toContain("VOORGESTELD_MERK");
    expect(buildUserPrompt(input)).toContain("KANDIDATEN");
    expect(buildUserPrompt(input)).toContain("TOP_N=5");
    expect(buildUserPrompt(input)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
